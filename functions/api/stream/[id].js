import { getAccessToken } from "../../utils/googleAuth.js";

/**
 * 音视频流式播放代理核心接口
 * 完美支持 HTTP 206 Partial Content 与 Range 请求，支持音视频拖拽进度条
 */
export async function onRequestGet(context) {
  const { params, request, env } = context;
  const fileId = params.id;

  if (!fileId) {
    return new Response("Missing file id", { status: 400 });
  }

  try {
    const token = await getAccessToken(env);

    // 1. 获取客户端的 Range 请求头
    const clientRange = request.headers.get("Range");

    // 2. 构造发往 Google Drive API 的请求
    const googleDriveUrl = `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(
      fileId
    )}?alt=media&supportsAllDrives=true`;

    const fetchHeaders = new Headers();
    fetchHeaders.set("Authorization", `Bearer ${token}`);
    if (clientRange) {
      fetchHeaders.set("Range", clientRange);
    }

    // 3. 请求 Google Drive API 获取媒体流
    const googleResp = await fetch(googleDriveUrl, {
      method: "GET",
      headers: fetchHeaders,
    });

    if (!googleResp.ok && googleResp.status !== 206) {
      const errText = await googleResp.text();
      return new Response(`Google Drive 流式传输失败 [${googleResp.status}]: ${errText}`, {
        status: googleResp.status,
      });
    }

    // 4. 构建返回给浏览器的响应头，透传 Range 分片所需信息
    const responseHeaders = new Headers();
    responseHeaders.set("Accept-Ranges", "bytes");

    // 透传 Content-Type
    const contentType = googleResp.headers.get("Content-Type");
    if (contentType) {
      responseHeaders.set("Content-Type", contentType);
    } else {
      responseHeaders.set("Content-Type", "video/mp4");
    }

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

    // 允许浏览器以 inline 方式播放
    responseHeaders.set("Content-Disposition", "inline");

    // 边缘缓存配置
    responseHeaders.set("Cache-Control", "public, max-age=14400");

    // 返回 206 或 200 状态码
    return new Response(googleResp.body, {
      status: googleResp.status,
      statusText: googleResp.statusText,
      headers: responseHeaders,
    });
  } catch (error) {
    return new Response(`流代理错误: ${error.message}`, { status: 500 });
  }
}
