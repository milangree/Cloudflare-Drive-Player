import { getAccessToken } from "../../utils/googleAuth.js";
import { verifyAccessToken, verifyAdminToken } from "../../utils/configManager.js";

/**
 * 常见媒体扩展名到标准 MIME 类型的映射表
 * 解决 Google Drive 返回 application/octet-stream 导致的浏览器媒体嗅探失败与黑屏问题
 */
const MIME_MAP = {
  // 视频容器
  mkv: "video/x-matroska",
  mp4: "video/mp4",
  webm: "video/webm",
  ogv: "video/ogg",
  mov: "video/quicktime",
  avi: "video/x-msvideo",
  wmv: "video/x-ms-wmv",
  flv: "video/x-flv",
  ts: "video/mp2t",
  m3u8: "application/x-mpegURL",
  // 音频容器
  mp3: "audio/mpeg",
  wav: "audio/wav",
  ogg: "audio/ogg",
  oga: "audio/ogg",
  opus: "audio/opus",
  flac: "audio/flac",
  aac: "audio/aac",
  m4a: "audio/mp4",
  // 文档与歌词
  pdf: "application/pdf",
  md: "text/markdown; charset=utf-8",
  txt: "text/plain; charset=utf-8",
  json: "application/json; charset=utf-8",
  lrc: "text/plain; charset=utf-8",
  // 字幕
  vtt: "text/vtt",
  srt: "text/plain",
  ass: "text/plain",
};

// 文件名内存短缓存（TTL 5分钟），避免高频 Range 分片请求与未带参数的直链重复查询 Google API
const filenameCache = new Map();
const CACHE_TTL_MS = 5 * 60 * 1000;

/**
 * 尝试从短缓存或 Google Drive 获取文件名称
 * @param {string} fileId 文件 ID
 * @param {string} token Google 访问令牌
 * @returns {Promise<string>}
 */
async function getCachedFilename(fileId, token) {
  const cached = filenameCache.get(fileId);
  const now = Date.now();
  if (cached && now - cached.timestamp < CACHE_TTL_MS) {
    return cached.name;
  }
  try {
    const metaResp = await fetch(
      `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?supportsAllDrives=true&fields=name`,
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );
    if (metaResp.ok) {
      const meta = await metaResp.json();
      if (meta && meta.name) {
        filenameCache.set(fileId, { timestamp: now, name: meta.name });
        return meta.name;
      }
    }
  } catch (_) {}
  return "";
}

/**
 * 获取媒体文件的规范化 Content-Type
 * @param {string} filename 文件名
 * @param {string|null} upstreamType 上游 Google Drive 返回的 Content-Type
 * @returns {string} 规范化的 Content-Type
 */
function resolveContentType(filename, upstreamType) {
  let ext = "";
  if (filename && filename.includes(".")) {
    ext = filename.split(".").pop().toLowerCase().trim();
  }

  // 1. 如果有明确扩展名且在映射表中，进行针对性校准
  if (ext && MIME_MAP[ext]) {
    // 特别针对 MKV 容器：无论 Google 返回什么（包括 application/octet-stream 或已有的 x-matroska），强制规范为 video/x-matroska
    if (ext === "mkv") {
      return MIME_MAP.mkv;
    }
    // 若上游返回的是二进制流或通用流，强制用扩展名映射替换
    if (!upstreamType || upstreamType === "application/octet-stream" || upstreamType === "binary/octet-stream") {
      return MIME_MAP[ext];
    }
  }

  // 2. 若上游返回了有效的音视频类型，优先透传
  if (upstreamType && upstreamType !== "application/octet-stream" && upstreamType !== "binary/octet-stream") {
    return upstreamType;
  }

  // 3. 后备默认值
  return ext && MIME_MAP[ext] ? MIME_MAP[ext] : "video/mp4";
}

/**
 * 音视频流式播放代理核心接口
 * 完美支持 HTTP 206 Partial Content、Range 请求、CORS 预检与 HEAD 探测
 */
async function handleStream(context, isHead = false) {
  const { params, request, env } = context;
  const fileId = params.id;
  const url = new URL(request.url);

  if (!fileId) {
    return new Response("Missing file id", { status: 400 });
  }

  // 校验访问权限（若配置了站点密码）
  const authHeader = request.headers.get("Authorization") || "";
  const clientToken = authHeader.replace(/^Bearer\s+/i, "") || url.searchParams.get("token") || "";

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

  // 获取请求中携带的自定义文件名（用于校准 Content-Type 及外部播放器识别）
  let customFilename = url.searchParams.get("filename") || url.searchParams.get("name") || "";

  try {
    const token = await getAccessToken(env);

    // 若 URL 未提供文件名（如外部播放器或直链切换未带参数），通过短缓存或 Google Drive 补充
    if (!customFilename && token) {
      customFilename = await getCachedFilename(fileId, token);
    } else if (customFilename) {
      filenameCache.set(fileId, { timestamp: Date.now(), name: customFilename });
    }

    // 1. 获取客户端的 Range 请求头及条件请求标头
    const clientRange = request.headers.get("Range");
    const ifRange = request.headers.get("If-Range");
    const ifMatch = request.headers.get("If-Match");

    // 2. 构造发往 Google Drive API 的请求
    const googleDriveUrl = `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(
      fileId
    )}?alt=media&supportsAllDrives=true`;

    const fetchHeaders = new Headers();
    fetchHeaders.set("Authorization", `Bearer ${token}`);
    if (clientRange) {
      fetchHeaders.set("Range", clientRange);
    }
    if (ifRange) {
      fetchHeaders.set("If-Range", ifRange);
    }
    if (ifMatch) {
      fetchHeaders.set("If-Match", ifMatch);
    }

    // 3. 请求 Google Drive API 获取媒体流
    const googleResp = await fetch(googleDriveUrl, {
      method: isHead ? "HEAD" : "GET",
      headers: fetchHeaders,
    });

    // 针对 416 Range Not Satisfiable 进行标准透传
    if (googleResp.status === 416) {
      const respHeaders = new Headers();
      respHeaders.set("Accept-Ranges", "bytes");
      const contentRange = googleResp.headers.get("Content-Range");
      if (contentRange) respHeaders.set("Content-Range", contentRange);
      return new Response(null, { status: 416, headers: respHeaders });
    }

    if (!googleResp.ok && googleResp.status !== 206) {
      const errText = await googleResp.text();
      return new Response(`Google Drive 流式传输失败 [${googleResp.status}]: ${errText}`, {
        status: googleResp.status,
      });
    }

    // 4. 构建返回给浏览器的响应头，透传 Range 分片所需信息
    const responseHeaders = new Headers();
    responseHeaders.set("Accept-Ranges", "bytes");

    // 透传并校准 Content-Type，杜绝 application/octet-stream 导致的黑屏
    const rawContentType = googleResp.headers.get("Content-Type");
    const resolvedType = resolveContentType(customFilename, rawContentType);
    responseHeaders.set("Content-Type", resolvedType);

    // 透传 Content-Length
    const contentLength = googleResp.headers.get("Content-Length");
    if (contentLength) {
      responseHeaders.set("Content-Length", contentLength);
    }

    // 透传 Content-Range (206 分片关键)
    const contentRange = googleResp.headers.get("Content-Range");
    if (contentRange) {
      responseHeaders.set("Content-Range", contentRange);
    }

    // 透传 ETag 与 Last-Modified（支持条件请求强一致性与多线程分片定位）
    const etag = googleResp.headers.get("ETag");
    if (etag) {
      responseHeaders.set("ETag", etag);
    }
    const lastModified = googleResp.headers.get("Last-Modified");
    if (lastModified) {
      responseHeaders.set("Last-Modified", lastModified);
    }

    // 规范 Content-Disposition，方便外部播放器（PotPlayer、VLC、MPV、IINA）识别真实文件名
    if (customFilename) {
      const safeFilename = customFilename.replace(/["\r\n]/g, "");
      const encodedFilename = encodeURIComponent(customFilename);
      responseHeaders.set(
        "Content-Disposition",
        `inline; filename="${safeFilename}"; filename*=UTF-8''${encodedFilename}`
      );
    } else {
      responseHeaders.set("Content-Disposition", "inline");
    }

    // 边缘缓存配置
    responseHeaders.set("Cache-Control", "public, max-age=14400, stale-while-revalidate=86400");

    // 确保 CORS 标头及分片暴露标头齐全，保障 Canvas 截图与前端流探测
    responseHeaders.set("Access-Control-Allow-Origin", "*");
    responseHeaders.set("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS");
    responseHeaders.set("Access-Control-Allow-Headers", "Range, Authorization, Content-Type, Origin, Accept, If-Range, If-Match");
    responseHeaders.set(
      "Access-Control-Expose-Headers",
      "Content-Range, Content-Length, Accept-Ranges, Content-Type, Content-Disposition, ETag, Last-Modified"
    );

    // 返回 206 或 200 状态码
    return new Response(isHead ? null : googleResp.body, {
      status: googleResp.status,
      statusText: googleResp.statusText,
      headers: responseHeaders,
    });
  } catch (error) {
    return new Response(`流代理错误: ${error.message}`, { status: 500 });
  }
}

export async function onRequestGet(context) {
  return handleStream(context, false);
}

export async function onRequestHead(context) {
  return handleStream(context, true);
}

export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
      "Access-Control-Allow-Headers": "Range, Authorization, Content-Type, Origin, Accept",
      "Access-Control-Max-Age": "86400",
    },
  });
}
