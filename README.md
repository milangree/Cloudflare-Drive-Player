# Cloudflare Drive Player

一个基于 **Cloudflare Pages Functions** 与 **Google Drive API（Service Account）** 构建的轻量级网盘目录索引与流媒体在线播放器。

**零服务端、零运行时 npm 依赖、纯边缘计算**：静态资源走 Cloudflare 边缘 CDN 直通，全部业务逻辑运行在 Cloudflare Pages Functions 中，鉴权签名直接使用浏览器/边缘原生 Web Crypto API，无需任何构建打包流程。

![Platform: Cloudflare Pages](https://img.shields.io/badge/Platform-Cloudflare%20Pages-f38020?logo=cloudflare)
![Storage: Google Drive](https://img.shields.io/badge/Storage-Google%20Drive-4285F4?logo=googledrive)
![Runtime Dependencies: Zero](https://img.shields.io/badge/Runtime%20Dependencies-Zero-emerald)
![Frontend Stack: Tailwind + ArtPlayer](https://img.shields.io/badge/Frontend-Tailwind%20%2B%20ArtPlayer-0ea5e9)
![License: 未定义 (No LICENSE file)](https://img.shields.io/badge/License-%E6%9C%AA%E5%AE%9A%E4%B9%89-lightgrey)

---

## 1. 项目简介与定位

Cloudflare Drive Player 把一个 Google Drive 根文件夹变成可公开浏览、可在线流媒体播放的私有云盘站点。它的定位非常明确：

| 它是 | 它不是 |
| :--- | :--- |
| 一个**目录索引 + 流媒体代理**：列出 Drive 文件夹内容，并把媒体文件以 HTTP Range 分片透传给浏览器 | 一个**转码服务**：项目内没有 FFmpeg，也不在边缘做实时转码 |
| 一个**零运维**的 Serverless 应用：无服务器、无数据库、无构建步骤 | 一个**网盘存储**：所有数据仍然存放在 Google Drive，本项目不复制、不缓存媒体内容 |
| 一个**开箱即用**的播放器：内置自适应降级、外挂字幕、断点续播、本地播放器唤起 | 一个**多用户 SaaS**：只有一套「访客令牌 + 管理员令牌」的简易权限模型 |

> **关于「云端转码」的真实含义**：本项目所称的「云端转码预览」，实质是嵌入 **Google Drive 官方预览页**（`https://drive.google.com/file/d/{id}/preview`）由 Google 侧完成转码播放，并非本项目自行转码。该通道要求目标文件对访客可访问（见 [ADR-0001](docs/adr/0001-media-streaming-and-transcoding-architecture.md)）。

---

## 2. 核心特性

### 2.1 边缘原生架构

- **零运行时依赖**：`package.json` 中唯一的依赖是开发工具 `wrangler`（devDependencies），生产运行时不加载任何 npm 包（见 [package.json](package.json)）。
- **Web Crypto 原生 JWT 签名**：Google Service Account 的 RS256 JWT 通过 `crypto.subtle` 直接签名并换取 OAuth2 Token，带 300 秒提前量的 Token 缓存（见 [functions/utils/googleAuth.js](functions/utils/googleAuth.js)）。
- **边缘路由隔离**：`public/_routes.json` 仅声明 `/api/*` 进入 Functions 计算，静态资源 100% 走 CDN 直通，彻底规避静态资源被 Worker 冷启动拖垮的风险（见 [public/_routes.json](public/_routes.json) 与 [ADR-001](docs/adr/ADR-001-cf-pages-edge-routing-and-ci-resilience.md)）。

### 2.2 流媒体与自适应降级

- **HTTP Range 分片透传**：完整支持 `Range` / `If-Range` / `If-Match` 请求头转发与 `206 Partial Content` 响应，支持 `HEAD` 探测与 `416` 区间回传，实现大视频秒开与任意进度拖拽（见 [functions/api/stream/[id].js](functions/api/stream/[id].js)）。
- **MKV MIME 校准**：强制将 `.mkv` 映射为 `video/x-matroska`，并修正上游返回的 `application/octet-stream`。
- **双阶段智能降级引擎**（见 [public/js/app.js](public/js/app.js)）：
  - **阶段一 · 静态先验探测** `canBrowserPlayNatively()`：黑名单容器（`avi/wmv/rmvb/vob/iso`）、Safari 下的 MKV、多声道商业音频（`DTS/TrueHD/Atmos/AC3/EAC3`）、HEVC/H.265 硬解能力探测；判定失败则**直接跳过原生播放器**，自动切至 Google 云端预览。
  - **阶段二 · 动态双阶看门狗** `startMediaWatchdog()`：2.5 秒快速黑屏侦测（有声无画）+ 5 秒深度稳定性巡检；捕获 `video.error`、解码卡死、`readyState < 2` 后自动无感切源，并保留 Toast 提示与手动切回入口。
- **零遮挡视窗**：Google 预览 iframe 采用纯 CSS 几何裁切（`top: -56px; height: calc(100% + 56px)`）隐藏 Google 原生 56px 顶栏，**不引入任何遮罩层**，iframe 使用完整 `allow=` 权限（含 `encrypted-media`、`fullscreen`），以保留 EME/DRM 与自动播放能力。
- **画质热切换**：在「Google 云端预览」与「4K/原画直链」之间一键切换，不重载页面。

### 2.3 OpenList 范式多选与批量管理

- **日常浏览纯净无扰**：复选框默认隐藏；仅管理员登录后在导航栏出现「多选模式」开关。
- **优先级事件仲裁**：多选态下点击整行/卡片任意区域优先切换选中状态，防止误触播放；进入文件夹需使用专属「打开」按钮或 `Alt/Option + 点击`。
- **底吸浮动工具栏**：全选本页、反选本页、清空退出。
- **批量操作**：批量重命名（替换 / 前后缀 / 递增序号，带实时预览）、批量跨目录移动、批量移入回收站（默认非永久删除）。
- **受控并发池**：前端原子级并发调度（并发上限 3），规避 Cloudflare Functions 请求时长限制与 Google API 429 限流。

### 2.4 极简播放器控制台

播放器顶栏只保留四项核心控件：**① 文件名**（自适应截断 + Tooltip + 一键全选）、**② 本地播放器调用中心**、**③ 最大化 / 还原**、**④ 关闭**。

外部播放器协议支持（见 [docs/player-architecture-and-user-guide.md](docs/player-architecture-and-user-guide.md)）：

| 播放器 | 协议 |
| :--- | :--- |
| MPV | `mpv://<StreamUrl>` 或终端命令 `mpv "<StreamUrl>"` |
| PotPlayer (Windows) | `potplayer://<StreamUrl>` |
| IINA (macOS) | `iina://weblink?url=<StreamUrl>` |
| VLC | `vlc://<StreamUrl>` |
| Infuse (iOS / Apple TV) | `infuse://open?url=<StreamUrl>` |
| Android (Just Player / Next Player / VLC) | `intent:<StreamUrl>#Intent;action=android.intent.action.VIEW;type=video/*;end` |
| 通用 | 复制直链（RFC 5987 文件名）/ 复制 MPV 命令 |

### 2.5 播放体验增强

- **自动连播**：智能提取剧集序号（剥离 `ep`/`e`/`第N集` 标记），自然排序后生成播放列表，支持上一集/下一集与「自动连播」开关（偏好持久化）。
- **断点续播**：播放进度按文件 ID 存入 `localStorage`（键 `cf_player_progress`），再次打开弹出续播提示条。
- **外挂字幕**：自动检测同名字幕（`vtt/srt/ass/sub`）并优先挂载；支持 `+0.5s / -0.5s / 重置` 时间轴微调；支持选择本地字幕文件；`SRT`/`ASS` 在浏览器端实时转换为 WebVTT。
- **播放倍速记忆**、音频文件居中卡片式播放、竖屏视频比例自适应。

### 2.6 后台管理系统

- **动态配置持久化**：站点标题（`SITE_NAME`）等配置可在线修改，无需回 Cloudflare 重新部署环境变量。
- **三级配置存储**（见 [functions/utils/configManager.js](functions/utils/configManager.js)）：Cloudflare KV（键 `SYSTEM_CONFIG`）→ Google Drive 根文件夹私有属性（`properties.cf_sys_config`）→ 环境变量 → 运行时内存。未绑定 KV 时自动降级到 Drive 属性，**开箱即用、永久持久化**。
- **站点密码保护**：可一键开启「全站访问密码」，未验证访客无法列出或播放任何资源。
- **文件全生命周期管理**：在线查看元数据、重命名、移动、删除（移入回收站 / 永久删除）、新建文件夹、上传文件（含可恢复的断点续传初始化）、一键设置文件为「知道链接的任何人可查看」。

### 2.7 网盘浏览体验

多级目录穿梭与面包屑导航、实时模糊搜索、五种排序（名称升降序 / 最新修改 / 文件大小升降序）、网格与表格双视图（记忆偏好）、15/30/50/100/全部 分页、640px 高清缩略图与分辨率徽标、图片灯箱预览、文件下载与直链复制、深色毛玻璃（Glassmorphism）视觉。

### 2.8 质量保障与 CI/CD

- **阶段一 · 质量与安全门禁**：JavaScript 语法与静态契约校验（`scripts/ci-check.js`，7 项检查）、生产依赖漏洞阻断门禁（`npm audit --omit=dev --audit-level=high`）、脚手架依赖预警（非阻断）。
- **阶段二 · 部署与冒烟**：`cloudflare/wrangler-action@v3` 部署到 Cloudflare Pages，主分支进入生产分支，随后执行带 Anycast 预热与指数退避重试的冒烟测试（`scripts/healthcheck.js`，8 项检查）。

---

## 3. 技术架构

```
浏览器 (public/)
  │  ① 静态资源直出：index.html / css / js / favicon.svg（CDN 直通，不经 Functions）
  │  ② /api/* 请求 → Cloudflare Pages Functions
  ▼
Cloudflare Pages Functions (functions/)
  ├── api/_middleware.js      统一 CORS 与全局异常保护（仅作用于 /api/*）
  ├── api/info.js             站点信息与配置探测
  ├── api/list.js             目录列表（分页 / 搜索 / 快捷方式解析 / 文件夹统计）
  ├── api/stream/[id].js      媒体流代理（Range 透传 / MIME 校准）
  ├── api/download/[id].js    文件下载（RFC 5987 / Google 文档导出）
  ├── api/admin/*             认证、配置、文件管理
  └── utils/*                 Google 鉴权、三级配置管理
  ▼
Google Drive API v3（Service Account Bearer Token）
```

- **鉴权模型**：`Authorization: Bearer <token>` 或 URL Query `?token=<token>` 双通道（流媒体标签与外部播放器无法自定义 Header，故必须支持 Query 通道）。
- **令牌结构**：`<base64url(payload)>.<signature>`，`payload` 含 `exp`（7 天有效期）与 `role`（`viewer` / `admin`）；`signature = SHA-256(payloadB64 + secret)` 取前 32 位十六进制。
- **恒定时间比较**：`timingSafeEqual()` 逐字符异或累加比对签名，避免时序侧信道。

---

## 4. 目录结构

```text
Cloudflare Drive Player/
├── .github/workflows/ci-cd.yml    # GitHub Actions 双阶段 CI/CD
├── docs/                          # 架构决策与工程文档
│   ├── adr/                       # ADR 架构决策记录
│   ├── api-reference.md           # API 接口参考
│   ├── ci-cd-deployment-guide.md  # CI/CD 与部署排障
│   └── player-architecture-and-user-guide.md
├── functions/                     # Cloudflare Pages Functions（边缘 API 层）
│   ├── api/
│   │   ├── _middleware.js
│   │   ├── info.js
│   │   ├── list.js
│   │   ├── stream/[id].js
│   │   ├── download/[id].js
│   │   └── admin/{auth,config,files}.js
│   └── utils/{configManager,googleAuth}.js
├── public/                        # 静态前端资源
│   ├── index.html                 # 单页应用
│   ├── css/style.css
│   ├── js/app.js                  # 前端核心交互逻辑
│   ├── favicon.svg
│   ├── _headers                   # 静态资源响应头（CORS / CSP / nosniff）
│   └── _routes.json               # 边缘路由隔离（仅 /api/* 走 Functions）
├── scripts/
│   ├── ci-check.js                # 阶段一：语法与静态契约校验
│   └── healthcheck.js             # 阶段二：冒烟测试
├── wrangler.toml                  # Wrangler 配置（Pages 项目名与 KV 绑定）
├── .env.example                   # 环境变量模板
└── package.json
```

---

## 5. 环境变量与配置

在 **Cloudflare Dashboard → Pages → Settings → Environment variables** 中配置。本地调试时复制 [.env.example](.env.example) 为 `.dev.vars`（已在 [.gitignore](.gitignore) 中忽略）。

### 5.1 环境变量清单

| 变量名 | 必填 | 说明 |
| :--- | :---: | :--- |
| `SERVICE_ACCOUNT_JSON` | **是**（二选一） | Google Service Account 的**完整 JSON 字符串**（含 `private_key`、`client_email`），直接粘贴 JSON 内容 |
| `GOOGLE_CLIENT_EMAIL` | **是**（二选一） | 服务账号邮箱；与 `GOOGLE_PRIVATE_KEY` 组合使用 |
| `GOOGLE_PRIVATE_KEY` | **是**（二选一） | JSON 密钥中的私钥完整内容（含 `-----BEGIN PRIVATE KEY-----` 与 `-----END PRIVATE KEY-----`） |
| `ROOT_FOLDER_ID` | 推荐 | 挂载的 Google Drive 根文件夹 ID；留空则默认使用 `root` |
| `SITE_NAME` | 否 | 站点标题；留空则回退为「Google Drive 根文件夹名 - Drive Player」 |
| `REQUIRE_ACCESS_PASSWORD` | 否 | 置为 `true` 或 `1` 时开启全站访问密码保护 |
| `ACCESS_PASSWORD` | 否 | 访客访问密码（仅在 `REQUIRE_ACCESS_PASSWORD` 开启时生效） |
| `ADMIN_PASSWORD` | 否 | 后台管理密码；**若不设置，代码内默认值为 `admin`**，请务必显式配置 |

> **凭据二选一**：`SERVICE_ACCOUNT_JSON` 与 `GOOGLE_CLIENT_EMAIL` + `GOOGLE_PRIVATE_KEY` 两组方式任选其一（见 [functions/utils/googleAuth.js](functions/utils/googleAuth.js)）。JSON 方式支持在 JSON 内直接携带 `root_folder_id`。

### 5.2 Cloudflare KV 命名空间（可选，推荐生产开启）

KV 用于提供毫秒级的配置读取与备份。**注意**：当项目根目录存在 `wrangler.toml` 时，Cloudflare Pages 会自动接管绑定管理，控制台界面的手动绑定将被锁定，所有绑定必须在 `wrangler.toml` 中配置（见 [wrangler.toml](wrangler.toml) 注释）。

```toml
[[kv_namespaces]]
binding = "DRIVE_KV"
id = "<你的 KV Namespace ID>"
```

未绑定 KV 时系统自动使用 Google Drive 根文件夹属性持久化，功能不受影响。

---

## 6. 本地开发

前置条件：Node.js 18+（CI 使用 Node 20）、npm、[Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/)。

```bash
# 安装开发依赖（仅 wrangler）
npm install

# 配置本地机密（复制模板并填入真实值）
cp .env.example .dev.vars

# 启动本地 Pages 开发服务器（含 Functions 模拟）
npm run dev
```

常用脚本（见 [package.json](package.json)）：

| 命令 | 作用 |
| :--- | :--- |
| `npm run dev` | 本地启动 Cloudflare Pages 开发环境 |
| `npm run test:syntax` | 运行 `scripts/ci-check.js` 静态契约校验 |
| `npm run healthcheck` | 无参数时打印契约摘要；传 URL 时执行冒烟测试 |
| `npm run deploy` | 部署到 Cloudflare Pages（预览） |
| `npm run deploy:preview` | 部署预览环境 |
| `npm run deploy:prod` | 部署并提交到 `main` 分支（生产） |

---

## 7. 部署

### 方式一：GitHub Actions 自动部署（推荐）

推送至 `main` / `master` 或手动触发 `workflow_dispatch` 即可自动执行「质量门禁 → 部署 → 冒烟测试」（见 [.github/workflows/ci-cd.yml](.github/workflows/ci-cd.yml)）。首次使用需在仓库 Secrets 中配置：

| Secret | 说明 |
| :--- | :--- |
| `CLOUDFLARE_API_TOKEN` | Cloudflare API Token（需具备 Pages 编辑权限） |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare 账户 ID |

> **注意**：工作流通过 `--project-name=cf-pages-drive-player` 指定 Cloudflare Pages 项目名（见 [.github/workflows/ci-cd.yml](.github/workflows/ci-cd.yml)）。该名称是 **Cloudflare 侧的 Pages 项目名**，与 GitHub 仓库名相互独立；它决定了站点的 `*.pages.dev` 默认域名。

### 方式二：Wrangler 命令行部署

```bash
npm run deploy:prod
```

### 首次部署的前置步骤

1. 在 [Google Cloud Console](https://console.cloud.google.com/) 启用 **Google Drive API**。
2. 创建 **Service Account**，在 **Keys** 中创建 **JSON** 密钥并下载。
3. 在 Google Drive 中把目标根文件夹**共享**给该 Service Account 的 `client_email`：
   - 仅需浏览/播放：授予 **查看者（Viewer）**。
   - 需要在线重命名/移动/删除/上传：授予 **内容管理员（Editor）** 或更高权限。
4. 从浏览器地址栏提取根文件夹 ID 作为 `ROOT_FOLDER_ID`。
5. 在 Cloudflare Pages 环境变量中填入凭据，然后部署。

---

## 8. API 端点

所有端点位于 `functions/api/` 下，统一经过 `_middleware.js` 处理 CORS 与全局异常。

| 方法 | 路径 | 鉴权 | 说明 |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/info` | 无 | 站点信息、配置探测、根文件夹信息、`clientEmail`（脱敏）、是否开启密码保护 |
| `GET` | `/api/list` | 访客/管理员令牌 | 目录列表；参数 `folderId`、`search`、`pageToken`；返回 `items` 与 `nextPageToken` |
| `GET` / `HEAD` / `OPTIONS` | `/api/stream/:id` | 访客/管理员令牌 | 媒体流代理；参数 `filename` 或 `name`；支持 `Range` / `If-Range` / `If-Match` |
| `GET` | `/api/download/:id` | 访客/管理员令牌 | 文件下载；参数 `filename`；Google Docs/Sheets/Slides 自动导出 |
| `POST` | `/api/admin/auth` | 无 | `action=verify_access`（访客密码）/ `action=admin_login`（管理员密码） |
| `GET` / `POST` | `/api/admin/config` | 管理员令牌 | 读取 / 更新站点配置（`siteName`、`requirePassword`、`accessPassword`、`newAdminPassword`） |
| `POST` | `/api/admin/files` | 管理员令牌 | 文件管理操作（见下表） |

`/api/admin/files` 的 `action` 取值：

| action | 作用 |
| :--- | :--- |
| `inspect` | 读取文件元数据与其子项（pageSize 20） |
| `rename` | 重命名（自动级联处理 Google 快捷方式） |
| `move` | 跨目录移动（`addParents` / `removeParents`） |
| `delete` | `permanent=true` 永久删除，否则移入回收站 |
| `create_folder` | 新建文件夹 |
| `create_file` | 上传文件（multipart/related） |
| `init_resumable_upload` | 初始化断点续传，返回 `uploadUrl` |
| `ensure_public` | 设置文件为「知道链接的任何人可查看」（`role=viewer, type=anyone`） |

> 完整请求/响应示例见 [docs/api-reference.md](docs/api-reference.md)。

---

## 9. 安全与权限模型

- **凭证物理隔离**：Google 私钥仅存在于 Cloudflare 边缘环境变量中，接口不会透出任何 Google 鉴权令牌；`/api/info` 仅返回脱敏后的 `clientEmail`。
- **双令牌体系**：访客令牌（`role=viewer`）与后台管理员令牌（`role=admin`）分离，管理接口强制校验 `role=admin`。
- **恒定时间比较**：`timingSafeEqual()` 用于签名比对，降低时序侧信道风险（见 [functions/utils/configManager.js](functions/utils/configManager.js)）。
- **响应头防护**：`X-Content-Type-Options: nosniff`、`Content-Security-Policy: frame-src 'self' https://drive.google.com; frame-ancestors 'self'`（见 [public/_headers](public/_headers)）。
- **CORS**：`/api/*` 统一返回 `Access-Control-Allow-Origin: *`，便于第三方播放器与外部页面嵌入。

> **部署前请务必确认的事项**：① 显式设置 `ADMIN_PASSWORD`，否则后台密码为默认值 `admin`；② 如需限制访问，同时设置 `REQUIRE_ACCESS_PASSWORD=true` 与 `ACCESS_PASSWORD`；③ 令牌可通过 URL Query 传递（外部播放器需要），若对日志泄露敏感，请优先使用 `Authorization` 头。

---

## 10. 常见问题与限制

**Q：播放时黑屏有声音 / 提示无法解码？**
A：说明当前浏览器无法硬解该容器或编码。系统会自动降级到 Google 云端预览；若仍未成功，请使用播放器顶栏的本地播放器调用中心（MPV / VLC / IINA / PotPlayer 等）拉起本地解码器。

**Q：Google 预览要求登录 Google 账号，无法播放？**
A：Google Drive Web Preview 依赖访客自身的 Google 会话。若文件未对外开放，Google 会重定向到登录页并被 iframe 拦截。请在后台对目标文件执行「设为公开」（`ensure_public`），或将文件共享给「知道链接的任何人」。

**Q：MKV 在 Safari 下无法播放？**
A：属于预期行为。Safari/WebKit 不支持 `video/x-matroska`，系统会自动切换至 Google 预览或建议改用本地播放器。

**Q：为什么没有「真正的」转码？**
A：Cloudflare Workers/Pages 有严格的 CPU 时间与内存上限（128MB），实时视频转码在边缘不可行。项目采用「原生直链 + Google 官方预览 + 本地播放器」三级方案（见 [ADR-0001](docs/adr/0001-media-streaming-and-transcoding-architecture.md)）。

**Q：部署后静态资源返回 500？**
A：通常是中间件作用范围过大或边缘收敛延迟。本项目已通过 `functions/api/_middleware.js` 下沉 + `public/_routes.json` 隔离 + 冒烟测试指数退避重试解决（见 [ADR-001](docs/adr/ADR-001-cf-pages-edge-routing-and-ci-resilience.md)）。

**Q：提示 `Authentication error 10000` / Google Drive 403？**
A：多为 Service Account 凭据缺失或目标文件夹未共享给 `client_email`。凭据问题需在 Cloudflare 控制台修正后 **Retry deployment**（重新部署不会重新注入已缓存的环境变量）。

**已知限制**：

- 无转码能力，高码率/冷门编码依赖 Google 预览或本地播放器。
- 令牌有效期 7 天，过期后需重新验证（浏览器端已自动处理）。
- 认证接口无内置速率限制，建议配合 Cloudflare 防火墙规则或 WAF 使用。
- 配置持久化优先 KV，未绑定 KV 时写入 Drive 根文件夹属性；该属性为 Drive 文件元数据，不占用存储配额。
- 从原生播放器降级至 Google 预览时无法继承播放进度（跨域隔离限制，见 [ADR-0002](docs/adr/0002-adaptive-playback-sandboxing-and-minimalist-player.md)）。

更多排障细节见 [docs/ci-cd-deployment-guide.md](docs/ci-cd-deployment-guide.md)。

---

## 11. 许可证

**当前仓库未包含任何许可证文件**（`LICENSE` / `COPYING` 均不存在），GitHub 仓库 API 返回的 `license` 字段为 `null`。依版权法默认规则，本项目当前处于**保留所有权利（All Rights Reserved）**状态，他人不可自由复制、修改或再分发。

若希望以开源许可证发布（例如 MIT），请在仓库根目录新增 `LICENSE` 文件并重新推送，GitHub 会自动识别并在仓库页展示许可证信息。

> 说明：本仓库早期版本的 README 曾声明 MIT 许可证并链接 `LICENSE` 文件，但该文件实际不存在，属于失效声明；本版已修正为如实描述。

---

## 12. 致谢

- [Cloudflare Pages](https://pages.cloudflare.com/) / [Workers](https://workers.cloudflare.com/) / [KV](https://developers.cloudflare.com/kv/) —— 边缘托管、Serverless 函数与键值存储。
- [Google Drive API v3](https://developers.google.com/drive/api) —— 存储与转码预览能力。
- [Tailwind CSS](https://tailwindcss.com/) —— 前端原子化样式。
- [ArtPlayer](https://artplayer.org/) / [hls.js](https://github.com/video-dev/hls.js) / [flv.js](https://github.com/Bilibili/flv.js) —— 现代播放器内核与流媒体解码。
- [Lucide Icons](https://lucide.dev/) —— 图标库。
- [Wrangler](https://developers.cloudflare.com/workers/wrangler/) —— Cloudflare 命令行工具。
- [OpenList](https://github.com/OpenListTeam/OpenList) —— 多选交互范式的参考来源。

---

## 13. 文档索引

- [API 接口参考](docs/api-reference.md) —— 全量端点参数、状态码、认证流程与可执行 `curl` 示例。
- [播放器交互架构与自适应降级手册](docs/player-architecture-and-user-guide.md) —— 双阶段降级探测、56px 视口裁切规约、本地播放器协议与测试指南。
- [CI/CD 流水线与部署运维指南](docs/ci-cd-deployment-guide.md) —— 双阶段门禁、边缘预热机制与生产故障排查。
- [ADR-0001 流媒体与转码架构](docs/adr/0001-media-streaming-and-transcoding-architecture.md) —— 多级播放矩阵与鉴权纵深防御。
- [ADR-0002 自适应降级与极简视窗](docs/adr/0002-adaptive-playback-sandboxing-and-minimalist-player.md) —— 降级状态机、零遮挡模型与控制平面收敛。
- [ADR-001 边缘路由隔离与 CI 韧性](docs/adr/ADR-001-cf-pages-edge-routing-and-ci-resilience.md) —— 静态/API 边界隔离与冒烟测试重试策略。
