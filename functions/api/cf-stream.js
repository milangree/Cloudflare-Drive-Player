/**
 * Cloudflare Stream 云端转码与在线播放服务集成
 * 支持自动将 Google Drive 的 MKV/HEVC 等视频异步拉取并云端切片为自适应码率 HLS
 */

function getCfCredentials(env) {
  const accountId = env.CF_ACCOUNT_ID || env.CLOUDFLARE_ACCOUNT_ID || "";
  const apiToken = env.CF_STREAM_API_TOKEN || env.CF_API_TOKEN || "";
  return { accountId: accountId.trim(), apiToken: apiToken.trim() };
}

// 检查该 fileId 是否已在 Cloudflare Stream 中转码或正在转码
async function findExistingStreamVideo(accountId, apiToken, fileId) {
  try {
    const listUrl = `https://api.cloudflare.com/client/v4/accounts/${accountId}/stream?limit=100`;
    const resp = await fetch(listUrl, {
      headers: {
        Authorization: `Bearer ${apiToken}`,
      },
    });

    if (!resp.ok) return null;
    const data = await resp.json();
    if (!data.success || !Array.isArray(data.result)) return null;

    // 匹配 metadata 中的 fileId
    const found = data.result.find((v) => v.meta && v.meta.fileId === fileId);
    return found || null;
  } catch (_) {
    return null;
  }
}

// GET: 查询视频在 Cloudflare Stream 中的转码状态
export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const fileId = url.searchParams.get("fileId");

  const noCacheHeaders = {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store, no-cache, must-revalidate",
  };

  const { accountId, apiToken } = getCfCredentials(env);
  if (!accountId || !apiToken) {
    return new Response(
      JSON.stringify({
        success: false,
        notConfigured: true,
        message: "尚未在 Cloudflare Pages 环境变量中配置 CF_ACCOUNT_ID 与 CF_STREAM_API_TOKEN",
      }),
      { status: 200, headers: noCacheHeaders }
    );
  }

  if (!fileId) {
    return new Response(
      JSON.stringify({ success: false, error: "缺少 fileId 参数" }),
      { status: 400, headers: noCacheHeaders }
    );
  }

  try {
    const existing = await findExistingStreamVideo(accountId, apiToken, fileId);
    if (existing) {
      return new Response(
        JSON.stringify({
          success: true,
          exists: true,
          video: {
            uid: existing.uid,
            readyToStream: existing.readyToStream,
            status: existing.status,
            duration: existing.duration,
            playback: existing.playback,
            preview: existing.preview,
          },
        }),
        { headers: noCacheHeaders }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        exists: false,
      }),
      { headers: noCacheHeaders }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ success: false, error: err.message }),
      { status: 500, headers: noCacheHeaders }
    );
  }
}

// POST: 发起转码任务（Copy from URL）
export async function onRequestPost(context) {
  const { request, env } = context;
  const noCacheHeaders = {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store, no-cache, must-revalidate",
  };

  const { accountId, apiToken } = getCfCredentials(env);
  if (!accountId || !apiToken) {
    return new Response(
      JSON.stringify({
        success: false,
        notConfigured: true,
        message: "尚未在 Cloudflare Pages 环境变量中配置 CF_ACCOUNT_ID 与 CF_STREAM_API_TOKEN",
      }),
      { status: 200, headers: noCacheHeaders }
    );
  }

  try {
    const body = await request.json();
    const { fileId, fileName } = body;

    if (!fileId) {
      return new Response(
        JSON.stringify({ success: false, error: "缺少 fileId" }),
        { status: 400, headers: noCacheHeaders }
      );
    }

    // 1. 先检查是否已经存在
    const existing = await findExistingStreamVideo(accountId, apiToken, fileId);
    if (existing) {
      return new Response(
        JSON.stringify({
          success: true,
          video: existing,
          alreadyExisted: true,
        }),
        { headers: noCacheHeaders }
      );
    }

    // 2. 构造视频源直链
    const origin = new URL(request.url).origin;
    const mediaStreamUrl = `${origin}/api/stream/${fileId}`;

    // 3. 向 Cloudflare Stream API 提交 copy 任务
    const copyUrl = `https://api.cloudflare.com/client/v4/accounts/${accountId}/stream/copy`;
    const cfResp = await fetch(copyUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        url: mediaStreamUrl,
        meta: {
          name: fileName || fileId,
          fileId: fileId,
        },
        requireSignedURLs: false,
      }),
    });

    const cfData = await cfResp.json();
    if (!cfResp.ok || !cfData.success) {
      const errMsg = (cfData.errors && cfData.errors[0] && cfData.errors[0].message) || "提交 Cloudflare Stream 任务失败";
      return new Response(
        JSON.stringify({ success: false, error: errMsg }),
        { status: cfResp.status, headers: noCacheHeaders }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        video: cfData.result,
        alreadyExisted: false,
      }),
      { headers: noCacheHeaders }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ success: false, error: err.message }),
      { status: 500, headers: noCacheHeaders }
    );
  }
}
