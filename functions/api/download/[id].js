import { getAccessToken } from "../../utils/googleAuth.js";

/**
 * 文件下载代理接口
 * 触发浏览器另存为下载，并保留原始文件名
 */
export async function onRequestGet(context) {
  const { params, request, env } = context;
  const fileId = params.id;
  const url = new URL(request.url);
  let customFilename = url.searchParams.get("filename") || "";

  if (!fileId) {
    return new Response("Missing file id", { status: 400 });
  }

  try {
    const token = await getAccessToken(env);

    // 如果未传文件名，先查询文件元数据获取真实文件名
    if (!customFilename) {
      try {
        const metaResp = await fetch(
          `https://www.googleapis.com/drive/v3/files/${fileId}?supportsAllDrives=true&fields=name,mimeType`,
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );
        if (metaResp.ok) {
          const meta = await metaResp.json();
          customFilename = meta.name;
        }
      } catch (_) {}
    }

    if (!customFilename) {
      customFilename = `file_${fileId}`;
    }

    // 从 Google Drive 下载文件流
    const googleResp = await fetch(
      `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?alt=media&supportsAllDrives=true`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    if (!googleResp.ok) {
      const err = await googleResp.text();
      return new Response(`下载失败 [${googleResp.status}]: ${err}`, { status: googleResp.status });
    }

    const headers = new Headers(googleResp.headers);
    // 处理 RFC 5987 文件名编码，避免中文乱码
    const encodedFilename = encodeURIComponent(customFilename);
    headers.set(
      "Content-Disposition",
      `attachment; filename="${customFilename}"; filename*=UTF-8''${encodedFilename}`
    );

    return new Response(googleResp.body, {
      status: 200,
      headers: headers,
    });
  } catch (error) {
    return new Response(`下载服务异常: ${error.message}`, { status: 500 });
  }
}
