<div align="center">

# Cloudflare Drive Player

> 基于 **Cloudflare Pages Functions** 与 **Google Drive API (Service Account)** 构建的极简、企业级网盘目录索引与流媒体多端聚合枢纽。

<p align="center">
  <a href="https://pages.cloudflare.com/"><img src="https://img.shields.io/badge/Platform-Cloudflare%20Pages-f38020?style=flat&logo=cloudflare" alt="Cloudflare Pages"></a>
  <a href="https://developers.google.com/drive/api"><img src="https://img.shields.io/badge/Storage-Google%20Drive-4285F4?style=flat&logo=googledrive" alt="Google Drive"></a>
  <img src="https://img.shields.io/badge/Runtime%20Dependencies-Zero-emerald?style=flat" alt="Zero Runtime Dependencies">
  <img src="https://img.shields.io/badge/Frontend-Tailwind%20%2B%20ArtPlayer-0ea5e9?style=flat" alt="Frontend Stack">
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT-blue.svg?style=flat" alt="License: MIT"></a>
</p>

<p align="center">
  <a href="README.md">English</a> · <b>简体中文</b>
</p>

</div>

---

## 📑 目录

- [1. 项目定位与核心优势](#1-项目定位与核心优势)
- [2. 核心功能与特性](#2-核心功能与特性)
  - [2.1 边缘计算驱动与零运行时依赖](#21-边缘计算驱动与零运行时依赖)
  - [2.2 Artplayer 现代流媒体视窗](#22-artplayer-现代流媒体视窗)
  - [2.3 双阶黑屏降级看门狗与智能选源](#23-双阶黑屏降级看门狗与智能选源)
  - [2.4 智能断点记忆续播](#24-智能断点记忆续播)
  - [2.5 黑胶音频工作台与同步滚动歌词](#25-黑胶音频工作台与同步滚动歌词)
  - [2.6 沉浸式通用文档阅读器](#26-沉浸式通用文档阅读器)
  - [2.7 全场景原文件高速下载](#27-全场景原文件高速下载)
  - [2.8 极简深色视窗美学](#28-极简深色视窗美学)
  - [2.9 管理员后台与全生命周期文件管理](#29-管理员后台与全生命周期文件管理)
  - [2.10 Google Drive 多源挂载与快捷方式穿透](#210-google-drive-多源挂载与快捷方式穿透)
  - [2.11 Telegram 媒体转存机器人](#211-telegram-媒体转存机器人)
- [3. 极速部署指南（5 分钟上线）](#3-极速部署指南5-分钟上线)
  - [3.1 Cloudflare Pages 一键导入](#31-cloudflare-pages-一键导入)
  - [3.2 环境变量详细配置清单](#32-环境变量详细配置清单)
  - [3.3 Cloudflare KV 命名空间绑定（可选进阶）](#33-cloudflare-kv-命名空间绑定可选进阶)
- [4. Google Cloud 凭据与权限配置](#4-google-cloud-凭据与权限配置)
  - [4.1 创建 GCP 服务账号并获取密钥](#41-创建-gcp-服务账号并获取密钥)
  - [4.2 授权 Google Drive 文件夹访问（关键步骤）](#42-授权-google-drive-文件夹访问关键步骤)
  - [4.3 管理员后台设置与全站访问控制](#43-管理员后台设置与全站访问控制)
- [5. 常见问题排查 (FAQ)](#5-常见问题排查-faq)
  - [Q1: 视频播放黑屏有声音、解码卡死或提示格式不受支持？](#q1-视频播放黑屏有声音解码卡死或提示格式不受支持)
  - [Q2: 提示 Google 凭据失效 / 403 Forbidden / invalid_grant / 10000 错误？](#q2-提示-google-凭据失效--403-forbidden--invalid_grant--10000-错误)
  - [Q3: 拖动视频进度条异常卡死，或返回 HTTP 416 Range Not Satisfiable？](#q3-拖动视频进度条异常卡死或返回-http-416-range-not-satisfiable)
  - [Q4: 未绑定 KV 会影响使用吗？三级元数据持久化是什么？](#q4-未绑定-kv-会影响使用吗三级元数据持久化是什么)
  - [Q5: 上传文件或创建文件时报错 Quota: 0 或 storageQuotaExceeded？](#q5-上传文件或创建文件时报错-quota-0-或-storagequotaexceeded)
  - [Q6: 如何唤起第三方本地播放器（PotPlayer / IINA / VLC / Infuse / MPV）？](#q6-如何唤起第三方本地播放器potplayer--iina--vlc--infuse--mpv)
  - [Q7: Telegram 机器人返回 401 / 无操作权限 / 20MB 上限？](#q7-telegram-机器人返回-401--无操作权限--20mb-上限)
- [6. 系统架构全景图](#6-系统架构全景图)
- [7. 本地开发与质量闸门](#7-本地开发与质量闸门)
- [8. 技术文档索引与致谢](#8-技术文档索引与致谢)
- [9. 开源许可证](#9-开源许可证)

---

## 1. 项目定位与核心优势

| 它是 | 它不是 |
| :--- | :--- |
| **边缘驱动的目录索引与流媒体代理**：通过 Cloudflare Pages 边缘节点转发分片请求，支持流式直出。 | **重型转码服务器**：边缘节点不挂载 FFmpeg，高码率特殊编码通过内置双阶看门狗调用 Google 官方云端转码预览或唤起本地播放器。 |
| **零运维 Serverless 架构**：无虚拟机、无容器、无独立数据库，部署后享受平台免维护开销。 | **云存储提供商**：所有文件均存储于您的 Google 云端硬盘中，本项目不转存、不占用额外服务器空间。 |
| **沉浸式多端媒体枢纽**：涵盖视频、黑胶音乐、逐行歌词、PDF/Markdown 阅读与批量管理。 | **复杂的多租户 SaaS 平台**：采用简洁的「访客令牌 + 管理员令牌」轻量安全模型。 |

---

## 2. 核心功能与特性

### 2.1 边缘计算驱动与零运行时依赖
- **零运行时 npm 依赖**：生产运行态零第三方 npm 包，仅保留 Wrangler 开发脚手架依赖，杜绝供应链风险并保持极致轻量。
- **纯原生 Web Crypto API 鉴权**：在 Cloudflare Worker 边缘沙箱内使用原生 `crypto.subtle` 完成 RS256 PKCS#8 签名并生成 JWT，向 Google Drive 兑换 Access Token，内置 300 秒提前量智能缓存。
- **边缘路由物理隔离**：基于 `public/_routes.json` 规则，仅将 `/api/*` 请求接入 Functions 计算，HTML/JS/CSS/SVG 静态资产 100% 直通边缘 CDN 缓存，免受冷启动拖累。

### 2.2 Artplayer 现代流媒体视窗
- **现代播放内核**：集成 Artplayer 播放器，提供完备的控制台能力（画中画、全屏、截图、比例调节、迷你进度条、声画同步微调等）。
- **全格式支持矩阵**：
  - **MP4 / WebM / MOV**：浏览器原生硬解加速；
  - **HLS (.m3u8)**：集成 Hls.js 解码；
  - **FLV (.flv)**：集成 Flv.js 解码；
  - **MKV (.mkv)**：针对 `video/x-matroska` MIME 深度适配，支持原生解封装与底层错误即时拦截。
- **外挂字幕自动装配与转换**：自动匹配并加载同目录下同名字幕文件（`.vtt`, `.srt`, `.ass`），支持前端将 SRT/ASS 格式动态转为 WebVTT，支持字幕时间轴 `±0.5s` 实时微调与本地字幕加载。
- **智能连播队列**：自动根据剧集命名规则提取自然排序，支持「下一集自动连播」与快捷上下集切换。

### 2.3 双阶黑屏降级看门狗与智能选源
针对浏览器对 HEVC/H.265 10bit、MKV 容器以及商业音频编码（DTS, Dolby Atmos, AC3, EAC3, TrueHD）解码能力有限的问题，系统内建**双阶段智能降级引擎**：
1. **阶段一 · 静态先验探测**：打开视频前自动探测容器与编码，针对已知黑名单（如 AVI, WMV, RMVB, ISO）或 Safari 环境下的 MKV，直接跳过原生播放，自动启用 Google 官方云端转码预览。
2. **阶段二 · 动态双阶看门狗**：
   - **2.0 秒快速侦测**：针对“音频正常推进但画面黑屏无帧输出（`hasVideo === false`）”的典型 Chrome MKV 黑屏故障，在 2 秒内快速识别并自动切源；
   - **4.0 秒深度兜底**：巡检 `video.error`、`readyState < 2` 及播放停滞状态，触发平滑降级并伴随友好 Toast 提醒；
   - **无感还原与一键切换**：顶栏保留画质热切换按钮，随时在「Google 官方转码预览」与「原画直链」之间一键切换。
3. **零遮挡视窗**：Google 预览使用纯 CSS 几何裁切技巧（负边距抵消顶栏），无多余遮罩层，保留完备的 iframe 播放权限（包含全屏与 DRM 支持）。

### 2.4 智能断点记忆续播
- 播放过程中自动节流记录每部影片的播放进度（Local Storage 持久化）。
- 再次打开时自动跳转至上次观看位置，并伴随轻量微交互提示浮层，可一键切换「从头播放」。

### 2.5 黑胶音频工作台与同步滚动歌词
- **沉浸式黑胶唱机**：为 MP3, FLAC, WAV, AAC, OGG, M4A 等音频打造专注播放模式，呈现拟物黑胶动态唱片旋转与音频母带品质徽标（Hi-Res / 无损）。
- **同步滚动歌词**：自动检测挂载同目录下的同名 `.lrc` 歌词文件，毫秒级逐行滚动高亮，并支持**点击歌词直接定位音频进度**。
- **音频播放列表**：同目录音频自动生成播放队列，支持循环、随机与上一首/下一首切歌。

### 2.6 沉浸式通用文档阅读器
- **PDF 在线原样预览**：集成响应式 PDF 视窗，全屏无缩放偏差浏览。
- **Markdown / 代码 / 文本渲染**：自动识别 `.md`, `.txt`, `.json`, `.log` 等文档并提供格式化排版阅读。
- **常驻独立下载**：阅读器顶栏常驻「下载源文件」按钮，随时离线保存。

### 2.7 全场景原文件高速下载
- **RFC 5987 编码规范**：后端严格以 `filename*=UTF-8''...` 格式编码响应头，确保包含中文字符、特殊符号及长文件名下载时不出现乱码。
- **Google 在线文档自动导出**：针对 Google Docs、Google Sheets、Google Slides，自动转换为标准的 `.docx`, `.xlsx`, `.pptx`, `.pdf` 格式流式导出。
- **常驻快捷入口**：视频播放器控制条、黑胶音频视窗、文档阅读器、文件列表右键及多选栏均包含常驻下载入口。

### 2.8 极简深色视窗美学
- **视觉风格**：采用现代化深色 Slate 主题搭配品牌 Accent 强调色与 Glassmorphism 毛玻璃质感。
- **视窗极简规范**：播放器顶部仅保留核心四项控件（文件名展示与全选复制、本地播放器调用菜单、窗口最大化/还原、关闭），杜绝信息冗余。

### 2.9 管理员后台与全生命周期文件管理
- **动态配置管理**：站点标题、副标题、全站访客密码保护、管理员密码等均可在后台在线热修改，无需重新部署。
- **三级持久化架构**：优先存入 Cloudflare KV；未绑定 KV 时自动写入 Google Drive 根目录 metadata properties（永久持久化且不占用存储配额）；最后使用内存兜底。
- **批量多选操作（OpenList 范式）**：
  - 默认浏览纯净无扰，复选框隐藏；开启多选后点击整行切换选择；
  - 底部吸附浮动工具栏，支持全选、反选、多选计数；
  - 支持批量重命名（正则/前后缀/递增序号）、批量跨目录移动、批量移入回收站。
- **文件全生命周期控制**：新建文件夹、单文件重命名/移动、删除（软删除至回收站 / 永久删除）、一键设置资源为「知道链接的任何人可查看」（解决 Google 预览未授权 302 问题）。

### 2.10 Google Drive 多源挂载与快捷方式穿透
- 支持挂载「我的云端硬盘」普通文件夹或团队盘（Shared Drive）。
- **快捷方式穿透**：通过 Google Drive 官方「添加快捷方式」功能，将分布在不同账号、团队盘或其他人共享的文件夹集中放入根文件夹，系统后端将自动透明解封装并穿透访问。

---

### 2.11 Telegram 媒体转存机器人
- 把 Telegram 里的任意**视频、音频、文档、照片或语音消息**经由官方 Drive API 直接转存进你的 Google Drive——机器人充当边缘中转。
- **secret_token 来源校验**：配置 `TELEGRAM_WEBHOOK_SECRET` 后，每次投递都必须携带匹配的 `X-Telegram-Bot-Api-Secret-Token` 头（恒定时间比较），不匹配返回 **401**。
- **白名单 fail-closed**：白名单留空时拒绝所有上传请求，公开可访问的端点因此绝不会被陌生人滥用。
- **20 MB 上限，前置校验**：在任何出站请求之前即强制执行 Telegram 的 `getFile` 限制。
- **幂等转存**：以 Telegram `file_unique_id`（写入 Drive `appProperties`）为键，Telegram 重推不会产生重复文件。
- **深链直达**：转存成功后返回站内链接（`?file=<id>`）与下载直链。
- **自检工具**：在后台测试 Bot 连通性、执行端到端上传探针。
- 完整指南：[docs/telegram-integration_zh.md](docs/telegram-integration_zh.md)

---

## 3. 极速部署指南（5 分钟上线）

### 3.1 Cloudflare Pages 一键导入

1. **Fork 或克隆仓库**：将本项目推送至您的个人 GitHub / GitLab 账户。
2. **登录 Cloudflare 控制台**：
   - 进入 **Workers & Pages** -> 点击 **Create application** -> 选择 **Pages** -> 点击 **Connect to Git**。
3. **项目构建配置**：
   - 选取导入的代码仓库。
   - **Framework preset（框架预设）**：选择 `None`。
   - **Build command（构建命令）**：**留空**（无需任何构建编译流程）。
   - **Build output directory（输出目录）**：填写 `public`。
4. **配置环境变量**：展开 **Environment variables**，根据下表添加机密变量后点击 **Save and Deploy**。

### 3.2 环境变量详细配置清单

| 变量名 | 必填状态 | 说明与示例 |
| :--- | :---: | :--- |
| **`CLIENT_EMAIL`** | **是**（方式A） | Google 服务账号邮箱，形如：`xxx@project-id.iam.gserviceaccount.com` |
| **`PRIVATE_KEY`** | **是**（方式A） | 服务账号私钥内容，需包含完整 `-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----`，支持直接粘贴或换行转义 |
| **`SERVICE_ACCOUNT_JSON`** | **是**（方式B） | 完整 JSON 凭据字符串（将 GCP 下载的 `.json` 密钥全文粘贴）。方式 A 与方式 B 任选其一 |
| **`ROOT_FOLDER_ID`** | **推荐** | 挂载的 Google Drive 根文件夹 ID；若留空则默认挂载服务账号的 `root` 根空间 |
| **`ADMIN_PASSWORD`** | **推荐** | 后台管理员密码；**代码内默认值为 `admin`**，强烈建议显式自定义复杂密码 |
| **`JWT_SECRET`** | **推荐** | 访问令牌防伪签名加盐密钥（任意随机复杂字符串，建议 32 位以上） |
| **`SITE_NAME`** | 否 | 自定义站点主标题，如：`我的私有云盘`（亦可在后台管理动态修改） |
| **`SITE_SUBTITLE`** | 否 | 自定义站点副标题，如：`流媒体与通用文件中心` |
| **`REQUIRE_ACCESS_PASSWORD`** | 否 | 是否启用全站访客访问密码保护（`true` 或 `false`，默认 `false`） |
| **`ACCESS_PASSWORD`** | 否 | 访客访问密码（若开启了保护） |

> **提示**：为保障多环境一致性，建议同时在 **Production** 与 **Preview** 环境中配置上述变量。本地调试时，可将 [.env.example](.env.example) 复制为 `.dev.vars` 即可被 `npx wrangler pages dev public` 自动读取。

### 3.3 Cloudflare KV 命名空间绑定（可选进阶）

系统内置了 Google Drive 根目录 metadata properties 自动持久化机制，**即使不配置 KV 也具备完整保存能力**。  
若希望获得全球边缘节点毫秒级系统配置与密码读取加速，可配置 KV 绑定：

#### 方式 1：通过控制台绑定
1. 在 Cloudflare 控制台导航至 **Workers & Pages → KV**，点击 **Create a namespace**，输入名称如 `drive_player_kv`。
2. 进入 Pages 项目的 **Settings → Functions → KV namespace bindings**。
3. 点击 **Add binding**：
   - **Variable name（变量名）**：输入 **`DRIVE_KV`**（必须严格全大写保持一致）。
   - **KV namespace**：选中刚刚创建的 KV 命名空间。
4. 重新触发一次部署即可生效。

#### 方式 2：通过 wrangler.toml 绑定
如果使用 Git CI 自动化发布，可在工程根目录 [wrangler.toml](wrangler.toml) 中取消注释并填入 KV 命名空间 ID：

```toml
[[kv_namespaces]]
binding = "DRIVE_KV"
id = "6234abcd5678ef901234567890abcdef" # 替换为您真实的 KV Namespace ID
```

---

## 4. Google Cloud 凭据与权限配置

### 4.1 创建 GCP 服务账号并获取密钥

要让 Cloudflare Pages 能够读取您的 Google Drive 文件，需要通过 Google Cloud Platform 创建服务账号：

1. **新建 GCP 项目**：
   - 登录 [Google Cloud Console](https://console.cloud.google.com/)。
   - 点击顶部项目下拉菜单，点击 **新建项目 (New Project)**，输入项目名称（如 `cf-drive-player`）并创建。
2. **启用 Google Drive API**：
   - 在左侧导航栏选择 **API 和服务 (APIs & Services) → 库 (Library)**。
   - 搜索 `Google Drive API`，点击进入并点击 **启用 (Enable)**。
3. **创建服务账号 (Service Account)**：
   - 导航至 **API 和服务 → 凭据 (Credentials)**，点击顶部 **创建凭据 (Create Credentials) → 服务账号 (Service Account)**。
   - 输入服务账号名称（如 `drive-viewer`），点击 **创建并继续**。
   - 角色可选（不需要特殊权限，后续通过网盘内共享赋予权限），直接点击 **完成 (Done)**。
4. **生成私钥文件**：
   - 在服务账号列表中点击刚刚创建的服务账号进入详情页。
   - 切换到 **密钥 (Keys)** 选项卡，点击 **添加密钥 (Add Key) → 创建新密钥 (Create new key)**。
   - 密钥类型选择 **JSON** 并点击 **创建**，浏览器将自动下载一个 `.json` 凭据文件。
   - 打开该 JSON 文件，记录 `client_email` 与 `private_key`。

---

### 4.2 授权 Google Drive 文件夹访问（关键步骤）

> ⚠️ **新手最容易遗漏的步骤**：服务账号是独立的虚拟身份，默认看不到您的任何私人网盘文件。必须手动将网盘文件夹**共享**给服务账号！

1. 在浏览器中打开 [Google 云端硬盘](https://drive.google.com/drive/)。
2. 新建或找到希望挂载展示的总文件夹（例如「我的影音库」）。
3. 右键该文件夹，选择 **共享 (Share) → 共享 (Share)**。
4. 在添加人员输入框中，粘贴刚才生成的 **服务账号邮箱 (`client_email`)**。
5. 权限选择：
   - 仅用于只读浏览、音视频播放、下载：设置为 **查看者 (Viewer)**；
   - 需要使用后台重命名、移动、新建文件夹、移入回收站：设置为 **内容管理员 (Content Manager)** 或 **编辑者 (Editor)**。
6. 取消勾选“通知人员”（虚拟邮箱无法接收邮件），点击 **共享/发送** 确认。
7. 获取根文件夹 ID：
   - 进入该文件夹，查看浏览器地址栏 URL：  
     `https://drive.google.com/drive/folders/1-3i7VNCMLtTfkWxWpSemjUIvdwNLCi6l`
   - 末尾的 `1-3i7VNCMLtTfkWxWpSemjUIvdwNLCi6l` 即为 `ROOT_FOLDER_ID`。

---

### 4.3 管理员后台设置与全站访问控制

1. **登录管理员后台**：
   - 访问部署好的站点，点击右上角齿轮图标进入后台面板。
   - 输入环境变量配置的 `ADMIN_PASSWORD`（默认 `admin`）登录。
2. **网站基本信息设置**：
   - **网站标题 (siteName)**：修改前端顶栏展示的品牌标题。
   - **网站副标题 (siteSubtitle)**：修改展示的二级标语（如：影音娱乐与通用文档多端枢纽）。
3. **全站访客访问控制**：
   - 开启「启用全站访问密码」开关，并设定访客访问密码。
   - 保存后，未获授权的访客将看到密码解锁窗口，且后端 API 将拦截所有未经认证的目录列举与媒体取流请求。
4. **修改管理员密码**：
   - 可在后台直接输入新密码热更新，保存后系统将自动重新签发管理员令牌，无需重新部署。

---

## 5. 常见问题排查 (FAQ)

### Q1: 视频播放黑屏有声音、解码卡死或提示格式不受支持？

- **原因分析**：
  1. **音频有声音画面黑屏**：文件多为封装了 **HEVC (H.265) 10bit**、**VC-1**、**MPEG-2** 的 MKV/MP4，当前浏览器硬件或操作系统缺少对应视频硬解扩展；
  2. **完全无声无画报错**：音频轨道使用了商业专有音轨（**DTS**、**TrueHD**、**AC3/E-AC3 Dolby Digital**），浏览器原生不支持解封装商业音频；
  3. **Google 预览未授权 302 重定向**：启用了 Google 云端转码预览，但该文件未开放公开读取权限，导致 Google 预览 iframe 重定向至登录页受阻。
- **排查与解决步骤**：
  - **自动处理**：系统内建的**双阶看门狗**会在 2 秒内自动判定黑屏状态，并无感切换至 Google 官方云端转码预览通道；
  - **一键授权公开**：以管理员身份登录后台，在对应文件操作菜单中点击「设为任何人可见」，解除 Google 预览的 302 鉴权限制；
  - **本地专业播放器调用**：点击播放器顶栏的播放器菜单，一键唤起 **PotPlayer**、**IINA**、**VLC**、**Infuse** 或复制流直链至 **MPV** 原生硬解播放。

---

### Q2: 提示 Google 凭据失效 / 403 Forbidden / invalid_grant / 10000 错误？

- **原因分析**：
  1. `PRIVATE_KEY` 格式破损或换行符转义异常；
  2. 目标文件夹未共享给服务账号邮箱；
  3. Cloudflare Worker 边缘节点时钟或配置缓存未刷新。
- **排查与解决步骤**：
  - **检查私钥换行**：确保 `PRIVATE_KEY` 包含完整的 `-----BEGIN PRIVATE KEY-----` 和 `-----END PRIVATE KEY-----`。若在控制台多行粘贴出现截断，可直接使用单引号包裹的完整 `SERVICE_ACCOUNT_JSON` 变量；
  - **确认共享权限**：打开 Google Drive 网页版，检查挂载的根文件夹以及目标文件是否已共享给 `client_email`；
  - **清除部署缓存**：在 Cloudflare Pages 控制台的 **Deployments** 列表中，找到最新部署点击 **Retry deployment**。

---

### Q3: 拖动视频进度条异常卡死，或返回 HTTP 416 Range Not Satisfiable？

- **原理与机制**：
  - 流式播放依赖标准 HTTP 206 分片传输协议。请求头包含 `Range: bytes=start-end`，服务端响应 `Content-Range: bytes start-end/total`；
  - 本项目在 [functions/api/stream/[id].js](functions/api/stream/[id].js) 中完整透传了 `Accept-Ranges: bytes`、`Content-Range`、`Content-Length`、`ETag` 与 `If-Range` 标头；
- **排查与解决步骤**：
  - 如果拖拽进度超出文件总字节数，Google Drive 会返回 `416`，本项目已捕获并返回标准的 `416` 协议标头以通知播放器重置请求；
  - 检查网络运营商或中转反代是否禁用了 Range 分片缓存或修改了 HTTP 协议头。

---

### Q4: 未绑定 KV 会影响使用吗？三级元数据持久化是什么？

- **结论**：**完全不影响正常使用**。
- **三级持久化机制详解**：
  1. **一级存储（Cloudflare KV）**：若检测到 `DRIVE_KV` 绑定，配置读写毫秒级全球同步；
  2. **二级存储（Google Drive properties）**：若未配置 KV，配置会自动写入 Google Drive 根文件夹的私有元数据字段（`properties.cf_sys_config`）。该操作**不占用 Google 存储空间配额**，数据全球持久化存在，换机或重新部署均不丢失；
  3. **三级存储（内存与环境变量兜底）**：系统启动时读取默认环境变量。

---

### Q5: 上传文件或创建文件时报错 Quota: 0 或 storageQuotaExceeded？

- **原因分析**：
  - Google Cloud 的 Service Account（服务账号）本身是一个虚拟机器账号，**不附带独立的免费存储配额（Quota: 0）**。
- **解决方案**：
  - 若需直接向网盘写入文件，请将挂载的根文件夹放置于 **Google Workspace 共享云端硬盘 (Shared Drive)** 中，由组织配额承载存储；
  - 或者在个人网盘网页端直接上传文件，系统将实时索引并呈现，无需消耗服务账号配额。

---

### Q6: 如何唤起第三方本地播放器（PotPlayer / IINA / VLC / Infuse / MPV）？

播放器顶栏内置本地播放器调用中心，支持以下协议及端点：

| 客户端 | 调用协议 / 格式 | 适用平台 |
| :--- | :--- | :--- |
| **PotPlayer** | `potplayer://<StreamUrl>` | Windows |
| **IINA** | `iina://weblink?url=<StreamUrl>` | macOS |
| **VLC** | `vlc://<StreamUrl>` | Windows / macOS / Linux |
| **Infuse** | `infuse://open?url=<StreamUrl>` | iOS / iPadOS / macOS / Apple TV |
| **MPV** | `mpv://<StreamUrl>` 或终端运行 `mpv "<StreamUrl>"` | 全平台 |
| **Android ExoPlayer** | `intent:<StreamUrl>#Intent;action=android.intent.action.VIEW;type=video/*;end` | Android 手机 / 平板 / 电视 |

> **提示**：当全站开启访问密码保护时，外部播放器 URL 会自动在 Query 参数中附加 `?token=<token>`，确保外部播放器取流成功。

---

### Q7: Telegram 机器人返回 401 / 无操作权限 / 20MB 上限？

| 现象 | 原因 | 处理 |
| :--- | :--- | :--- |
| 机器人回复 `无操作权限` | 发送者不在白名单 | 将数字 ID 或 `@username` 加入 `TELEGRAM_ALLOWED_USERS` |
| 机器人对所有文件都无响应 | 白名单留空（**fail-closed**） | 填写 `TELEGRAM_ALLOWED_USERS` |
| Telegram 显示 `last_error_message` | 密钥不匹配或 URL 不可达 | 确认两侧 `TELEGRAM_WEBHOOK_SECRET` 一致；确认 URL 公开可访问 |
| 25 MB 文件报 `文件过大` | Telegram 的 20 MB `getFile` 限制 | 压缩/拆分文件，或直接上传到 Drive |
| 重推后出现重复文件 | 幂等键未写入 | 确认目标文件夹允许写入 `appProperties` |
| 上传报配额错误 | 服务账号自身无存储 | 指向共享云端硬盘并授予管理员权限 |

---

## 6. 系统架构全景图

```text
                            用户客户端浏览器 / 第三方播放器
                                         │
                    ┌────────────────────┴────────────────────┐
                    ▼ (静态资源直通)                          ▼ (/api/* 动态计算)
           Cloudflare 边缘 CDN                     Cloudflare Pages Functions
        (HTML / CSS / JS / SVG)               ┌───────────────────────────────────┐
                    │                         │  functions/api/_middleware.js     │
                    │                         │  (全局 CORS 预检与异常安全兜底)   │
                    │                         └─────────────────┬─────────────────┘
                    │                                           │
                    │                    ┌──────────────────────┼──────────────────────┐
                    │                    ▼                      ▼                      ▼
                    │              /api/list.js           /api/stream/[id].js    /api/admin/*
                    │           (分页/搜索/快捷穿透)     (HTTP 206 Range代理)    (后台控制面)
                    │                    │                      │                      │
                    │                    └──────────────┬───────┴──────────────────────┘
                    │                                   │
                    │                    ┌──────────────┴──────────────┐
                    │                    ▼                             ▼
                    │        functions/utils/googleAuth.js   functions/utils/configManager.js
                    │          (Web Crypto 原生 RS256 签名)      (三级持久化: KV / Drive / 内存)
                    │                    │                             │
                    ▼                    ▼                             ▼
            全球边缘极速渲染       Google Drive API v3           Cloudflare KV / Drive 元数据
```

---

## 7. 本地开发与质量闸门

本项目内置完备的自动化静态契约与安全门禁校验系统：

```bash
# 1. 克隆工程
git clone https://github.com/yourname/Cloudflare-Drive-Player.git
cd Cloudflare-Drive-Player

# 2. 安装本地开发依赖 (Wrangler)
npm install

# 3. 运行全栈 7 项自动化质量门禁
npm run test:syntax

# 4. 本地启动 Cloudflare Pages 仿真预览
npx wrangler pages dev public
```

### 质量门禁检查清单（`scripts/ci-check.js`）
- **步骤 1/7**：JavaScript AST 语法有效性原生校验（0 容忍语法隐患）；
- **步骤 2/7**：静态资源完备性与 `public/_routes.json` 边缘路由隔离规则校验；
- **步骤 3/7**：`wrangler.toml` 部署输出目录契约合规性校验；
- **步骤 4/7**：流媒体 HTTP 206 Range 分片透传与 MKV MIME 校准契约校验；
- **步骤 5/7**：Google 预览零遮挡安全沙箱模型与防弹窗门禁校验；
- **步骤 6/7**：客户端双阶自适应降级播放与智能选源契约校验；
- **步骤 7/7**：极简 Header 视窗结构契约与边缘安全响应头（CSP / nosniff）校验。

---

## 8. 技术文档索引与致谢

### 详细技术文档
- [API 接口规范参考](docs/api-reference_zh.md) ([English](docs/api-reference.md)) —— 全量端点参数、状态码说明、认证鉴权与可复现 `curl` 示例。
- [播放器交互架构与自适应降级手册](docs/player-architecture-and-user-guide_zh.md) ([English](docs/player-architecture-and-user-guide.md)) —— 双阶降级状态机、视窗几何裁切与本地播放器协议指南。
- [CI/CD 流水线与部署运维指南](docs/ci-cd-deployment-guide_zh.md) ([English](docs/ci-cd-deployment-guide.md)) —— 双阶段门禁、边缘预热与故障排除。
- [ADR-0001 流媒体与转码架构决策](docs/adr/0001-media-streaming-and-transcoding-architecture_zh.md) ([English](docs/adr/0001-media-streaming-and-transcoding-architecture.md)) —— 为什么不使用边缘实时转码与播放矩阵设计。
- [ADR-0002 自适应降级与极简视窗决策](docs/adr/0002-adaptive-playback-sandboxing-and-minimalist-player_zh.md) ([English](docs/adr/0002-adaptive-playback-sandboxing-and-minimalist-player.md)) —— 零遮挡视窗与控制平面收敛设计。
- [ADR-001 边缘路由隔离与 CI 韧性决策](docs/adr/ADR-001-cf-pages-edge-routing-and-ci-resilience_zh.md) ([English](docs/adr/ADR-001-cf-pages-edge-routing-and-ci-resilience.md)) —— 边缘路由隔离与冷启动消除。
- [关于项目与设计初衷](ABOUT_zh.md) ([English](ABOUT.md)) —— 架构创新与全套件设计理念。

### 致谢
- [Cloudflare Pages & Workers](https://pages.cloudflare.com/) —— 强大的边缘 Serverless 计算基座。
- [Google Drive API v3](https://developers.google.com/drive/api) —— 云端数据存储与转码服务。
- [ArtPlayer](https://artplayer.org/) —— 优秀的现代 HTML5 网页播放器。
- [Tailwind CSS](https://tailwindcss.com/) —— 原子化实用优先 CSS 框架。
- [OpenList](https://github.com/OpenListTeam/OpenList) —— 多选交互范式与影音微交互体验参考。
- [Lucide Icons](https://lucide.dev/) —— 优雅简洁的现代图标系统。

---

## 9. 开源许可证

本项目基于 [MIT License](LICENSE) 协议开源。
