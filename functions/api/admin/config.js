import { getSystemConfig, saveSystemConfig, verifyAdminToken } from "../../utils/configManager.js";

export async function onRequest(context) {
  const { request, env } = context;

  const authHeader = request.headers.get("Authorization") || "";
  const token = authHeader.replace(/^Bearer\s+/i, "");

  const isAdmin = await verifyAdminToken(token, env);
  if (!isAdmin) {
    return new Response(JSON.stringify({ success: false, error: "未授权的管理员访问" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  // GET: 获取后台当前配置
  if (request.method === "GET") {
    const config = await getSystemConfig(env);
    return new Response(
      JSON.stringify({
        success: true,
        config: {
          siteName: config.siteName,
          requirePassword: Boolean(config.requirePassword),
          accessPassword: config.accessPassword,
          hasAdminPassword: Boolean(config.adminPassword),
          kvConfigured: Boolean(env.DRIVE_KV),
        },
      }),
      { headers: { "Content-Type": "application/json" } }
    );
  }

  // POST: 更新后台配置
  if (request.method === "POST") {
    try {
      const body = await request.json();
      const { siteName, requirePassword, accessPassword, newAdminPassword } = body;

      const updateData = {};
      if (typeof siteName === "string") updateData.siteName = siteName.trim();
      if (typeof requirePassword === "boolean") updateData.requirePassword = requirePassword;
      if (typeof accessPassword === "string") updateData.accessPassword = accessPassword.trim();
      if (typeof newAdminPassword === "string" && newAdminPassword.trim()) {
        updateData.adminPassword = newAdminPassword.trim();
      }

      const res = await saveSystemConfig(env, updateData);
      return new Response(JSON.stringify({ success: true, persisted: res.persisted, debug: res.debug || null }), {
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
