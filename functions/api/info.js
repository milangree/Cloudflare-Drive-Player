import { getAccessToken, getCredentials, getResolvedDrives } from "../utils/googleAuth.js";

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
    const drives = await getResolvedDrives(env, token);

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
