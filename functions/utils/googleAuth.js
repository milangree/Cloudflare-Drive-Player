/**
 * Google Service Account 纯 Web Crypto API 认证与 Token 获取
 * 运行在 Cloudflare Workers / Pages Functions 运行时，零 npm 依赖
 */

let cachedToken = null;
let tokenExpiry = 0;

/**
 * 将 PEM 格式私钥转换为 ArrayBuffer
 */
function pemToArrayBuffer(pem) {
  const b64 = pem
    .replace(/-----BEGIN PRIVATE KEY-----/, "")
    .replace(/-----END PRIVATE KEY-----/, "")
    .replace(/[\r\n\s]/g, "");
  const binaryString = atob(b64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}

/**
 * Base64URL 编码
 */
function base64UrlEncode(str) {
  const b64 = btoa(str);
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function arrayBufferToBase64Url(buffer) {
  let binary = "";
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return base64UrlEncode(binary);
}

/**
 * 从环境变量中提取 Google 服务账号凭据
 */
export function getCredentials(env) {
  if (env.SERVICE_ACCOUNT_JSON) {
    try {
      const parsed = JSON.parse(env.SERVICE_ACCOUNT_JSON);
      return {
        clientEmail: parsed.client_email,
        privateKey: parsed.private_key,
        rootFolderId: env.ROOT_FOLDER_ID ? env.ROOT_FOLDER_ID.trim() : (parsed.root_folder_id || "root"),
      };
    } catch (e) {
      throw new Error("SERVICE_ACCOUNT_JSON 环境变量解析失败，请确保格式为合法的 JSON 字符串: " + e.message);
    }
  }

  if (env.GOOGLE_CLIENT_EMAIL && env.GOOGLE_PRIVATE_KEY) {
    return {
      clientEmail: env.GOOGLE_CLIENT_EMAIL,
      privateKey: env.GOOGLE_PRIVATE_KEY,
      rootFolderId: env.ROOT_FOLDER_ID ? env.ROOT_FOLDER_ID.trim() : "root",
    };
  }

  throw new Error("未配置 Google 凭据。请在 Cloudflare Pages 环境变量中配置 SERVICE_ACCOUNT_JSON。");
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
      hash: "SHA-256",
    },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    cryptoKey,
    new TextEncoder().encode(unsignedToken)
  );

  const jwt = `${unsignedToken}.${arrayBufferToBase64Url(signature)}`;

  // 使用 JWT 换取 access_token
  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });

  if (!tokenResponse.ok) {
    const errorBody = await tokenResponse.text();
    throw new Error(`获取 Google Access Token 失败: ${errorBody}`);
  }

  const data = await tokenResponse.json();
  cachedToken = data.access_token;
  tokenExpiry = now + (data.expires_in || 3600);

  return cachedToken;
}
