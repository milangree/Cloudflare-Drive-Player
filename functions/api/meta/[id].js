import { getAccessToken } from "../../utils/googleAuth.js";
import { verifyAccessToken, verifyAdminToken } from "../../utils/configManager.js";

/**
 * 文件元数据查询接口
 *
 * 供 Telegram 深链 (?file=<id>) 等场景按 ID 定位文件，无需先知道它所在目录。
 * 返回的字段与 /api/list 的条目结构保持一致，前端可直接复用打开逻辑。
 */

const VIDEO_EXT = /\.(mp4|mkv|avi|mov|webm|flv|ts|m4v|wmv|mpg|mpeg|3gp)$/i;
const AUDIO_EXT = /\.(mp3|flac|wav|m4a|aac|ogg|opus|wma)$/i;
const IMAGE_EXT = /\.(jpg|jpeg|png|gif|webp|bmp|svg|avif|heic)$/i;

export async function onRequestGet(context) {
  const { params, request, env } = context;
  const fileId = params.id;
  if (!fileId) {
    return new Response("Missing file id", { status: 400 });
  }

  // 校验访问权限（与 /api/download 一致：若配置了站点密码则需令牌）
  const url = new URL(request.url);
  const clientToken =
    (request.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "") || url.searchParams.get("token") || "";

  const isAccessValid = (await verifyAccessToken(clientToken, env)) || (await verifyAdminToken(clientToken, env));
  if (!isAccessValid) {
    return new Response("需要访问授权令牌 (Unauthorized)", {
      status: 401,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Access-Control-Allow-Origin": "*",
      },
    });
  }

  let googleToken;
  try {
    googleToken = await getAccessToken(env);
  } catch (err) {
    return new Response(JSON.stringify({ success: false, error: "Google Drive 授权失败" }), {
      status: 500,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });
  }

  const metaUrl =
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}` +
    "?fields=id,name,mimeType,size,parents,thumbnailLink,modifiedTime&supportsAllDrives=true";

  let res;
  try {
    res = await fetch(metaUrl, {
      headers: { Authorization: `Bearer ${googleToken}` },
      signal: AbortSignal.timeout(15000),
    });
  } catch (err) {
    return new Response(JSON.stringify({ success: false, error: "Google Drive 请求超时" }), {
      status: 502,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });
  }

  if (!res.ok) {
    return new Response(JSON.stringify({ success: false, error: `Google Drive 返回错误: HTTP ${res.status}` }), {
      status: res.status === 404 ? 404 : 502,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });
  }

  const file = await res.json().catch(() => null);
  if (!file || !file.id) {
    return new Response(JSON.stringify({ success: false, error: "未找到该文件" }), {
      status: 404,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });
  }

  const name = file.name || "";
  const item = {
    id: file.id,
    name,
    mimeType: file.mimeType || "",
    size: Number(file.size || 0),
    parents: Array.isArray(file.parents) ? file.parents : [],
    thumbnailLink: file.thumbnailLink || "",
    modifiedTime: file.modifiedTime || "",
    isFolder: file.mimeType === "application/vnd.google-apps.folder",
    isVideo: VIDEO_EXT.test(name),
    isAudio: AUDIO_EXT.test(name),
    isImage: IMAGE_EXT.test(name),
  };

  return new Response(JSON.stringify({ success: true, item }), {
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "no-store",
    },
  });
}
