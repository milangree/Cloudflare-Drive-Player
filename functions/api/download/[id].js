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

    // 1. 查询文件元数据（检查是否为文件夹、Google Docs文档等）
    let mimeType = "";
    try {
      const metaResp = await fetch(
        `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?supportsAllDrives=true&fields=name,mimeType`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      if (metaResp.ok) {
        const meta = await metaResp.json();
        if (!customFilename && meta.name) {
          customFilename = meta.name;
        }
        mimeType = meta.mimeType || "";
      }
    } catch (_) {}

    // 2. 文件夹不可直接单文件流下载
    if (mimeType === "application/vnd.google-apps.folder") {
      return new Response(
        JSON.stringify({
          error: "无法直接下载文件夹，请进入文件夹下载其中的音视频或文件。",
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json; charset=utf-8" },
        }
      );
    }

    if (!customFilename) {
      customFilename = `file_${fileId}`;
    }

    // 3. 处理 Google Docs/Sheets/Slides 等专用在线文档导出
    let downloadEndpoint = `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?alt=media&supportsAllDrives=true`;
    if (mimeType.startsWith("application/vnd.google-apps.")) {
      let exportMime = "application/pdf";
      let ext = ".pdf";
      if (mimeType.includes("spreadsheet")) {
        exportMime = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
        ext = ".xlsx";
      } else if (mimeType.includes("presentation")) {
        exportMime = "application/vnd.openxmlformats-officedocument.presentationml.presentation";
        ext = ".pptx";
      } else if (mimeType.includes("document")) {
        exportMime = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
        ext = ".docx";
      }
      if (!customFilename.includes(".")) customFilename += ext;
      downloadEndpoint = `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}/export?mimeType=${encodeURIComponent(exportMime)}&supportsAllDrives=true`;
    }

    // 从 Google Drive 下载文件流
    const googleResp = await fetch(downloadEndpoint, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

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
