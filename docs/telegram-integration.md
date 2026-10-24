<div align="center">

# Cloudflare Drive Player - Telegram 媒体转存集成指南

<p align="center">
  <b>English</b> · <a href="telegram-integration_zh.md">简体中文</a>
</p>

</div>

---

## Overview

The **Telegram Media Transfer Bot** lets you forward any media or file from a Telegram chat straight into your Google Drive, through your Cloudflare Pages deployment. The bot acts as an edge-side relay: Telegram → Cloudflare Pages Function → Google Drive.

```
Telegram User ──message──▶ api.telegram.org ──webhook──▶ /api/telegram/webhook
                                                             │
                            ┌────────────────────────────────┘
                            ▼
                  Google Drive API (multipart upload)
                            │
                            ▼
              Telegram sendMessage ◀── result + deep link ──┘
```

## Why these defaults exist

Three deliberate design decisions are worth understanding before you change anything:

| Decision | Rationale |
| :--- | :--- |
| **20 MB hard ceiling** | Telegram's Bot API `getFile` refuses files larger than 20 MB. A bot simply cannot fetch them, so the check is applied *before* any outbound request — no wasted bandwidth or quota. |
| **Allowlist is fail-closed** | An empty allowlist denies *every* upload request. This is the only safe default for a publicly reachable endpoint. Text commands (`/start`, `/help`) still respond, so a blocked user can discover what to configure. |
| **Idempotency via `file_unique_id`** | Telegram retries a delivery when it does not receive a 2xx response. Keying on the file's `file_unique_id` (stored in Drive `appProperties` as `cfTgFileUniqueId`) means a retry reuses the existing file instead of creating a duplicate. |

---

## 1. Prerequisites

1. A Telegram bot token from [@BotFather](https://t.me/BotFather) (`/newbot`).
2. Your Telegram **numeric user ID** (send `/start` to [@userinfobot](https://t.me/userinfobot)) or your `@username`.
3. The Google Drive folder ID that should receive transfers (optional — defaults to the mounted root).

---

## 2. Configuration

All variables can be set in the **Cloudflare Pages environment variables** panel *or* in the **admin panel → Telegram 媒体转存机器人**.

| Variable | Required | Default | Notes |
| :--- | :---: | :--- | :--- |
| `TELEGRAM_BOT_TOKEN` | **Yes** | *(empty)* | Legacy alias: `TG_BOT_TOKEN` |
| `TELEGRAM_WEBHOOK_SECRET` | Strongly recommended | *(empty)* | When empty, source verification is **disabled** — anyone who knows the URL can forge requests. |
| `TELEGRAM_ALLOWED_USERS` | **Yes** (fail-closed) | *(empty)* | Comma/space separated; numeric IDs or `@username`. Legacy alias: `TG_ALLOWED_USERS` |
| `TELEGRAM_UPLOAD_FOLDER_ID` | No | mounted root | Legacy alias: `TG_UPLOAD_FOLDER_ID` |

```bash
TELEGRAM_BOT_TOKEN="1234567890:ABCdefGhIJKlmNoPQRsTUVwxyZ"
TELEGRAM_WEBHOOK_SECRET="a-long-random-string"
TELEGRAM_ALLOWED_USERS="@your_username, 123456789"
TELEGRAM_UPLOAD_FOLDER_ID="1-3i7VNCMLtTfkWxWpSemjUIvdwNLCi6l"
```

> **Security note** — `TELEGRAM_WEBHOOK_SECRET` should stay an environment variable. It is read server-side and is intentionally **not** persisted into the Drive config metadata, because that metadata is readable by anyone with access to the root folder.

---

## 3. Registering the Webhook

### Option A — One-click from the admin panel

1. Open the admin panel → **Telegram 媒体转存机器人**.
2. Fill in the Bot Token and allowlist, then **Save System Configuration**.
3. Click **一键绑定 Webhook**.

The panel reads the real webhook state back from `GET /api/admin/telegram` after registering, so the status badge reflects Telegram's own answer rather than a local assumption.

### Option B — Via the API

```bash
curl -X POST https://<your-domain>/api/admin/telegram \
  -H "Authorization: Bearer <ADMIN_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"action": "register"}'
```

When `TELEGRAM_WEBHOOK_SECRET` is configured, the `secret_token` parameter is forwarded automatically, so Telegram will attach the matching `X-Telegram-Bot-Api-Secret-Token` header on every delivery. The backend compares it in constant time and answers **401** on mismatch.

---

## 4. Verifying the pipeline

Three read-only diagnostics are available:

| Action | What it proves |
| :--- | :--- |
| `{"action": "test"}` | The Bot Token is valid and Telegram is reachable (calls `getMe`). |
| `{"action": "test-upload"}` | The full write path works: it uploads a tiny probe file to the target folder, then deletes it immediately. |
| `{"action": "capability"}` | *Why* writes fail — distinguishes a personal My Drive (service accounts have no quota), a full Shared Drive, and a missing grant. |

```bash
curl -X POST https://<your-domain>/api/admin/telegram \
  -H "Authorization: Bearer <ADMIN_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"action": "test-upload"}'
```

A `test-upload` failure with a quota message means the service account has no storage of its own. Run the `capability` diagnostic to confirm which of the three cases applies:

```bash
curl -X POST https://<your-domain>/api/admin/telegram \
  -H "Authorization: Bearer <ADMIN_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"action": "capability"}'
```

| `verdict` | Meaning | Fix |
| :--- | :--- | :--- |
| `writable` | Writes succeed | Nothing to do |
| `personal_drive_sa_no_quota` | Target is a personal My Drive; uploaded files are owned by the service account, which has **no quota** | Move the target into a Shared Drive (requires Google Workspace) |
| `shared_drive_quota` | Target is a Shared Drive, but writes are still quota-rejected | Free space or upgrade the organization's storage; confirm the service account is a member |
| `insufficient_permissions` | The service account cannot write to the folder | Share the folder: Content Manager on a Shared Drive, Editor on a personal drive |
| `unknown` | No cause determined | Forward the diagnostic output |

> **The core rule**: Google Cloud service accounts have **no storage quota of their own**. Any file they create is owned by the service account, so writing into a personal "My Drive" is rejected no matter how much free space that drive has. Only a **Shared Drive** gives service-account uploads somewhere to live — and Shared Drives require a Google Workspace (business/education) account. A personal Gmail account cannot create one, so service-account uploads are impossible on it under any configuration.

---

## 5. Using the bot

Send any of these directly to your bot:

| Payload | Behaviour |
| :--- | :--- |
| Document (any file type) | Uploaded with its original filename |
| Video | Uploaded; `.mp4` used if no filename is present |
| Audio / music | Uploaded; `.mp3` used if no filename is present |
| Photo | The highest-resolution variant is uploaded |
| Voice message | Uploaded as audio |
| `/start`, `/help` | Returns configuration info (no allowlist check) |
| Plain text only | Returns usage instructions |

On success the bot replies with an **in-site deep link** and a **direct download link**:

- `https://<your-domain>/?file=<fileId>` — opens the file in the site's own player/viewer.
- `https://<your-domain>/api/download/<fileId>?filename=<name>` — native download.

---

## 6. Error contract

The endpoint never echoes raw error text to the user. Only fixed Chinese messages are sent; the original error goes to logs.

| Condition | HTTP | User-facing message |
| :--- | :---: | :--- |
| Bot Token missing | 200 | `Telegram Bot Token 未配置` |
| Body is not JSON | 400 | `Invalid JSON` |
| Not a message update | 200 | *(silent, `ignored: true`)* |
| Not in allowlist | 200 | `无操作权限` + instructions |
| No media | 200 | usage instructions |
| Size > 20 MB | 200 | `文件超过 Telegram Bot API 的 20MB 上限…` |
| Drive quota exceeded | 200 | Shared Drive guidance |
| Drive auth failure | 200 | credentials guidance |
| Telegram/Drive unreachable, 5xx, 429 | **502** | `无法连接 Telegram 服务器…` |

> **Why 502 for transient failures?** Telegram only retries a delivery when it receives a non-2xx response. Returning 502 for network/5xx/429 conditions lets Telegram's own backoff retry the transfer, while permanent failures (quota, auth) return 200 to avoid an endless retry loop.

---

## 7. Troubleshooting

| Symptom | Likely cause | Fix |
| :--- | :--- | :--- |
| Bot replies `无操作权限` | Sender not in the allowlist | Add the numeric ID or `@username` to `TELEGRAM_ALLOWED_USERS` |
| Bot silent on every file | Allowlist empty (fail-closed) | Fill in `TELEGRAM_ALLOWED_USERS` |
| Telegram shows webhook `last_error_message` | Secret mismatch or unreachable URL | Confirm `TELEGRAM_WEBHOOK_SECRET` matches on both sides; check the URL is public |
| `文件过大` for a 25 MB video | Telegram's 20 MB limit | Compress/split the file, or upload it directly to Drive |
| Duplicate files after a retry | Idempotency key not stored | Verify `appProperties` writes are allowed on the target folder |
| Quota error on upload | Service account has no own storage | Target a Shared Drive and grant manager rights |

---

## 8. Endpoint reference

Full request/response schemas live in [api-reference.md §8 / §9 / §10](api-reference.md#8-telegram-media-transfer-webhook-getpost-apitelegramwebhook).
