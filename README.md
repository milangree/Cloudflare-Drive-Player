# Cloudflare Drive Player

一个基于 **Cloudflare Pages** 与 **Google Drive API (Service Account)** 构建的现代化、极速轻量网盘目录索引与流媒体在线播放器。

![Cloudflare Pages](https://img.shields.io/badge/Platform-Cloudflare%20Pages-f38020?logo=cloudflare)
![Google Drive](https://img.shields.io/badge/Storage-Google%20Drive-4285F4?logo=googledrive)
![Zero Dependencies](https://img.shields.io/badge/Dependencies-Zero%20(Pure%20Web%20Crypto)-emerald)

---

## ✨ 核心特性

- 🚀 **极简部署 & 零 npm 臃肿依赖**：基于原生 Web 标准与 Cloudflare Pages Functions，免去冗长的 node_modules 打包流程，秒级上传部署。
- 🎬 **原生 HTTP Range 流式分片代理**：针对 Google Drive 视频播放卡顿与无法快进的通病，后端深度实现了 `Range: bytes=` 请求与 `206 Partial Content` 状态穿透，支持在浏览器中秒开视频、任意拖拽进度条。
- 🎬 **现代化全能影音内核**：深度集成 **Artplayer** 与 Hls.js / Flv.js，支持视频/音频播放、0.5x~2.0x 倍速记忆、画中画 (PiP)、全屏/网页全屏、同名外挂字幕自动加载与时间轴微调、断点记忆续播及同名剧集自动连播。
- 🔐 **完备的后台管理系统 (Admin Dashboard)**：
  - **访客安全访问控制**：支持后台一键开关「打开网站需要输入密码」，并随时更改访客访问密码；未解锁用户无法列出和播放任何文件。
  - **动态 SITE_NAME 调整**：直接在后台控制台重命名网站名称，立即生效，无需再去 Cloudflare 改环境变量重部署。
  - **云盘文件在线管控**：管理员登录后可直接在线对 Google 云端文件/文件夹执行 **重命名 (Rename)、跨目录移动 (Move)、删除/移入回收站 (Delete)** 等操作。
- 🔒 **全密闭凭证安全**：Google 服务账号私钥与敏感配置全部存放于 Cloudflare 环境变量中，前端仅交互轻量代理接口，对外绝不暴露任何 Google API 凭证。
- 📁 **完整网盘体验**：
  - 支持多级文件夹无限层级穿梭与面包屑导航。
  - 文件实时模糊搜索与动态排序（名称 / 修改时间 / 文件大小）。
  - 网格卡片与表格列表双视图自由切换（自动记忆偏好）。
  - 支持图片全屏沉浸式灯箱预览、文件直接下载与一键直链复制。
  - 优雅的深色模式（Dark Modern Glassmorphism）磨砂半透明美学设计。

---

## 🛠️ 架构概览

```text
cf-pages-drive-player/
├── .github/
│   └── workflows/
│       └── ci-cd.yml          # GitHub Actions 自动化 CI/CD 流水线 (双阶段质量与部署门禁)
├── docs/                      # 架构与开发者工程文档
│   ├── api-reference.md       # 全量 API 接口参考文档与可执行示例
│   ├── ci-cd-deployment-guide.md # CI/CD 流水线与部署运维排障手册
│   └── adr/                   # 架构决策记录 (ADR-001 边缘路由隔离与重试策略)
├── functions/                 # Cloudflare Pages Functions (Serverless API 边缘层)
│   ├── api/
│   │   ├── _middleware.js     # API 统一中间件 (CORS 跨域与全局异常保护，仅对 /api/* 生效)
│   │   ├── info.js            # 网站信息与凭证配置检测
│   │   ├── list.js            # 获取目录文件列表 (支持分页与模糊搜索)
│   │   ├── stream/[id].js     # 媒体流代理核心 (HTTP 206 Range 分片透传)
│   │   ├── download/[id].js   # 文件直接下载 (RFC 5987 编码文件名)
│   │   └── admin/             # 后台管理及云盘文件全生命周期管控 API
│   │       ├── auth.js        # 访问密码与管理员身份认证
│   │       ├── config.js      # 站点配置读取与动态持久化更新
│   │       └── files.js       # 在线重命名/移动/删除/新建/断点续传通道
│   └── utils/
│       ├── configManager.js   # 配置管理器 (KV / Drive Properties 双模自动降级)
│       └── googleAuth.js      # 基于 Web Crypto API 的 RS256 JWT 自动生成与 Token 缓存
├── public/                    # 纯静态前端资源 (100% 走 Cloudflare 边缘 CDN 直通，零开销)
│   ├── index.html             # 现代化单页应用 (Tailwind + Lucide + Artplayer)
│   ├── css/style.css          # 自定义滚动条与毛玻璃视觉增强
│   ├── js/app.js              # 核心交互逻辑 (路由/播放/搜索/状态管理)
│   ├── favicon.svg            # 站点矢量图标
│   ├── _headers               # 静态资源全局 HTTP 响应头配置
│   └── _routes.json           # 边缘路由隔离规则 (显式指定仅 /api/* 进入 Functions 计算)
├── scripts/                   # 自动化运维与质量闸门脚本
│   ├── ci-check.js            # 流水线阶段 1: JavaScript AST 语法与静态资源完整性验证
│   └── healthcheck.js         # 流水线阶段 2: 具备 Anycast 边缘预热与指数退避的冒烟测试脚本
├── wrangler.toml              # Wrangler 配置文件
└── .env.example               # 环境变量配置模板
```

---

## 📚 开发者与运维文档指南

- 📖 **[完整 API 接口参考文档 (API Reference)](docs/api-reference.md)**：包含全量端点参数、状态码说明、认证流程与可直接复制执行的 `curl` 示例。
- 🚀 **[CI/CD 流水线与部署运维指南 (Deployment & Troubleshooting)](docs/ci-cd-deployment-guide.md)**：详解 GitHub Actions 双阶段门禁、边缘 Anycast 预热机制与生产故障排查手册。
- 🏛️ **[架构决策记录 (ADR-001)](docs/adr/ADR-001-cf-pages-edge-routing-and-ci-resilience.md)**：关于边缘路由隔离、避免静态资源 500 异常与冒烟测试重试策略的架构决策背景。

---

## 🚀 快速上手与部署步骤

### 第一步：准备 Google Service Account (服务账号)

1. 进入 [Google Cloud Console 控制台](https://console.cloud.google.com/)，新建或选择已有项目。
2. 搜索并进入 **Google Drive API**，点击 **启用 (Enable)**。
3. 前往 **凭据 (Credentials)** 页面，点击 **创建凭据 -> 服务账号 (Service Account)**：
   - 输入服务账号名称（例如 `drive-viewer`），角色选择 `基本 -> 查看者 (Viewer)`。
4. 创建完成后，在服务账号列表中点击刚刚创建的账号，进入 **密钥 (Keys)** 选项卡：
   - 点击 **添加密钥 -> 创建新密钥**，类型选择 **JSON**，下载保存生成的 `.json` 文件。
5. **极其关键的一步（授予云盘权限）**：
   - 打开下载的 JSON 文件，找到里面的 `"client_email"` 字段（类似 `drive-viewer@xxxxxx.iam.gserviceaccount.com`）。
   - 打开你的 [Google Drive](https://drive.google.com/)，找到你希望展示的文件夹（或团队盘），点击 **共享**。
   - 将上面复制的 `client_email` 添加为协作者，权限设为 **查看者 (Viewer)**。
   - 打开该文件夹，地址栏中 `folders/` 后面的那一串字符就是你的 `ROOT_FOLDER_ID`。

---

### 第二步：部署到 Cloudflare Pages

本项目支持三种部署方式：**GitHub Actions CI/CD 自动化部署（推荐）**、**Cloudflare 控制台 Git 绑定** 或 **Wrangler CLI 本地部署**：

#### 方式 A：GitHub Actions CI/CD 自动化部署（推荐）

本项目已内置生产级双阶段 CI/CD 流水线（`.github/workflows/ci-cd.yml`），每次推送或提 PR 时自动执行质量扫描与部署：
1. 将代码推送到你的 GitHub 仓库。
2. 进入 GitHub 仓库 -> **Settings -> Secrets and variables -> Actions**，配置以下两个 Repository Secrets：
   - `CLOUDFLARE_API_TOKEN`：具备 Cloudflare Pages 编辑权限的 API Token。
   - `CLOUDFLARE_ACCOUNT_ID`：你的 Cloudflare 账户 ID（可在控制台右侧获取）。
3. 只要向 `main` 分支提交代码，GitHub Actions 将自动执行：
   - **阶段 1 (质量与安全门禁)**：自动执行 `npm run test:syntax` 语法扫描与 `npm audit` 漏洞审计；
   - **阶段 2 (自动部署与冒烟)**：通过 Wrangler 发布至 Cloudflare Pages，并自动触发指数退避的端点健康检查。
4. 详情请参阅 **[CI/CD 流水线与部署运维指南](docs/ci-cd-deployment-guide.md)**。

#### 方式 B：Cloudflare 控制台 Git 直连部署

1. 打开 [Cloudflare Dashboard](https://dash.cloudflare.com/)，进入 **Workers & Pages -> Pages**。
2. 点击 **Connect to Git (连接到 Git)**，选择你的项目仓库。
3. 部署构建设置：
   - **Framework preset (框架预设)**: `None`
   - **Build command (构建命令)**: 留空（无构建步骤）
   - **Build output directory (输出目录)**: `public`
4. 点击 **Save and Deploy** 完成初始化部署。

#### 方式 C：使用 Wrangler CLI 本地一键部署

在项目根目录下执行：
```bash
# 安装依赖
npm install

# 登录 Cloudflare
npx wrangler login

# 一键部署静态页面与 Pages Functions
npm run deploy
```

---

### 第三步：配置环境变量与存储绑定

在 Cloudflare Dashboard 中，进入你的 Pages 项目：
- 依次点击：**Settings (设置) -> Environment variables (环境变量) -> Production (生产环境)**。
- 点击 **Add variables (添加变量)** 并填入以下内容：

| 变量名 | 是否必填 | 示例 / 说明 |
| :--- | :---: | :--- |
| `SERVICE_ACCOUNT_JSON` | **必填** | 将下载的 Google 服务账号 JSON 文件的全部内容**压缩为单行或原样粘贴**在此处。 |
| `ROOT_FOLDER_ID` | **推荐** | 挂载的总文件夹 ID（如 `1-3i7VNCMLtTfkWxWpSemjUIvdwNLCi6l`）。 |
| `SITE_NAME` | 选填 | 自定义网站标题，例如 `我的私人影视库`。 |

> 💡 **系统内置持久化存储机制**：
> * **开箱即用（免配 KV）**：系统已内置 Google Drive 根文件夹元数据 properties 机制，自动持久化存储后台配置与密码，重启与冷启动永不丢失！
> * **进阶加速（通过 `wrangler.toml` 绑定 Cloudflare KV）**：
>   > ⚠️ **关于控制台提示「此项目的绑定在通过 wrangler.toml 进行管理」**：
>   > Cloudflare Pages 具备 **“代码即配置 (Configuration as Code)”** 机制。一旦代码仓库根目录存在 `wrangler.toml` 文件，系统会自动锁定网页控制台中的绑定按钮，转由代码库中的 `wrangler.toml` 统一管理。
>   
>   **启用 KV 绑定的极简 3 步**：
>   1. **创建 KV 命名空间**：前往 [Cloudflare Dashboard](https://dash.cloudflare.com/) -> **Workers & Pages** -> **KV**，点击 **Create Namespace**（例如命名为 `cf-drive-player-kv`）。
>   2. **获取 Namespace ID**：在 KV 列表中找到刚创建的命名空间，复制其右侧的 **ID**（形如 `8a3b5c7d9e0f...` 的 32 位哈希串）。
>   3. **配置 `wrangler.toml` 并推送**：
>      打开项目根目录的 `wrangler.toml`，取消注释并填入你的 ID：
>      ```toml
>      [[kv_namespaces]]
>      binding = "DRIVE_KV"
>      id = "你的KV命名空间真实ID"
>      ```
>      提交并推送到 GitHub，Cloudflare Pages 会自动触发构建并完成 KV 挂载！登录后台管理窗口将看到绿色的 `KV: ACTIVE` 状态标记。

> 💡 **跨盘与多盘使用技巧（方案 A）**：
> 1. 在 Google Drive 建一个总目录（例如 `我的影音库`），将其 ID 填入 `ROOT_FOLDER_ID`。
> 2. **如何挂载其他盘/团队盘/不同账号的文件夹？**
>    - 在 Google Drive 网页里找到目标文件夹，右键选择 **「整理 (Organize)」->「添加快捷方式 (Add shortcut)」**，直接添加进你的总目录中。
>    - 本项目底层已深度适配 Google Drive 快捷方式穿透解析，点击快捷方式即可像本地文件夹一样原生穿透访问其他盘！
>    - 增删改盘全部在 Google Drive 网页完成，**彻底告别在 Cloudflare 环境变量中维护长加密串！**

> 💡 **提示**：添加完环境变量或 KV 绑定后，在 Pages 的 **Deployments (部署)** 页面中点击最新一次部署右侧的 `Retry deployment (重新部署)` 即可生效！

---

## 📺 全格式播放支持与兼容性说明 (MKV / HEVC / 特殊音轨)

### 1. 浏览器原生支持与技术原理
网页端媒体播放直接受宿主浏览器及底层系统的原生解封装和解码限制：
- **MP4 / WebM (H.264 + AAC / VP9 + Opus)**：全平台浏览器原生秒开，完美支持 HTTP 206 范围分片拖拽。
- **MKV (Matroska) 容器**：
  - **Safari (macOS / iOS)**：底层基于 AVFoundation，苹果不支持 Matroska 容器，网页播放将触发解码告警；
  - **Chrome / Edge / Firefox**：可直连部分标准编码，但如果音轨采用 **AC-3 (杜比) / DTS** 等商业授权编码，受专利授权限制将导致静音或画面卡死在第 0 帧（黑屏）。

### 2. 完备的无缝降级与外部秒播方案
当系统检测到浏览器原生解码受限时，播放器界面会自动弹出提示条，并提供以下多级解决方案：
- **🌐 Google 官方转码通道**：点击警告栏右侧 **「一键切换云端转码」** 或顶栏 **「⚡ 原画直出 / 转码预览」** 按钮，直接无缝切换至 Google Drive 官方转码预览切片。
  - *前置权限说明*：Google 官方转码预览是由浏览器前端直接加载 Google 网页服务（不同于后端通过 Service Account 读取二进制流）。如需匿名访客顺畅使用转码预览，请在 Google Drive 中将对应文件夹设置为 **「知道链接的任何人都可以查看」**；若为私有文件，访客浏览器需登录有权访问该云盘的 Google 账号。
- **⚡ MPV 播放器 (跨平台)**：点击直接通过 `mpv://` 协议秒开；提供 **「复制 MPV 终端命令」** 按钮，命令行粘贴 `mpv "直链"` 运行，尊享全特效 ASS 字幕与完整硬件加速。
- **💻 Windows PotPlayer**：点击一键调起本地 PotPlayer 极速硬件加速。
- **🍎 macOS IINA**：点击一键调起基于 MPV 核心的 IINA 播放器。
- **📱 Android ExoPlayer (原生 Intent)**：通过系统级 `intent:` 调用底层播放内核（如 Just Player、Next Player、VLC 等）。
- **📺 Apple TV / iOS Infuse**：点击一键直达 Infuse。

### 3. 统一视口与多比例自适应规范
播放器视口采用无损等比自适应架构（`object-fit: contain`），在切换 16:9（常规剧集）、4:3（怀旧番剧）、21:9（宽银幕电影）或 9:16（手机竖屏）片源时，窗口尺寸保持几何稳定，上下/左右自适应纯黑底色，杜绝界面剧烈晃动与画面变形拉伸。

---

## 💻 本地调试运行

如果你想在本地开发或预览：

1. 复制配置模板：
   ```bash
   cp .env.example .dev.vars
   ```
2. 编辑 `.dev.vars`，将你的 `SERVICE_ACCOUNT_JSON` 与 `ROOT_FOLDER_ID` 填入。
3. 启动本地模拟服务：
   ```bash
   npm run dev
   ```
4. 浏览器访问终端输出的地址（通常为 `http://localhost:8788`）。

---

## ❓ 常见问题排查 (FAQ)

#### Q1: 打开网页提示“未配置 Google 凭据”或无内容？
- **检查**：请确认是否已在 Cloudflare Pages 的 Environment variables 中正确添加了 `SERVICE_ACCOUNT_JSON`，并执行了一次重新部署。

#### Q2: 加载时报错 `The user does not have sufficient permissions for this file` (403 权限错误)？
- **检查**：说明该文件夹尚未共享给服务账号。请进入 Google Drive，右键该文件夹 -> 共享 -> 将服务账号的 `client_email`（例如 `xxx@xxx.iam.gserviceaccount.com`）添加为查看者。

#### Q3: 为什么大视频在手机或某些浏览器中拖动进度条不会重新缓冲？
- 本项目针对 `Range` 头进行了完整的 206 分片透传，若遇到进度条异常，请确认视频编码是否支持流式播放（推荐通用的 `H.264 / AAC` 编码的 `.mp4` 格式，WebM 亦可良好支持）。

#### Q4: GitHub Actions 部署成功，但在冒烟测试时出现 HTTP 500 导致流水线报红？
- **原因**：Cloudflare Anycast 边缘网络在全球节点分发资源时存在短暂收敛窗口，若静态资源被全局中间件拦截或探测缺乏重试，容易出现假阴性失败。
- **解决方案**：确保项目包含 `public/_routes.json` 并将中间件放在 `functions/api/_middleware.js`，使静态资源通过边缘 CDN 直通；同时使用内置了预热与指数退避重试的 `node scripts/healthcheck.js` 脚本。完整细节请参考 [CI/CD 运维指南](docs/ci-cd-deployment-guide.md)。

#### Q5: 为什么修改了 Cloudflare Pages 环境变量后，页面依然提示未配置？
- **原因**：Cloudflare Pages 环境变量在注入现有容器时，必须重新触发一次构建或部署。
- **解决方案**：登录 Cloudflare Dashboard -> 进入 Pages 项目 -> 切换到 **Deployments (部署)** 页面，在最新一次成功部署记录右侧点击 **「...」->「Retry deployment (重试部署)」** 即可立即生效。

---

## 📄 开源许可证

MIT License.
