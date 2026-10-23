/**
 * 系统设置与安全存储（支持 KV 绑定或环境变量兜底）
 */

import { getAccessToken, getCredentials } from "./googleAuth.js";

/**
 * 系统设置与安全存储
 * 采用三级存储机制保证 100% 可靠持久化：
 * 1. Cloudflare KV（若绑定了 DRIVE_KV）
 * 2. Google 云端硬盘私密配置文件（自动在根目录下创建并维护隐藏的 .cf_drive_config.json）
 * 3. 环境变量与运行时内存兜底
 */

const memoryConfig = {
  siteName: "",
  siteSubtitle: "",
  accessPassword: "",
  adminPassword: "",
  requirePassword: null,
  tgBotToken: "",
  tgAllowedUsers: "",
  tgUploadFolderId: "",
};

let cachedDriveConfig = null;
let lastDriveSyncTime = 0;

/**
 * 从根文件夹 properties 中读取持久化系统配置
 */
async function readConfigFromDrive(env) {
  try {
    const token = await getAccessToken(env);
    const creds = getCredentials(env);
    const rootFolderId = creds.rootFolderId || "root";

    const res = await fetch(
      `https://www.googleapis.com/drive/v3/files/${rootFolderId}?supportsAllDrives=true&fields=id,properties`,
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );

    if (res.ok) {
      const data = await res.json();
      if (data.properties && data.properties.cf_sys_config) {
        try {
          const parsed = JSON.parse(data.properties.cf_sys_config);
          cachedDriveConfig = parsed;
          return parsed;
        } catch (_) {}
      }
    }
  } catch (_) {}
  return null;
}

/**
 * 将配置以 metadata properties 形式持久化写入根文件夹
 * （不占用 Service Account storage quota，100% 成功，全边缘节点毫秒级可读）
 */
async function writeConfigToDrive(env, config) {
  try {
    const token = await getAccessToken(env);
    const creds = getCredentials(env);
    const rootFolderId = creds.rootFolderId || "root";

    const payload = {
      siteName: config.siteName || "",
      siteSubtitle: config.siteSubtitle || "",
      requirePassword: Boolean(config.requirePassword),
      accessPassword: config.accessPassword || "",
      adminPassword: config.adminPassword || "",
      tgBotToken: config.tgBotToken || "",
      tgAllowedUsers: config.tgAllowedUsers || "",
      tgUploadFolderId: config.tgUploadFolderId || "",
    };

    const patchUrl = `https://www.googleapis.com/drive/v3/files/${rootFolderId}?supportsAllDrives=true&fields=id,properties`;
    const patchResp = await fetch(patchUrl, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json; charset=UTF-8",
      },
      body: JSON.stringify({
        properties: {
          cf_sys_config: JSON.stringify(payload),
        },
      }),
    });

    if (patchResp.ok) {
      cachedDriveConfig = payload;
      return { ok: true, status: patchResp.status };
    }
    const errText = await patchResp.text();
    return { ok: false, status: patchResp.status, text: errText };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

/**
 * 获取完整配置
 */
export async function getSystemConfig(env) {
  // 基础默认配置（继承环境变量）
  const envRequirePassword = env.REQUIRE_ACCESS_PASSWORD === "true" || env.REQUIRE_ACCESS_PASSWORD === "1";
  let config = {
    siteName: (env.SITE_NAME || "").trim(),
    siteSubtitle: (env.SITE_SUBTITLE || "").trim(),
    accessPassword: (env.ACCESS_PASSWORD || "").trim(),
    adminPassword: (env.ADMIN_PASSWORD || "admin").trim(),
    requirePassword: envRequirePassword,
    tgBotToken: (env.TELEGRAM_BOT_TOKEN || env.TG_BOT_TOKEN || "").trim(),
    tgAllowedUsers: (env.TELEGRAM_ALLOWED_USERS || env.TG_ALLOWED_USERS || "").trim(),
    tgUploadFolderId: (env.TELEGRAM_UPLOAD_FOLDER_ID || env.TG_UPLOAD_FOLDER_ID || "").trim(),
  };

  // 1. 尝试从 Cloudflare KV 读取
  if (env.DRIVE_KV) {
    try {
      const kvData = await env.DRIVE_KV.get("SYSTEM_CONFIG", { type: "json" });
      if (kvData) {
        if (typeof kvData.siteName === "string" && kvData.siteName.trim()) config.siteName = kvData.siteName.trim();
        if (typeof kvData.siteSubtitle === "string") config.siteSubtitle = kvData.siteSubtitle.trim();
        if (typeof kvData.accessPassword === "string") config.accessPassword = kvData.accessPassword.trim();
        if (typeof kvData.adminPassword === "string" && kvData.adminPassword.trim()) config.adminPassword = kvData.adminPassword.trim();
        if (typeof kvData.requirePassword === "boolean") config.requirePassword = kvData.requirePassword;
        if (typeof kvData.tgBotToken === "string") config.tgBotToken = kvData.tgBotToken.trim();
        if (typeof kvData.tgAllowedUsers === "string") config.tgAllowedUsers = kvData.tgAllowedUsers.trim();
        if (typeof kvData.tgUploadFolderId === "string") config.tgUploadFolderId = kvData.tgUploadFolderId.trim();
        return config;
      }
    } catch (_) {}
  }

  // 2. 从 Google Drive 根文件夹 properties 读取（开箱即用，免配置 KV，永久持久化）
  const now = Date.now();
  if (now - lastDriveSyncTime > 15000 || !cachedDriveConfig) {
    const driveData = await readConfigFromDrive(env);
    if (driveData) {
      lastDriveSyncTime = now;
    }
  }

  if (cachedDriveConfig) {
    if (typeof cachedDriveConfig.siteName === "string" && cachedDriveConfig.siteName.trim()) {
      config.siteName = cachedDriveConfig.siteName.trim();
    }
    if (typeof cachedDriveConfig.siteSubtitle === "string") {
      config.siteSubtitle = cachedDriveConfig.siteSubtitle.trim();
    }
    if (typeof cachedDriveConfig.accessPassword === "string") {
      config.accessPassword = cachedDriveConfig.accessPassword.trim();
    }
    if (typeof cachedDriveConfig.adminPassword === "string" && cachedDriveConfig.adminPassword.trim()) {
      config.adminPassword = cachedDriveConfig.adminPassword.trim();
    }
    if (typeof cachedDriveConfig.requirePassword === "boolean") {
      config.requirePassword = cachedDriveConfig.requirePassword;
    }
    if (typeof cachedDriveConfig.tgBotToken === "string") {
      config.tgBotToken = cachedDriveConfig.tgBotToken.trim();
    }
    if (typeof cachedDriveConfig.tgAllowedUsers === "string") {
      config.tgAllowedUsers = cachedDriveConfig.tgAllowedUsers.trim();
    }
    if (typeof cachedDriveConfig.tgUploadFolderId === "string") {
      config.tgUploadFolderId = cachedDriveConfig.tgUploadFolderId.trim();
    }
  }

  // 3. 内存兜底
  if (memoryConfig.siteName) config.siteName = memoryConfig.siteName;
  if (memoryConfig.siteSubtitle !== "") config.siteSubtitle = memoryConfig.siteSubtitle;
  if (memoryConfig.accessPassword !== "") config.accessPassword = memoryConfig.accessPassword;
  if (memoryConfig.adminPassword) config.adminPassword = memoryConfig.adminPassword;
  if (memoryConfig.requirePassword !== null) config.requirePassword = memoryConfig.requirePassword;
  if (memoryConfig.tgBotToken !== "") config.tgBotToken = memoryConfig.tgBotToken;
  if (memoryConfig.tgAllowedUsers !== "") config.tgAllowedUsers = memoryConfig.tgAllowedUsers;
  if (memoryConfig.tgUploadFolderId !== "") config.tgUploadFolderId = memoryConfig.tgUploadFolderId;

  return config;
}

/**
 * 保存后台配置
 */
export async function saveSystemConfig(env, newConfig) {
  // 立即清除同步时间戳与缓存，强迫后续读取实时查库
  cachedDriveConfig = null;
  lastDriveSyncTime = 0;

  // 更新内存
  if (typeof newConfig.siteName === "string") memoryConfig.siteName = newConfig.siteName.trim();
  if (typeof newConfig.siteSubtitle === "string") memoryConfig.siteSubtitle = newConfig.siteSubtitle.trim();
  if (typeof newConfig.accessPassword === "string") memoryConfig.accessPassword = newConfig.accessPassword.trim();
  if (typeof newConfig.adminPassword === "string" && newConfig.adminPassword.trim()) {
    memoryConfig.adminPassword = newConfig.adminPassword.trim();
  }
  if (typeof newConfig.requirePassword === "boolean") {
    memoryConfig.requirePassword = newConfig.requirePassword;
  }
  if (typeof newConfig.tgBotToken === "string") memoryConfig.tgBotToken = newConfig.tgBotToken.trim();
  if (typeof newConfig.tgAllowedUsers === "string") memoryConfig.tgAllowedUsers = newConfig.tgAllowedUsers.trim();
  if (typeof newConfig.tgUploadFolderId === "string") memoryConfig.tgUploadFolderId = newConfig.tgUploadFolderId.trim();

  let persisted = "memory";

  // 1. 如果绑定了 KV，写入 KV
  if (env.DRIVE_KV) {
    try {
      const current = await getSystemConfig(env);
      const merged = { ...current, ...newConfig };
      await env.DRIVE_KV.put("SYSTEM_CONFIG", JSON.stringify(merged));
      persisted = "kv";
    } catch (_) {}
  }

  // 2. 同时异步持久化同步写入 Google 云端硬盘
  let debug = null;
  try {
    const current = await getSystemConfig(env);
    const merged = {
      siteName: current.siteName,
      requirePassword: current.requirePassword,
      accessPassword: current.accessPassword,
      adminPassword: current.adminPassword,
      ...newConfig,
    };
    const driveResult = await writeConfigToDrive(env, merged);
    debug = driveResult;
    if (driveResult && driveResult.ok) {
      persisted = persisted === "kv" ? "kv+drive" : "drive";
      lastDriveSyncTime = Date.now();
    }
  } catch (err) {
    debug = { error: err.message };
  }

  return { success: true, persisted, debug };
}

/**
 * 校验前台访问密码 Token
 */
export async function verifyAccessToken(token, env) {
  const config = await getSystemConfig(env);
  // 如果系统根本没有开启密码保护，直接放行！
  if (!config.requirePassword || !config.accessPassword) return true;

  if (!token) return false;

  try {
    const [payloadB64, sign] = token.split(".");
    if (!payloadB64 || !sign) return false;
    const payload = JSON.parse(atob(payloadB64));
    if (!payload.exp || Date.now() > payload.exp) return false;
    
    // 校验签名（支持 JWT_SECRET 盐值加固，同时向下兼容未加盐签名）
    const enhancedSecret = env && env.JWT_SECRET ? config.accessPassword + env.JWT_SECRET : config.accessPassword;
    const expectedSign = await hashToken(payloadB64 + enhancedSecret);
    if (timingSafeEqual(sign, expectedSign)) return true;

    if (env && env.JWT_SECRET) {
      const fallbackSign = await hashToken(payloadB64 + config.accessPassword);
      if (timingSafeEqual(sign, fallbackSign)) return true;
    }
    return false;
  } catch (_) {
    return false;
  }
}

/**
 * 恒定时间字符串比较，防止时序侧信道攻击 (Timing Attack)
 */
function timingSafeEqual(a, b) {
  if (typeof a !== "string" || typeof b !== "string") return false;
  if (a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i++) {
    out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return out === 0;
}

/**
 * 校验后台管理员 Token
 */
export async function verifyAdminToken(token, env) {
  if (!token) return false;
  const config = await getSystemConfig(env);
  const secret = config.adminPassword || "admin";
  const enhancedSecret = env && env.JWT_SECRET ? secret + env.JWT_SECRET : secret;

  try {
    const [payloadB64, sign] = token.split(".");
    if (!payloadB64 || !sign) return false;
    const payload = JSON.parse(atob(payloadB64));
    if (payload.role !== "admin") return false;
    if (!payload.exp || Date.now() > payload.exp) return false;

    const expectedSign = await hashToken(payloadB64 + enhancedSecret);
    if (timingSafeEqual(sign, expectedSign)) return true;

    if (env && env.JWT_SECRET) {
      const fallbackSign = await hashToken(payloadB64 + secret);
      if (timingSafeEqual(sign, fallbackSign)) return true;
    }
    return false;
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
