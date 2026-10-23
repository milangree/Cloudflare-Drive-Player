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
- [Protected & Administration Endpoints](#protected--administration-endpoints)
  - [5. Authentication & Token Issuance (`POST /api/admin/auth`)](#5-authentication--token-issuance-post-apiadminauth)
  - [6. System Configuration (`GET/POST /api/admin/config`)](#6-system-configuration-getpost-apiadminconfig)
  - [7. File Lifecycle Operations (`POST /api/admin/files`)](#7-file-lifecycle-operations-post-apiadminfiles)

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
