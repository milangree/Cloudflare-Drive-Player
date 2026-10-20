import { getSystemConfig, generateToken, verifyAdminToken } from "../../utils/configManager.js";

export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    const body = await request.json();
    const { action, password } = body;

    const config = await getSystemConfig(env);

    // 1. 前台站点访问密码验证
    if (action === "verify_access") {
      if (!config.requirePassword || !config.accessPassword) {
        return new Response(JSON.stringify({ success: true, needPassword: false }), {
          headers: { "Content-Type": "application/json" },
        });
      }

      if (password === config.accessPassword) {
        const token = await generateToken({ role: "viewer" }, config.accessPassword);
        return new Response(
          JSON.stringify({
            success: true,
            token,
          }),
          { headers: { "Content-Type": "application/json" } }
        );
      } else {
        return new Response(
          JSON.stringify({
            success: false,
            error: "访问密码错误，请重新输入",
          }),
          { status: 401, headers: { "Content-Type": "application/json" } }
        );
      }
    }

    // 2. 后台管理登录
    if (action === "admin_login") {
      const adminPass = config.adminPassword || "admin";
      if (password === adminPass) {
        const token = await generateToken({ role: "admin" }, adminPass);
        return new Response(
          JSON.stringify({
            success: true,
            token,
          }),
          { headers: { "Content-Type": "application/json" } }
        );
      } else {
        return new Response(
          JSON.stringify({
            success: false,
            error: "后台管理员密码错误",
          }),
          { status: 401, headers: { "Content-Type": "application/json" } }
        );
      }
    }

    return new Response(JSON.stringify({ success: false, error: "未知的认证动作" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ success: false, error: err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
