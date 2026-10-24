import { getSystemConfig, verifyAdminToken } from "../../utils/configManager.js";

/**
 * Telegram Bot Webhook 自动化管理端点
 * 允许在管理员后台一键自动注册、查询、测试、移除 Telegram Webhook
 *
 * GET                        查询 Webhook 状态（归一化，供后台与 healthcheck 共用契约）
 * POST {action:"register"}   注册/绑定当前站点的 Webhook（携带 secret_token）
 * POST {action:"test"}       只读探测：调用 getMe 验证 Bot Token 有效性
 * POST {action:"test-upload"} 上传一个极小测试文件到目标目录后立即删除，验证整条转存链路
 * DELETE                     注销 Webhook
 */

const TG_TIMEOUT_MS = 15000;

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/** 归一化的 webhook 状态，后台 UI 与 healthcheck 共用同一契约 */
function normalizeWebhookStatus(tgResponse) {
  const result = (tgResponse && tgResponse.result) || {};
  return {
    webhookActive: Boolean(result.url),
    url: result.url || "",
    pendingUpdateCount: Number(result.pending_update_count || 0),
    lastErrorMessage: result.last_error_message || "",
    lastErrorDate: result.last_error_date || null,
    hasCustomCertificate: Boolean(result.has_custom_certificate),
    maxConnections: result.max_connections || null,
  };
}

export async function onRequest(context) {
  const { request, env } = context;

  // 1. 管理员鉴权
  const authHeader = request.headers.get("Authorization") || "";
  const token = authHeader.replace(/^Bearer\s+/i, "");
  const isAdmin = await verifyAdminToken(token, env);
  if (!isAdmin) {
    return json({ success: false, error: "未授权的管理员访问" }, 401);
  }

  const config = await getSystemConfig(env);
  const botToken = (config.tgBotToken || env.TELEGRAM_BOT_TOKEN || env.TG_BOT_TOKEN || "").trim();
  const webhookSecret = (env.TELEGRAM_WEBHOOK_SECRET || env.TG_WEBHOOK_SECRET || "").trim();

  if (!botToken) {
    return json({ success: false, error: "请先在上方设置并保存 Telegram Bot Token！" }, 400);
  }

  const tgApi = (method) => `https://api.telegram.org/bot${botToken}/${method}`;

  async function callTelegram(method, body) {
    const options = { method: "POST", signal: AbortSignal.timeout(TG_TIMEOUT_MS) };
    if (body !== undefined) {
      options.headers = { "Content-Type": "application/json" };
      options.body = JSON.stringify(body);
    }
    const res = await fetch(tgApi(method), options);
    const data = await res.json().catch(() => null);
    return { ok: res.ok, data };
  }

  // GET: 查询 Webhook 状态
  if (request.method === "GET") {
    try {
      const { ok, data } = await callTelegram("getWebhookInfo");
      if (!ok || !data || data.ok !== true) {
        return json(
          { success: false, error: (data && data.description) || "Telegram API 查询失败" },
          502
        );
      }
      return json({
        success: true,
        ...normalizeWebhookStatus(data),
        tgResponse: data,
      });
    } catch (err) {
      return json({ success: false, error: "无法连接 Telegram 服务器" }, 502);
    }
  }

  if (request.method === "POST") {
    let payload = {};
    try {
      payload = await request.json().catch(() => ({}));
    } catch (_) {}
    const action = payload.action || "register";

    // 只读探测：验证 Bot Token 是否有效
    if (action === "test") {
      try {
        const { ok, data } = await callTelegram("getMe");
        if (!ok || !data || data.ok !== true) {
          return json(
            { success: false, error: (data && data.description) || "Bot Token 无效或无法连接 Telegram" },
            502
          );
        }
        return json({
          success: true,
          botUsername: data.result.username,
          botFirstName: data.result.first_name,
          botId: data.result.id,
        });
      } catch (err) {
        return json({ success: false, error: "无法连接 Telegram 服务器" }, 502);
      }
    }

    // 链路自检：上传一个极小文件后立即删除，验证凭据/配额/目标目录写权限
    if (action === "test-upload") {
      const { getAccessToken, getCredentials } = await import("../../utils/googleAuth.js");
      try {
        const googleToken = await getAccessToken(env);
        const creds = getCredentials(env);
        const targetFolderId = config.tgUploadFolderId || creds.rootFolderId || "root";
        const probeName = `.tg-upload-probe-${Date.now()}.txt`;
        const content = `Cloudflare Drive Player Telegram upload probe @ ${new Date().toISOString()}`;

        const boundary = "-------CFDriveProbeBoundary" + Date.now();
        const delimiter = `\r\n--${boundary}\r\n`;
        const closeDelimiter = `\r\n--${boundary}--`;
        const encoder = new TextEncoder();
        const metadata = { name: probeName, mimeType: "text/plain", parents: [targetFolderId] };
        const head = encoder.encode(
          delimiter +
            "Content-Type: application/json; charset=UTF-8\r\n\r\n" +
            JSON.stringify(metadata) +
            delimiter +
            "Content-Type: text/plain\r\n\r\n"
        );
        const tail = encoder.encode(closeDelimiter + "\r\n");
        const body = new Uint8Array(head.byteLength + content.length + tail.byteLength);
        body.set(head, 0);
        body.set(encoder.encode(content), head.byteLength);
        body.set(tail, head.byteLength + content.length);

        const uploadRes = await fetch(
          "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true",
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${googleToken}`,
              "Content-Type": `multipart/related; boundary=${boundary}`,
            },
            body,
            signal: AbortSignal.timeout(30000),
          }
        );

        if (!uploadRes.ok) {
          const errText = await uploadRes.text().catch(() => "");
          if (/storageQuotaExceeded|Service Accounts do not have storage quota/.test(errText)) {
            return json(
              {
                success: false,
                error:
                  "Google Drive 存储配额不足。请将目标目录设为共享云端硬盘 (Shared Drive)，或授予服务账号对该目录的管理权限。",
              },
              502
            );
          }
          return json(
            { success: false, error: `测试上传失败: HTTP ${uploadRes.status}` },
            502
          );
        }

        const uploaded = await uploadRes.json().catch(() => null);
        if (!uploaded || !uploaded.id) {
          return json({ success: false, error: "测试上传未返回文件 ID" }, 502);
        }

        // 立即清理测试文件
        await fetch(
          `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(uploaded.id)}?supportsAllDrives=true`,
          {
            method: "DELETE",
            headers: { Authorization: `Bearer ${googleToken}` },
            signal: AbortSignal.timeout(15000),
          }
        ).catch(() => null);

        return json({ success: true, probeFileId: uploaded.id, targetFolderId });
      } catch (err) {
        return json({ success: false, error: "测试上传异常，请检查服务账号凭据" }, 502);
      }
    }

    // 注册/绑定当前站点的 Webhook
    if (action === "register") {
      try {
        const origin = new URL(request.url).origin;
        const webhookUrl = `${origin}/api/telegram/webhook`;

        const body = {
          url: webhookUrl,
          allowed_updates: ["message", "channel_post"],
          drop_pending_updates: Boolean(payload.dropPendingUpdates),
        };
        // 仅当配置了 secret 时才携带，避免未配置时把空串发给 Telegram
        if (webhookSecret) {
          body.secret_token = webhookSecret;
        }

        const { ok, data } = await callTelegram("setWebhook", body);
        if (!ok || !data || data.ok !== true) {
          return json(
            { success: false, error: (data && data.description) || "Telegram API 绑定 Webhook 失败" },
            502
          );
        }

        return json({
          success: true,
          message: "Telegram Webhook 自动注册成功！",
          webhookUrl,
          secretTokenConfigured: Boolean(webhookSecret),
          ...normalizeWebhookStatus(data),
          tgResponse: data,
        });
      } catch (err) {
        return json({ success: false, error: "无法连接 Telegram 服务器" }, 502);
      }
    }

    return json({ success: false, error: `未知操作: ${action}` }, 400);
  }

  // DELETE: 注销 Webhook
  if (request.method === "DELETE") {
    try {
      const { ok, data } = await callTelegram("deleteWebhook");
      if (!ok || !data || data.ok !== true) {
        return json(
          { success: false, error: (data && data.description) || "Telegram API 注销 Webhook 失败" },
          502
        );
      }
      return json({ success: true, message: "Webhook 已移除", tgResponse: data });
    } catch (err) {
      return json({ success: false, error: "无法连接 Telegram 服务器" }, 502);
    }
  }

  return new Response("Method not allowed", { status: 405 });
}
