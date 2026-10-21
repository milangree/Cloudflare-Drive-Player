# Cloudflare Drive Player - API 接口参考文档 (API Reference)

本文档提供系统全量 API 规范说明与可直接执行的请求示例。所有接口均部署在 Cloudflare Pages Functions 边缘运行时（基于 V8 Isolate）。

---

## 目录
- [认证与安全机制](#认证与安全机制)
- [前台公开接口](#前台公开接口)
  - [1. 站点信息与配置状态 (`GET /api/info`)](#1-站点信息与配置状态-get-apiinfo)
  - [2. 目录文件索引与搜索 (`GET /api/list`)](#2-目录文件索引与搜索-get-apilist)
  - [3. 媒体流式代理与分片播放 (`GET/HEAD/OPTIONS /api/stream/:id`)](#3-媒体流式代理与分片播放-getheadoptions-apistreamid)
  - [4. 文件原生下载 (`GET /api/download/:id`)](#4-文件原生下载-get-apidownloadid)
- [前台密码验证与后台管理接口](#前台密码验证与后台管理接口)
  - [5. 身份认证与 Token 颁发 (`POST /api/admin/auth`)](#5-身份认证与-token-颁发-post-apiadminauth)
  - [6. 系统配置读取与更新 (`GET/POST /api/admin/config`)](#6-系统配置读取与更新-getpost-apiadminconfig)
  - [7. 云盘文件在线管理 (`POST /api/admin/files`)](#7-云盘文件在线管理-post-apiadminfiles)

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

#### 附：客户端智能降级与 Google 云端预览集成契约

当浏览器宿主环境无法原生解码媒体流时（如 Safari 下播放 MKV、缺少 HEVC/H.265 硬解、商用 DTS/AC-3 音频或起播黑屏），前端状态机自动无感降级调用 Google 官方转码预览通道：
- **预览端点**：`https://drive.google.com/file/d/{id}/preview`
- **控制参数**：
  - `autoplay=1`：自动起播
  - `vq=highres`（或 `hd2160`/`hd1080`/`hd720`）：画质参数对齐源文件元数据
- **安全沙箱隔离**：嵌入时使用 W3C HTML5 iframe 沙箱属性：`sandbox="allow-scripts allow-forms allow-presentation"`，严禁声明 `allow-popups`，天然阻断弹窗并彻底废除物理遮挡层。详细规范见 [ADR-0002](adr/0002-adaptive-playback-sandboxing-and-minimalist-player.md)。

---

### 4. 文件原生下载 (`GET /api/download/:id`)

触发浏览器原生文件下载对话框，自动处理 RFC 5987 国际化文件名编码与 Google 文档（Docs/Sheets/Slides）转码导出。

- **请求方法**：`GET`
- **请求路径**：`/api/download/:id`
- **查询参数**：
  | 参数名 | 类型 | 必填 | 说明 |
  | :--- | :--- | :---: | :--- |
  | `filename` | string | 否 | 自定义保存的文件名 |
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
