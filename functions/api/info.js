import { getAccessToken, getCredentials } from "../utils/googleAuth.js";

export async function onRequestGet(context) {
  const { env } = context;

  try {
    const creds = getCredentials(env);
    const token = await getAccessToken(env);

    let rootName = "Google 云端硬盘";
    if (creds.rootFolderId && creds.rootFolderId !== "root") {
      try {
        const metaResp = await fetch(
          `https://www.googleapis.com/drive/v3/files/${creds.rootFolderId}?supportsAllDrives=true&fields=name`,
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );
        if (metaResp.ok) {
          const meta = await metaResp.json();
          rootName = meta.name || rootName;
        }
      } catch (_) {}
    }

    return new Response(
      JSON.stringify({
        success: true,
        configured: true,
        siteName: env.SITE_NAME || "CF Drive Player",
        rootFolderId: creds.rootFolderId,
        rootFolderName: rootName,
        clientEmail: creds.clientEmail ? creds.clientEmail.replace(/(.{3}).*(@.*)/, "$1***$2") : null,
      }),
      {
        headers: { "Content-Type": "application/json; charset=utf-8" },
      }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({
        success: false,
        configured: false,
        error: err.message,
      }),
      {
        status: 200, // 返回 200 方便前端优雅展示未配置提示引导
        headers: { "Content-Type": "application/json; charset=utf-8" },
      }
    );
  }
}
