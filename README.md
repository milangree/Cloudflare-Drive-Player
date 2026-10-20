# Cloudflare Drive Player

一个基于 **Cloudflare Pages** 与 **Google Drive API (Service Account)** 构建的现代化、极速轻量网盘目录索引与流媒体在线播放器。

![Cloudflare Pages](https://img.shields.io/badge/Platform-Cloudflare%20Pages-f38020?logo=cloudflare)
![Google Drive](https://img.shields.io/badge/Storage-Google%20Drive-4285F4?logo=googledrive)
![Zero Dependencies](https://img.shields.io/badge/Dependencies-Zero%20(Pure%20Web%20Crypto)-emerald)

---

## ✨ 核心特性

- 🚀 **极简部署 & 零 npm 臃肿依赖**：基于原生 Web 标准与 Cloudflare Pages Functions，免去冗长的 node_modules 打包流程，秒级上传部署。
- 🎬 **原生 HTTP Range 流式分片代理**：针对 Google Drive 视频播放卡顿与无法快进的通病，后端深度实现了 `Range: bytes=` 请求与 `206 Partial Content` 状态穿透，支持在浏览器中秒开视频、任意拖拽进度条。
- 🎵 **现代化全能播放器**：集成成熟优雅的 **Plyr.js**，支持视频/音频播放、0.5x~2.0x 倍速播放、画中画 (PiP)、全屏模式与快捷键操作。
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
├── functions/
│   ├── _middleware.js         # 全局 CORS 处理与异常捕获
│   ├── api/
│   │   ├── info.js            # 网站信息与凭证配置检测
│   │   ├── list.js            # 获取目录文件列表 (支持分页与模糊搜索)
│   │   ├── stream/[id].js     # 媒体流代理核心 (HTTP 206 Range 分片透传)
│   │   └── download/[id].js   # 文件直接下载 (RFC 5987 编码文件名)
│   └── utils/
│       └── googleAuth.js      # 基于 Web Crypto API 的 RS256 JWT 自动生成与 Token 缓存
├── public/
│   ├── index.html             # 现代化单页应用 (Tailwind + Lucide + Plyr)
│   ├── css/style.css          # 自定义滚动条与毛玻璃视觉增强
│   ├── js/app.js              # 核心交互逻辑 (路由/播放/搜索/状态管理)
│   └── favicon.svg
├── wrangler.toml              # Wrangler 配置文件
└── .env.example               # 环境变量配置模板
```

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

你可以选择 **Git 仓库绑定部署（推荐）** 或 **Wrangler CLI 本地部署**：

#### 方式 A：GitHub / GitLab 仓库部署（最推荐）

1. 将本项目推送到你的 GitHub 仓库。
2. 打开 [Cloudflare Dashboard](https://dash.cloudflare.com/)，进入 **Workers & Pages -> Pages**。
3. 点击 **Connect to Git (连接到 Git)**，选择刚刚推送的仓库。
4. 部署设置：
   - **Framework preset (框架预设)**: `None`
   - **Build command (构建命令)**: 留空（无需构建）
   - **Build output directory (输出目录)**: `public`
5. 点击 **Save and Deploy** 完成部署。

#### 方式 B：使用 Wrangler CLI 一键本地部署

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

### 第三步：配置环境变量

在 Cloudflare Dashboard 中，进入你的 Pages 项目：
- 依次点击：**Settings (设置) -> Environment variables (环境变量) -> Production (生产环境)**。
- 点击 **Add variables (添加变量)** 并填入以下内容：

| 变量名 | 是否必填 | 示例 / 说明 |
| :--- | :---: | :--- |
| `SERVICE_ACCOUNT_JSON` | **必填** | 将下载的 Google 服务账号 JSON 文件的全部内容**压缩为单行或原样粘贴**在此处。 |
| `ROOT_FOLDER_ID` | **推荐** | 挂载的总文件夹 ID（如 `1-3i7VNCMLtTfkWxWpSemjUIvdwNLCi6l`）。 |
| `SITE_NAME` | 选填 | 自定义网站标题，例如 `我的私人影视库`。 |

> 💡 **跨盘与多盘使用技巧（方案 A）**：
> 1. 在 Google Drive 建一个总目录（例如 `我的影音库`），将其 ID 填入 `ROOT_FOLDER_ID`。
> 2. **如何挂载其他盘/团队盘/不同账号的文件夹？**
>    - 在 Google Drive 网页里找到目标文件夹，右键选择 **「整理 (Organize)」->「添加快捷方式 (Add shortcut)」**，直接添加进你的总目录中。
>    - 本项目底层已深度适配 Google Drive 快捷方式穿透解析，点击快捷方式即可像本地文件夹一样原生穿透访问其他盘！
>    - 增删改盘全部在 Google Drive 网页完成，**彻底告别在 Cloudflare 环境变量中维护长加密串！**

> 💡 **提示**：添加完环境变量后，在 Pages 的 **Deployments (部署)** 页面中点击最新一次部署右侧的 `Retry deployment (重新部署)` 即可生效！

---

## 📺 全格式极速秒播支持 (MKV / HEVC 10-bit / 特殊编码)

针对现代浏览器 `<video>` 无法原生解封装 MKV 容器以及部分设备缺少 HEVC 硬解授权的问题，本项目内置了**全平台原生播放器无缝调起体系**：

- **⚡ MPV 播放器 (跨平台)**：
  - 点击「MPV 播放器」直接通过 `mpv://` 协议秒开；
  - 提供 **「复制 MPV 终端命令」** 按钮，复制后在命令行一键运行：`mpv "直链"`，支持全特效字幕与全格式硬解！
- **📱 Android ExoPlayer (原生 Intent)**：
  - 点击「ExoPlayer (Android)」通过系统级 `intent:` 调用底层 ExoPlayer 内核播放器（如 Just Player、Next Player、VLC 等），实现 Android 手机与电视盒子的硬件秒开！
- **💻 Windows PotPlayer**：点击一键调起本地 PotPlayer 极速硬件加速。
- **🍎 macOS IINA**：点击一键调起基于 MPV 核心的 IINA 播放器。
- **📺 Apple TV / iOS Infuse**：点击一键打开 Infuse 播放。
- **🌐 Google 官方转码通道**：在任何无本地播放器的公共设备上，可点击「Google 预览」查看官方转码切片。

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

---

## 📄 开源许可证

MIT License.
