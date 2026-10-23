<div align="center">

# About Cloudflare Drive Player

<p align="center">
  <a href="https://pages.cloudflare.com/"><img src="https://img.shields.io/badge/Platform-Cloudflare%20Pages-f38020?style=flat&logo=cloudflare" alt="Cloudflare Pages"></a>
  <a href="https://developers.google.com/drive/api"><img src="https://img.shields.io/badge/Storage-Google%20Drive-4285F4?style=flat&logo=googledrive" alt="Google Drive"></a>
  <img src="https://img.shields.io/badge/Architecture-100%25%20Serverless%20Edge-000000?style=flat&logo=v8" alt="Serverless Edge">
  <img src="https://img.shields.io/badge/Player-Artplayer%20Core-ea580c?style=flat" alt="Artplayer Core">
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT-emerald?style=flat" alt="License: MIT"></a>
</p>

<p align="center">
  <b>Lightweight, elegant, and uncompromising Google Drive media streaming and file management at the edge.</b><br>
  Built on Cloudflare's global network to eliminate VPS maintenance overhead, transforming personal and shared drives into a high-performance web studio.
</p>

<p align="center">
  <b>English</b> · <a href="ABOUT_zh.md">简体中文</a>
</p>

</div>

---

## 📖 Vision & Philosophy

With the exponential growth of personal cloud libraries and team media vaults, developers and media enthusiasts frequently store high-bitrate media (4K UHD, MKV, REMUX), lossless audio (FLAC, Hi-Res), and rich documentation on Google Drive. However, traditional self-hosted directory portals suffer from recurring pain points:

1. **Heavyweight VPS Maintenance**: Conventional Nginx, Node.js, or Python setups demand server provisioning, SSL certificate management, DDoS protection, and continuous security patching.
2. **Browser Decoding Incompatibilities**: Desktop and mobile browsers offer fragmented support for MKV containers, HEVC/H.265 10-bit HDR, and proprietary commercial audio codecs (DTS, AC-3), frequently resulting in playback failures or "black screen with audio only".
3. **Cluttered & Inflexible UIs**: Generic directory listings often truncate titles prematurely, fail to scale gracefully on mobile viewports, and lack integrated music players with synchronized lyrics or document viewers.
4. **Credential Security & Database Overhead**: Many tools require external SQL or Redis databases, increasing configuration friction and risking credential exposure.

**Cloudflare Drive Player** was engineered to address these challenges with two core principles: **100% Serverless Edge Computing** and **Human-Centered Design**.

---

## ⚡ Key Architectural Innovations

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│                       Client Viewport (Mobile / Desktop / Tablet)           │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │ HTTPS / HTTP 206 (Byte-Range)
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                 Cloudflare Pages Functions (Edge Gateway)                   │
│                                                                             │
│  ┌───────────────────────┐  ┌───────────────────────┐  ┌──────────────────┐  │
│  │   /api/stream/:id     │  │   /api/download/:id   │  │   /api/list      │  │
│  │ HTTP 206 Passthrough  │  │ RFC 5987 Header Safe  │  │ Tree/Quota Agg   │  │
│  └───────────────────────┘  └───────────────────────┘  └──────────────────┘  │
│  ┌──────────────────────────────────────────────────┐  ┌──────────────────┐  │
│  │       3-Tier Resilient Persistence Architecture  │  │ Google Auth API  │  │
│  │      KV First ➔ Drive Properties ➔ RAM/Env       │  │ Edge JWT Renewal │  │
│  └──────────────────────────────────────────────────┘  └──────────────────┘  │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │ Official REST API v3
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│          Google Drive (Personal My Drive / Shared Drives / Shortcuts)       │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 1. Dual-Phase Playback Watchdog
To eliminate the chronic issue of video playing with audio but a black screen on Chrome (typically with MKV / HEVC / DTS files), the player implements a dual-phase detection engine:
- **Phase 1 (Static Pre-Flight Inspection)**: Pre-checks container formats and codec names. Non-web-friendly containers (AVI, WMV, RMVB, ISO) or WebKit/Safari environments encountering MKV are immediately routed to Google Cloud preview.
- **Phase 2 (Dynamic Runtime Watchdog)**: While launching Artplayer, the engine monitors video frame rendering. If audio plays for 0.3s without video frames (`hasVideo === false`), a 2.0s fast watchdog triggers failover. A secondary 4.0s check catches stalled pipelines (`readyState < 2` or `video.error`), transitioning smoothly with a non-intrusive toast notification.
- **Zero-Occlusion Viewport**: By applying precise 56px negative margin offset clipping, the native pop-out icon in Google's preview is moved out of view without relying on brittle overlay `div` masks, preserving native hardware-accelerated playback and full-screen interaction.

### 2. Resilient 3-Tier Metadata Engine
Deploying Cloudflare Drive Player requires no database setup or monthly bills:
- **Tier 1 (Global Edge KV)**: Reads and writes configurations via Cloudflare KV with single-digit millisecond latency worldwide when bound.
- **Tier 2 (Google Drive Root Properties)**: When KV is not configured, configuration changes (site title, subtitle, visitor passwords) automatically persist to private Google Drive root folder metadata properties. This **consumes zero Google Drive storage quota** and survives across redeployments.
- **Tier 3 (In-Memory & Environment Fallback)**: Initial variables load from Cloudflare environment secrets, ensuring the application remains available under any circumstance.

### 3. Responsive Typography & Mobile Adaptation (`card-title-v3`)
- **CJK Boundary Handling**: Leverages `word-break: break-all; overflow-wrap: anywhere; line-break: anywhere;` to prevent titles from prematurely wrapping on CJK characters.
- **Strict Two-Line Budget**: Card titles are locked to a predictable 40px height with a 2px visual buffer, keeping directory grid cards perfectly aligned.
- **Mobile Single-Column Stream**: Automatically shifts to a spacious single-column card layout on viewports below 640px, providing expansive cover art (>340px width) and optimal touch targets.

### 4. Decoupled Two-Tier Action Footers
- Card footers cleanly separate file metadata (size and modification timestamp) on the top tier from secondary tags and action buttons on the bottom tier.
- Metadata remains visible and uncompromised regardless of the number of action buttons added by administrator privileges.

---

## 🎨 Comprehensive Feature Suite

| Viewport Module | Core Capabilities |
| :--- | :--- |
| **Video Player (Artplayer)** | Direct streaming for MP4, WebM, FLV, HLS, and demuxed MKV; automated subtitle discovery with dynamic SRT/ASS to WebVTT conversion; persistent header dropdown to trigger local desktop players (PotPlayer, IINA, VLC, Infuse, MPV, ExoPlayer). |
| **Audio Studio** | Animated vinyl turntable interface, Hi-Res / Lossless indicators, millisecond-accurate synchronized lyrics (`.lrc`), **click-to-seek from lyrics**, and an integrated slide-out playlist drawer. |
| **Universal Document Viewer** | Responsive in-browser PDF preview without scaling distortion; formatted syntax preview for Markdown (`.md`), source code, JSON, and log files. |
| **Universal High-Speed Downloads** | Download buttons integrated into all media cards and viewports; full RFC 5987 compliance prevents filename character corruption; Google Docs, Sheets, and Slides export on the fly as standard Office files. |
| **Minimalist Dark Mode** | Slate 950 deep dark theme paired with brand accent styling and clean visual hierarchy. |
| **Management Dashboard** | Hot updates for site title, subtitle, and visitor access password; batch file management (regex/prefix rename, cross-folder move, trash) and permission management. |

---

## 🛠️ Technology Stack

- **Edge Runtime**: Cloudflare Pages / Pages Functions (V8 Edge Workers)
- **Upstream Storage Interface**: Google Drive REST API v3
- **Frontend Architecture**: Vanilla ES6+ JavaScript — zero heavy SPA framework dependencies for instant first-paint times
- **Styling & Design System**: Tailwind CSS (CDN JIT mode) + Lucide Icons
- **Media Engines**: Artplayer 5.x + Hls.js 1.x + Flv.js 1.x
- **Authentication & Cryptography**: Web Crypto API (`crypto.subtle` RS256 JWT signing directly at the edge)

---

## 🔒 Security & Privacy

1. **Zero Tracking & No Third-Party Cookies**: No advertising trackers, telemetry beacons, or profiling scripts.
2. **Strict Secret Isolation**: Private keys and administrator passwords remain inside Cloudflare encrypted environment variables and are never transmitted to client browsers.
3. **Edge Security Headers**: Injects Content Security Policy (CSP), `X-Content-Type-Options: nosniff`, and CORS headers to prevent clickjacking, MIME sniffing, and cross-origin abuse.

---

## 📜 License

This project is licensed under the **[MIT License](LICENSE)**. Contributions, suggestions, and pull requests are warmly welcomed!
