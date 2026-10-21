# Cloudflare Drive Player

一个基于 **Cloudflare Pages** 与 **Google Drive API (Service Account)** 构建的现代化、极速轻量网盘目录索引与流媒体在线播放器。

![Cloudflare Pages](https://img.shields.io/badge/Platform-Cloudflare%20Pages-f38020?logo=cloudflare)
![Google Drive](https://img.shields.io/badge/Storage-Google%20Drive-4285F4?logo=googledrive)
![Zero Dependencies](https://img.shields.io/badge/Dependencies-Zero%20(Pure%20Web%20Crypto)-emerald)
![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)

---

## ✨ 核心特性

- 🚀 **极简部署 & 零 npm 臃肿依赖**：基于原生 Web 标准与 Cloudflare Pages Functions，免去冗长的 node_modules 打包流程，秒级上传部署。
- 🎬 **原生 HTTP Range 流式分片代理**：针对 Google Drive 视频播放卡顿与无法快进的通病，后端深度实现了 `Range: bytes=` 请求与 `206 Partial Content` 状态穿透，支持在浏览器中秒开视频、任意拖拽进度条。
- ⚡ **双阶段智能解码降级引擎 (Smart Adaptive Fallback)**：
  - **阶段一（静态先验探测）**：自动检测浏览器解码能力与硬件硬解环境；当检测到不支持的容器/编码（如 Safari 下 MKV、缺少 HEVC/H.265 硬解、DTS/AC-3 商用音频）时，**系统自动无感切换至云端转码通道**，无需用户反复手动排查。
  - **阶段二（动态双阶看门狗）**：2.0s 快速黑屏侦测与 4.0s 深度稳定性巡检；一旦发生解码卡死、只有声音没有画面或 `video.error`，自动平滑切源至 Google 转码预览。
- 🛡️ **100% 纯净零遮挡 W3C 原生安全沙箱**：
  - **彻底废除物理遮挡层**：完全移除覆在视频画面右上角的透明遮罩卡片，彻底告别鼠标光标突变与视觉伪影，呈现 100% 通透院线级画质。
  - **浏览器内核级弹窗阻断**：基于 W3C HTML5 沙箱规范严格移除 `allow-popups` 与 `allow-popups-to-escape-sandbox`，配合严格 CSP 策略，在浏览器底层天然静默拦截任何新窗口与跳转，安全与观感兼得。
- 🖥️ **极简 4 合 1 纯净控制台**：
  - 顶栏 Header 极致精简，严格聚焦核心四要素：**① 文件名 (自适应截断/Tooltip/一键全选)**、**② 调用本地播放器 (MPV / PotPlayer / IINA / VLC / Infuse / ExoPlayer / 快捷直链 / 终端命令)**、**③ 最大化 / 还原窗口**、**④ 关闭按钮**。
  - 其余元素优雅收敛，紧随其后是开阔沉浸的原生全功能播放视窗。
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
│   │   ├── _middleware.js     # API 统一中间件 (CORS 跨域与全局异常保护，仅对 /api/* 生效)
│   │   ├── info.js            # 网站信息与凭证配置检测
│   │   ├── list.js            # 获取目录文件列表 (支持分页与模糊搜索)
│   │   ├── stream/[id].js     # 媒体流代理核心 (HTTP 206 Range 分片透传与 MKV MIME 校准)
│   │   ├── download/[id].js   # 文件直接下载 (RFC 5987 编码文件名)
│   │   └── admin/             # 后台管理及云盘文件全生命周期管控 API
│   │       ├── auth.js        # 访问密码与管理员身份认证
│   │       ├── config.js      # 站点配置读取与动态持久化更新
│   │       └── files.js       # 在线重命名/移动/删除/新建/公开权限配置通道
│   └── utils/
│       ├── configManager.js   # 配置管理器 (KV / Drive Properties 双模自动降级，恒定时间签名比较)
│       └── googleAuth.js      # 基于 Web Crypto API 的 RS256 JWT 自动生成与 Token 缓存
├── public/                    # 纯静态前端资源 (100% 走 Cloudflare 边缘 CDN 直通，零开销)
│   ├── index.html             # 现代化单页应用 (极简 4 合 1 Header 与沉浸式播放器视窗)
│   ├── css/style.css          # 自定义滚动条与毛玻璃视觉增强
│   ├── js/app.js              # 核心交互逻辑 (智能降级状态机、双阶看门狗、外部播放器调用)
│   ├── favicon.svg            # 站点矢量图标
│   ├── _headers               # 静态资源全局 HTTP 响应头配置 (含 frame-ancestors 与 CSP 沙箱)
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
- 🎬 **[播放器交互架构与自适应降级手册 (Player Architecture & User Guide)](docs/player-architecture-and-user-guide.md)**：详解双阶段自适应降级探测引擎、零遮挡 W3C 安全沙箱、本地播放器协议规范与测试指南。
- 🏛️ **[架构决策记录 (ADR-0002)](docs/adr/0002-adaptive-playback-sandboxing-and-minimalist-player.md)**：主导制定的自适应降级状态机、零遮挡安全沙箱模型与极简流媒体视窗架构决策。
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

> 💡 **跨盘与多盘使用技巧**：
> 1. 在 Google Drive 建一个总目录（例如 `我的影音库`），将其 ID 填入 `ROOT_FOLDER_ID`。
> 2. **如何挂载其他盘/团队盘/不同账号的文件夹？**
>    - 在 Google Drive 网页里找到目标文件夹，右键选择 **「整理 (Organize)」->「添加快捷方式 (Add shortcut)」**，直接添加进你的总目录中。
>    - 本项目底层已深度适配 Google Drive 快捷方式穿透解析，点击快捷方式即可像本地文件夹一样原生穿透访问其他盘！
>    - 增删改盘全部在 Google Drive 网页完成，**彻底告别在 Cloudflare 环境变量中维护长加密串！**

---

## 📺 播放器交互、自适应降级与调用矩阵

### 1. 播放器顶部视窗极简架构 (Header 4-Core Layout)

播放器顶部遵循极简沉浸美学，仅呈现 4 项核心交互，彻底消除界面杂音：

```text
+----------------------------------------------------------------------------------------------------+
| [🎞️ 文件名.mkv] (自适应截断/Tooltip/全选)     [▶️ 调用本地播放器 ▾]  [🔲 最大化/还原]  [✕ 关闭 (Esc)] |
+----------------------------------------------------------------------------------------------------+
|                                                                                                    |
|                                       沉浸式视频播放视窗                                              |
|                           (原生 Artplayer 流畅起播 或 Google 转码预览)                              |
|                                                                                                    |
+----------------------------------------------------------------------------------------------------+
```

1. **文件名呈现器 (`#player-file-name`)**：
   - 自动响应式弹性宽度，支持超长文件名截断 (`truncate`)；
   - 鼠标悬停呈现完整文件名 Tooltip，支持点击或双击**一键全选 (`select-all`)**，方便复制片名搜索刮削。
2. **调用本地播放器菜单 (`#ext-player-dropdown-container`)**：
   - 集成 6 大主流硬解播放器协议与直链通道（见下文调用协议）。
3. **窗口最大化 / 还原 (`#player-maximize-btn`)**：
   - 点击或双击顶栏实现居中模态视窗与网页全屏无缝切换，播放状态丝滑保持不中断。
4. **关闭按钮 (`#close-player-btn`)**：
   - 退出视窗，自动销毁解码实例与后台看门狗定时器，释放内存。

### 2. 双阶段智能自适应降级引擎

无需用户手动排查或多次点击切换，播放管道自动完成环境适配：

| 探测阶段 | 触发时机 | 探测条件 | 自动化动作 | 体验效果 |
| :--- | :--- | :--- | :--- | :--- |
| **阶段一：静态先验探测** | 打开媒体前 | ① 格式为 `.avi/.wmv/.rmvb/.iso`<br>② Safari 环境下的 `.mkv`<br>③ 包含 DTS/AC-3/TrueHD 等非免费商用音轨<br>④ 浏览器缺少 HEVC/H.265 硬解能力 | **直接调用 Google 云端转码预览通道**起播 (`renderGooglePreview`) | **零等待、零黑屏**，秒开转码画面 |
| **阶段二：动态双阶看门狗** | 原生起播中 | ① **快速巡检 (2.0s)**：`currentTime > 0.3` 但 `hasVideo === false`（经典黑屏有声音），或 `video.error`<br>② **深度巡检 (4.0s)**：未暂停且未缓冲成功 (`readyState < 2`) | **自动销毁原生播放器，平滑重连至 Google 云端转码预览** | 自动完成救场，告别“黑屏卡死”困扰 |

### 3. 零遮挡 W3C 原生安全沙箱对比

针对 Google Drive 官方预览右上角弹窗问题，彻底废除旧式遮罩层：

| 机制维度 | 旧式透明遮罩卡片（已彻底废除） | 当前 W3C 原生沙箱模型（现行标准） |
| :--- | :--- | :--- |
| **视觉呈现** | 画面右上角常驻 `w-28 h-14` 透明悬浮框，产生图层伪影 | **100% 纯净通透**，没有任何遮罩层或悬浮 div 遮挡 |
| **鼠标与触控** | 悬停至右上角时光标突变、点击被物理阻断影响控制条交互 | **全域触控透明自然**，原生鼠标悬浮与全屏手势完美畅通 |
| **弹窗阻断能力** | 仅依赖物理拦截，穿透或代码执行易被绕过 | **W3C 规范级天然静默阻断**：严格去除 `allow-popups`，底层拒绝创建新窗口 |
| **防重定向加固** | 无 CSP 加固，存在宿主被跳出的风险 | 双层防护：不授予 `allow-top-navigation` + CSP `frame-ancestors 'self'` |

### 4. 外部硬件解码播放器调用协议白皮书

点击顶部「调用本地播放器」下拉菜单，即可一键将 Range 分片直链派发至系统本地播放器，尊享完整 HDR、杜比视界与 ASS 特效字幕：

| 播放器 | 支持平台 | 调起协议 / URL Scheme 格式 | 优势场景 |
| :--- | :--- | :--- | :--- |
| **MPV** | 全平台 (Windows / macOS / Linux) | `mpv://<ENCODED_STREAM_URL>` | 最强开源跨平台渲染器，色彩还原与 ASS 字幕极佳 |
| **PotPlayer** | Windows | `potplayer://<ENCODED_STREAM_URL>` | Windows 端极致硬件加速与滤镜扩展 |
| **IINA** | macOS | `iina://weblink?url=<ENCODED_STREAM_URL>` | Mac 专属现代播放器，深度适配 Touch Bar 与原生手势 |
| **VLC** | 全平台 / 移动端 | `vlc://<ENCODED_STREAM_URL>` | 老牌工业级全能解码器，兼容所有冷门编码 |
| **Infuse** | Apple 生态 (iOS / iPadOS / macOS / Apple TV) | `infuse://x-callback-url/play?url=<ENCODED_STREAM_URL>` | 奢华海报墙与家庭影院音频直通 |
| **ExoPlayer** | Android | `intent:<STREAM_URL>#Intent;type=video/*;end` | 调用手机自带底层媒体播放内核 (支持 Next Player / Just Player) |
| **MPV 终端命令** | 开发者 / 极客 | 点击一键复制命令：`mpv "<STREAM_URL>"` | 终端直接贴入执行，附带完整日志诊断 |

---

## 💻 本地调试与质量验证

如果你想在本地开发、调试或跑质量闸门：

```bash
# 1. 复制配置模板
cp .env.example .dev.vars

# 2. 执行静态质量检查 (包含 AST 语法、路由与沙箱合规校验)
npm run test:syntax
# 或直接运行：
node scripts/ci-check.js

# 3. 启动本地开发服务 (支持 Pages Functions 本地热重载)
npm run dev
```

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

MIT License © 2026 [Cloudflare Drive Player Team](https://github.com/milangree/cf-pages-drive-player)
