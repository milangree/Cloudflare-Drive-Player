import { getAccessToken, getCredentials } from "../../utils/googleAuth.js";
import { getSystemConfig, timingSafeEqual } from "../../utils/configManager.js";

/**
 * Telegram Bot Webhook 处理器
 *
 * 接收用户通过 Telegram 发送的文档、视频、音频、图片等媒体与文件，
 * 中转上传至 Google Drive 指定文件夹，并回消息给用户提供播放与下载直链。
 *
 * 【重要】Telegram Bot API 的 getFile 对可下载文件有 20MB 上限，
 * 因此本处理器采用「一次读取后上传」而非真流式；上限校验前置到拉取之前，
 * 避免无效的出站请求与配额消耗。
 */

// Telegram Bot API getFile 可下载的文件大小上限 (20 MB)
const TG_MAX_FILE_BYTES = 20 * 1024 * 1024;

// 出站请求超时预算 (毫秒)
const TG_TIMEOUT_MS = 15000;
const DRIVE_TIMEOUT_MS = 60000;

/**
 * HTML 转义：所有插值进 Telegram parse_mode=HTML 的内容必须先转义，
 * 否则文件名含 < 或 & 会让 sendMessage 返回 400，用户将收不到任何反馈。
 */
function escapeHtml(value) {
  return String(value == null ? "" : value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * 构造带错误码的异常。
 * transient=true 时由调用方返回 5xx，让 Telegram 按自身退避策略重推；
 * transient=false 表示永久性故障，返回 200 避免 Telegram 无限重试。
 */
function tgError(code, transient = false) {
  const err = new Error(code);
  err.code = code;
  err.transient = transient;
  return err;
}

/**
 * 错误码 -> 用户可见的固定中文文案。
 * 原始错误只进日志，不回吐给用户（避免泄露内部路径、配额与凭据细节）。
 */
const ERROR_MESSAGES = {
  TG_UNREACHABLE: "无法连接 Telegram 服务器，请稍后重试。",
  TG_BAD_RESPONSE: "Telegram 返回异常响应，请稍后重试。",
  TG_NO_FILE_PATH: "Telegram 返回的文件信息无效，请重新发送该文件。",
  TG_FETCH_FAILED: "从 Telegram 拉取文件失败，请稍后重试。",
  FILE_TOO_LARGE:
    "文件超过 Telegram Bot API 的 20MB 上限，无法通过机器人转存。请压缩文件或改用其它方式上传。",
  DRIVE_QUOTA:
    "Google Drive 存储配额不足。请将目标目录设为共享云端硬盘 (Shared Drive)，或在网盘中授予该服务账号对共享目录的管理特权。",
  DRIVE_AUTH: "Google Drive 授权失败，请检查服务账号凭据配置是否正确。",
  DRIVE_UPLOAD_FAILED: "Google Drive 上传失败，请稍后重试。",
  UNKNOWN: "转存失败，请稍后重试。",
};

async function sendTelegramMessage(botToken, chatId, text) {
  const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    signal: AbortSignal.timeout(TG_TIMEOUT_MS),
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: "HTML",
      disable_web_page_preview: true,
    }),
  });
  const data = await res.json().catch(() => null);
  return Boolean(data && data.ok);
}

async function getTelegramFilePath(botToken, fileId) {
  const url = `https://api.telegram.org/bot${botToken}/getFile?file_id=${encodeURIComponent(fileId)}`;
  let res;
  try {
    res = await fetch(url, { signal: AbortSignal.timeout(TG_TIMEOUT_MS) });
  } catch (_) {
    throw tgError("TG_UNREACHABLE", true);
  }
  if (!res.ok) throw tgError("TG_BAD_RESPONSE", true);
  const data = await res.json().catch(() => null);
  if (!data || data.ok !== true || !data.result || !data.result.file_path) {
    throw tgError("TG_NO_FILE_PATH", false);
  }
  return { filePath: data.result.file_path, fileSize: data.result.file_size };
}

/**
 * 幂等：以 Telegram file_unique_id 为键，避免 Telegram 重推导致重复上传。
 * 查询失败时返回 null（降级为不去重），不影响主链路。
 */
async function findExistingByUniqueId(googleToken, folderId, uniqueId) {
  const safeId = String(uniqueId).replace(/'/g, "\\'");
  const q =
    `'${folderId}' in parents and trashed = false and ` +
    `appProperties has { key = 'cfTgFileUniqueId' and value = '${safeId}' }`;
  const url =
    "https://www.googleapis.com/drive/v3/files?q=" +
    encodeURIComponent(q) +
    "&fields=files(id,name)&supportsAllDrives=true&includeItemsFromAllDrives=true&pageSize=1&orderBy=createdTime desc";
  try {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${googleToken}` },
      signal: AbortSignal.timeout(TG_TIMEOUT_MS),
    });
    if (!res.ok) return null;
    const data = await res.json().catch(() => null);
    const file = data && Array.isArray(data.files) && data.files[0];
    return file ? { id: file.id, name: file.name } : null;
  } catch (_) {
    return null;
  }
}

export async function onRequestPost(context) {
  const { request, env } = context;

  const config = await getSystemConfig(env);

  // 0. Telegram 来源校验：仅当配置了 secret 时启用（恒定时间比较，防时序侧信道）
  const expectedSecret = (env.TELEGRAM_WEBHOOK_SECRET || env.TG_WEBHOOK_SECRET || "").trim();
  if (expectedSecret) {
    const provided = request.headers.get("X-Telegram-Bot-Api-Secret-Token") || "";
    if (!timingSafeEqual(provided, expectedSecret)) {
      return new Response(JSON.stringify({ ok: false, error: "未授权的 Telegram Webhook 调用" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }
  }

  const botToken = (config.tgBotToken || env.TELEGRAM_BOT_TOKEN || env.TG_BOT_TOKEN || "").trim();
  if (!botToken) {
    return new Response(JSON.stringify({ ok: false, error: "Telegram Bot Token 未配置" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  // 1. 解析 Telegram Webhook Payload
  let update = null;
  try {
    update = await request.json();
  } catch (_) {
    return new Response("Invalid JSON", { status: 400 });
  }

  const message = update.message || update.channel_post;
  if (!message) {
    return new Response(JSON.stringify({ ok: true, ignored: true }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  const chatId = message.chat.id;
  const fromUser = message.from || {};
  const userId = String(fromUser.id || "");
  const username = fromUser.username ? `@${fromUser.username}` : (fromUser.first_name || "用户");

  // 2. 文本指令：/start /help —— 放行，便于用户自助获取配置指引
  const text = (message.text || "").trim();
  if (text.startsWith("/start") || text.startsWith("/help")) {
    const helpMsg =
      `🤖 <b>Cloudflare Drive 转存机器人</b>\n\n` +
      `直接将任意<b>视频、音乐、文档或照片</b>发送给本机器人，系统会自动同步到您的 Google 云盘。\n\n` +
      `📌 <b>当前配置：</b>\n` +
      `• 用户: ${escapeHtml(username)} (ID: <code>${escapeHtml(userId)}</code>)\n` +
      `• 站点: <b>${escapeHtml(config.siteName || "Cloudflare Drive Player")}</b>\n` +
      `• 存放目录: <code>${escapeHtml(config.tgUploadFolderId || "默认网盘根目录")}</code>\n\n` +
      `💡 <i>文件上限 20MB（Telegram Bot API 限制）。上传成功后会返回站内在线播放与下载直链。</i>`;
    await sendTelegramMessage(botToken, chatId, helpMsg).catch(() => false);
    return new Response(JSON.stringify({ ok: true }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  // 3. 用户白名单权限校验 (fail-closed：未配置白名单即拒绝所有上传请求)
  const rawAllowed = (config.tgAllowedUsers || env.TELEGRAM_ALLOWED_USERS || env.TG_ALLOWED_USERS || "").trim();
  const allowedList = rawAllowed
    .split(/[,，\s]+/)
    .map((item) => item.trim().replace(/^@/, "").toLowerCase())
    .filter(Boolean);
  const matchId = allowedList.includes(userId);
  const matchUsername = Boolean(fromUser.username) && allowedList.includes(fromUser.username.toLowerCase());

  if (!matchId && !matchUsername) {
    await sendTelegramMessage(
      botToken,
      chatId,
      `⚠️ <b>无操作权限</b>\n\n` +
        `抱歉，您的账号 (ID: <code>${escapeHtml(userId)}</code>) 未在管理员白名单中。\n` +
        `请联系管理员在后台「Telegram 媒体转存机器人」中将您的 ID 或 Username 加入许可列表。`
    ).catch(() => false);
    return new Response(JSON.stringify({ ok: true, denied: true }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  // 4. 提取待转存的媒体或文件对象
  let fileObj = null;
  let defaultExt = "";
  let mimeType = "application/octet-stream";

  if (message.document) {
    fileObj = message.document;
    mimeType = fileObj.mime_type || "application/octet-stream";
  } else if (message.video) {
    fileObj = message.video;
    mimeType = fileObj.mime_type || "video/mp4";
    defaultExt = ".mp4";
  } else if (message.audio) {
    fileObj = message.audio;
    mimeType = fileObj.mime_type || "audio/mpeg";
    defaultExt = ".mp3";
  } else if (message.photo && Array.isArray(message.photo) && message.photo.length > 0) {
    // 照片取分辨率最高的一张（数组最后一项）
    fileObj = message.photo[message.photo.length - 1];
    mimeType = "image/jpeg";
    defaultExt = ".jpg";
  } else if (message.voice) {
    fileObj = message.voice;
    mimeType = fileObj.mime_type || "audio/ogg";
    defaultExt = ".ogg";
  }

  if (!fileObj || !fileObj.file_id) {
    if (text) {
      await sendTelegramMessage(
        botToken,
        chatId,
        `💡 请直接将需要转存的<b>视频、音乐、文档或照片</b>发送给机器人，系统将自动帮您同步到 Google Drive。`
      ).catch(() => false);
    }
    return new Response(JSON.stringify({ ok: true, ignored: "no_media" }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  // 5. 大小前置校验：超限直接拒绝，不发起任何拉取/上传请求
  const declaredSize = Number(fileObj.file_size || 0);
  if (declaredSize > TG_MAX_FILE_BYTES) {
    await sendTelegramMessage(botToken, chatId, `⚠️ <b>文件过大</b>\n\n${escapeHtml(ERROR_MESSAGES.FILE_TOO_LARGE)}`).catch(
      () => false
    );
    return new Response(JSON.stringify({ ok: true, ignored: "too_large" }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  // 6. 计算文件名
  let fileName = fileObj.file_name;
  if (!fileName) {
    const timestamp = new Date().toISOString().replace(/[-:T]/g, "").slice(0, 14);
    fileName = `TG_${timestamp}_${fileObj.file_unique_id || Math.random().toString(36).slice(2, 8)}${defaultExt}`;
  }

  // 7. 发送「正在处理中」状态提示
  await sendTelegramMessage(
    botToken,
    chatId,
    `⏳ <b>正在同步至 Google Drive...</b>\n\n` +
      `📄 <b>文件名:</b> <code>${escapeHtml(fileName)}</code>\n` +
      `📦 <b>文件大小:</b> ${((declaredSize || 0) / 1024 / 1024).toFixed(2)} MB\n\n` +
      `<i>正在通过 Cloudflare 边缘计算转存，请稍候...</i>`
  ).catch(() => false);

  try {
    // 8. 获取 Telegram 文件下载链接
    const { filePath } = await getTelegramFilePath(botToken, fileObj.file_id);
    const tgDownloadUrl = `https://api.telegram.org/file/bot${botToken}/${filePath}`;

    // 9. 发起下载流
    let tgRes;
    try {
      tgRes = await fetch(tgDownloadUrl, { signal: AbortSignal.timeout(DRIVE_TIMEOUT_MS) });
    } catch (_) {
      throw tgError("TG_FETCH_FAILED", true);
    }
    if (!tgRes.ok) throw tgError("TG_FETCH_FAILED", true);

    let googleToken;
    try {
      googleToken = await getAccessToken(env);
    } catch (_) {
      throw tgError("DRIVE_AUTH", false);
    }
    const creds = getCredentials(env);
    const targetFolderId = config.tgUploadFolderId || creds.rootFolderId || "root";
    const uniqueId = fileObj.file_unique_id || fileObj.file_id;

    // 10. 幂等检查：同一 file_unique_id 已转存过则复用，不再重复上传
    const existing = await findExistingByUniqueId(googleToken, targetFolderId, uniqueId);
    const originUrl = new URL(request.url).origin;

    if (existing) {
      const playUrl = `${originUrl}/?file=${encodeURIComponent(existing.id)}`;
      const directDownloadUrl = `${originUrl}/api/download/${existing.id}?filename=${encodeURIComponent(
        existing.name || fileName
      )}`;
      await sendTelegramMessage(
        botToken,
        chatId,
        `✅ <b>文件已存在（已跳过重复上传）</b>\n\n` +
          `📄 <b>文件名:</b> <code>${escapeHtml(existing.name || fileName)}</code>\n` +
          `🆔 <b>文件 ID:</b> <code>${existing.id}</code>\n\n` +
          `🔗 <b>在线播放/浏览:</b>\n<a href="${playUrl}">点击在线查看</a>\n\n` +
          `📥 <b>本站下载直链:</b>\n<a href="${directDownloadUrl}">点击极速下载</a>`
      ).catch(() => false);
      return new Response(JSON.stringify({ ok: true, deduped: true, fileId: existing.id }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    // 11. 读取文件内容并二次校验大小
    const fileBuffer = await tgRes.arrayBuffer();
    if (fileBuffer.byteLength > TG_MAX_FILE_BYTES) throw tgError("FILE_TOO_LARGE", false);

    // 12. 使用 Google Drive multipart 上传协议
    const boundary = "-------CFDrivePlayerTGBoundary" + Date.now();
    const delimiter = `\r\n--${boundary}\r\n`;
    const closeDelimiter = `\r\n--${boundary}--`;

    const metadata = {
      name: fileName,
      mimeType: mimeType.split(";")[0].trim(),
      parents: [targetFolderId],
      appProperties: { cfTgFileUniqueId: uniqueId },
    };

    const encoder = new TextEncoder();
    const headPart = encoder.encode(
      delimiter +
        "Content-Type: application/json; charset=UTF-8\r\n\r\n" +
        JSON.stringify(metadata) +
        delimiter +
        `Content-Type: ${mimeType}\r\n\r\n`
    );
    const tailPart = encoder.encode(closeDelimiter);

    const fullPayload = new Uint8Array(headPart.byteLength + fileBuffer.byteLength + tailPart.byteLength);
    fullPayload.set(headPart, 0);
    fullPayload.set(new Uint8Array(fileBuffer), headPart.byteLength);
    fullPayload.set(tailPart, headPart.byteLength + fileBuffer.byteLength);

    const uploadUrl =
      "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true";

    let driveUploadRes;
    try {
      driveUploadRes = await fetch(uploadUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${googleToken}`,
          "Content-Type": `multipart/related; boundary=${boundary}`,
        },
        body: fullPayload,
        signal: AbortSignal.timeout(DRIVE_TIMEOUT_MS),
      });
    } catch (_) {
      throw tgError("DRIVE_UPLOAD_FAILED", true);
    }

    if (!driveUploadRes.ok) {
      const errText = await driveUploadRes.text().catch(() => "");
      if (/storageQuotaExceeded|Service Accounts do not have storage quota/.test(errText)) {
        throw tgError("DRIVE_QUOTA", false);
      }
      if (/insufficientPermissions|forbidden|unauthorized|invalid_grant|Invalid Credentials/.test(errText)) {
        throw tgError("DRIVE_AUTH", false);
      }
      throw tgError("DRIVE_UPLOAD_FAILED", driveUploadRes.status >= 500 || driveUploadRes.status === 429);
    }

    const uploadedFile = await driveUploadRes.json().catch(() => null);
    if (!uploadedFile || !uploadedFile.id) throw tgError("DRIVE_UPLOAD_FAILED", false);

    const playUrl = `${originUrl}/?file=${encodeURIComponent(uploadedFile.id)}`;
    const directDownloadUrl = `${originUrl}/api/download/${uploadedFile.id}?filename=${encodeURIComponent(fileName)}`;

    // 13. 成功响应
    await sendTelegramMessage(
      botToken,
      chatId,
      `🎉 <b>文件转存成功！</b>\n\n` +
        `📄 <b>文件名:</b> <code>${escapeHtml(fileName)}</code>\n` +
        `🆔 <b>文件 ID:</b> <code>${uploadedFile.id}</code>\n` +
        `📁 <b>已存入目录:</b> <code>${escapeHtml(targetFolderId)}</code>\n\n` +
        `🔗 <b>在线播放/浏览:</b>\n<a href="${playUrl}">点击在线查看</a>\n\n` +
        `📥 <b>本站下载直链:</b>\n<a href="${directDownloadUrl}">点击极速下载</a>`
    ).catch(() => false);

    return new Response(JSON.stringify({ ok: true, fileId: uploadedFile.id }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    const code = (err && err.code) || "UNKNOWN";
    const message = ERROR_MESSAGES[code] || ERROR_MESSAGES.UNKNOWN;
    // 原始错误仅入日志，不回吐给用户
    console.error(
      `[telegram-webhook] update_id=${update && update.update_id} code=${code} transient=${Boolean(
        err && err.transient
      )} err=${err && err.message}`
    );
    try {
      await sendTelegramMessage(botToken, chatId, `❌ <b>转存失败</b>\n\n${escapeHtml(message)}`);
    } catch (_) {}

    // 瞬时故障返回 5xx，让 Telegram 按退避策略重推；永久故障返回 200 避免无限重试
    if (err && err.transient) {
      return new Response(JSON.stringify({ ok: false, error: message }), {
        status: 502,
        headers: { "Content-Type": "application/json" },
      });
    }
    return new Response(JSON.stringify({ ok: true }), {
      headers: { "Content-Type": "application/json" },
    });
  }
}

export async function onRequestGet(context) {
  return new Response("Telegram Bot Webhook Endpoint is Running (Cloudflare Drive Player).", {
    status: 200,
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
