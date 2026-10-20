/**
 * 系统设置与安全存储（支持 KV 绑定或环境变量兜底）
 */

// 内存单例兜底（当未绑定 KV 时，依然能够保持当前运行时正常读写）
const memoryConfig = {
  siteName: "",
  accessPassword: "", // 打开整站密码
  adminPassword: "",  // 管理员后台密码
  requirePassword: null, // 是否开启整站密码：null 表示继承环境变量，true/false 为显式设置
};

/**
 * 获取完整配置
 */
export async function getSystemConfig(env) {
  // 默认不开启访问密码（即 requirePassword 默认为 false，除非在后台显式勾选开启，或配置了 REQUIRE_ACCESS_PASSWORD=true）
  const envRequirePassword = env.REQUIRE_ACCESS_PASSWORD === "true" || env.REQUIRE_ACCESS_PASSWORD === "1";
  let config = {
    siteName: (env.SITE_NAME || "").trim(),
    accessPassword: (env.ACCESS_PASSWORD || "").trim(),
    adminPassword: (env.ADMIN_PASSWORD || "admin").trim(),
    requirePassword: envRequirePassword,
  };

  // 1. 如果绑定了 Cloudflare KV (如 DRIVE_KV)
  if (env.DRIVE_KV) {
    try {
      const kvData = await env.DRIVE_KV.get("SYSTEM_CONFIG", { type: "json" });
      if (kvData) {
        if (typeof kvData.siteName === "string" && kvData.siteName.trim()) {
          config.siteName = kvData.siteName.trim();
        }
        if (typeof kvData.accessPassword === "string") {
          config.accessPassword = kvData.accessPassword.trim();
        }
        if (typeof kvData.adminPassword === "string" && kvData.adminPassword.trim()) {
          config.adminPassword = kvData.adminPassword.trim();
        }
        if (typeof kvData.requirePassword === "boolean") {
          config.requirePassword = kvData.requirePassword;
        }
        return config;
      }
    } catch (_) {}
  }

  // 2. 内存热更兜底（在无 KV 情况下）
  if (memoryConfig.siteName) config.siteName = memoryConfig.siteName;
  if (memoryConfig.accessPassword !== "") config.accessPassword = memoryConfig.accessPassword;
  if (memoryConfig.adminPassword) config.adminPassword = memoryConfig.adminPassword;
  if (memoryConfig.requirePassword !== null) config.requirePassword = memoryConfig.requirePassword;

  return config;
}

/**
 * 保存后台配置
 */
export async function saveSystemConfig(env, newConfig) {
  // 更新内存兜底
  if (typeof newConfig.siteName === "string") memoryConfig.siteName = newConfig.siteName.trim();
  if (typeof newConfig.accessPassword === "string") memoryConfig.accessPassword = newConfig.accessPassword.trim();
  if (typeof newConfig.adminPassword === "string" && newConfig.adminPassword.trim()) {
    memoryConfig.adminPassword = newConfig.adminPassword.trim();
  }
  if (typeof newConfig.requirePassword === "boolean") {
    memoryConfig.requirePassword = newConfig.requirePassword;
  }

  // 如果绑定了 KV，持久化写入 KV
  if (env.DRIVE_KV) {
    try {
      const current = await getSystemConfig(env);
      const merged = {
        ...current,
        ...newConfig,
      };
      await env.DRIVE_KV.put("SYSTEM_CONFIG", JSON.stringify(merged));
      return { success: true, persisted: "kv" };
    } catch (err) {
      return { success: true, persisted: "memory", warning: "KV写入异常: " + err.message };
    }
  }

  return { success: true, persisted: "memory" };
}

/**
 * 校验前台访问密码 Token
 */
export async function verifyAccessToken(token, env) {
  if (!token) return false;
  const config = await getSystemConfig(env);
  if (!config.requirePassword || !config.accessPassword) return true;

  try {
    const [payloadB64, sign] = token.split(".");
    if (!payloadB64 || !sign) return false;
    const payload = JSON.parse(atob(payloadB64));
    if (!payload.exp || Date.now() > payload.exp) return false;
    
    // 校验签名（兼容带或不带 salt）
    const expectedSign = await hashToken(payloadB64 + config.accessPassword);
    return sign === expectedSign;
  } catch (_) {
    return false;
  }
}

/**
 * 校验后台管理员 Token
 */
export async function verifyAdminToken(token, env) {
  if (!token) return false;
  const config = await getSystemConfig(env);
  const secret = config.adminPassword || "admin";

  try {
    const [payloadB64, sign] = token.split(".");
    if (!payloadB64 || !sign) return false;
    const payload = JSON.parse(atob(payloadB64));
    if (payload.role !== "admin") return false;
    if (!payload.exp || Date.now() > payload.exp) return false;

    const expectedSign = await hashToken(payloadB64 + secret);
    return sign === expectedSign;
  } catch (_) {
    return false;
  }
}

/**
 * 生成简易安全的签名 Token (7 天有效)
 */
export async function generateToken(payloadObj, secretKey) {
  const payload = {
    ...payloadObj,
    exp: Date.now() + 7 * 24 * 3600 * 1000, // 7 天
  };
  const payloadB64 = btoa(JSON.stringify(payload));
  const sign = await hashToken(payloadB64 + secretKey);
  return `${payloadB64}.${sign}`;
}

async function hashToken(str) {
  const data = new TextEncoder().encode(str);
  const hashBuf = await crypto.subtle.digest("SHA-256", data);
  const hashArr = Array.from(new Uint8Array(hashBuf));
  return hashArr.map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, 32);
}
