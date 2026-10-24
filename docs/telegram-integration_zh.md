<div align="center">

# Cloudflare Drive Player - Telegram 媒体转存集成指南

<p align="center">
  <a href="telegram-integration.md">English</a> · <b>简体中文</b>
</p>

</div>

---

## 概述

**Telegram 媒体转存机器人**让你可以把 Telegram 里的任意媒体或文件直接转存进 Google Drive，全程经由你的 Cloudflare Pages 部署完成。机器人充当边缘中转：Telegram → Cloudflare Pages Function → Google Drive。

```
Telegram 用户 ──消息──▶ api.telegram.org ──webhook──▶ /api/telegram/webhook
                                                              │
                            ┌─────────────────────────────────┘
                            ▼
                  Google Drive API (multipart 上传)
                            │
                            ▼
              Telegram sendMessage ◀── 结果 + 深链 ─────────┘
```

## 为什么采用这些默认值

在改动任何行为之前，请先理解三个刻意的设计决策：

| 决策 | 原因 |
| :--- | :--- |
| **20 MB 硬上限** | Telegram Bot API 的 `getFile` 拒绝超过 20 MB 的文件，机器人根本无法拉取，因此校验前置到任何出站请求之前——不浪费带宽与配额。 |
| **白名单 fail-closed** | 白名单留空时拒绝*所有*上传请求。对于公开可访问的端点，这是唯一安全的默认值。文本指令（`/start`、`/help`）仍会响应，被拦截的用户可据此发现该配置什么。 |
| **以 `file_unique_id` 幂等** | Telegram 在未收到 2xx 响应时会重推投递。以文件 `file_unique_id`（写入 Drive `appProperties` 的 `cfTgFileUniqueId`）为键，重推会复用已存在的文件而非产生重复。 |

---

## 1. 前置条件

1. 来自 [@BotFather](https://t.me/BotFather) 的 Telegram 机器人 Token（`/newbot`）。
2. 你的 Telegram **数字用户 ID**（向 [@userinfobot](https://t.me/userinfobot) 发送 `/start` 获取）或你的 `@username`。
3. 接收转存的 Google Drive 文件夹 ID（可选——默认为挂载根目录）。

---

## 2. 配置

所有变量既可以在 **Cloudflare Pages 环境变量**面板设置，也可以在**管理员后台 → Telegram 媒体转存机器人**中填写。

| 变量 | 必填 | 默认值 | 说明 |
| :--- | :---: | :--- | :--- |
| `TELEGRAM_BOT_TOKEN` | **是** | *(空)* | 旧别名：`TG_BOT_TOKEN` |
| `TELEGRAM_WEBHOOK_SECRET` | 强烈建议 | *(空)* | 留空时来源校验**不启用**——任何知道 URL 的人都可伪造请求。 |
| `TELEGRAM_ALLOWED_USERS` | **是**（fail-closed） | *(空)* | 逗号/空格分隔；数字 ID 或 `@username`。旧别名：`TG_ALLOWED_USERS` |
| `TELEGRAM_UPLOAD_FOLDER_ID` | 否 | 挂载根目录 | 旧别名：`TG_UPLOAD_FOLDER_ID` |

```bash
TELEGRAM_BOT_TOKEN="1234567890:ABCdefGhIJKlmNoPQRsTUVwxyZ"
TELEGRAM_WEBHOOK_SECRET="一长串随机字符串"
TELEGRAM_ALLOWED_USERS="@your_username, 123456789"
TELEGRAM_UPLOAD_FOLDER_ID="1-3i7VNCMLtTfkWxWpSemjUIvdwNLCi6l"
```

> **安全提示** —— `TELEGRAM_WEBHOOK_SECRET` 应始终作为环境变量。它在服务端读取，且刻意**不**写入 Drive 配置元数据，因为该元数据对任何能访问根文件夹的人都是可读的。

---

## 3. 注册 Webhook

### 方式 A —— 后台一键绑定

1. 打开管理员后台 → **Telegram 媒体转存机器人**。
2. 填入 Bot Token 与白名单，然后**保存系统配置**。
3. 点击**一键绑定 Webhook**。

面板在注册后会通过 `GET /api/admin/telegram` 回查真实 Webhook 状态，因此状态徽章反映的是 Telegram 自身的回答，而非本地臆断。

### 方式 B —— 通过 API

```bash
curl -X POST https://<你的域名>/api/admin/telegram \
  -H "Authorization: Bearer <ADMIN_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"action": "register"}'
```

配置了 `TELEGRAM_WEBHOOK_SECRET` 时，`secret_token` 参数会自动携带，Telegram 随后在每次投递时附带匹配的 `X-Telegram-Bot-Api-Secret-Token` 头。后端以恒定时间比较，不匹配时返回 **401**。

---

## 4. 验证链路

提供两项只读诊断：

| 动作 | 验证内容 |
| :--- | :--- |
| `{"action": "test"}` | Bot Token 有效且 Telegram 可达（调用 `getMe`）。 |
| `{"action": "test-upload"}` | 完整写入路径可用：上传一个极小探针文件到目标目录后立即删除。 |

```bash
curl -X POST https://<你的域名>/api/admin/telegram \
  -H "Authorization: Bearer <ADMIN_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"action": "test-upload"}'
```

若 `test-upload` 返回配额错误，说明服务账号自身没有存储空间——请把 `TELEGRAM_UPLOAD_FOLDER_ID` 指向**共享云端硬盘 (Shared Drive)**，并为该服务账号授予该目录的管理员权限。

---

## 5. 使用机器人

直接向你的机器人发送以下内容：

| 载荷 | 行为 |
| :--- | :--- |
| 文档（任意文件类型） | 以原始文件名上传 |
| 视频 | 上传；无文件名时使用 `.mp4` |
| 音频/音乐 | 上传；无文件名时使用 `.mp3` |
| 照片 | 上传最高分辨率的那一张 |
| 语音消息 | 作为音频上传 |
| `/start`、`/help` | 返回配置信息（不校验白名单） |
| 纯文本 | 返回使用说明 |

成功后机器人会回复**站内深链**与**下载直链**：

- `https://<你的域名>/?file=<fileId>` —— 在站点自身的播放器/阅读器中打开文件。
- `https://<你的域名>/api/download/<fileId>?filename=<名称>` —— 原生下载。

---

## 6. 错误契约

该端点绝不向用户回吐原始错误文本，只发送固定中文文案，原始错误仅入日志。

| 条件 | HTTP | 用户可见文案 |
| :--- | :---: | :--- |
| 缺少 Bot Token | 200 | `Telegram Bot Token 未配置` |
| 请求体非 JSON | 400 | `Invalid JSON` |
| 非消息类更新 | 200 | *(静默，`ignored: true`)* |
| 不在白名单 | 200 | `无操作权限` + 指引 |
| 无媒体 | 200 | 使用说明 |
| 大小 > 20 MB | 200 | `文件超过 Telegram Bot API 的 20MB 上限…` |
| Drive 配额不足 | 200 | 共享云端硬盘指引 |
| Drive 授权失败 | 200 | 凭据指引 |
| Telegram/Drive 不可达、5xx、429 | **502** | `无法连接 Telegram 服务器…` |

> **为什么瞬时故障返回 502？** Telegram 只在收到非 2xx 响应时才重推投递。对网络/5xx/429 返回 502 可让 Telegram 自身的退避策略重试转存；而永久故障（配额、授权）返回 200 以避免无休止的重试循环。

---

## 7. 故障排查

| 现象 | 可能原因 | 处理 |
| :--- | :--- | :--- |
| 机器人回复 `无操作权限` | 发送者不在白名单 | 将数字 ID 或 `@username` 加入 `TELEGRAM_ALLOWED_USERS` |
| 机器人对所有文件都无响应 | 白名单留空（fail-closed） | 填写 `TELEGRAM_ALLOWED_USERS` |
| Telegram 显示 webhook `last_error_message` | 密钥不匹配或 URL 不可达 | 确认两侧 `TELEGRAM_WEBHOOK_SECRET` 一致；确认 URL 公开可访问 |
| 25 MB 视频报 `文件过大` | Telegram 的 20 MB 限制 | 压缩/拆分文件，或直接上传到 Drive |
| 重推后出现重复文件 | 幂等键未写入 | 确认目标文件夹允许写入 `appProperties` |
| 上传报配额错误 | 服务账号自身无存储 | 指向共享云端硬盘并授予管理员权限 |

---

## 8. 接口参考

完整请求/响应结构见 [api-reference.md §8 / §9 / §10](api-reference_zh.md#8-telegram-媒体转存-webhook-getpost-apitelegramwebhook)。
