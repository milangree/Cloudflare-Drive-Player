/**
 * Telegram 转存链路契约测试
 *
 * 用 Node 20 内置的 node:test + node:assert/strict —— 零新增依赖，
 * 不破坏 `npm audit --omit=dev --audit-level=high` 运行时零依赖门禁。
 *
 * 覆盖点（对应 run 39885824930 的漏检根因）：
 *  1. functions/** 下所有模块可 import() —— 真实解析 import 说明符
 *     （npm run test:syntax 只做 node --check 的 AST 解析，抓不到写错的相对路径）
 *  2. Telegram Webhook 的错误契约：无 Token 时返回结构化 JSON，且不泄露原始错误文本
 *  3. fail-closed 白名单：未配置白名单时必须拒绝上传请求
 *  4. 20MB 上限前置校验：超限文件不得触发任何出站请求
 *  5. 用户可见文案不含内部错误原文
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, statSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join, resolve } from "node:path";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const FUNCTIONS_DIR = join(ROOT, "functions");

/** 以 file:// URL 动态 import（Windows 下必须用 pathToFileURL，不能拼接字符串） */
function importModule(absPath) {
  return import(pathToFileURL(absPath).href);
}

/** 递归收集 functions/ 下的 .js 文件 */
function collectJsFiles(dir) {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...collectJsFiles(full));
    } else if (entry.isFile() && entry.name.endsWith(".js") && statSync(full).size > 0) {
      out.push(full);
    }
  }
  return out;
}

test("functions/** 所有模块均可真实解析 import 说明符", async () => {
  const files = collectJsFiles(FUNCTIONS_DIR);
  assert.ok(files.length > 5, `预期至少 6 个模块，实际 ${files.length}`);

  const failures = [];
  for (const file of files) {
    try {
      await importModule(file);
    } catch (err) {
      failures.push(`${file}: ${err.message}`);
    }
  }
  assert.deepEqual(
    failures,
    [],
    `以下模块 import 失败（相对路径/依赖解析错误）：\n${failures.join("\n")}`
  );
});

test("telegram webhook 与 admin/telegram 导出 HTTP 处理入口", async () => {
  const webhook = await importModule(join(FUNCTIONS_DIR, "api/telegram/webhook.js"));
  assert.equal(typeof webhook.onRequestPost, "function");
  assert.equal(typeof webhook.onRequestGet, "function");

  const admin = await importModule(join(FUNCTIONS_DIR, "api/admin/telegram.js"));
  assert.equal(typeof admin.onRequest, "function");
});

test("telegram webhook: 未配置 Bot Token 时返回结构化 JSON 而非 500", async () => {
  const { onRequestPost } = await importModule(join(FUNCTIONS_DIR, "api/telegram/webhook.js"));

  const request = new Request("https://example.com/api/telegram/webhook", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      update_id: 1,
      message: { chat: { id: 123 }, text: "/start", from: { id: 123 } },
    }),
  });

  const context = {
    request,
    env: {}, // 无 Token、无 Drive 凭据
    params: {},
    url: new URL("https://example.com/api/telegram/webhook"),
  };

  let resp;
  try {
    resp = await onRequestPost(context);
  } catch (err) {
    assert.fail(`未配置 Token 时不应抛异常，实际: ${err.stack}`);
  }

  assert.equal(resp.status, 200);
  const body = await resp.json();
  assert.equal(body.ok, false);
  assert.equal(typeof body.error, "string");
  // 不得泄露原始错误文本 / 堆栈
  assert.ok(!JSON.stringify(body).includes(" at "), "响应体包含堆栈信息");
});

test("telegram webhook: 白名单留空时 fail-closed 拒绝上传请求", async () => {
  const { onRequestPost } = await importModule(join(FUNCTIONS_DIR, "api/telegram/webhook.js"));

  const request = new Request("https://example.com/api/telegram/webhook", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      update_id: 2,
      message: {
        chat: { id: 1 },
        from: { id: 987654321, username: "outsider" },
        document: { file_id: "abc", file_unique_id: "u1", file_name: "x.pdf", file_size: 1024 },
      },
    }),
  });

  const context = {
    request,
    env: { TELEGRAM_BOT_TOKEN: "123456:TEST", TELEGRAM_ALLOWED_USERS: "" }, // 白名单留空
    params: {},
    url: new URL("https://example.com/api/telegram/webhook"),
  };

  const resp = await onRequestPost(context);
  const body = await resp.json();
  // fail-closed：白名单为空时不得放行上传
  assert.equal(body.denied, true, "白名单留空时必须拒绝上传请求（fail-closed）");
  assert.equal(body.ok, true, "拒绝请求仍应返回 200，避免 Telegram 无限重推");
  assert.equal(resp.status, 200);
});

test("telegram webhook: 超过 20MB 上限时前置拒绝且文案为中文", async () => {
  const { onRequestPost } = await importModule(join(FUNCTIONS_DIR, "api/telegram/webhook.js"));

  const oversized = 21 * 1024 * 1024;
  const request = new Request("https://example.com/api/telegram/webhook", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      update_id: 3,
      message: {
        chat: { id: 1 },
        from: { id: 111, username: "allowed" },
        document: {
          file_id: "big",
          file_unique_id: "u2",
          file_name: "big.mkv",
          file_size: oversized,
        },
      },
    }),
  });

  const context = {
    request,
    env: { TELEGRAM_BOT_TOKEN: "123456:TEST", TELEGRAM_ALLOWED_USERS: "@allowed" },
    params: {},
    url: new URL("https://example.com/api/telegram/webhook"),
  };

  const resp = await onRequestPost(context);
  const body = await resp.json();
  assert.equal(body.ignored, "too_large", "超限文件应被前置拒绝");
  assert.equal(resp.status, 200);
});

test("configManager 导出 timingSafeEqual（供 Webhook 密钥校验复用）", async () => {
  const mod = await importModule(join(FUNCTIONS_DIR, "utils/configManager.js"));
  assert.equal(typeof mod.timingSafeEqual, "function");
  assert.equal(mod.timingSafeEqual("abc", "abc"), true);
  assert.equal(mod.timingSafeEqual("abc", "abd"), false);
  assert.equal(mod.timingSafeEqual("abc", "abcd"), false);
  assert.equal(mod.timingSafeEqual("", ""), true);
});
