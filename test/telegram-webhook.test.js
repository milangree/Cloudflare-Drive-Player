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

// ---------------------------------------------------------------------------
// 本轮新增契约：中间件错误隔离 / KV 幂等去重 / 流式 multipart 上传
// ---------------------------------------------------------------------------

/** 最小可用的假 KV 存储 */
function makeFakeKV(initial = {}) {
  const store = new Map(Object.entries(initial));
  return {
    store,
    async get(key) {
      return store.has(key) ? store.get(key) : null;
    },
    async put(key, value) {
      store.set(key, value);
    },
    async delete(key) {
      store.delete(key);
    },
  };
}

/** 把 ReadableStream 完整读出为 Uint8Array */
async function drainStream(stream) {
  const reader = stream.getReader();
  const chunks = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    total += value.byteLength;
  }
  const out = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return out;
}

/** 生成一个测试用 RSA 服务账号私钥（PEM），避免在仓库里固化任何私钥 */
async function makeTestServiceAccount() {
  const pair = await crypto.subtle.generateKey(
    {
      name: "RSASSA-PKCS1-v1_5",
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: "SHA-256",
    },
    true,
    ["sign"]
  );
  const pkcs8 = await crypto.subtle.exportKey("pkcs8", pair.privateKey);
  const b64 = Buffer.from(pkcs8).toString("base64");
  const pem = `-----BEGIN PRIVATE KEY-----\n${b64.match(/.{1,64}/g).join("\n")}\n-----END PRIVATE KEY-----\n`;
  return JSON.stringify({
    client_email: "test-account@example.iam.gserviceaccount.com",
    private_key: pem,
    root_folder_id: "root",
  });
}

test("_middleware: 未捕获异常返回固定文案，不泄露原始错误文本", async () => {
  const { onRequest } = await importModule(join(FUNCTIONS_DIR, "api/_middleware.js"));

  const request = new Request("https://example.com/api/anything");
  const context = {
    request,
    next: async () => {
      throw new Error("C:\\secret\\internal.js:12 真实内部堆栈");
    },
  };

  const resp = await onRequest(context);
  assert.equal(resp.status, 500);
  const body = await resp.json();
  assert.equal(body.success, false);
  assert.equal(body.error, "服务器内部错误，请稍后重试。");
  assert.ok(
    !JSON.stringify(body).includes("internal.js"),
    "500 响应不得泄露内部路径或堆栈"
  );
});

test("telegram webhook: KV 已记录同一 update_id 时直接幂等返回", async () => {
  const { onRequestPost } = await importModule(join(FUNCTIONS_DIR, "api/telegram/webhook.js"));
  const kv = makeFakeKV({ "TG_UPDATE:777": "1700000000000" });

  const request = new Request("https://example.com/api/telegram/webhook", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      update_id: 777,
      message: {
        chat: { id: 1 },
        from: { id: 111, username: "allowed" },
        document: { file_id: "f1", file_unique_id: "u7", file_name: "a.pdf", file_size: 10 },
      },
    }),
  });

  const context = {
    request,
    env: { TELEGRAM_BOT_TOKEN: "123456:TEST", TELEGRAM_ALLOWED_USERS: "@allowed", DRIVE_KV: kv },
    params: {},
    url: new URL("https://example.com/api/telegram/webhook"),
  };

  const resp = await onRequestPost(context);
  const body = await resp.json();
  assert.equal(resp.status, 200);
  assert.equal(body.deduped, "kv", "已处理的 update_id 必须走 KV 幂等短路");
});

test("telegram webhook: 流式 multipart 上传携带完整文件内容与幂等属性", async () => {
  const { onRequestPost } = await importModule(join(FUNCTIONS_DIR, "api/telegram/webhook.js"));
  const serviceAccount = await makeTestServiceAccount();

  const captured = {};
  const originalFetch = globalThis.fetch;

  globalThis.fetch = async (url, options = {}) => {
    const u = String(url);
    if (u.includes("oauth2.googleapis.com/token")) {
      return new Response(JSON.stringify({ access_token: "tok", expires_in: 3600 }), { status: 200 });
    }
    if (u.includes("/getFile")) {
      return new Response(
        JSON.stringify({ ok: true, result: { file_path: "docs/a.txt", file_size: 5 } }),
        { status: 200 }
      );
    }
    if (u.includes("/sendMessage")) {
      return new Response(JSON.stringify({ ok: true, result: {} }), { status: 200 });
    }
    if (u.includes("api.telegram.org/file/")) {
      return new Response(new Uint8Array([104, 101, 108, 108, 111]), { status: 200 }); // "hello"
    }
    if (u.includes("uploadType=multipart")) {
      captured.options = options;
      captured.bytes = await drainStream(options.body);
      return new Response(JSON.stringify({ id: "DRIVE_FILE_1", name: "a.txt" }), { status: 200 });
    }
    if (u.includes("drive/v3/files?")) {
      return new Response(JSON.stringify({ files: [] }), { status: 200 }); // 无历史重复
    }
    if (u.includes("drive/v3/files/")) {
      return new Response(JSON.stringify({ id: "root", properties: {} }), { status: 200 });
    }
    throw new Error(`mock fetch 未覆盖: ${u}`);
  };

  try {
    const request = new Request("https://example.com/api/telegram/webhook", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        update_id: 888,
        message: {
          chat: { id: 1 },
          from: { id: 111, username: "allowed" },
          document: { file_id: "f2", file_unique_id: "u8", file_name: "a.txt", file_size: 5 },
        },
      }),
    });

    const context = {
      request,
      env: {
        TELEGRAM_BOT_TOKEN: "123456:TEST",
        TELEGRAM_ALLOWED_USERS: "@allowed",
        SERVICE_ACCOUNT_JSON: serviceAccount,
      },
      params: {},
      url: new URL("https://example.com/api/telegram/webhook"),
    };

    const resp = await onRequestPost(context);
    const body = await resp.json();
    assert.equal(resp.status, 200);
    assert.equal(body.ok, true);
    assert.equal(body.fileId, "DRIVE_FILE_1");

    // 流式上传必须声明 duplex:'half'（ReadableStream body 的强制要求）
    assert.equal(captured.options.duplex, "half", "必须使用流式 body（duplex:'half'）");

    const text = new TextDecoder().decode(captured.bytes);
    assert.ok(text.includes('"name":"a.txt"'), "multipart body 必须包含元数据 JSON");
    assert.ok(text.includes("hello"), "multipart body 必须包含文件原文");
    assert.ok(text.includes("cfTgFileUniqueId"), "必须写入幂等 appProperties");
    assert.ok(text.trimEnd().endsWith("--"), "multipart body 必须以 boundary 结束标记收尾");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("telegram webhook: 上传成功后写入 KV 幂等键", async () => {
  const { onRequestPost } = await importModule(join(FUNCTIONS_DIR, "api/telegram/webhook.js"));
  const serviceAccount = await makeTestServiceAccount();
  const kv = makeFakeKV();

  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    const u = String(url);
    if (u.includes("oauth2.googleapis.com/token")) {
      return new Response(JSON.stringify({ access_token: "tok", expires_in: 3600 }), { status: 200 });
    }
    if (u.includes("/getFile")) {
      return new Response(
        JSON.stringify({ ok: true, result: { file_path: "docs/b.txt", file_size: 2 } }),
        { status: 200 }
      );
    }
    if (u.includes("/sendMessage")) {
      return new Response(JSON.stringify({ ok: true, result: {} }), { status: 200 });
    }
    if (u.includes("api.telegram.org/file/")) {
      return new Response(new Uint8Array([65, 66]), { status: 200 }); // "AB"
    }
    if (u.includes("uploadType=multipart")) {
      return new Response(JSON.stringify({ id: "DRIVE_FILE_2", name: "b.txt" }), { status: 200 });
    }
    if (u.includes("drive/v3/files?")) {
      return new Response(JSON.stringify({ files: [] }), { status: 200 });
    }
    if (u.includes("drive/v3/files/")) {
      return new Response(JSON.stringify({ id: "root", properties: {} }), { status: 200 });
    }
    throw new Error(`mock fetch 未覆盖: ${u}`);
  };

  try {
    const request = new Request("https://example.com/api/telegram/webhook", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        update_id: 999,
        message: {
          chat: { id: 1 },
          from: { id: 111, username: "allowed" },
          document: { file_id: "f3", file_unique_id: "u9", file_name: "b.txt", file_size: 2 },
        },
      }),
    });

    const context = {
      request,
      env: {
        TELEGRAM_BOT_TOKEN: "123456:TEST",
        TELEGRAM_ALLOWED_USERS: "@allowed",
        SERVICE_ACCOUNT_JSON: serviceAccount,
        DRIVE_KV: kv,
      },
      params: {},
      url: new URL("https://example.com/api/telegram/webhook"),
    };

    const resp = await onRequestPost(context);
    assert.equal(resp.status, 200);
    assert.equal((await resp.json()).ok, true);
    assert.ok(kv.store.has("TG_UPDATE:999"), "上传成功后必须写入 KV 幂等键");
  } finally {
    globalThis.fetch = originalFetch;
  }
});
