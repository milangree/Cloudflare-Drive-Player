import { getAccessToken, getCredentials } from "../utils/googleAuth.js";

export async function onRequestGet(context) {
  const { env } = context;

  const noCacheHeaders = {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
    Pragma: "no-cache",
  };

  try {
    const creds = getCredentials(env);
    const token = await getAccessToken(env);

    const rootFolderId = creds.rootFolderId || "root";
    let rootName = "主云盘";

    if (rootFolderId !== "root") {
      try {
        const metaResp = await fetch(
          `https://www.googleapis.com/drive/v3/files/${rootFolderId}?supportsAllDrives=true&fields=name`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        if (metaResp.ok) {
          const meta = await metaResp.json();
          if (meta.name) rootName = meta.name;
        }
      } catch (_) {}
    }

    const customSiteName = env.SITE_NAME ? env.SITE_NAME.trim() : "";
    const displaySiteName = customSiteName || `${rootName} - Drive Player`;

    return new Response(
      JSON.stringify({
        success: true,
        configured: true,
        siteName: displaySiteName,
        rootFolderId,
        rootName,
        clientEmail: creds.clientEmail ? creds.clientEmail.replace(/(.{3}).*(@.*)/, "$1***$2") : null,
      }),
      {
        headers: noCacheHeaders,
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
        status: 200,
        headers: noCacheHeaders,
      }
    );
  }
}
