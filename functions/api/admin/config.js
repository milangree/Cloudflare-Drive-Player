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
          siteSubtitle: config.siteSubtitle || "",
          requirePassword: Boolean(config.requirePassword),
          accessPassword: config.accessPassword,
          hasAdminPassword: Boolean(config.adminPassword),
          kvConfigured: Boolean(env.DRIVE_KV),
          tgBotToken: config.tgBotToken || "",
          tgAllowedUsers: config.tgAllowedUsers || "",
          tgUploadFolderId: config.tgUploadFolderId || "",
        },
      }),
      { headers: { "Content-Type": "application/json" } }
    );
  }

  // POST: 更新后台配置
  if (request.method === "POST") {
    try {
      const body = await request.json();
      const {
        siteName,
        siteSubtitle,
        requirePassword,
        accessPassword,
        newAdminPassword,
        tgBotToken,
        tgAllowedUsers,
        tgUploadFolderId,
      } = body;

      const updateData = {};
      if (typeof siteName === "string") updateData.siteName = siteName.trim();
      if (typeof siteSubtitle === "string") updateData.siteSubtitle = siteSubtitle.trim();
      if (typeof requirePassword === "boolean") updateData.requirePassword = requirePassword;
      if (typeof accessPassword === "string") updateData.accessPassword = accessPassword.trim();
      if (typeof newAdminPassword === "string" && newAdminPassword.trim()) {
        updateData.adminPassword = newAdminPassword.trim();
      }
      if (typeof tgBotToken === "string") updateData.tgBotToken = tgBotToken.trim();
      if (typeof tgAllowedUsers === "string") updateData.tgAllowedUsers = tgAllowedUsers.trim();
      if (typeof tgUploadFolderId === "string") updateData.tgUploadFolderId = tgUploadFolderId.trim();

      const res = await saveSystemConfig(env, updateData);

      // 如果修改了管理员密码，用新密码重新为当前管理员签发最新 Token 返回，避免旧 Token 签名失效
      let newToken = null;
      if (updateData.adminPassword) {
        const { generateToken } = await import("../../utils/configManager.js");
        const signingSecret = env && env.JWT_SECRET ? updateData.adminPassword + env.JWT_SECRET : updateData.adminPassword;
        newToken = await generateToken({ role: "admin" }, signingSecret);
      }

      return new Response(JSON.stringify({ success: true, persisted: res.persisted, newToken }), {
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
