<div align="center">

# 关于 Cloudflare Drive Player

<p align="center">
  <a href="https://pages.cloudflare.com/"><img src="https://img.shields.io/badge/Platform-Cloudflare%20Pages-f38020?style=flat&logo=cloudflare" alt="Cloudflare Pages"></a>
  <a href="https://developers.google.com/drive/api"><img src="https://img.shields.io/badge/Storage-Google%20Drive-4285F4?style=flat&logo=googledrive" alt="Google Drive"></a>
  <img src="https://img.shields.io/badge/Architecture-100%25%20Serverless%20Edge-000000?style=flat&logo=v8" alt="Serverless Edge">
  <img src="https://img.shields.io/badge/Player-Artplayer%20Core-ea580c?style=flat" alt="Artplayer Core">
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT-emerald?style=flat" alt="License: MIT"></a>
</p>

<p align="center">
  <b>轻量、高雅、纯净的下一代 Google Drive 边缘流媒体与通用文件枢纽</b><br>
  依托 Cloudflare 全球边缘计算网络，彻底免除 VPS 服务器运维负担，赋能私人网盘与团队盘秒级化身在线影音工作台。
</p>

<p align="center">
  <a href="ABOUT.md">English</a> · <b>简体中文</b>
</p>

</div>

---

## 📖 项目愿景与设计初衷 (Vision & Philosophy)

随着个人云盘与团队协作资源的日益增长，许多开发者和影视/音乐爱好者选择将高画质影视（4K UHD / MKV / REMUX）、无损音乐（FLAC / Hi-Res）以及海量技术文档托管在 Google Drive 上。然而，传统自建网盘方案普遍面临以下痛点：

1. **VPS 运维负担沉重**：基于传统服务器（Nginx / Node.js / Python）的网盘前端需要购买机器、配置 SSL 证书、防御 DDoS 攻击，长期维护成本高昂；
2. **浏览器解码断层**：桌面端与移动端浏览器对 MKV、HEVC/H.265 10-bit HDR 以及商业音频编码（DTS / AC-3）的支持高度碎片化，常出现“黑屏有声音”或“无法播放”的致命问题；
3. **UI 体验粗糙冗杂**：传统列表型网盘排版生硬，长标题提前截断断字，移动端无法根据设备比例适配，且缺乏沉浸式音乐歌词与通用文档阅读能力；
4. **凭据安全与配置门槛**：多数开源工具要求绑定复杂的数据库或付费 Redis，极易因凭据泄露或配置繁琐而劝退。

**Cloudflare Drive Player** 的诞生，正是为了以**「全边缘计算（100% Serverless Edge）」**和**「以用户体验为核心（Human-Centered Design）」**的理念彻底终结上述痛点。

---

## ⚡ 核心架构与技术创新 (Key Architectural Innovations)

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│                           用户端多端视口 (Mobile / Desktop / Pad)            │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │ HTTPS / HTTP 206 (Range)
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                 Cloudflare Pages 边缘函数网关 (Edge Functions)                │
│                                                                             │
│  ┌───────────────────────┐  ┌───────────────────────┐  ┌──────────────────┐  │
│  │   /api/stream/:id     │  │   /api/download/:id   │  │   /api/list      │  │
│  │ HTTP 206 分片穿透      │  │ RFC 5987 国际化防乱码   │  │ 目录树/容量并发聚合 │  │
│  └───────────────────────┘  └───────────────────────┘  └──────────────────┘  │
│  ┌──────────────────────────────────────────────────┐  ┌──────────────────┐  │
│  │        独创三级持久化架构 (Resilient 3-Tier)        │  │ Google Auth 模块 │  │
│  │   KV 优先 ➔ Drive Metadata 属性接管 ➔ 环境变量兜底  │  │ 边缘端 JWT 自动续签 │  │
│  └──────────────────────────────────────────────────┘  └──────────────────┘  │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │ 官方 REST API v3
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                 Google Drive (个人盘 / 共享团队盘 / 跨盘快捷方式)              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 1. 双阶起播降级看门狗 (Dual-Phase Playback Watchdog)
为彻底攻克 PC Chrome 播放 MKV/HEVC/DTS 时出现的“黑屏有声音”顽疾，系统内置双阶自适应选源内核：
- **阶段一（静态先验特征探测）**：静态检测到 AVI/WMV/RMVB 等浏览器不兼容格式或 WebKit/Safari 内核时，秒级智能分流至 Google 官方转码预览；
- **阶段二（动态状态看门狗）**：在本地 Artplayer 起播阶段，2 秒内自动检测当前视频解码帧与真实画面输出，若检测到音频推进但画面卡死（Black Screen with Audio），4 秒看门狗自动触发无感降级并引导转码播放；
- **零遮挡几何裁切沙箱**：利用纯 CSS 视口顶栏 56px 精准裁切，彻底隐藏 Google 转码页面右上角突兀的 Pop-out 弹出拦截弹窗，拒绝破坏性遮罩层，保留 100% 原生硬件播放与画质切换能力。

### 2. 独创三级元数据持久化容灾机制 (Resilient 3-Tier Metadata Engine)
免除开发者强制购买或开通数据库的负担，系统实现真正零成本免运维：
- **Tier 1 (边缘缓存)**：优先使用 Cloudflare KV 命名空间，实现毫秒级全球分布式配置与状态存储；
- **Tier 2 (网盘元数据接管)**：若未绑定 KV，系统**自动无缝降级**并将网站名称、副标题、访客密码等配置安全写入 Google Drive 挂载根目录的 `properties` 元数据中。无需任何额外配置，即可获得持久保存能力，且**完全不计入网盘容量配额**；
- **Tier 3 (环境变量兜底)**：在极端无写入特权场景下，自动回退到 Pages 环境变量与会话内存中，确保系统始终可用。

### 3. 多端排版物理换行与响应式单列适配 (`card-title-v3`)
- **CJK 字符物理极限折行**：深入底层 CSS 排版引擎，应用 `word-break: break-all; overflow-wrap: anywhere; line-break: anywhere;`，彻底根除超长剧集名第一行未排满即提前断字的缺陷；
- **严格两行自适应限制**：卡片标题高度固定为 40px，并在多端视口保持 2px 视觉缓冲区，绝不因标题行数不一破坏网格对齐；
- **移动端单列大画幅流**：在手机视口（`<640px`）自动智能切为单列网格布局，确保封面具备超过 340px 的广阔画幅与最佳触控区域。

### 4. 元数据与操作控制双层解耦底栏
- 卡片底部拆分为「顶层：容量大小与修改时间（两端对齐，空间独立绝不折行挤压）」与「底层：项目数量/格式标签与紧凑操作按钮组」；
- 无论管理员登录后增加多少快捷操作按钮，文件与文件夹的容量大小和修改时间始终 100% 完整清晰可见。

---

## 🎨 全功能工作套件 (Comprehensive Suite)

| 视窗模块 | 核心能力描述 |
| :--- | :--- |
| **视频播放器 (Artplayer)** | 支持 MP4、WebM、FLV、HLS，针对 MKV 容器定制解封装；外挂 ASS/SRT 字幕智能识别与动态转 WebVTT 渲染；顶部常驻一键唤起本地播放器（PotPlayer、IINA、VLC、Infuse、MPV、ExoPlayer）菜单。 |
| **音频工作台 (Audio Studio)** | 拟物黑胶动态旋转动效、Hi-Res 高解析度无损标识、同目录 `.lrc` 歌词毫秒级同步高亮；**支持点击歌词定位跳转播放进度**；内置侧边抽屉播放队列。 |
| **通用文档阅读器 (Doc Viewer)** | PDF 原生全屏浏览，Markdown (`.md`)、代码、JSON、日志在线语法格式化展示。 |
| **全场景常驻静默下载** | 各卡片与模态视窗常驻下载入口；后端全面遵循 RFC 5987 编码标准防中文乱码；Google 在线文档自动无缝导出为 Office 格式流。 |
| **纯深色模式极简美学** | 基于 Tailwind CSS 构建 Slate 950 与 Brand 橙色高对比度纯深色模式，界面纯净优雅。 |
| **系统管理控制台** | 在线热修改站点主标题与下方副标题描述、一键配置全站访客访问密码、支持批量重命名（替换/前后缀/序列号）、批量跨目录移动与安全移入回收站。 |

---

## 🛠️ 技术栈清单 (Technology Stack)

- **边缘计算运行时**：Cloudflare Pages / Pages Functions (V8 Edge Workers)
- **底层云存储接口**：Google Drive REST API v3
- **前端核心逻辑**：原生 JavaScript (Vanilla ES6+)，零第三方巨型前端框架依赖，首屏毫秒级秒开
- **样式与图元设计**：Tailwind CSS (CDN JIT Mode) + Lucide Icons
- **播放内核与音画**：Artplayer 5.x + Hls.js 1.x + Flv.js 1.x
- **鉴权与加密安全**：Web Crypto API (RS256 签名，直接在边缘端向 Google OAuth 换取 Access Token)

---

## 🔒 安全与隐私考量 (Security & Compliance)

1. **零服务端存储与无 Cookie 追踪**：系统不记录访客个人隐私，不植入任何广告追踪或第三方分析探针；
2. **凭据安全隔离**：Google 服务账号私钥与管理员密码严格通过 Cloudflare 边缘安全环境变量保护，前端任何请求绝不向浏览器暴露后端原始私钥；
3. **安全响应头门禁**：边缘端默认注入严格的 CSP、`X-Content-Type-Options: nosniff` 以及规范的 CORS 标头，防御点击劫持与 MIME 嗅探攻击。

---

## 📜 开源协议 (License)

本项目基于 **[MIT License](LICENSE)** 开源发布。欢迎广大开发者与影音爱好者自由学习、Fork、部署与提交 PR 改进！
