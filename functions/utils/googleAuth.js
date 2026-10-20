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

/**
 * 解析多盘配置
 * 支持 JSON 数组格式或极简 key:value / key=value 格式
 */
export function parseDrives(env) {
  const drives = [];

  if (env.DRIVES && typeof env.DRIVES === "string" && env.DRIVES.trim()) {
    const raw = env.DRIVES.trim();
    // 1. 尝试 JSON 数组解析
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

    // 2. 若非 JSON，尝试多行或逗号分隔格式，如: "动漫影视:1-3i..., 欧美电影:1xxx..."
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
          if (id) {
            drives.push({ id, name: name || `云盘 ${index + 1}`, icon: "hard-drive" });
          }
        } else {
          drives.push({ id: trimmed, name: `云盘 ${index + 1}`, icon: "hard-drive" });
        }
      });
    }
  }

  // 3. 兼容已配置的单个 ROOT_FOLDER_ID
  if (drives.length === 0 && env.ROOT_FOLDER_ID && env.ROOT_FOLDER_ID.trim()) {
    drives.push({
      id: env.ROOT_FOLDER_ID.trim(),
      name: "主云盘",
      icon: "hard-drive",
    });
  }

  // 4. 最终兜底
  if (drives.length === 0) {
    drives.push({
      id: "root",
      name: "Google 云端硬盘",
      icon: "hard-drive",
    });
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
