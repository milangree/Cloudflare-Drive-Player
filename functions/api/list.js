import { getAccessToken, getCredentials } from "../utils/googleAuth.js";
import { verifyAccessToken, verifyAdminToken } from "../utils/configManager.js";

// 内存级短缓存，避免重复切换目录频繁向 Google 查询文件夹大小与数量
const statsCache = new Map();
const STATS_TTL = 60 * 1000; // 60 秒缓存

async function getFolderStats(folderId, token) {
  const cached = statsCache.get(folderId);
  const now = Date.now();
  if (cached && now - cached.timestamp < STATS_TTL) {
    return cached.data;
  }

  try {
    const statUrl = new URL("https://www.googleapis.com/drive/v3/files");
    statUrl.searchParams.set("q", `'${folderId}' in parents and trashed = false`);
    statUrl.searchParams.set("fields", "files(id,size,mimeType)");
    statUrl.searchParams.set("pageSize", "1000");
    statUrl.searchParams.set("supportsAllDrives", "true");
    statUrl.searchParams.set("includeItemsFromAllDrives", "true");

    const res = await fetch(statUrl.toString(), {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) {
      return { count: 0, size: 0 };
    }

    const data = await res.json();
    const files = data.files || [];
    const count = files.length;
    const size = files.reduce((acc, cur) => acc + (parseInt(cur.size, 10) || 0), 0);

    const statsResult = { count, size };
    statsCache.set(folderId, { timestamp: now, data: statsResult });
    return statsResult;
  } catch (_) {
    return { count: 0, size: 0 };
  }
}

export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);

  // 校验前台访问权限（如果开启了密码保护）
  const authHeader = request.headers.get("Authorization") || "";
  const clientToken = authHeader.replace(/^Bearer\s+/i, "") || url.searchParams.get("token") || "";

  const isAccessValid = (await verifyAccessToken(clientToken, env)) || (await verifyAdminToken(clientToken, env));
  if (!isAccessValid) {
    return new Response(JSON.stringify({ success: false, requirePassword: true, error: "需要访问密码" }), {
      status: 401,
      headers: { "Content-Type": "application/json; charset=utf-8" },
    });
  }

  try {
    const creds = getCredentials(env);
    const token = await getAccessToken(env);

    const rootFolderId = creds.rootFolderId || "root";
    const folderId = url.searchParams.get("folderId") || rootFolderId;
    const pageToken = url.searchParams.get("pageToken") || "";
    const search = url.searchParams.get("search") || "";

    // 1. 构建查询 query
    let q = `'${folderId}' in parents and trashed = false`;
    if (search.trim()) {
      q = `trashed = false and name contains '${search.trim().replace(/'/g, "\\'")}'`;
    }

    const driveApiUrl = new URL("https://www.googleapis.com/drive/v3/files");
    driveApiUrl.searchParams.set("q", q);
    driveApiUrl.searchParams.set(
      "fields",
      "nextPageToken, files(id, name, mimeType, size, modifiedTime, thumbnailLink, iconLink, videoMediaMetadata, shortcutDetails)"
    );
    driveApiUrl.searchParams.set("orderBy", "folder, name_natural asc");
    driveApiUrl.searchParams.set("pageSize", "1000");
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
      } catch (_) {}
    }

    // 3. 规范化并对文件进行分类整理（支持快捷方式穿透解析，并过滤内部系统配置文件）
    const items = (data.files || [])
      .filter((f) => f.name !== ".cf_drive_config.json")
      .map((f) => {
        let targetId = f.id;
        let targetMimeType = f.mimeType;

      // 如果是 Google Drive 快捷方式，自动穿透解析目标真实 ID 与类型
      if (f.mimeType === "application/vnd.google-apps.shortcut" && f.shortcutDetails) {
        targetId = f.shortcutDetails.targetId || f.id;
        targetMimeType = f.shortcutDetails.targetMimeType || f.mimeType;
      }

      const isFolder = targetMimeType === "application/vnd.google-apps.folder";
      const isVideo = targetMimeType.startsWith("video/") || /\.(mp4|mkv|webm|avi|mov|flv|m4v)$/i.test(f.name);
      const isAudio = targetMimeType.startsWith("audio/") || /\.(mp3|wav|ogg|flac|aac|m4a)$/i.test(f.name);
      const isImage = targetMimeType.startsWith("image/") || /\.(jpg|jpeg|png|gif|webp|svg|bmp)$/i.test(f.name);
      const isDocument = /\.(pdf|txt|md|json|log|csv)$/i.test(f.name);

      return {
        id: targetId,
        name: f.name,
        mimeType: targetMimeType,
        size: f.size ? parseInt(f.size, 10) : 0,
        itemCount: 0,
        modifiedTime: f.modifiedTime,
        thumbnailLink: f.thumbnailLink || null,
        videoMediaMetadata: f.videoMediaMetadata || null,
        isFolder,
        isVideo,
        isAudio,
        isImage,
        isDocument,
      };
    });

    // 4. 并行获取所有子文件夹包含的文件数量与大小
    const folderItems = items.filter((i) => i.isFolder);
    if (folderItems.length > 0) {
      await Promise.all(
        folderItems.map(async (folder) => {
          const stats = await getFolderStats(folder.id, token);
          folder.itemCount = stats.count;
          folder.size = stats.size;
        })
      );
    }

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
