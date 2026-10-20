import { getAccessToken, getCredentials } from "../utils/googleAuth.js";

export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);

  try {
    const creds = getCredentials(env);
    const token = await getAccessToken(env);

    let folderId = url.searchParams.get("folderId") || creds.rootFolderId || "root";
    const pageToken = url.searchParams.get("pageToken") || "";
    const search = url.searchParams.get("search") || "";

    // 1. 构建查询 query
    let q = `'${folderId}' in parents and trashed = false`;
    if (search.trim()) {
      // 如果有全局搜索词，可以在当前目录下或者全局进行名字匹配
      q = `trashed = false and name contains '${search.trim().replace(/'/g, "\\'")}'`;
    }

    const driveApiUrl = new URL("https://www.googleapis.com/drive/v3/files");
    driveApiUrl.searchParams.set("q", q);
    driveApiUrl.searchParams.set(
      "fields",
      "nextPageToken, files(id, name, mimeType, size, modifiedTime, thumbnailLink, iconLink, videoMediaMetadata)"
    );
    driveApiUrl.searchParams.set("orderBy", "folder, name_natural asc");
    driveApiUrl.searchParams.set("pageSize", "100");
    driveApiUrl.searchParams.set("supportsAllDrives", "true");
    driveApiUrl.searchParams.set("includeItemsFromAllDrives", "true");

    if (pageToken) {
      driveApiUrl.searchParams.set("pageToken", pageToken);
    }

    const filesResp = await fetch(driveApiUrl.toString(), {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!filesResp.ok) {
      const err = await filesResp.text();
      return new Response(
        JSON.stringify({
          success: false,
          error: `Google Drive API 查询失败: ${err}`,
        }),
        {
          status: filesResp.status,
          headers: { "Content-Type": "application/json; charset=utf-8" },
        }
      );
    }

    const data = await filesResp.json();

    // 2. 如果不是全局搜索，获取当前文件夹的名称以方便生成面包屑
    let currentFolderName = "根目录";
    if (folderId !== "root" && !search.trim()) {
      try {
        const metaResp = await fetch(
          `https://www.googleapis.com/drive/v3/files/${folderId}?supportsAllDrives=true&fields=id,name`,
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );
        if (metaResp.ok) {
          const meta = await metaResp.json();
          currentFolderName = meta.name || currentFolderName;
        }
      } catch (_) {
        // 忽略文件夹名字获取错误，降级使用 ID
      }
    }

    // 3. 规范化并对文件进行分类整理
    const items = (data.files || []).map((f) => {
      const isFolder = f.mimeType === "application/vnd.google-apps.folder";
      const isVideo = f.mimeType.startsWith("video/") || /\.(mp4|mkv|webm|avi|mov|flv|m4v)$/i.test(f.name);
      const isAudio = f.mimeType.startsWith("audio/") || /\.(mp3|wav|ogg|flac|aac|m4a)$/i.test(f.name);
      const isImage = f.mimeType.startsWith("image/") || /\.(jpg|jpeg|png|gif|webp|svg|bmp)$/i.test(f.name);
      const isDocument = /\.(pdf|txt|md|json|log|csv)$/i.test(f.name);

      return {
        id: f.id,
        name: f.name,
        mimeType: f.mimeType,
        size: f.size ? parseInt(f.size, 10) : 0,
        modifiedTime: f.modifiedTime,
        thumbnailLink: f.thumbnailLink || null,
        isFolder,
        isVideo,
        isAudio,
        isImage,
        isDocument,
      };
    });

    return new Response(
      JSON.stringify({
        success: true,
        currentFolder: {
          id: folderId,
          name: currentFolderName,
        },
        items,
        nextPageToken: data.nextPageToken || null,
      }),
      {
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          // 缓存 30 秒，加速用户切目录体验
          "Cache-Control": "public, max-age=30, s-maxage=30",
        },
      }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json; charset=utf-8" },
      }
    );
  }
}
