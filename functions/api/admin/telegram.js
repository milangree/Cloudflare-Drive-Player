import { getSystemConfig, verifyAdminToken } from "../../utils/configManager.js";

/**
 * Telegram Bot Webhook 自动化管理端点
 * 允许在管理员后台一键自动注册、查询、移除 Telegram Webhook
 */

export async function onRequest(context) {
  const { request, env } = context;

  // 1. 管理员鉴权
  const authHeader = request.headers.get("Authorization") || "";
  const token = authHeader.replace(/^Bearer\s+/i, "");
  const isAdmin = await verifyAdminToken(token, env);
  if (!isAdmin) {
    return new Response(JSON.stringify({ success: false, error: "未授权的管理员访问" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const config = await getSystemConfig(env);
  const botToken = (config.tgBotToken || env.TELEGRAM_BOT_TOKEN || env.TG_BOT_TOKEN || "").trim();

  if (!botToken) {
    return new Response(JSON.stringify({ success: false, error: "请先在上方设置并保存 Telegram Bot Token！" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // GET: 查询 Webhook 状态
  if (request.method === "GET") {
    try {
      const tgRes = await fetch(`https://api.telegram.org/bot${botToken}/getWebhookInfo`);
      const data = await tgRes.json();
      return new Response(JSON.stringify({ success: true, tgResponse: data }), {
        headers: { "Content-Type": "application/json" },
      });
    } catch (err) {
      return new Response(JSON.stringify({ success: false, error: err.message }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
  }

  // POST: 注册/绑定当前站点的 Webhook
  if (request.method === "POST") {
    try {
      const origin = new URL(request.url).origin;
      const webhookUrl = `${origin}/api/telegram/webhook`;

      const tgRes = await fetch(`https://api.telegram.org/bot${botToken}/setWebhook`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: webhookUrl,
          allowed_updates: ["message", "channel_post"],
          drop_pending_updates: true,
        }),
      });

      const data = await tgRes.json();
      if (!data.ok) {
        throw new Error(data.description || "Telegram API 绑定 Webhook 失败");
      }

      return new Response(
        JSON.stringify({
          success: true,
          message: "Telegram Webhook 自动注册成功！",
          webhookUrl,
          tgResponse: data,
        }),
        { headers: { "Content-Type": "application/json" } }
      );
    } catch (err) {
      return new Response(JSON.stringify({ success: false, error: err.message }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
  }

  // DELETE: 注销 Webhook
  if (request.method === "DELETE") {
    try {
      const tgRes = await fetch(`https://api.telegram.org/bot${botToken}/deleteWebhook`);
      const data = await tgRes.json();
      return new Response(JSON.stringify({ success: true, message: "Webhook 已移除", tgResponse: data }), {
        headers: { "Content-Type": "application/json" },
      });
    } catch (err) {
      return new Response(JSON.stringify({ success: false, error: err.message }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
  }

  return new Response("Method not allowed", { status: 405 });
}
