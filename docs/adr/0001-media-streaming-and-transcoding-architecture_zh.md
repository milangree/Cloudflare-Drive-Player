<div align="center">

# ADR-0001: 跨端流媒体播放、云端转码降级与边缘鉴权模型设计

<p align="center">
  <img src="https://img.shields.io/badge/状态-已接受-success?style=flat" alt="状态: 已接受">
  <img src="https://img.shields.io/badge/决策层-系统架构师与后端架构师-blue?style=flat" alt="决策层">
</p>

<p align="center">
  <a href="0001-media-streaming-and-transcoding-architecture.md">English</a> · <b>简体中文</b>
</p>

</div>

---

## 状态
已接受 (Accepted)

## 上下文 (Context)
本项目是一套基于 Cloudflare Pages (V8 Functions) 与 Google Service Account 的轻量级 Google Drive 目录索引与流媒体播放器。
在生产使用中，用户反馈核心痛点：“一键转码云端播放无效果，之前有在用 Google 预览，这个就正常的。”
深入排查发现：
1. **转码能力虚假承诺与双重鉴权断层**：
   后端（Cloudflare Pages Functions）本身无转码管道（FFmpeg）；前端所称的“一键切换云端转码”实质是指向 Google Drive 官方的静态 iframe 页面（`https://drive.google.com/file/d/${id}/preview`）。
   - 后端流代理通过 Google Service Account Bearer Token 进行 API 鉴权，可读取未公开文件；
   - 但 Google Drive Web Preview 运行在客户端浏览器，依赖访客自身的 Google Cookie。当文件未在云端开启“知道链接的任何人可查看”时，Google 会返回 302 重定向至 `accounts.google.com/ServiceLogin`；
   - 该登录页自带 `X-Frame-Options: DENY`，且前端为了防止弹窗配置了缺少 `allow-same-origin` 的严苛沙箱及透明物理遮罩，导致 iframe 彻底被浏览器拦截，呈现白屏或黑屏无响应。
2. **后端流与下载接口的权限穿透漏洞**：
   原系统仅在 `/api/list` 进行了站点密码校验，而 `/api/stream/[id]` 与 `/api/download/[id]` 未校验访问令牌，存在越权访问风险。
3. **Google API 速率超限与并发放大风险**：
   在目录索引（`/api/list`）中对所有子文件夹无节制全并发（`Promise.all`）调用 Google 统计 API，极易引发 HTTP 429 速率限制。

---

## 架构决策 (Decisions)

### 1. 转码与流媒体多级降级架构 (Multi-Tier Playback Architecture)
放弃单一“假云端转码”假定，构建确定性的多级播放矩阵：
- **Tier 1 (原生直链 + Range 分片)**：针对 H.264 / AAC / MP4 / WebM 等浏览器原生支持格式，通过 Cloudflare Pages 边缘代理透传 HTTP 206 Partial Content，提供零转码开销的秒开播放。
- **Tier 2 (Google 官方转码预览通道 - 修复与前置条件保障)**：
  - 在管理端提供 `ensure_public` 权限保障能力，一键向 Google Drive API 申请 `anyoneWithLink: viewer` 共享策略，消除 302 登录重定向；
  - 采用无遮挡视口裁切架构，移除阻断交互的透明遮罩。
- **Tier 3 (深度协议唤起本地专业解码器)**：
  - 针对高规格 MKV、HEVC 10bit、HDR、DTS/TrueHD 音轨，浏览器原生内核无法硬解时，通过标准化 URL Scheme（`potplayer://`, `vlc://`, `iina://`, `mpv://`）无缝唤起客户端专业播放器，直接拉取边缘 Range 流，实现无损硬件直出。
- **Tier 4 (未来中长期演进：边缘切片与云端转码 Worker)**：
  - 后续可规划接入 Cloudflare Stream 或轻量容器转码服务。

### 2. 纵深防御鉴权体系 (Defense-in-Depth Authentication)
- 在边缘全局统一网关或关键 API（`/api/stream/[id]`、`/api/download/[id]`、`/api/list`）严格执行双令牌（前台访问令牌 + 后台管理员令牌）校验；
- 针对流媒体 `<video>` 标签与外部播放器无法自定义 Header 的限制，标准化支持 `Authorization: Bearer <token>` 与 URL Query `?token=<token>` 双通道解析；
- 采用 Web Crypto 恒定时间比较函数 `timingSafeEqual` 防御时序侧信道攻击。

### 3. API 调用限流与并发批处理 (API Throttling & Concurrency Pool)
- 在 `/api/list` 中引入 `CONCURRENCY_LIMIT = 5` 的批量调度池，平滑并发毛刺，消除 Google API 429 风险。

---

## 被否决方案与权衡分析 (Rejected Alternatives)

1. **方案一：在 Cloudflare Worker 内部直接运行 WebAssembly FFmpeg 实时转码**
   - **否决原因**：Cloudflare Workers 免费/标准计划有严格的 CPU 执行时间限制（50ms ~ 30s），且内存仅 128MB。视频重编码（如 1080p HEVC 转 H.264）CPU 与内存消耗极大，完全超出边缘无服务器运行时的物理边界，会导致 Worker 频繁 OOM 或 CPU Timeout 崩溃。
2. **方案二：彻底移除 Google 预览，强制所有非原画视频均走外部播放器**
   - **否决原因**：大量普通移动端/轻度用户在未安装第三方播放器时，依赖开箱即用的在线播放能力。只要解决 Google Drive 共享权限与沙箱策略，Google 预览仍是成本最低、兼容性最好的免费转码方案。

---

## 后续演进约束 (Consequences & Evolution Constraints)
1. **外部播放器直链鉴权有效期**：带参直链（`?token=...`）需保证在长视频播放过程中令牌不过期，或提供专用短时媒体签名机制；
2. **大文件下载配额**：Google Drive 对单一文件的每日下载量有隐性配额限制，超大规模访问需规划多账号轮换或 Cloudflare R2 缓存回源中间层。
