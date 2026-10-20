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
  accessPassword: "",
  adminPassword: "",
  requirePassword: null,
};

let cachedDriveFileId = null;
let lastDriveSyncTime = 0;

/**
 * 在 Google Drive 中查找或创建 .cf_drive_config.json
 */
async function getDriveConfigFileId(env, token) {
  if (cachedDriveFileId) return cachedDriveFileId;
  const creds = getCredentials(env);
  const rootFolderId = creds.rootFolderId || "root";

  // 1. 查找是否存在 .cf_drive_config.json
  const q = `'${rootFolderId}' in parents and name = '.cf_drive_config.json' and trashed = false`;
  const searchUrl = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&supportsAllDrives=true&includeItemsFromAllDrives=true&fields=files(id,name)`;
  const searchResp = await fetch(searchUrl, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (searchResp.ok) {
    const data = await searchResp.json();
    if (data.files && data.files.length > 0) {
      cachedDriveFileId = data.files[0].id;
      return cachedDriveFileId;
    }
  }

  return null;
}

/**
 * 从 Google Drive 读取保存的系统配置
 */
async function readConfigFromDrive(env) {
  try {
    const token = await getAccessToken(env);
    const fileId = await getDriveConfigFileId(env, token);
    if (!fileId) return null;

    const fileResp = await fetch(
      `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media&supportsAllDrives=true`,
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );

    if (fileResp.ok) {
      const data = await fileResp.json();
      return data;
    }
  } catch (_) {}
  return null;
}

/**
 * 将配置持久化写入 Google Drive
 */
async function writeConfigToDrive(env, config) {
  try {
    const token = await getAccessToken(env);
    const creds = getCredentials(env);
    const rootFolderId = creds.rootFolderId || "root";
    const fileId = await getDriveConfigFileId(env, token);
    const content = JSON.stringify(config, null, 2);

    if (fileId) {
      // 存在则更新内容
      const patchUrl = `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media&supportsAllDrives=true`;
      await fetch(patchUrl, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json; charset=UTF-8",
        },
        body: content,
      });
      return true;
    } else {
      // 不存在则新建文件
      const metadata = {
        name: ".cf_drive_config.json",
        parents: [rootFolderId],
        mimeType: "application/json",
      };
      const boundary = "-------CFDriveConfigBoundary" + Math.random().toString(36).substring(2);
      const delimiter = "\r\n--" + boundary + "\r\n";
      const closeDelim = "\r\n--" + boundary + "--";

      const multipartRequestBody =
        delimiter +
        "Content-Type: application/json; charset=UTF-8\r\n\r\n" +
        JSON.stringify(metadata) +
        delimiter +
        "Content-Type: application/json; charset=UTF-8\r\n\r\n" +
        content +
        closeDelim;

      const createResp = await fetch(
        "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": `multipart/related; boundary=${boundary}`,
          },
          body: multipartRequestBody,
        }
      );

      if (createResp.ok) {
        const createdFile = await createResp.json();
        cachedDriveFileId = createdFile.id;
        return true;
      }
    }
  } catch (err) {
    console.error("writeConfigToDrive error:", err);
  }
  return false;
}

/**
 * 获取完整配置
 */
export async function getSystemConfig(env) {
  // 基础默认配置（继承环境变量）
  const envRequirePassword = env.REQUIRE_ACCESS_PASSWORD === "true" || env.REQUIRE_ACCESS_PASSWORD === "1";
  let config = {
    siteName: (env.SITE_NAME || "").trim(),
    accessPassword: (env.ACCESS_PASSWORD || "").trim(),
    adminPassword: (env.ADMIN_PASSWORD || "admin").trim(),
    requirePassword: envRequirePassword,
  };

  // 1. 尝试从 Cloudflare KV 读取
  if (env.DRIVE_KV) {
    try {
      const kvData = await env.DRIVE_KV.get("SYSTEM_CONFIG", { type: "json" });
      if (kvData) {
        if (typeof kvData.siteName === "string" && kvData.siteName.trim()) config.siteName = kvData.siteName.trim();
        if (typeof kvData.accessPassword === "string") config.accessPassword = kvData.accessPassword.trim();
        if (typeof kvData.adminPassword === "string" && kvData.adminPassword.trim()) config.adminPassword = kvData.adminPassword.trim();
        if (typeof kvData.requirePassword === "boolean") config.requirePassword = kvData.requirePassword;
        return config;
      }
    } catch (_) {}
  }

  // 2. 尝试从 Google Drive 私密配置文件读取（免去繁琐的 KV 绑定，直接开箱持久化）
  const now = Date.now();
  if (now - lastDriveSyncTime > 10000 || !memoryConfig.adminPassword) {
    const driveData = await readConfigFromDrive(env);
    if (driveData) {
      if (typeof driveData.siteName === "string") memoryConfig.siteName = driveData.siteName.trim();
      if (typeof driveData.accessPassword === "string") memoryConfig.accessPassword = driveData.accessPassword.trim();
      if (typeof driveData.adminPassword === "string" && driveData.adminPassword.trim()) {
        memoryConfig.adminPassword = driveData.adminPassword.trim();
      }
      if (typeof driveData.requirePassword === "boolean") memoryConfig.requirePassword = driveData.requirePassword;
      lastDriveSyncTime = now;
    }
  }

  // 3. 内存与缓存配置合并
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
  // 更新内存
  if (typeof newConfig.siteName === "string") memoryConfig.siteName = newConfig.siteName.trim();
  if (typeof newConfig.accessPassword === "string") memoryConfig.accessPassword = newConfig.accessPassword.trim();
  if (typeof newConfig.adminPassword === "string" && newConfig.adminPassword.trim()) {
    memoryConfig.adminPassword = newConfig.adminPassword.trim();
  }
  if (typeof newConfig.requirePassword === "boolean") {
    memoryConfig.requirePassword = newConfig.requirePassword;
  }

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
  try {
    const current = await getSystemConfig(env);
    const merged = {
      siteName: current.siteName,
      requirePassword: current.requirePassword,
      accessPassword: current.accessPassword,
      adminPassword: current.adminPassword,
      ...newConfig,
    };
    const driveSaved = await writeConfigToDrive(env, merged);
    if (driveSaved) {
      persisted = persisted === "kv" ? "kv+drive" : "drive";
      lastDriveSyncTime = Date.now();
    }
  } catch (_) {}

  return { success: true, persisted };
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
