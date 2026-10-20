/**
 * Google Service Account 鉴权与 Access Token 获取模块
 * 纯原生 Web Crypto API 实现，无需任何外部 npm 依赖
 */

let cachedToken = null;
let tokenExpiry = 0;

/**
 * 将普通 Base64 转为 Base64URL
 */
function base64UrlEncode(strOrBuffer) {
  let base64 = "";
  if (typeof strOrBuffer === "string") {
    base64 = btoa(strOrBuffer);
  } else {
    const bytes = new Uint8Array(strOrBuffer);
    let binary = "";
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    base64 = btoa(binary);
  }
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/**
 * 将 PEM 格式的私钥转为 ArrayBuffer
 */
function pemToArrayBuffer(pem) {
  const cleanPem = pem
    .replace(/-----BEGIN PRIVATE KEY-----/, "")
    .replace(/-----END PRIVATE KEY-----/, "")
    .replace(/\\n/g, "")
    .replace(/\s+/g, "");
  
  const binaryString = atob(cleanPem);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}

/**
 * 从环境变量解析 Google 凭据
 */
export function getCredentials(env) {
  if (env.SERVICE_ACCOUNT_JSON) {
    try {
      const parsed = JSON.parse(env.SERVICE_ACCOUNT_JSON);
      return {
        clientEmail: parsed.client_email,
        privateKey: parsed.private_key,
        rootFolderId: env.ROOT_FOLDER_ID || parsed.root_folder_id || "root",
      };
    } catch (e) {
      throw new Error("SERVICE_ACCOUNT_JSON 环境变量解析失败，请确保格式为合法的 JSON 字符串: " + e.message);
    }
  }

  if (env.GOOGLE_CLIENT_EMAIL && env.GOOGLE_PRIVATE_KEY) {
    return {
      clientEmail: env.GOOGLE_CLIENT_EMAIL,
      privateKey: env.GOOGLE_PRIVATE_KEY,
      rootFolderId: env.ROOT_FOLDER_ID || "root",
    };
  }

  throw new Error("未配置 Google 凭据。请在 Cloudflare Pages 环境变量中配置 SERVICE_ACCOUNT_JSON 或 GOOGLE_CLIENT_EMAIL 与 GOOGLE_PRIVATE_KEY。");
}

// 缓存解析后的多盘列表（60秒TTL）
let cachedDrives = null;
let drivesExpiry = 0;

/**
 * 智能解析多盘配置（支持免配置自动扫描与独立分盘变量）
 */
export async function getResolvedDrives(env, token) {
  const now = Date.now();
  if (cachedDrives && drivesExpiry > now) {
    return cachedDrives;
  }

  const drives = [];

  // 1. 检查环境变量中的分盘配置: DRIVE_1, DRIVE_2, DRIVE_3... (便于在 CF 中单项添加与编辑，无需修改整串)
  for (let i = 1; i <= 20; i++) {
    const key = `DRIVE_${i}`;
    const val = env[key];
    if (val && typeof val === "string" && val.trim()) {
      const trimmed = val.trim();
      if (trimmed.includes(":") || trimmed.includes("=")) {
        const sep = trimmed.includes(":") ? ":" : "=";
        const idx = trimmed.indexOf(sep);
        const name = trimmed.substring(0, idx).trim();
        const id = trimmed.substring(idx + 1).trim();
        if (id) drives.push({ id, name: name || `云盘 ${i}`, icon: "hard-drive" });
      } else {
        drives.push({ id: trimmed, name: `云盘 ${i}`, icon: "hard-drive" });
      }
    }
  }

  // 2. 检查旧版 DRIVES 环境变量 (JSON 或 逗号分隔)
  if (drives.length === 0 && env.DRIVES && typeof env.DRIVES === "string" && env.DRIVES.trim()) {
    const raw = env.DRIVES.trim();
    if (raw.startsWith("[") || raw.startsWith("{")) {
      try {
        const parsed = JSON.parse(raw);
        const list = Array.isArray(parsed) ? parsed : [parsed];
        list.forEach((item, index) => {
          if (item && (item.id || item.folderId)) {
            drives.push({
              id: item.id || item.folderId,
              name: item.name || `云盘 ${index + 1}`,
              icon: item.icon || "hard-drive",
            });
          }
        });
      } catch (_) {}
    }
    if (drives.length === 0) {
      const parts = raw.split(/[\n,;]+/);
      parts.forEach((part, index) => {
        const trimmed = part.trim();
        if (!trimmed) return;
        if (trimmed.includes(":") || trimmed.includes("=")) {
          const sep = trimmed.includes(":") ? ":" : "=";
          const idx = trimmed.indexOf(sep);
          const name = trimmed.substring(0, idx).trim();
          const id = trimmed.substring(idx + 1).trim();
          if (id) drives.push({ id, name: name || `云盘 ${index + 1}`, icon: "hard-drive" });
        } else {
          drives.push({ id: trimmed, name: `云盘 ${index + 1}`, icon: "hard-drive" });
        }
      });
    }
  }

  // 3. 【全新推荐：零配置自动分盘】如果未手动在环境变量中配置多个盘
  if (drives.length === 0) {
    const rootFolderId = env.ROOT_FOLDER_ID ? env.ROOT_FOLDER_ID.trim() : "";

    // 模式 A：如果指定了 ROOT_FOLDER_ID（主总目录）
    // 自动扫描 ROOT_FOLDER_ID 下的所有一级子文件夹，将其直接作为分盘选项！
    if (rootFolderId && rootFolderId !== "root" && rootFolderId !== "auto") {
      let rootName = "全部文件";
      try {
        const metaRes = await fetch(
          `https://www.googleapis.com/drive/v3/files/${rootFolderId}?supportsAllDrives=true&fields=name`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        if (metaRes.ok) {
          const meta = await metaRes.json();
          if (meta.name) rootName = meta.name;
        }
      } catch (_) {}

      // 查询一级子文件夹，将其作为各个独立的分类云盘
      try {
        const subRes = await fetch(
          `https://www.googleapis.com/drive/v3/files?q='${rootFolderId}'+in+parents+and+mimeType='application/vnd.google-apps.folder'+and+trashed=false&fields=files(id,name)&pageSize=50&orderBy=name_natural+asc&supportsAllDrives=true&includeItemsFromAllDrives=true`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        if (subRes.ok) {
          const subData = await subRes.json();
          if (Array.isArray(subData.files) && subData.files.length > 0) {
            // 首先加入总库
            drives.push({ id: rootFolderId, name: `📁 ${rootName} (全库)`, icon: "hard-drive" });
            // 将子文件夹作为各个独立盘
            subData.files.forEach((f) => {
              drives.push({ id: f.id, name: f.name, icon: "folder" });
            });
          }
        }
      } catch (_) {}

      if (drives.length === 0) {
        drives.push({ id: rootFolderId, name: rootName, icon: "hard-drive" });
      }
    } else {
      // 模式 B：完全不填 ROOT_FOLDER_ID，全自动扫描服务账号拥有的共享文件夹与团队盘！
      // 1) 自动发现所有 sharedWithMe 直接共享给服务账号的文件夹
      try {
        const sharedRes = await fetch(
          `https://www.googleapis.com/drive/v3/files?q=sharedWithMe=true+and+mimeType='application/vnd.google-apps.folder'+and+trashed=false&fields=files(id,name)&pageSize=50&orderBy=name_natural+asc&supportsAllDrives=true&includeItemsFromAllDrives=true`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        if (sharedRes.ok) {
          const sharedData = await sharedRes.json();
          if (Array.isArray(sharedData.files)) {
            sharedData.files.forEach((f) => {
              drives.push({ id: f.id, name: f.name, icon: "folder" });
            });
          }
        }
      } catch (_) {}

      // 2) 自动发现所有团队盘 (Shared Drives)
      try {
        const teamRes = await fetch(
          `https://www.googleapis.com/drive/v3/drives?pageSize=50`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        if (teamRes.ok) {
          const teamData = await teamRes.json();
          if (Array.isArray(teamData.drives)) {
            teamData.drives.forEach((d) => {
              drives.push({ id: d.id, name: `👥 ${d.name}`, icon: "hard-drive" });
            });
          }
        }
      } catch (_) {}
    }
  }

  // 4. 兜底
  if (drives.length === 0) {
    drives.push({
      id: "root",
      name: "Google 云端硬盘",
      icon: "hard-drive",
    });
  }

  // 为没有自定义名称的手动盘补齐真实名称
  await Promise.all(
    drives.map(async (drive) => {
      if ((!drive.name || drive.name.startsWith("云盘") || drive.name === "主云盘") && drive.id !== "root") {
        try {
          const metaResp = await fetch(
            `https://www.googleapis.com/drive/v3/files/${drive.id}?supportsAllDrives=true&fields=name`,
            { headers: { Authorization: `Bearer ${token}` } }
          );
          if (metaResp.ok) {
            const meta = await metaResp.json();
            if (meta.name) drive.name = meta.name;
          }
        } catch (_) {}
      }
    })
  );

  cachedDrives = drives;
  drivesExpiry = now + 60 * 1000;
  return drives;
}

/**
 * 兼容旧版同步解析
 */
export function parseDrives(env) {
  const drives = [];
  if (env.DRIVES && typeof env.DRIVES === "string" && env.DRIVES.trim()) {
    const raw = env.DRIVES.trim();
    if (raw.startsWith("[") || raw.startsWith("{")) {
      try {
        const parsed = JSON.parse(raw);
        const list = Array.isArray(parsed) ? parsed : [parsed];
        list.forEach((item, index) => {
          if (item && (item.id || item.folderId)) {
            drives.push({
              id: item.id || item.folderId,
              name: item.name || `云盘 ${index + 1}`,
              icon: item.icon || "hard-drive",
            });
          }
        });
      } catch (_) {}
    }
    if (drives.length === 0) {
      const parts = raw.split(/[\n,;]+/);
      parts.forEach((part, index) => {
        const trimmed = part.trim();
        if (!trimmed) return;
        if (trimmed.includes(":") || trimmed.includes("=")) {
          const sep = trimmed.includes(":") ? ":" : "=";
          const idx = trimmed.indexOf(sep);
          const name = trimmed.substring(0, idx).trim();
          const id = trimmed.substring(idx + 1).trim();
          if (id) drives.push({ id, name: name || `云盘 ${index + 1}`, icon: "hard-drive" });
        } else {
          drives.push({ id: trimmed, name: `云盘 ${index + 1}`, icon: "hard-drive" });
        }
      });
    }
  }
  if (drives.length === 0 && env.ROOT_FOLDER_ID && env.ROOT_FOLDER_ID.trim()) {
    drives.push({ id: env.ROOT_FOLDER_ID.trim(), name: "主云盘", icon: "hard-drive" });
  }
  if (drives.length === 0) {
    drives.push({ id: "root", name: "Google 云端硬盘", icon: "hard-drive" });
  }
  return drives;
}

/**
 * 生成签名 JWT 并换取 Google Drive Access Token
 */
export async function getAccessToken(env) {
  const now = Math.floor(Date.now() / 1000);

  // 如果缓存有效（预留 300 秒富余量），直接返回
  if (cachedToken && tokenExpiry > now + 300) {
    return cachedToken;
  }

  const { clientEmail, privateKey } = getCredentials(env);

  const header = {
    alg: "RS256",
    typ: "JWT",
  };

  const payload = {
    iss: clientEmail,
    scope: "https://www.googleapis.com/auth/drive.readonly",
    aud: "https://oauth2.googleapis.com/token",
    exp: now + 3600,
    iat: now,
  };

  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const unsignedToken = `${encodedHeader}.${encodedPayload}`;

  // 导入私钥并签名
  const binaryKey = pemToArrayBuffer(privateKey);
  const cryptoKey = await crypto.subtle.importKey(
    "pkcs8",
    binaryKey,
    {
      name: "RSASSA-PKCS1-v1_5",
      hash: { name: "SHA-256" },
    },
    false,
    ["sign"]
  );

  const encoder = new TextEncoder();
  const signatureBuffer = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    cryptoKey,
    encoder.encode(unsignedToken)
  );

  const signature = base64UrlEncode(signatureBuffer);
  const assertion = `${unsignedToken}.${signature}`;

  // 向 Google OAuth2 请求 access_token
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: assertion,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Google OAuth2 Token 申请失败 [${response.status}]: ${errorText}`);
  }

  const tokenData = await response.json();
  cachedToken = tokenData.access_token;
  tokenExpiry = now + (tokenData.expires_in || 3600);

  return cachedToken;
}
