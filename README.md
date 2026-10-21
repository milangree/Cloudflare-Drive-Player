# Cloudflare Drive Player

一个基于 **Cloudflare Pages** 与 **Google Drive API (Service Account)** 构建的现代化、极速轻量网盘目录索引与流媒体在线播放器。

![Cloudflare Pages](https://img.shields.io/badge/Platform-Cloudflare%20Pages-f38020?logo=cloudflare)
![Google Drive](https://img.shields.io/badge/Storage-Google%20Drive-4285F4?logo=googledrive)
![Zero Dependencies](https://img.shields.io/badge/Dependencies-Zero%20(Pure%20Web%20Crypto)-emerald)
![OpenList Paradigm](https://img.shields.io/badge/Multi--Select-OpenList%20Paradigm-0284c7)
![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)

---

## ✨ 核心特性

- 🚀 **极简部署 & 零 npm 臃肿依赖**：基于原生 Web 标准与 Cloudflare Pages Functions，免去庞大的构建打包流程，纯原生 Web Crypto API 实现 Google 服务账号 JWT 签名，秒级上传部署。
- 🎬 **原生 HTTP Range 分片流媒体透传**：深度支持 `Range: bytes=` 请求与 `206 Partial Content` 状态穿透，在浏览器中实现大视频秒开播放、任意拖拽进度条。
- ⚡ **双阶段智能解码降级引擎 (Smart Adaptive Fallback)**：
  - **阶段一（静态先验探测）**：自动检测浏览器硬解能力与音频环境；遇到不支持的编码或容器（如 Safari 下 MKV、缺少 HEVC/AV1 硬解、AC-3/DTS 商用多声道）时，**系统自动无感切换至 Google 云端转码通道**。
  - **阶段二（动态双阶看门狗）**：2.0s 快速黑屏侦测与 4.0s 深度稳定性巡检；一旦发生解码假死、黑屏有声音或 HTML5 `video.error`，自动平滑切源至 Google 转码预览。
- 🛡️ **Google 云端预览零遮挡视窗 (56px 精准裁切)**：
  - 采用纯 CSS 视口裁剪规约（`top: -56px; height: calc(100% + 56px)`），从几何源头上彻底隐藏 Google 官方播放器右上角突兀的「弹出 (Pop-out)」图标，0 遮挡、0 黑块、0 画面拉伸，实现 100% 院线级纯净画质。
  - 彻底移除了破坏 Google YouTube 播放内核的受限沙箱，完整保留 EME/DRM 解码与凭证链，保障视频在各端 100% 稳定出声出画。
- 🎯 **OpenList 经典范式多选与批量管理**：
  - **日常浏览纯净无扰**：日常浏览时复选框默认隐藏，界面极简通透。
  - **显式开关与权限分流**：仅管理员登录后在导航栏提供「多选模式开关」，开启后激活批量管理。
  - **优先级事件仲裁**：多选激活态下，点击整行或卡片任意区域优先切换选中状态，彻底防止多选操作中因点中标题/封面误跳视频播放。
  - **双轨无缝穿透**：多选模式下进入文件夹支持「Alt/Option+点击」快捷键或直接点击文件夹专属「打开」按钮。
  - **底吸悬浮工具栏 (Floating Batch Bar)**：支持「全选本页」、「反选本页」、「清空退出」，提供批量重命名（替换/前后缀/递增序号及实时预览）、批量跨目录移动、批量移入回收站（安全防误删）。
  - **受控并发池调度**：前端原子级并发调度（Concurrency Limit = 3~5），彻底消除 Cloudflare Functions 30s 超时与 Google API 429 限流风险。
- 🖥️ **极简 4 合 1 纯净控制台**：
  - 播放器顶栏聚焦核心四要素：**① 文件名 (自适应截断/Tooltip/一键全选)**、**② 调用本地播放器纯图标按钮 (MPV / PotPlayer / IINA / VLC / Infuse / ExoPlayer / 快捷直链 / 终端命令)**、**③ 最大化 / 还原窗口**、**④ 关闭按钮**。
- 🔐 **完备的后台管理系统 (Admin Dashboard)**：
  - **访客安全访问密码**：支持后台一键开启「全站访问密码保护」，未输入密码的访客无法列出或播放任何资源。
  - **动态配置持久化**：直接在线修改网站标题 (SITE_NAME)，无需去 Cloudflare 重新部署环境变量。
  - **KV 毫秒级加速 / Drive Properties 自动双模降级**：优先使用 Cloudflare KV 命名空间存储配置，未绑定 KV 时自动无缝回退至 Google Drive 根目录私有属性持久化。
- 📁 **现代化网盘体验**：
  - 多级目录无限穿梭与交互式面包屑导航。
  - 实时模糊搜索与动态排序（名称 / 修改时间 / 文件大小）。
  - 网格卡片与表格列表双视图自由切换（自动记忆用户偏好）。
  - 支持高清视频海报缩略图展示、图片全屏灯箱预览与文件直接下载。
  - 优雅的深色模式（Dark Modern Glassmorphism）磨砂半透明美学设计。

---

## 🛠️ 架构概览

```text
Cloudflare-Drive-Player/
├── .github/
│   └── workflows/
│       └── ci-cd.yml          # GitHub Actions 自动化 CI/CD 流水线 (双阶段质量与部署门禁)
├── docs/                      # 架构决策与开发者工程文档
│   ├── adr/
│   │   ├── ADR-001-cf-pages-edge-routing-and-ci-resilience.md # 边缘路由隔离与 CI 韧性决策
│   │   ├── 0001-media-streaming-and-transcoding-architecture.md # 流媒体分片透传架构
│   │   └── 0002-adaptive-playback-sandboxing-and-minimalist-player.md # 智能降级、零遮挡沙箱与极简视窗 ADR
│   ├── api-reference.md       # 全量 API 接口参考文档与可执行示例
│   ├── ci-cd-deployment-guide.md # CI/CD 流水线与部署运维排障手册
│   └── player-architecture-and-user-guide.md # 播放器交互架构、自适应降级状态机与零遮挡视窗使用手册
├── functions/                 # Cloudflare Pages Functions (Serverless API 边缘层)
│   ├── api/
│   │   ├── _middleware.js     # API 统一中间件 (CORS 跨域与全局异常保护)
│   │   ├── info.js            # 网站信息与凭证配置检测
│   │   ├── list.js            # 目录文件列表 (支持分页与模糊搜索)
│   │   ├── stream/[id].js     # 媒体流代理核心 (HTTP 206 Range 分片透传与 MKV MIME 校准)
│   │   ├── download/[id].js   # 文件直接下载 (RFC 5987 编码文件名)
│   │   └── admin/             # 后台管理及云盘文件全生命周期管控 API
│   │       ├── auth.js        # 访问密码与管理员身份认证
│   │       ├── config.js      # 站点配置读取与动态持久化更新
│   │       └── files.js       # 在线重命名/移动/删除/批量操作通道
│   └── utils/
│       ├── configManager.js   # 配置管理器 (KV / Drive Properties 双模自动降级)
│       └── googleAuth.js      # 基于 Web Crypto API 的 RS256 JWT 自动生成与 Token 缓存
├── public/                    # 纯静态前端资源 (100% 走 Cloudflare 边缘 CDN 直通，零开销)
│   ├── index.html             # 现代化单页应用 (极简 Header 与 OpenList 多选支持)
│   ├── css/style.css          # 自定义滚动条、多选模式与毛玻璃视觉增强
│   ├── js/app.js              # 核心交互逻辑 (智能降级、OpenList 多选状态机、外部播放器调用)
│   ├── favicon.svg            # 站点矢量图标
│   ├── _headers               # 静态资源全局 HTTP 响应头配置 (严格 CSP 与防 MIME 嗅探)
│   └── _routes.json           # 边缘路由隔离规则 (显式指定仅 /api/* 进入 Functions 计算)
├── scripts/                   # 自动化运维与质量闸门脚本
│   ├── ci-check.js            # 流水线阶段 1: JavaScript AST 语法、静态资源完整性与契约验证
│   └── healthcheck.js         # 流水线阶段 2: 具备 Anycast 边缘预热与指数退避的冒烟测试脚本
├── wrangler.toml              # Wrangler 配置文件
└── .env.example               # 环境变量配置模板
```

---

## 📚 开发者与运维文档指南

- 📖 **[完整 API 接口参考文档 (API Reference)](docs/api-reference.md)**：包含全量端点参数、状态码说明、认证流程与可直接复制执行的 `curl` 示例。
- 🎬 **[播放器交互架构与自适应降级手册 (Player Architecture & User Guide)](docs/player-architecture-and-user-guide.md)**：详解双阶段自适应降级探测引擎、56px 视口裁切规约、本地播放器协议规范与测试指南。
- 🏛️ **[架构决策记录 (ADR-0002)](docs/adr/0002-adaptive-playback-sandboxing-and-minimalist-player.md)**：主导制定的自适应降级状态机、零遮挡安全沙箱模型与极简流媒体视窗架构决策。
- 🚀 **[CI/CD 流水线与部署运维指南 (Deployment & Troubleshooting)](docs/ci-cd-deployment-guide.md)**：详解 GitHub Actions 双阶段门禁、边缘 Anycast 预热机制与生产故障排查手册。
- 🏛️ **[架构决策记录 (ADR-001)](docs/adr/ADR-001-cf-pages-edge-routing-and-ci-resilience.md)**：关于边缘路由隔离、避免静态资源 500 异常与冒烟测试重试策略的架构决策背景。

---

## 🚀 快速上手与部署步骤

### 第一步：准备 Google Service Account (服务账号)

1. 进入 [Google Cloud Console 控制台](https://console.cloud.google.com/)，新建或选择已有项目。
2. 搜索并进入 **Google Drive API**，点击 **启用 (Enable)**。
3. 前往 **凭据 (Credentials)** 页面，点击 **创建凭据 -> 服务账号 (Service Account)**：
   - 账号名称任意输入（例如 `drive-viewer`），点击完成。
4. 在服务账号列表中点击刚刚创建的账号，进入 **密钥 (Keys)** 标签页：
   - 点击 **添加密钥 -> 创建新密钥**，类型选择 **JSON**，下载生成的 JSON 密钥文件保存至本地。
5. 打开您的 Google Drive，将您希望展示的根文件夹（或团队盘/普通盘目录）**共享**给该服务账号：
   - 将 JSON 文件中的 `client_email` 地址复制并添加为该文件夹的 **查看者 (Viewer)** 或 **内容管理员 (Editor)**（如需在线管理重命名/移动/删除文件，请授予具有编辑权限的角色）。
   - 从浏览器地址栏提取该文件夹的 ID（例如 `https://drive.google.com/drive/folders/1A2B3C4D5E...` 中末尾的哈希串即为 `ROOT_FOLDER_ID`）。

---

### 第二步：一键部署到 Cloudflare Pages

#### 推荐方案：通过 GitHub 仓库自动持续集成 (CI/CD)

1. Fork 或上传本项目到您的 GitHub 个人仓库。
2. 登录 [Cloudflare Dashboard 控制台](https://dash.cloudflare.com/)，进入 **Workers & Pages** -> **Create application** -> **Pages** -> **Connect to Git**。
3. 选择刚刚关联的 GitHub 仓库，配置构建设置：
   - **Framework preset (框架预设)**: `None`
   - **Build command (构建命令)**: 留空（本项目为纯零依赖原生实现，无需打包）
   - **Build output directory (构建输出目录)**: `public`
4. 展开 **Environment variables (环境变量)**，添加以下必需的环境变量：

| 变量名 | 必填 | 示例值 / 说明 |
| :--- | :---: | :--- |
| `ROOT_FOLDER_ID` | **是** | Google Drive 根目录文件夹 ID，例如 `1A2B3C4D5E6F7G8H9I0J` |
| `CLIENT_EMAIL` | **是** | 服务账号邮箱，例如 `drive-viewer@project-id.iam.gserviceaccount.com` |
| `PRIVATE_KEY` | **是** | JSON 密钥中的私钥完整内容（包含 `-----BEGIN PRIVATE KEY-----` 和 `-----END PRIVATE KEY-----`） |
| `SITE_NAME` | 否 | 站点标题，默认为 `Cloudflare Drive Player` |
| `ADMIN_PASSWORD` | 否 | 后台管理密码，设置后开启在线文件管理与动态配置面板 |
| `SITE_PASSWORD` | 否 | 全站访客访问密码，设置后全站受密码保护 |

5. 点击 **Save and Deploy (保存并部署)**，等待数十秒即可完成部署并获取分配的 `*.pages.dev` 访问域名！

---

### 第三步：配置 Cloudflare KV 命名空间（可选，推荐生产开启）

系统支持通过 Cloudflare KV 提供毫秒级配置读取与更新：

1. 登录 Cloudflare 控制台 -> **Workers & Pages** -> **KV** -> **Create a namespace**，输入名称如 `drive-player-kv`。
2. 创建完成后，复制列表中的 **Namespace ID**（32 位字符串）。
3. 打开根目录下的 [wrangler.toml](wrangler.toml)，取消下方绑定注释并填入您的 ID：
   ```toml
   [[kv_namespaces]]
   binding = "DRIVE_KV"
   id = "您的KV_Namespace_ID"
   ```
4. 提交推送到 GitHub，Cloudflare Pages 将自动完成边缘 KV 挂载，开启零冷启动的毫秒级配置读取！

---

## 🎯 本地播放器调用协议支持

当在网页端遇到高码率蓝光片源、多音轨切换或外挂特效字幕需求时，可一键将流媒体直链抛送至本地专业播放器：

- 🚀 **MPV**：`mpv://<StreamUrl>` 或终端命令 `mpv "<StreamUrl>"`
- 🎬 **PotPlayer (Windows)**：`potplayer://<StreamUrl>`
- 🍎 **IINA (macOS)**：`iina://weblink?url=<StreamUrl>`
- 🍊 **VLC**：`vlc://<StreamUrl>`
- 📺 **Infuse (Apple TV / iOS)**：`infuse://x-callback-url/play?url=<StreamUrl>`
- 📋 **原生直链复制**：一键生成带 RFC 5987 规范文件名后缀的 HTTP 206 流媒体直链。

---

## 🛡️ 安全合规与权限规范

- **凭证全物理隔离**：Google 服务的私钥仅存放在 Cloudflare 边缘计算环境变量中，对外绝不透出任何 Google 鉴权令牌。
- **恒定时间密码比对 (Constant-Time Compare)**：管理接口认证使用 Web Crypto `crypto.subtle.timingSafeEqual` 防范时序攻击 (Timing Attack)。
- **严苛的 HTTP 响应头安全防护**：静态网关自带 `X-Content-Type-Options: nosniff`、`X-Frame-Options: SAMEORIGIN`，并针对第三方 Google 预览配置了精细化的 CSP 白名单。

---

## 📄 开源许可证

本项目采用 **MIT License** 许可证。详见 [LICENSE](LICENSE) 文件。
