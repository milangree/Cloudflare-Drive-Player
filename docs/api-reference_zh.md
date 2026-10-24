<div align="center">

# Cloudflare Drive Player - API 接口参考文档

<p align="center">
  <a href="https://pages.cloudflare.com/"><img src="https://img.shields.io/badge/Runtime-Cloudflare%20Pages%20Functions-f38020?style=flat&logo=cloudflare" alt="Cloudflare Pages Functions"></a>
  <img src="https://img.shields.io/badge/Auth-Web%20Crypto%20RS256-blue?style=flat" alt="Web Crypto RS256">
  <img src="https://img.shields.io/badge/Format-RESTful%20JSON-emerald?style=flat" alt="RESTful JSON">
</p>

<p align="center">
  <a href="api-reference.md">English</a> · <b>简体中文</b>
</p>

</div>

---

本文档提供 Cloudflare Drive Player 全量 API 规范说明与可复现的请求示例。所有接口均部署在 Cloudflare Pages Functions 边缘运行时（基于 V8 Isolate）。

---

## 📑 目录

- [认证与安全机制](#认证与安全机制)
- [前台公开接口](#前台公开接口)
  - [1. 站点信息与配置状态 (`GET /api/info`)](#1-站点信息与配置状态-get-apiinfo)
  - [2. 目录文件索引与搜索 (`GET /api/list`)](#2-目录文件索引与搜索-get-apilist)
  - [3. 媒体流式代理与分片播放 (`GET/HEAD/OPTIONS /api/stream/:id`)](#3-媒体流式代理与分片播放-getheadoptions-apistreamid)
  - [4. 文件原生下载 (`GET /api/download/:id`)](#4-文件原生下载-get-apidownloadid)
- [8. Telegram 媒体转存 Webhook (`GET/POST /api/telegram/webhook`)](#8-telegram-媒体转存-webhook-getpost-apitelegramwebhook)
- [9. 按 ID 查询文件元数据 (`GET /api/meta/:id`)](#9-按-id-查询文件元数据-get-apimetapid)
- [前台密码验证与后台管理接口](#前台密码验证与后台管理接口)
  - [5. 身份认证与 Token 颁发 (`POST /api/admin/auth`)](#5-身份认证与-token-颁发-post-apiadminauth)
  - [6. 系统配置读取与更新 (`GET/POST /api/admin/config`)](#6-系统配置读取与更新-getpost-apiadminconfig)
  - [7. 云盘文件在线管理 (`POST /api/admin/files`)](#7-云盘文件在线管理-post-apiadminfiles)
- [10. Telegram Webhook 管理 (`GET/POST/DELETE /api/admin/telegram`)](#10-telegram-webhook-管理-getpostdelete-apiadmintelegram)

---

## 认证与安全机制

1. **公开访问模式**：若未在后台启用「访问密码」，`/api/info`、`/api/list`、`/api/stream/:id`、`/api/download/:id` 均无需额外鉴权。
2. **密码保护模式**：若启用了访问密码，客户端需先通过 `/api/admin/auth`（action: `verify_access`）置换 Access Token，并在后续请求头中携带：
   ```http
   Authorization: Bearer <TOKEN>
   ```
   或通过 Query 参数传递：`?token=<TOKEN>`。
3. **管理员接口鉴权**：`/api/admin/config` 与 `/api/admin/files` 严格要求管理员 Bearer Token（由 action: `admin_login` 颁发）。
4. **CORS 支持**：`/functions/api/_middleware.js` 统一处理 `/api/*` 下的所有跨域请求与预检（`OPTIONS` 返回 HTTP 204），静态资源（`/`、`/css/*`、`/js/*`）由边缘 CDN 零开销直通。

---

## 前台公开接口

### 1. 站点信息与配置状态 (`GET /api/info`)

探测云盘挂载状态、展示站点名称与是否需要访客密码。

- **请求方法**：`GET`
- **请求路径**：`/api/info`
- **请求示例**：
  ```bash
  curl -X GET https://cf-pages-drive-player.pages.dev/api/info
  ```
- **成功响应 (HTTP 200)**：
  ```json
  {
    "success": true,
    "configured": true,
    "siteName": "我的影视库 - Drive Player",
    "rootFolderId": "1-3i7VNCMLtTfkWxWpSemjUIvdwNLCi6l",
    "rootName": "我的影视库",
    "clientEmail": "dri***@my-project.iam.gserviceaccount.com",
    "requirePassword": false
  }
  ```
- **凭据未配置响应 (HTTP 200)**：
  ```json
  {
    "success": false,
    "configured": false,
    "error": "未检测到 SERVICE_ACCOUNT_JSON 环境变量"
  }
  ```

---

### 2. 目录文件索引与搜索 (`GET /api/list`)

获取指定目录的文件及子文件夹列表，支持无限层级穿梭、全局关键字搜索与 Google 快捷方式自动穿透。

- **请求方法**：`GET`
- **请求路径**：`/api/list`
- **查询参数**：
  | 参数名 | 类型 | 必填 | 默认值 | 说明 |
  | :--- | :--- | :---: | :--- | :--- |
  | `folderId` | string | 否 | `root` | 目录 ID；缺省时使用根目录 `ROOT_FOLDER_ID` |
  | `search` | string | 否 | 空 | 模糊搜索文件名关键字（带搜索时跨越层级） |
  | `pageToken` | string | 否 | 空 | Google Drive 分页标记 |
- **请求示例**：
  ```bash
  # 查询根目录
  curl -X GET "https://cf-pages-drive-player.pages.dev/api/list"

  # 查询特定子目录
  curl -X GET "https://cf-pages-drive-player.pages.dev/api/list?folderId=1A2B3C4D5E"

  # 关键字搜索
  curl -X GET "https://cf-pages-drive-player.pages.dev/api/list?search=Avatar"
  ```
- **成功响应 (HTTP 200)**：
  ```json
  {
    "success": true,
    "currentFolder": {
      "id": "1-3i7VNCMLtTfkWxWpSemjUIvdwNLCi6l",
      "name": "电影专区"
    },
    "items": [
      {
        "id": "1XYZ888FolderId",
        "shortcutId": null,
        "name": "科幻大片",
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

### 3. 媒体流式代理与分片播放 (`GET/HEAD/OPTIONS /api/stream/:id`)

高性能媒体流代理接口，具备 HTTP 206 Partial Content 透传与 Content-Type 精准校准，支持浏览器与第三方播放器拖拽进度条。

- **请求方法**：`GET`, `HEAD`, `OPTIONS`
- **请求路径**：`/api/stream/:id`
- **路径参数**：
  | 参数名 | 类型 | 必填 | 说明 |
  | :--- | :--- | :---: | :--- |
  | `id` | string | 是 | Google Drive 文件唯一 ID |
- **查询参数**：
  | 参数名 | 类型 | 必填 | 说明 |
  | :--- | :--- | :---: | :--- |
  | `filename` | string | 否 | 用于 MIME 映射校准（如 `.mkv` 强制转 `video/x-matroska`）及生成 `Content-Disposition` 供本地播放器识别 |
  | `token` | string | 否 | 当启用了全站密码时携带的访问令牌 |
- **请求头示例 (Range 分片请求)**：
  ```http
  GET /api/stream/1ABC999VideoId?filename=Inception.mkv HTTP/1.1
  Host: cf-pages-drive-player.pages.dev
  Range: bytes=0-1048575
  ```
- **请求命令示例**：
  ```bash
  # 测试获取前 1MB 分片
  curl -i -H "Range: bytes=0-1048575" "https://cf-pages-drive-player.pages.dev/api/stream/1ABC999VideoId?filename=Inception.mkv"
  ```
- **分片成功响应 (HTTP 206 Partial Content)**：
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

#### 客户端智能降级与 Google 云端预览集成契约

当浏览器宿主环境无法原生解码媒体流时（如 Safari 下播放 MKV、缺少 HEVC/H.265 硬解、商用 DTS/AC-3 音频或起播黑屏），前端状态机自动无感降级调用 Google 官方转码预览通道：
- **预览端点**：`https://drive.google.com/file/d/{id}/preview`
- **控制参数**：
  - `autoplay=1`：自动起播
  - `vq=highres`（或 `hd2160`/`hd1080`/`hd720`）：画质参数对齐源文件元数据
- **安全沙箱隔离**：使用纯 CSS 负边距偏移裁切架构隐藏 Google 顶栏，同时保留完整硬件解码支持与全屏能力。详细规范见 [ADR-0002](adr/0002-adaptive-playback-sandboxing-and-minimalist-player_zh.md)。

---

### 4. 文件原生下载 (`GET /api/download/:id`)

触发浏览器原生文件下载对话框，自动处理 RFC 5987 国际化文件名编码与 Google 文档（Docs/Sheets/Slides）转码导出。

- **请求方法**：`GET`
- **请求路径**：`/api/download/:id`
- **路径参数**：
  | 参数名 | 类型 | 必填 | 说明 |
  | :--- | :--- | :---: | :--- |
  | `id` | string | 是 | Google Drive 文件 ID |
- **查询参数**：
  | 参数名 | 类型 | 必填 | 说明 |
  | :--- | :--- | :---: | :--- |
  | `filename` | string | 否 | 自定义保存的文件名 |
  | `token` | string | 否 | 访问令牌（若启用了密码） |
- **请求命令示例**：
  ```bash
  curl -OJ "https://cf-pages-drive-player.pages.dev/api/download/1ABC999VideoId?filename=Inception.mkv"
  ```
- **成功响应 (HTTP 200)**：
  ```http
  HTTP/1.1 200 OK
  Content-Type: application/octet-stream
  Content-Disposition: attachment; filename="Inception.mkv"; filename*=UTF-8''Inception.mkv
  ```

---

### 8. Telegram 媒体转存 Webhook (`GET/POST /api/telegram/webhook`)

接收 Telegram 用户发送的媒体与文件，通过 Google Drive 官方 API 转存至指定目录。

- **方法**：`GET`（存活探针）、`POST`（Telegram 投递更新）
- **路径**：`/api/telegram/webhook`

#### 来源校验（可选但强烈建议）

配置 `TELEGRAM_WEBHOOK_SECRET` 后，每次 `POST` 都必须携带匹配的请求头，否则返回 **HTTP 401**：

```http
X-Telegram-Bot-Api-Secret-Token: <TELEGRAM_WEBHOOK_SECRET>
```

#### 更新载荷处理

| 场景 | 响应 |
| :--- | :--- |
| 未配置 Bot Token | `200` + `{"ok":false,"error":"Telegram Bot Token 未配置"}` |
| 请求体非合法 JSON | `400` + `Invalid JSON` |
| 非 `message` / `channel_post` 更新 | `200` + `{"ok":true,"ignored":true}` |
| `/start` 或 `/help` | `200` + `{"ok":true}`（不校验白名单，仅供信息展示） |
| 发送者不在白名单 | `200` + `{"ok":true,"denied":true}` |
| 无媒体且无文本 | `200` + `{"ok":true,"ignored":"no_media"}` |
| 声明大小 > 20 MB | `200` + `{"ok":true,"ignored":"too_large"}` |
| 转存完成 | `200` + `{"ok":true,"fileId":"..."}` |
| 已转存过（幂等） | `200` + `{"ok":true,"deduped":true,"fileId":"..."}` |
| 瞬时故障（Telegram/Drive 不可达、5xx、429） | `502` + `{"ok":false,"error":"<固定中文文案>"}` |
| 永久故障（配额、授权、路径无效） | `200` + `{"ok":true}` |

> **设计说明**
> - **20 MB 上限**来自 Telegram Bot API 的 `getFile` 限制，超限文件根本无法经机器人拉取，因此校验前置到任何出站请求之前。
> - **白名单 fail-closed**：白名单留空时拒绝所有上传请求；文本指令仍响应，便于用户自助发现配置方式。
> - **幂等**：以 Drive `appProperties` 键（`cfTgFileUniqueId`，取自 Telegram `file_unique_id`）去重，Telegram 重推不会产生重复文件。
> - 原始错误文本**绝不**回吐给用户，只发送固定中文文案，原始错误仅入日志。

---

### 9. 按 ID 查询文件元数据 (`GET /api/meta/:id`)

按 ID 直接定位单个文件，无需知道其所在目录。支撑 Telegram 深链（`?file=<id>`）。

- **方法**：`GET`
- **路径**：`/api/meta/:id`
- **路径参数**：
  | 参数 | 类型 | 必填 | 说明 |
  | :--- | :--- | :---: | :--- |
  | `id` | string | 是 | Google Drive 文件 ID |
- **查询参数**：
  | 参数 | 类型 | 必填 | 说明 |
  | :--- | :--- | :---: | :--- |
  | `token` | string | 否 | 开启密码保护时的访问令牌 |
- **示例请求**：
  ```bash
  curl -X GET "https://cf-pages-drive-player.pages.dev/api/meta/1ABC999VideoId"
  ```
- **成功响应 (HTTP 200)**：
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
- **错误响应**：`401`（开启密码保护且无有效令牌）、`404`（文件不存在）、`500`/`502`（Drive 请求失败）——均返回含 `success` 布尔字段的 JSON。

---

## 前台密码验证与后台管理接口

### 5. 身份认证与 Token 颁发 (`POST /api/admin/auth`)

- **请求方法**：`POST`
- **请求路径**：`/api/admin/auth`
- **请求头**：`Content-Type: application/json`

#### 场景 A：访客前台访问密码校验 (`verify_access`)
```bash
curl -X POST https://cf-pages-drive-player.pages.dev/api/admin/auth \
  -H "Content-Type: application/json" \
  -d '{"action": "verify_access", "password": "guest_password_123"}'
```
响应示例：
```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

#### 场景 B：管理员控制台登录 (`admin_login`)
```bash
curl -X POST https://cf-pages-drive-player.pages.dev/api/admin/auth \
  -H "Content-Type: application/json" \
  -d '{"action": "admin_login", "password": "your_admin_password"}'
```
响应示例：
```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

---

### 6. 系统配置读取与更新 (`GET/POST /api/admin/config`)

读取或更新系统级配置（网站标题、访问密码、管理员密码）。

- **请求头**：`Authorization: Bearer <ADMIN_TOKEN>`

#### 读取当前配置 (`GET`)
```bash
curl -X GET https://cf-pages-drive-player.pages.dev/api/admin/config \
  -H "Authorization: Bearer <ADMIN_TOKEN>"
```
响应示例：
```json
{
  "success": true,
  "config": {
    "siteName": "我的私人影院",
    "siteSubtitle": "流媒体与通用文件中心",
    "requirePassword": true,
    "accessPassword": "guest_password_123",
    "hasAdminPassword": true,
    "kvConfigured": false
  }
}
```

#### 更新系统配置 (`POST`)
```bash
curl -X POST https://cf-pages-drive-player.pages.dev/api/admin/config \
  -H "Authorization: Bearer <ADMIN_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "siteName": "全新影音中心",
    "siteSubtitle": "极速边缘云盘",
    "requirePassword": true,
    "accessPassword": "new_guest_pwd_2026",
    "newAdminPassword": "new_admin_pwd_2026"
  }'
```
响应示例：
```json
{
  "success": true,
  "persisted": "DriveMeta",
  "newToken": "eyJhbGciOiJIUzI1NiIs..."
}
```

---

### 7. 云盘文件在线管理 (`POST /api/admin/files`)

提供云端文件全生命周期管控接口。

- **请求头**：`Authorization: Bearer <ADMIN_TOKEN>`
- **请求头**：`Content-Type: application/json`

#### 支持动作速查表：
| Action | 说明 | 关键入参 |
| :--- | :--- | :--- |
| `inspect` | 深度探测文件/目录元数据与子项 | `fileId` (默认 root) |
| `rename` | 重命名文件、目录或快捷方式 | `fileId`, `shortcutId` (可选), `newName` |
| `move` | 移动文件或目录至目标文件夹 | `fileId` 或 `shortcutId`, `targetFolderId` |
| `delete` | 移入回收站或彻底删除 | `fileId` 或 `shortcutId`, `permanent: boolean` |
| `create_folder` | 在指定父目录下新建文件夹 | `name`, `parentFolderId` (默认 root) |
| `create_file` | 创建文本/代码文件 (支持 multipart) | `name`, `content`, `mimeType`, `parentFolderId` |
| `init_resumable_upload` | 申请 Google 断点续传直传 URL | `name`, `parentFolderId`, `mimeType`, `fileSize` |

#### 示例：重命名文件 (`rename`)
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
响应示例：
```json
{
  "success": true,
  "message": "重命名成功",
  "file": {
    "id": "1ABC999VideoId",
    "name": "Inception.DirectorCut.2010.mkv"
  }
}
```

---

### 10. Telegram Webhook 管理 (`GET/POST/DELETE /api/admin/telegram`)

管理 Telegram Webhook 注册并执行诊断。所有路由均需管理员 Bearer Token。

- **请求头**：`Authorization: Bearer <ADMIN_TOKEN>`

#### 查询 Webhook 状态 (`GET`)
```bash
curl -X GET https://cf-pages-drive-player.pages.dev/api/admin/telegram \
  -H "Authorization: Bearer <ADMIN_TOKEN>"
```
响应示例：
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

#### 注册 Webhook (`POST` 且 `action: "register"`)
```bash
curl -X POST https://cf-pages-drive-player.pages.dev/api/admin/telegram \
  -H "Authorization: Bearer <ADMIN_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"action": "register"}'
```
响应示例：
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
> 仅当配置了 `TELEGRAM_WEBHOOK_SECRET` 时才会自动携带 `secret_token`，从而保证 Webhook URL 不被伪造调用。

#### 测试 Bot 连接 (`POST` 且 `action: "test"`)
```bash
curl -X POST https://cf-pages-drive-player.pages.dev/api/admin/telegram \
  -H "Authorization: Bearer <ADMIN_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"action": "test"}'
```
响应示例：
```json
{
  "success": true,
  "botUsername": "my_drive_bot",
  "botFirstName": "Drive Transfer",
  "botId": 1234567890
}
```

#### 端到端转存自检 (`POST` 且 `action: "test-upload"`)
向目标目录上传一个极小的探针文件并立即删除，用于验证凭据、配额与写权限。
```bash
curl -X POST https://cf-pages-drive-player.pages.dev/api/admin/telegram \
  -H "Authorization: Bearer <ADMIN_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"action": "test-upload"}'
```
响应示例：
```json
{
  "success": true,
  "probeFileId": "1ProbeFileId",
  "targetFolderId": "1-3i7VNCMLtTfkWxWpSemjUIvdwNLCi6l"
}
```

#### 存储能力诊断 (`POST` 且 `action: "capability"`)

区分写入失败的**真实原因**——三种成因的修法完全不同：个人网盘拒绝服务账号文件、共享硬盘空间不足、权限未授予。

该探测会读取目标目录元信息（`driveId` **仅**对共享硬盘内的条目返回）、列出服务账号可访问的共享硬盘，随后真实写入 1 字节探针文件并立即删除，从而拿到 Google 的原始拒绝原因。

```bash
curl -X POST https://cf-pages-drive-player.pages.dev/api/admin/telegram \
  -H "Authorization: Bearer <ADMIN_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"action": "capability"}'
```
响应示例：
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

| `verdict` | 含义 | 处理 |
| :--- | :--- | :--- |
| `writable` | 可正常写入 | 无需处理 |
| `personal_drive_sa_no_quota` | 目标位于个人网盘；上传文件归服务账号所有，而服务账号**无配额** | 将目标移入共享云端硬盘（需 Google Workspace） |
| `shared_drive_quota` | 目标位于共享硬盘，但写入仍被配额拒绝 | 清理空间或升级组织存储额度；确认服务账号是成员 |
| `insufficient_permissions` | 服务账号对该目录无写入权限 | 共享该目录：共享硬盘授「内容管理员」，个人网盘授「编辑者」 |
| `unknown` | 未能判定原因 | 将诊断结果提供给维护者 |

> **核心规则**：Google Cloud 服务账号**没有自己的存储配额**。它创建的任何文件都归服务账号所有，因此无论个人「我的云端硬盘」还剩多少空间，写入都会被拒绝。只有**共享云端硬盘**能给服务账号的上传提供归属——而共享云端硬盘需要 Google Workspace（企业版/教育版）账号。个人 Gmail 账号无法创建共享硬盘，因此在其上服务账号写入在任何配置下都不可能成功。

#### 注销 Webhook (`DELETE`)
```bash
curl -X DELETE https://cf-pages-drive-player.pages.dev/api/admin/telegram \
  -H "Authorization: Bearer <ADMIN_TOKEN>"
```
