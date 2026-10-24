<div align="center">

# Cloudflare Drive Player - API Reference

<p align="center">
  <a href="https://pages.cloudflare.com/"><img src="https://img.shields.io/badge/Runtime-Cloudflare%20Pages%20Functions-f38020?style=flat&logo=cloudflare" alt="Cloudflare Pages Functions"></a>
  <img src="https://img.shields.io/badge/Auth-Web%20Crypto%20RS256-blue?style=flat" alt="Web Crypto RS256">
  <img src="https://img.shields.io/badge/Format-RESTful%20JSON-emerald?style=flat" alt="RESTful JSON">
</p>

<p align="center">
  <b>English</b> · <a href="api-reference_zh.md">简体中文</a>
</p>

</div>

---

This document provides complete API endpoint specifications and reproducible request examples for Cloudflare Drive Player. All endpoints execute within the Cloudflare Pages Functions edge runtime (V8 Isolates).

---

## 📑 Table of Contents

- [Authentication & Security Model](#authentication--security-model)
- [Public Endpoints](#public-endpoints)
  - [1. Site Information & Status (`GET /api/info`)](#1-site-information--status-get-apiinfo)
  - [2. Directory Indexing & Search (`GET /api/list`)](#2-directory-indexing--search-get-apilist)
  - [3. Media Streaming & Range Proxy (`GET/HEAD/OPTIONS /api/stream/:id`)](#3-media-streaming--range-proxy-getheadoptions-apistreamid)
  - [4. Original File Download (`GET /api/download/:id`)](#4-original-file-download-get-apidownloadid)
  - [8. Telegram Media Transfer Webhook (`GET/POST /api/telegram/webhook`)](#8-telegram-media-transfer-webhook-getpost-apitelegramwebhook)
  - [9. File Metadata by ID (`GET /api/meta/:id`)](#9-file-metadata-by-id-get-apimetapid)
- [Protected & Administration Endpoints](#protected--administration-endpoints)
  - [5. Authentication & Token Issuance (`POST /api/admin/auth`)](#5-authentication--token-issuance-post-apiadminauth)
  - [6. System Configuration (`GET/POST /api/admin/config`)](#6-system-configuration-getpost-apiadminconfig)
  - [7. File Lifecycle Operations (`POST /api/admin/files`)](#7-file-lifecycle-operations-post-apiadminfiles)
  - [10. Telegram Webhook Management (`GET/POST/DELETE /api/admin/telegram`)](#10-telegram-webhook-management-getpostdelete-apiadmintelegram)

---

## Authentication & Security Model

1. **Public Access Mode**: When site password protection is disabled, `/api/info`, `/api/list`, `/api/stream/:id`, and `/api/download/:id` require no authentication headers.
2. **Password Protected Mode**: When enabled, clients must first call `/api/admin/auth` with `action: "verify_access"` to obtain an Access Token. Subsequent requests must supply this token via:
   ```http
   Authorization: Bearer <TOKEN>
   ```
   Or via the query parameter: `?token=<TOKEN>`.
3. **Admin Endpoints**: `/api/admin/config` and `/api/admin/files` strictly require an administrator Bearer Token (obtained via `action: "admin_login"`).
4. **CORS Handling**: `/functions/api/_middleware.js` uniformly manages cross-origin headers and handles pre-flight checks (`OPTIONS` returning HTTP 204). Static assets (`/`, `/css/*`, `/js/*`) are served directly via Cloudflare Anycast CDN caches without invoking Functions.

---

## Public Endpoints

### 1. Site Information & Status (`GET /api/info`)

Inspects mount status, site brand title, root folder identity, and whether visitor password protection is required.

- **Method**: `GET`
- **Path**: `/api/info`
- **Example Request**:
  ```bash
  curl -X GET https://cf-pages-drive-player.pages.dev/api/info
  ```
- **Success Response (HTTP 200)**:
  ```json
  {
    "success": true,
    "configured": true,
    "siteName": "My Media Vault - Drive Player",
    "rootFolderId": "1-3i7VNCMLtTfkWxWpSemjUIvdwNLCi6l",
    "rootName": "Media Collection",
    "clientEmail": "dri***@my-project.iam.gserviceaccount.com",
    "requirePassword": false
  }
  ```
- **Unconfigured Response (HTTP 200)**:
  ```json
  {
    "success": false,
    "configured": false,
    "error": "Missing SERVICE_ACCOUNT_JSON or credentials environment variables"
  }
  ```

---

### 2. Directory Indexing & Search (`GET /api/list`)

Lists files and subfolders within a given directory, supporting infinite hierarchy traversal, global keyword search, and automatic Google Drive shortcut resolution.

- **Method**: `GET`
- **Path**: `/api/list`
- **Query Parameters**:
  | Parameter | Type | Required | Default | Description |
  | :--- | :--- | :---: | :--- | :--- |
  | `folderId` | string | No | `root` | Directory ID; defaults to `ROOT_FOLDER_ID` if omitted |
  | `search` | string | No | *empty* | Keyword search across filenames (spans recursive hierarchy) |
  | `pageToken` | string | No | *empty* | Google Drive pagination token |
- **Example Requests**:
  ```bash
  # Query root folder
  curl -X GET "https://cf-pages-drive-player.pages.dev/api/list"

  # Query specific subfolder
  curl -X GET "https://cf-pages-drive-player.pages.dev/api/list?folderId=1A2B3C4D5E"

  # Search keyword
  curl -X GET "https://cf-pages-drive-player.pages.dev/api/list?search=Avatar"
  ```
- **Success Response (HTTP 200)**:
  ```json
  {
    "success": true,
    "currentFolder": {
      "id": "1-3i7VNCMLtTfkWxWpSemjUIvdwNLCi6l",
      "name": "Movies"
    },
    "items": [
      {
        "id": "1XYZ888FolderId",
        "shortcutId": null,
        "name": "Sci-Fi",
        "mimeType": "application/vnd.google-apps.folder",
        "size": 15482390142,
        "itemCount": 12,
        "modifiedTime": "2026-10-18T08:00:00.000Z",
        "thumbnailLink": null,
        "videoMediaMetadata": null,
        "isFolder": true,
        "isVideo": false,
        "isAudio": false,
        "isImage": false,
        "isDocument": false
      },
      {
        "id": "1ABC999VideoId",
        "shortcutId": null,
        "name": "Inception.2010.1080p.mkv",
        "mimeType": "video/x-matroska",
        "size": 3221225472,
        "itemCount": 0,
        "modifiedTime": "2026-10-15T12:00:00.000Z",
        "thumbnailLink": "https://lh3.googleusercontent.com/...",
        "videoMediaMetadata": {
          "width": 1920,
          "height": 1080,
          "durationMillis": "8880000"
        },
        "isFolder": false,
        "isVideo": true,
        "isAudio": false,
        "isImage": false,
        "isDocument": false
      }
    ],
    "nextPageToken": null
  }
  ```

---

### 3. Media Streaming & Range Proxy (`GET/HEAD/OPTIONS /api/stream/:id`)

High-performance streaming proxy featuring HTTP 206 Partial Content byte-range passthrough, strict MIME type mapping, and seamless seeking support for web and external media players.

- **Methods**: `GET`, `HEAD`, `OPTIONS`
- **Path**: `/api/stream/:id`
- **Path Parameters**:
  | Parameter | Type | Required | Description |
  | :--- | :--- | :---: | :--- |
  | `id` | string | Yes | Unique Google Drive file ID |
- **Query Parameters**:
  | Parameter | Type | Required | Description |
  | :--- | :--- | :---: | :--- |
  | `filename` | string | No | Helps correct MIME headers (e.g., mapping `.mkv` to `video/x-matroska`) and formats `Content-Disposition` |
  | `token` | string | No | Access token when password protection is active |
- **Sample Request (Byte-Range)**:
  ```http
  GET /api/stream/1ABC999VideoId?filename=Inception.mkv HTTP/1.1
  Host: cf-pages-drive-player.pages.dev
  Range: bytes=0-1048575
  ```
- **Example Command**:
  ```bash
  # Request initial 1MB byte chunk
  curl -i -H "Range: bytes=0-1048575" "https://cf-pages-drive-player.pages.dev/api/stream/1ABC999VideoId?filename=Inception.mkv"
  ```
- **Partial Content Response (HTTP 206)**:
  ```http
  HTTP/1.1 206 Partial Content
  Content-Type: video/x-matroska
  Content-Range: bytes 0-1048575/3221225472
  Content-Length: 1048576
  Accept-Ranges: bytes
  Access-Control-Allow-Origin: *
  Access-Control-Expose-Headers: Content-Range, Content-Length, Accept-Ranges, Content-Type, Content-Disposition
  Content-Disposition: inline; filename="Inception.mkv"; filename*=UTF-8''Inception.mkv
  Cache-Control: public, max-age=14400, stale-while-revalidate=86400
  ```

#### Client Failover Contract: Google Cloud Preview

When native playback fails due to missing codecs (e.g., Safari with MKV, lack of HEVC/H.265 hardware support, proprietary DTS/AC-3 audio, or black screen watchdog triggers), client state machines fall back automatically to Google Cloud transcoding preview:
- **Preview Endpoint**: `https://drive.google.com/file/d/{id}/preview`
- **Query Parameters**:
  - `autoplay=1`: Initiates immediate playback.
  - `vq=highres` (or `hd2160`/`hd1080`/`hd720`): Matches resolution with source metadata.
- **Viewport Integration**: Uses negative CSS margin clipping to hide Google's header pop-out icon without overlay masks, preserving 100% native hardware decoding, DRM, and full-screen support. See [ADR-0002](adr/0002-adaptive-playback-sandboxing-and-minimalist-player.md) for architectural details.

---

### 4. Original File Download (`GET /api/download/:id`)

Triggers browser native file download dialogues with strict RFC 5987 internationalized filename encoding and on-the-fly Google Workspace document conversion.

- **Method**: `GET`
- **Path**: `/api/download/:id`
- **Path Parameters**:
  | Parameter | Type | Required | Description |
  | :--- | :--- | :---: | :--- |
  | `id` | string | Yes | Google Drive file ID |
- **Query Parameters**:
  | Parameter | Type | Required | Description |
  | :--- | :--- | :---: | :--- |
  | `filename` | string | No | Custom downloaded filename |
  | `token` | string | No | Access token (when password protection is enabled) |
- **Example Request**:
  ```bash
  curl -OJ "https://cf-pages-drive-player.pages.dev/api/download/1ABC999VideoId?filename=Inception.mkv"
  ```
- **Success Response (HTTP 200)**:
  ```http
  HTTP/1.1 200 OK
  Content-Type: application/octet-stream
  Content-Disposition: attachment; filename="Inception.mkv"; filename*=UTF-8''Inception.mkv
  ```

---

### 8. Telegram Media Transfer Webhook (`GET/POST /api/telegram/webhook`)

Receives media and files sent by Telegram users and transfers them into Google Drive via the official Drive API.

- **Methods**: `GET` (liveness probe), `POST` (Telegram update delivery)
- **Path**: `/api/telegram/webhook`

#### Source Verification (optional but strongly recommended)

When `TELEGRAM_WEBHOOK_SECRET` is configured, every `POST` must carry the matching header, otherwise **HTTP 401** is returned:

```http
X-Telegram-Bot-Api-Secret-Token: <TELEGRAM_WEBHOOK_SECRET>
```

#### Update Payload Handling

| Scenario | Response |
| :--- | :--- |
| Bot Token not configured | `200` + `{"ok":false,"error":"Telegram Bot Token 未配置"}` |
| Body is not valid JSON | `400` + `Invalid JSON` |
| Not a `message` / `channel_post` update | `200` + `{"ok":true,"ignored":true}` |
| `/start` or `/help` | `200` + `{"ok":true}` (no allowlist check — informational only) |
| Sender not in allowlist | `200` + `{"ok":true,"denied":true}` |
| No media and no text | `200` + `{"ok":true,"ignored":"no_media"}` |
| Declared size > 20 MB | `200` + `{"ok":true,"ignored":"too_large"}` |
| Transfer completed | `200` + `{"ok":true,"fileId":"..."}` |
| Already transferred (idempotent) | `200` + `{"ok":true,"deduped":true,"fileId":"..."}` |
| Transient failure (Telegram/Drive unreachable, 5xx, 429) | `502` + `{"ok":false,"error":"<fixed Chinese message>"}` |
| Permanent failure (quota, auth, invalid path) | `200` + `{"ok":true}` |

> **Design notes**
> - The **20 MB ceiling** comes from Telegram's Bot API `getFile` limit, so files larger than this cannot be fetched through the bot at all. The check is applied *before* any outbound request.
> - **Allowlist is fail-closed**: when the allowlist is empty, all upload requests are denied. Text commands still respond so users can discover what to do.
> - **Idempotency** uses a Drive `appProperties` key (`cfTgFileUniqueId`) derived from Telegram's `file_unique_id`, so a Telegram retry does not create a duplicate file.
> - Raw error text is **never** echoed to the user; only fixed Chinese messages are sent, and the original error goes to logs.

---

### 9. File Metadata by ID (`GET /api/meta/:id`)

Resolves a single file by ID without needing to know which folder contains it. Powers Telegram deep links (`?file=<id>`).

- **Method**: `GET`
- **Path**: `/api/meta/:id`
- **Path Parameters**:
  | Parameter | Type | Required | Description |
  | :--- | :--- | :---: | :--- |
  | `id` | string | Yes | Google Drive file ID |
- **Query Parameters**:
  | Parameter | Type | Required | Description |
  | :--- | :--- | :---: | :--- |
  | `token` | string | No | Access token when password protection is active |
- **Example Request**:
  ```bash
  curl -X GET "https://cf-pages-drive-player.pages.dev/api/meta/1ABC999VideoId"
  ```
- **Success Response (HTTP 200)**:
  ```json
  {
    "success": true,
    "item": {
      "id": "1ABC999VideoId",
      "name": "Inception.mkv",
      "mimeType": "video/x-matroska",
      "size": 3221225472,
      "parents": ["1-3i7VNCMLtTfkWxWpSemjUIvdwNLCi6l"],
      "thumbnailLink": "https://lh3.googleusercontent.com/...",
      "modifiedTime": "2026-10-15T12:00:00.000Z",
      "isFolder": false,
      "isVideo": true,
      "isAudio": false,
      "isImage": false
    }
  }
  ```
- **Error Responses**: `401` (password protection active, no valid token), `404` (file not found), `500`/`502` (Drive request failed) — all return JSON with a `success: boolean` field.

---

## Protected & Administration Endpoints

### 5. Authentication & Token Issuance (`POST /api/admin/auth`)

- **Method**: `POST`
- **Path**: `/api/admin/auth`
- **Headers**: `Content-Type: application/json`

#### Scenario A: Visitor Password Verification (`verify_access`)
```bash
curl -X POST https://cf-pages-drive-player.pages.dev/api/admin/auth \
  -H "Content-Type: application/json" \
  -d '{"action": "verify_access", "password": "guest_password_123"}'
```
Response:
```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

#### Scenario B: Administrator Login (`admin_login`)
```bash
curl -X POST https://cf-pages-drive-player.pages.dev/api/admin/auth \
  -H "Content-Type: application/json" \
  -d '{"action": "admin_login", "password": "your_admin_password"}'
```
Response:
```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

---

### 6. System Configuration (`GET/POST /api/admin/config`)

Reads or updates system-level runtime configurations (site title, subtitle, visitor protection, and admin passwords).

- **Header**: `Authorization: Bearer <ADMIN_TOKEN>`

#### Read Current Configuration (`GET`)
```bash
curl -X GET https://cf-pages-drive-player.pages.dev/api/admin/config \
  -H "Authorization: Bearer <ADMIN_TOKEN>"
```
Response:
```json
{
  "success": true,
  "config": {
    "siteName": "My Media Vault",
    "siteSubtitle": "Streaming and File Hub",
    "requirePassword": true,
    "accessPassword": "guest_password_123",
    "hasAdminPassword": true,
    "kvConfigured": false
  }
}
```

#### Update System Configuration (`POST`)
```bash
curl -X POST https://cf-pages-drive-player.pages.dev/api/admin/config \
  -H "Authorization: Bearer <ADMIN_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "siteName": "Enhanced Media Studio",
    "siteSubtitle": "Edge Powered Cloud Drive",
    "requirePassword": true,
    "accessPassword": "new_guest_pwd_2026",
    "newAdminPassword": "new_admin_pwd_2026"
  }'
```
Response:
```json
{
  "success": true,
  "persisted": "DriveMeta",
  "newToken": "eyJhbGciOiJIUzI1NiIs..."
}
```

---

### 7. File Lifecycle Operations (`POST /api/admin/files`)

Provides complete cloud drive file management capabilities.

- **Headers**:
  - `Authorization: Bearer <ADMIN_TOKEN>`
  - `Content-Type: application/json`

#### Action Reference Table:
| Action | Description | Key Parameters |
| :--- | :--- | :--- |
| `inspect` | In-depth metadata discovery for files/folders | `fileId` (defaults to root) |
| `rename` | Renames a file, folder, or shortcut | `fileId`, `shortcutId` (optional), `newName` |
| `move` | Moves a file or folder to a target destination | `fileId` or `shortcutId`, `targetFolderId` |
| `delete` | Soft-deletes to Trash or deletes permanently | `fileId` or `shortcutId`, `permanent: boolean` |
| `create_folder` | Creates a new subfolder | `name`, `parentFolderId` (defaults to root) |
| `create_file` | Creates a text or code document | `name`, `content`, `mimeType`, `parentFolderId` |
| `init_resumable_upload` | Requests a Google direct upload session URL | `name`, `parentFolderId`, `mimeType`, `fileSize` |

#### Example: Rename File (`rename`)
```bash
curl -X POST https://cf-pages-drive-player.pages.dev/api/admin/files \
  -H "Authorization: Bearer <ADMIN_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "action": "rename",
    "fileId": "1ABC999VideoId",
    "newName": "Inception.DirectorCut.2010.mkv"
  }'
```
Response:
```json
{
  "success": true,
  "message": "File renamed successfully",
  "file": {
    "id": "1ABC999VideoId",
    "name": "Inception.DirectorCut.2010.mkv"
  }
}
```

---

### 10. Telegram Webhook Management (`GET/POST/DELETE /api/admin/telegram`)

Manages the Telegram webhook registration and runs diagnostics. All routes require an administrator Bearer Token.

- **Header**: `Authorization: Bearer <ADMIN_TOKEN>`

#### Query Webhook Status (`GET`)
```bash
curl -X GET https://cf-pages-drive-player.pages.dev/api/admin/telegram \
  -H "Authorization: Bearer <ADMIN_TOKEN>"
```
Response:
```json
{
  "success": true,
  "webhookActive": true,
  "url": "https://cf-pages-drive-player.pages.dev/api/telegram/webhook",
  "pendingUpdateCount": 0,
  "lastErrorMessage": "",
  "lastErrorDate": null,
  "hasCustomCertificate": false,
  "maxConnections": 40
}
```

#### Register Webhook (`POST` with `action: "register"`)
```bash
curl -X POST https://cf-pages-drive-player.pages.dev/api/admin/telegram \
  -H "Authorization: Bearer <ADMIN_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"action": "register"}'
```
Response:
```json
{
  "success": true,
  "message": "Telegram Webhook 自动注册成功！",
  "webhookUrl": "https://cf-pages-drive-player.pages.dev/api/telegram/webhook",
  "secretTokenConfigured": true,
  "webhookActive": true,
  "pendingUpdateCount": 0
}
```
> `secret_token` is forwarded automatically **only when** `TELEGRAM_WEBHOOK_SECRET` is configured, so the webhook URL stays private.

#### Test Bot Connection (`POST` with `action: "test"`)
```bash
curl -X POST https://cf-pages-drive-player.pages.dev/api/admin/telegram \
  -H "Authorization: Bearer <ADMIN_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"action": "test"}'
```
Response:
```json
{
  "success": true,
  "botUsername": "my_drive_bot",
  "botFirstName": "Drive Transfer",
  "botId": 1234567890
}
```

#### End-to-End Transfer Probe (`POST` with `action: "test-upload"`)
Uploads a tiny probe file to the configured target folder and deletes it immediately, verifying credentials, quota, and write permission.
```bash
curl -X POST https://cf-pages-drive-player.pages.dev/api/admin/telegram \
  -H "Authorization: Bearer <ADMIN_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"action": "test-upload"}'
```
Response:
```json
{
  "success": true,
  "probeFileId": "1ProbeFileId",
  "targetFolderId": "1-3i7VNCMLtTfkWxWpSemjUIvdwNLCi6l"
}
```

#### Storage Capability Diagnostic (`POST` with `action: "capability"`)

Distinguishes *why* writes fail, because the three causes need completely different fixes: a personal My Drive that rejects service-account files, a Shared Drive that is out of space, and a missing grant.

The probe reads the target folder's metadata (`driveId` is returned **only** for items inside a Shared Drive), lists the Shared Drives the service account can access, then performs a real 1-byte write and deletes it immediately, capturing Google's raw refusal reason.

```bash
curl -X POST https://cf-pages-drive-player.pages.dev/api/admin/telegram \
  -H "Authorization: Bearer <ADMIN_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"action": "capability"}'
```
Response:
```json
{
  "success": true,
  "target": {
    "folderId": "1-3i7VNCMLtTfkWxWpSemjUIvdwNLCi6l",
    "name": "我的媒体库",
    "driveId": null,
    "isSharedDrive": false
  },
  "sharedDrives": [],
  "writable": false,
  "writeError": "{\"error\":{\"errors\":[{\"reason\":\"storageQuotaExceeded\"...",
  "verdict": "personal_drive_sa_no_quota",
  "remediation": [
    "目标目录位于个人网盘（My Drive）。Google Cloud 服务账号没有自己的存储配额……",
    "修法：在 Google Workspace 中创建「共享云端硬盘」(Shared Drive)……",
    "注意：共享云端硬盘需要 Google Workspace（企业版/教育版）账号……"
  ]
}
```

| `verdict` | Meaning | Fix |
| :--- | :--- | :--- |
| `writable` | Writes succeed | Nothing to do |
| `personal_drive_sa_no_quota` | Target is a personal My Drive; uploaded files are owned by the service account, which has **no quota** | Move the target into a Shared Drive (requires Google Workspace) |
| `shared_drive_quota` | Target is a Shared Drive, but writes are still quota-rejected | Free space or upgrade the organization's storage; confirm the service account is a member |
| `insufficient_permissions` | The service account cannot write to the folder | Share the folder: Content Manager on a Shared Drive, Editor on a personal drive |
| `unknown` | No cause determined | Forward the diagnostic output |

> **The core rule**: Google Cloud service accounts have **no storage quota of their own**. Any file they create is owned by the service account, so writing into a personal "My Drive" is rejected no matter how much free space that drive has. Only a **Shared Drive** gives service-account uploads somewhere to live — and Shared Drives require a Google Workspace (business/education) account. A personal Gmail account cannot create one, so service-account uploads are impossible on it under any configuration.

#### Remove Webhook (`DELETE`)
```bash
curl -X DELETE https://cf-pages-drive-player.pages.dev/api/admin/telegram \
  -H "Authorization: Bearer <ADMIN_TOKEN>"
```
