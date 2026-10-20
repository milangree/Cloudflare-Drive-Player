import { getAccessToken, getCredentials, parseDrives } from "../utils/googleAuth.js";

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
    const drives = parseDrives(env);

    // 为没有显式自定义命名的盘，从 Google Drive 查询真实文件夹名称
    await Promise.all(
      drives.map(async (drive) => {
        if ((!drive.name || drive.name.startsWith("云盘") || drive.name === "主云盘") && drive.id !== "root") {
          try {
            const metaResp = await fetch(
              `https://www.googleapis.com/drive/v3/files/${drive.id}?supportsAllDrives=true&fields=name`,
              {
                headers: { Authorization: `Bearer ${token}` },
              }
            );
            if (metaResp.ok) {
              const meta = await metaResp.json();
              if (meta.name) drive.name = meta.name;
            }
          } catch (_) {}
        }
      })
    );

    const defaultDrive = drives[0] || { id: "root", name: "Google 云端硬盘" };
    const customSiteName = env.SITE_NAME ? env.SITE_NAME.trim() : "";
    const displaySiteName = customSiteName || (defaultDrive.name ? `${defaultDrive.name} - Drive Player` : "Cloudflare Drive Player");

    return new Response(
      JSON.stringify({
        success: true,
        configured: true,
        siteName: displaySiteName,
        drives,
        defaultDriveId: defaultDrive.id,
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
