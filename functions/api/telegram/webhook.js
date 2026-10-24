import { getAccessToken, getCredentials } from "../../utils/googleAuth.js";
import { getSystemConfig } from "../../utils/configManager.js";

/**
 * Telegram Bot Webhook 处理器
 * 接收用户通过 Telegram 发送的文档、视频、音频、图片等媒体与文件，
 * 流式中转上传至 Google Drive 指定文件夹中，并给用户实时响应进度与直链。
 */

// 快捷回复 Telegram 文本消息
async function sendTelegramMessage(botToken, chatId, text, parseMode = "HTML") {
  try {
    const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: parseMode,
        disable_web_page_preview: true,
      }),
    });
  } catch (_) {}
}

// 获取 Telegram 文件下载直链
async function getTelegramFilePath(botToken, fileId) {
  const url = `https://api.telegram.org/bot${botToken}/getFile?file_id=${fileId}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`获取 Telegram 文件信息失败: ${res.status}`);
  }
  const data = await res.json();
  if (!data.ok || !data.result || !data.result.file_path) {
    throw new Error(`Telegram 返回无效的文件路径`);
  }
  return {
    filePath: data.result.file_path,
    fileSize: data.result.file_size,
  };
}

export async function onRequestPost(context) {
  const { request, env } = context;

  // 1. 读取系统配置 (优先从后台设置中获取 tgBotToken)
  const config = await getSystemConfig(env);
  const botToken = (config.tgBotToken || env.TELEGRAM_BOT_TOKEN || env.TG_BOT_TOKEN || "").trim();

  if (!botToken) {
    return new Response(JSON.stringify({ ok: false, error: "Telegram Bot Token 未配置" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  // 2. 解析 Telegram Webhook Payload
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

  // 3. 用户白名单权限校验
  const rawAllowed = (config.tgAllowedUsers || env.TELEGRAM_ALLOWED_USERS || env.TG_ALLOWED_USERS || "").trim();
  if (rawAllowed) {
    const allowedList = rawAllowed
      .split(/[,，\s]+/)
      .map((item) => item.trim().replace(/^@/, "").toLowerCase())
      .filter(Boolean);

    const matchId = allowedList.includes(userId);
    const matchUsername = fromUser.username && allowedList.includes(fromUser.username.toLowerCase());

    if (!matchId && !matchUsername) {
      await sendTelegramMessage(
        botToken,
        chatId,
        `⚠️ <b>无操作权限</b>\n\n抱歉，您的账号 (ID: <code>${userId}</code>) 未在管理员白名单中。请联系管理员在后台将您的 ID 或 Username 加入许可列表。`
      );
      return new Response(JSON.stringify({ ok: true, denied: true }), {
        headers: { "Content-Type": "application/json" },
      });
    }
  }

  // 4. 处理文本指令：/start /help /info
  const text = (message.text || "").trim();
  if (text.startsWith("/start") || text.startsWith("/help")) {
    const helpMsg = `🤖 <b>欢迎使用 Cloudflare Drive 转存机器人！</b>

直接将任意<b>视频、音频、照片或文件文档</b>发送给本机器人，系统将自动通过 Google Drive 官方 API 将其高速流式中转保存至网盘中。

📌 <b>当前配置信息：</b>
• 用户: ${username} (ID: <code>${userId}</code>)
• 站点: <b>${config.siteName || "Cloudflare Drive Player"}</b>
• 存放目录: <code>${config.tgUploadFolderId || "默认网盘根目录"}</code>

💡 <i>提示：支持大文件分片中转，上传成功后将为您自动生成本站在线播放与下载直链。</i>`;
    await sendTelegramMessage(botToken, chatId, helpMsg);
    return new Response(JSON.stringify({ ok: true }), { headers: { "Content-Type": "application/json" } });
  }

  // 5. 提取待转存的媒体或文件对象
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

  // 若没有检测到有效文件媒体
  if (!fileObj || !fileObj.file_id) {
    if (text) {
      await sendTelegramMessage(
        botToken,
        chatId,
        `💡 请直接将需要转存的<b>视频、音乐、文档或照片</b>发送给机器人，系统将自动帮您同步到 Google Drive。`
      );
    }
    return new Response(JSON.stringify({ ok: true, ignored: "no_media" }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  // 计算文件名
  let fileName = fileObj.file_name;
  if (!fileName) {
    const timestamp = new Date().toISOString().replace(/[-:T]/g, "").slice(0, 14);
    fileName = `TG_${timestamp}_${fileObj.file_unique_id || Math.random().toString(36).slice(2, 8)}${defaultExt}`;
  }

  // 发送“正在处理中”状态提示
  await sendTelegramMessage(
    botToken,
    chatId,
    `⏳ <b>正在同步至 Google Drive...</b>\n\n📄 <b>文件名:</b> <code>${fileName}</code>\n📦 <b>文件大小:</b> ${(
      (fileObj.file_size || 0) /
      1024 /
      1024
    ).toFixed(2)} MB\n\n<i>正在通过 Cloudflare 边缘计算流式转存，请稍候...</i>`
  );

  try {
    // 6. 获取 Telegram 文件下载链接
    const { filePath, fileSize } = await getTelegramFilePath(botToken, fileObj.file_id);
    const tgDownloadUrl = `https://api.telegram.org/file/bot${botToken}/${filePath}`;

    // 7. 发起下载流并直通上传至 Google Drive
    const tgRes = await fetch(tgDownloadUrl);
    if (!tgRes.ok) {
      throw new Error(`Telegram 媒体拉取失败: HTTP ${tgRes.status}`);
    }

    // 获取 Google OAuth 授权 Token
    const googleToken = await getAccessToken(env);
    const creds = getCredentials(env);
    const targetFolderId = config.tgUploadFolderId || creds.rootFolderId || "root";

    // 使用 Google Drive multipart 上传协议 (适用于 20MB 以内的 Telegram Bot API 文件)
    const boundary = "-------CFDrivePlayerTGBoundary" + Date.now();
    const delimiter = `\r\n--${boundary}\r\n`;
    const closeDelimiter = `\r\n--${boundary}--`;

    const metadata = {
      name: fileName,
      mimeType: mimeType.split(";")[0].trim(),
      parents: [targetFolderId],
    };

    const fileBuffer = await tgRes.arrayBuffer();

    // 构建符合 RFC 规范的 Multipart Uint8Array 数据
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

    const uploadUrl = "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true";
    const driveUploadRes = await fetch(uploadUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${googleToken}`,
        "Content-Type": `multipart/related; boundary=${boundary}`,
      },
      body: fullPayload,
    });

    if (!driveUploadRes.ok) {
      const errText = await driveUploadRes.text();
      if (errText.includes("storageQuotaExceeded") || errText.includes("Service Accounts do not have storage quota")) {
        throw new Error(
          "Google Drive 服务账号存储配额不足。请将目标目录设为共享云端硬盘 (Shared Drive)，或在网盘中授予该服务账号对共享目录的管理特权。"
        );
      }
      throw new Error(`Google Drive API 返回错误: ${errText.slice(0, 180)}`);
    }

    const uploadedFile = await driveUploadRes.json();
    const originUrl = new URL(request.url).origin;
    const playUrl = `${originUrl}/#${uploadedFile.id}`;
    const directDownloadUrl = `${originUrl}/api/download/${uploadedFile.id}?name=${encodeURIComponent(fileName)}`;

    // 8. 成功响应
    const successMsg = `🎉 <b>文件转存成功！</b>

📄 <b>文件名:</b> <code>${fileName}</code>
🆔 <b>文件 ID:</b> <code>${uploadedFile.id}</code>
📁 <b>已存入目录:</b> <code>${targetFolderId}</code>

🔗 <b>在线播放/浏览:</b>
<a href="${playUrl}">点击在线查看</a>

📥 <b>本站下载直链:</b>
<a href="${directDownloadUrl}">点击极速下载</a>`;

    await sendTelegramMessage(botToken, chatId, successMsg);
  } catch (err) {
    const errorMsg = `❌ <b>转存遇到错误</b>\n\n原因: <i>${err.message || "未知异常"}</i>\n\n请检查 Google 服务账号权限及云盘配额。`;
    await sendTelegramMessage(botToken, chatId, errorMsg);
  }

  return new Response(JSON.stringify({ ok: true }), {
    headers: { "Content-Type": "application/json" },
  });
}

export async function onRequestGet(context) {
  return new Response("Telegram Bot Webhook Endpoint is Running (Cloudflare Drive Player).", {
    status: 200,
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
