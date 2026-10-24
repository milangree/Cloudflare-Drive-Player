<div align="center">

# Cloudflare Drive Player

> A lightweight, enterprise-grade Google Drive directory indexer and multi-format media streaming hub powered by **Cloudflare Pages Functions** and the **Google Drive API (Service Account)**.

<p align="center">
  <a href="https://pages.cloudflare.com/"><img src="https://img.shields.io/badge/Platform-Cloudflare%20Pages-f38020?style=flat&logo=cloudflare" alt="Cloudflare Pages"></a>
  <a href="https://developers.google.com/drive/api"><img src="https://img.shields.io/badge/Storage-Google%20Drive-4285F4?style=flat&logo=googledrive" alt="Google Drive"></a>
  <img src="https://img.shields.io/badge/Runtime%20Dependencies-Zero-emerald?style=flat" alt="Zero Runtime Dependencies">
  <img src="https://img.shields.io/badge/Frontend-Tailwind%20%2B%20ArtPlayer-0ea5e9?style=flat" alt="Frontend Stack">
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT-blue.svg?style=flat" alt="License: MIT"></a>
</p>

<p align="center">
  <b>English</b> · <a href="README_zh.md">简体中文</a>
</p>

</div>

---

## 📑 Table of Contents

- [1. Positioning & Core Highlights](#1-positioning--core-highlights)
- [2. Key Features](#2-key-features)
  - [2.1 Edge-Driven & Zero Runtime Dependencies](#21-edge-driven--zero-runtime-dependencies)
  - [2.2 Modern Artplayer Media Viewport](#22-modern-artplayer-media-viewport)
  - [2.3 Dual-Phase Failover Watchdog & Smart Source Routing](#23-dual-phase-failover-watchdog--smart-source-routing)
  - [2.4 Playback Resume & Progress Memory](#24-playback-resume--progress-memory)
  - [2.5 Vinyl Audio Studio with Synchronized Lyrics](#25-vinyl-audio-studio-with-synchronized-lyrics)
  - [2.6 Universal Document Viewer (PDF / Markdown / Code)](#26-universal-document-viewer-pdf--markdown--code)
  - [2.7 High-Speed Original File Downloads](#27-high-speed-original-file-downloads)
  - [2.8 Minimalist Dark Mode Viewport](#28-minimalist-dark-mode-viewport)
  - [2.9 Admin Panel & Lifecycle File Operations](#29-admin-panel--lifecycle-file-operations)
  - [2.10 Multi-Drive Mounting & Shortcut Passthrough](#210-multi-drive-mounting--shortcut-passthrough)
  - [2.11 Telegram Media Transfer Bot](#211-telegram-media-transfer-bot)
- [3. Quick Start (5-Minute Deployment)](#3-quick-start-5-minute-deployment)
  - [3.1 Cloudflare Pages One-Click Setup](#31-cloudflare-pages-one-click-setup)
  - [3.2 Environment Variables Reference](#32-environment-variables-reference)
  - [3.3 Cloudflare KV Binding (Optional Acceleration)](#33-cloudflare-kv-binding-optional-acceleration)
- [4. Google Cloud Credentials & Permissions](#4-google-cloud-credentials--permissions)
  - [4.1 Create a GCP Service Account & Keys](#41-create-a-gcp-service-account--keys)
  - [4.2 Share Google Drive Folder (Crucial Step)](#42-share-google-drive-folder-crucial-step)
  - [4.3 Admin Settings & Site Access Control](#43-admin-settings--site-access-control)
- [5. Troubleshooting & FAQ](#5-troubleshooting--faq)
  - [Q1: Black screen with audio, playback stutter, or unsupported codec?](#q1-black-screen-with-audio-playback-stutter-or-unsupported-codec)
  - [Q2: Google credentials error / 403 Forbidden / invalid_grant / 10000?](#q2-google-credentials-error--403-forbidden--invalid_grant--10000)
  - [Q3: Seeking causes freeze or returns HTTP 416 Range Not Satisfiable?](#q3-seeking-causes-freeze-or-returns-http-416-range-not-satisfiable)
  - [Q4: Does running without KV affect persistence? How does 3-tier storage work?](#q4-does-running-without-kv-affect-persistence-how-does-3-tier-storage-work)
  - [Q5: "Quota: 0" or storageQuotaExceeded error when uploading files?](#q5-quota-0-or-storagequotaexceeded-error-when-uploading-files)
  - [Q6: How do I launch external players (PotPlayer, IINA, VLC, Infuse, MPV)?](#q6-how-do-i-launch-external-players-potplayer-iina-vlc-infuse-mpv)
  - [Q7: Telegram bot returns 401 / 无操作权限 / 20MB limit?](#q7-telegram-bot-returns-401--无操作权限--20mb-limit)
- [6. Architecture Overview](#6-architecture-overview)
- [7. Local Development & Quality Gates](#7-local-development--quality-gates)
- [8. Documentation Index & Acknowledgements](#8-documentation-index--acknowledgements)
- [9. License](#9-license)

---

## 1. Positioning & Core Highlights

| What It Is | What It Is Not |
| :--- | :--- |
| **Edge-Driven Directory Index & Media Streaming Proxy**: Forwards byte-range requests directly through Cloudflare Pages edge nodes for low-latency streaming. | **Heavyweight Transcoding Server**: Edge nodes do not run FFmpeg. Unconventional codecs seamlessly trigger Google Cloud transcoding preview or open in local players. |
| **Zero-Ops Serverless Architecture**: No VPS, containers, or dedicated databases. Zero maintenance overhead post-deployment. | **Cloud Storage Provider**: Files reside securely in your Google Drive. This project does not store or mirror your data on third-party servers. |
| **Immersive Multi-Format Media Hub**: Smooth playback for video, vinyl-styled audio with rolling lyrics, PDF/Markdown reading, and batch file management. | **Multi-Tenant SaaS Platform**: Uses an efficient, lightweight "Visitor Access Token + Admin Token" security model. |

---

## 2. Key Features

### 2.1 Edge-Driven & Zero Runtime Dependencies
- **Zero Runtime npm Dependencies**: Clean production runtime with no external npm packages (Wrangler is kept as a dev dependency only), eliminating supply chain vulnerabilities and runtime bloat.
- **Native Web Crypto API Authentication**: Utilizes `crypto.subtle` inside Cloudflare Workers to sign RS256 PKCS#8 JWTs, exchanging them directly for Google Drive access tokens with a proactive 300-second cache window.
- **Physical Routing Isolation**: Static assets (HTML, CSS, JS, SVG) are served directly from Cloudflare Anycast CDN caches via `public/_routes.json` rules, ensuring worker cold starts never degrade static asset loading.

### 2.2 Modern Artplayer Media Viewport
- **Modern HTML5 Engine**: Powered by Artplayer, featuring Picture-in-Picture, full-screen playback, screenshot capture, aspect ratio controls, mini progress bar, and subtitle-audio synchronization.
- **Broad Format Support**:
  - **MP4 / WebM / MOV**: Native browser hardware-accelerated playback.
  - **HLS (.m3u8)**: Integrated Hls.js stream decoding.
  - **FLV (.flv)**: Integrated Flv.js stream decoding.
  - **MKV (.mkv)**: Dedicated `video/x-matroska` MIME handling, native demuxing, and low-level decode error interception.
- **External Subtitles & Dynamic Conversion**: Automatically discovers `.vtt`, `.srt`, and `.ass` subtitles with matching names in the same folder. Dynamically converts SRT and ASS into WebVTT in the browser, complete with real-time `±0.5s` timeline adjustment.
- **Intelligent Episode Sequencing**: Naturally sorts episode filenames to enable automatic "Play Next" and quick previous/next navigation.

### 2.3 Dual-Phase Failover Watchdog & Smart Source Routing
Web browsers have limited native support for HEVC/H.265 10-bit, MKV containers, and proprietary audio codecs (DTS, Dolby Atmos, AC3, EAC3, TrueHD). Cloudflare Drive Player solves this with a **Dual-Phase Smart Failover Engine**:
1. **Phase 1 · Static Pre-Flight Inspection**: Inspects container format and codecs before instantiating the player. Blacklisted extensions (e.g., AVI, WMV, RMVB, ISO) or MKV on Safari immediately route to Google Cloud transcoding preview.
2. **Phase 2 · Dynamic Dual-Phase Watchdog**:
   - **2.0s Fast Watchdog**: Detects the classic "audio playing but video frames stuck on black (`hasVideo === false`)" Chrome MKV decode glitch and automatically falls back within 2 seconds.
   - **4.0s Deep Safety Net**: Monitors `video.error`, `readyState < 2`, and playback stall states, smoothly transitioning to cloud transcoding with a clear toast notification.
   - **Seamless Toggling**: A persistent control button lets you switch back and forth between "Google Transcoded Preview" and "Original Direct Stream" at any time.
3. **Zero-Occlusion Viewport**: Google preview utilizes precise CSS offset clipping to hide top bars without transparent overlay masks, maintaining full iframe interaction and DRM support.

### 2.4 Playback Resume & Progress Memory
- Automatically records playback progress per video file in `localStorage` with intelligent throttling.
- Resumes where you left off upon reopening, accompanied by a clean notification with a one-click "Play from Beginning" button.

### 2.5 Vinyl Audio Studio with Synchronized Lyrics
- **Immersive Vinyl Experience**: Dedicated audio player for MP3, FLAC, WAV, AAC, OGG, and M4A with animated vinyl turntable rotation and Hi-Res / Lossless indicators.
- **Real-Time Rolling Lyrics**: Automatically matches同名 `.lrc` files in the directory, highlighting lines with millisecond precision and supporting **click-to-seek directly from lyrics**.
- **In-Folder Queue**: Generates playback queues from audio tracks in the current folder, supporting repeat, shuffle, and next/previous track controls.

### 2.6 Universal Document Viewer (PDF / Markdown / Code)
- **Responsive PDF Reader**: Full-screen, high-fidelity PDF rendering without scaling distortion.
- **Markdown & Code Formatter**: Syntax-highlighted and styled preview for `.md`, `.txt`, `.json`, `.log`, and source code files.
- **Persistent Download**: Integrated header download button allows offline saving at any time.

### 2.7 High-Speed Original File Downloads
- **RFC 5987 Compliant Filename Encoding**: Employs `filename*=UTF-8''...` header encoding to guarantee non-ASCII (CJK, umlauts, symbols) and long filenames download without corruption across all operating systems.
- **Automatic Google Docs Export**: Converts Google Docs, Sheets, and Slides into standard `.docx`, `.xlsx`, `.pptx`, and `.pdf` streams on the fly.
- **Accessible Across the UI**: Download buttons are built into video controls, audio player, document viewer, context menus, and batch toolbars.

### 2.8 Minimalist Dark Mode Viewport
- **Aesthetic**: Deep Slate dark theme with brand accent highlights and glassmorphism styling.
- **4-in-1 Header Standard**: The player window header is streamlined to 4 essential controls: filename (with truncation, tooltip, and copy-all), local player launcher, maximize/restore, and close.

### 2.9 Admin Panel & Lifecycle File Operations
- **Hot-Reloadable Configuration**: Update site title, subtitle, visitor password, and administrator credentials on the fly without redeploying.
- **3-Tier Resilient Persistence**: Tries Cloudflare KV first; falls back seamlessly to Google Drive root folder metadata properties (permanent storage with zero quota consumption); and finally falls back to in-memory/environment defaults.
- **Batch Operations (OpenList Paradigm)**:
  - Clean directory view with checkboxes hidden by default; single click toggles row selection once multi-select is enabled.
  - Floating bottom bar with select-all, invert, and selection counters.
  - Supports batch rename (regex, prefix/suffix, sequential numbering), batch move, and batch trash.
- **Complete File Lifecycle**: Folder creation, single-item rename/move, soft-delete to Trash, permanent delete, and one-click "Make Anyone with Link a Viewer" permission fixes.

### 2.10 Multi-Drive Mounting & Shortcut Passthrough
- Supports mounting both personal "My Drive" folders and Google Workspace "Shared Drives".
- **Google Drive Shortcut Passthrough**: Leverages Google Drive's native "Add Shortcut" feature to consolidate folders from multiple drives or external accounts into a single root folder. The backend transparently follows target IDs.

---

### 2.11 Telegram Media Transfer Bot
- Forward any **video, audio, document, photo, or voice message** straight from Telegram into your Google Drive via the official Drive API — the bot relays the transfer at the edge.
- **Secret-token source verification**: when `TELEGRAM_WEBHOOK_SECRET` is set, every delivery must carry the matching `X-Telegram-Bot-Api-Secret-Token` header (constant-time comparison); mismatches get **401**.
- **Fail-closed allowlist**: an empty allowlist denies all uploads, so a publicly reachable endpoint can never be abused by strangers.
- **20 MB ceiling, checked first**: Telegram's `getFile` limit is enforced *before* any outbound request.
- **Idempotent transfers**: keyed on Telegram's `file_unique_id` (stored in Drive `appProperties`), so a Telegram retry never creates a duplicate file.
- **Deep links**: successful transfers return an in-site link (`?file=<id>`) plus a direct download URL.
- **Self-diagnostics**: test Bot connectivity and run an end-to-end upload probe from the admin panel.
- Full guide: [docs/telegram-integration.md](docs/telegram-integration.md)

---

## 3. Quick Start (5-Minute Deployment)

### 3.1 Cloudflare Pages One-Click Setup

1. **Fork or Clone**: Push this repository to your GitHub or GitLab account.
2. **Open Cloudflare Dashboard**:
   - Navigate to **Workers & Pages** -> **Create application** -> **Pages** -> **Connect to Git**.
3. **Configure the Project**:
   - Select your repository.
   - **Framework preset**: `None`.
   - **Build command**: *Leave empty* (no build step required).
   - **Build output directory**: `public`.
4. **Add Environment Variables**: Expand **Environment variables**, populate the required secrets listed below, and click **Save and Deploy**.

### 3.2 Environment Variables Reference

| Variable | Required | Description & Example |
| :--- | :---: | :--- |
| **`CLIENT_EMAIL`** | **Yes** (Method A) | Service account email, e.g., `xxx@project-id.iam.gserviceaccount.com` |
| **`PRIVATE_KEY`** | **Yes** (Method A) | Full RSA private key starting with `-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----` |
| **`SERVICE_ACCOUNT_JSON`** | **Yes** (Method B) | Full JSON credentials string from GCP. Choose either Method A or Method B |
| **`ROOT_FOLDER_ID`** | **Recommended** | Google Drive root folder ID. Defaults to service account `root` if omitted |
| **`ADMIN_PASSWORD`** | **Recommended** | Admin dashboard password. Defaults to `admin` in code; strongly recommended to set a custom string |
| **`JWT_SECRET`** | **Recommended** | Salt for signing access and admin tokens (recommended: 32+ random characters) |
| **`SITE_NAME`** | No | Site title, e.g., `My Media Cloud` (can also be updated from the admin panel) |
| **`SITE_SUBTITLE`** | No | Subtitle or tagline displayed under the title |
| **`REQUIRE_ACCESS_PASSWORD`** | No | Set to `true` to require a visitor access password site-wide (default: `false`) |
| **`ACCESS_PASSWORD`** | No | Visitor access password when protection is enabled |

> **Tip**: To ensure consistency across environments, define these variables for both **Production** and **Preview**. For local development, copy [.env.example](.env.example) to `.dev.vars`, which `npx wrangler pages dev public` loads automatically.

### 3.3 Cloudflare KV Binding (Optional Acceleration)

The system automatically writes configuration to Google Drive root folder metadata properties when KV is not bound, **providing full persistence out of the box**.  
To benefit from sub-millisecond global edge caching for configs and passwords, bind a KV namespace:

#### Option 1: Via the Cloudflare Dashboard
1. Go to **Workers & Pages → KV**, click **Create a namespace**, and name it `drive_player_kv`.
2. Open your Pages project settings: **Settings → Functions → KV namespace bindings**.
3. Click **Add binding**:
   - **Variable name**: Enter **`DRIVE_KV`** (must be uppercase).
   - **KV namespace**: Select the namespace created above.
4. Trigger a new deployment for changes to take effect.

#### Option 2: Via `wrangler.toml`
If deploying via automated CI/CD, uncomment and set your KV namespace ID in [wrangler.toml](wrangler.toml):

```toml
[[kv_namespaces]]
binding = "DRIVE_KV"
id = "6234abcd5678ef901234567890abcdef" # Replace with your real KV namespace ID
```

---

## 4. Google Cloud Credentials & Permissions

### 4.1 Create a GCP Service Account & Keys

To allow Cloudflare Pages to access your Google Drive, create a service account in Google Cloud Platform:

1. **Create a GCP Project**:
   - Visit the [Google Cloud Console](https://console.cloud.google.com/).
   - Click the project dropdown at the top, select **New Project**, enter a name (e.g., `cf-drive-player`), and create it.
2. **Enable Google Drive API**:
   - Go to **APIs & Services → Library**.
   - Search for `Google Drive API`, click it, and click **Enable**.
3. **Create a Service Account**:
   - Go to **APIs & Services → Credentials**, click **Create Credentials → Service Account**.
   - Enter a name (e.g., `drive-viewer`), and click **Create and Continue**.
   - Roles can be left blank (permissions are assigned via folder sharing). Click **Done**.
4. **Generate Private Key**:
   - Click the newly created service account to open its details.
   - Switch to the **Keys** tab, click **Add Key → Create new key**.
   - Select **JSON** and click **Create**. The key file will download automatically.
   - Keep note of `client_email` and `private_key` inside the JSON.

---

### 4.2 Share Google Drive Folder (Crucial Step)

> ⚠️ **Most Common Oversight**: A Service Account is an isolated virtual identity. It cannot see any files in your personal drive by default. You **must explicitly share** your target folder with the service account!

1. Open [Google Drive](https://drive.google.com/drive/).
2. Create or navigate to the folder you wish to mount (e.g., "My Media Vault").
3. Right-click the folder and choose **Share → Share**.
4. Paste the **Service Account email (`client_email`)** into the invitation box.
5. Select the permission level:
   - For read-only browsing, streaming, and downloading: set to **Viewer**.
   - For file operations (rename, move, create folder, trash): set to **Content Manager** or **Editor**.
6. Uncheck "Notify people" (virtual accounts cannot receive emails) and confirm **Share**.
7. Extract the root folder ID:
   - Open the shared folder in your browser and check the address bar URL:  
     `https://drive.google.com/drive/folders/1-3i7VNCMLtTfkWxWpSemjUIvdwNLCi6l`
   - The trailing segment `1-3i7VNCMLtTfkWxWpSemjUIvdwNLCi6l` is your `ROOT_FOLDER_ID`.

---

### 4.3 Admin Settings & Site Access Control

1. **Access Admin Panel**:
   - Visit your deployed site and click the gear icon in the top-right corner.
   - Enter your `ADMIN_PASSWORD` (default: `admin`) to log in.
2. **General Settings**:
   - **Site Title (`siteName`)**: Updates the main brand title displayed in the header.
   - **Subtitle (`siteSubtitle`)**: Updates the secondary tagline.
3. **Visitor Access Control**:
   - Toggle "Enable Site-Wide Access Password" and set a visitor password.
   - Once saved, unauthenticated users will be prompted for this password, and all directory listing/media streaming requests will require authentication.
4. **Change Admin Password**:
   - Update the admin password directly in the dashboard. The system immediately re-issues admin tokens without requiring redeployment.

---

## 5. Troubleshooting & FAQ

### Q1: Black screen with audio, playback stutter, or unsupported codec?

- **Causes**:
  1. **Audio plays but video is black**: The file is typically an MKV or MP4 containing **HEVC (H.265) 10-bit**, **VC-1**, or **MPEG-2**, and your current browser/OS lacks hardware decoding extensions.
  2. **Neither audio nor video plays**: The audio track uses proprietary formats (**DTS**, **TrueHD**, **AC3/E-AC3 Dolby Digital**) not licensed for native browser decoding.
  3. **Google Preview returns a 302 redirect**: Google Cloud transcoding was requested, but the file lacks public link permissions, causing Google's iframe to redirect to a Google login page.
- **Solutions**:
  - **Automatic Failover**: The built-in **Dual-Phase Watchdog** detects black screen states within 2 seconds and automatically transitions to Google Cloud transcoding preview.
  - **One-Click Public Authorization**: Log into the admin panel, find the file, and select "Make Anyone with Link Viewer" to lift Google's 302 login requirement.
  - **Launch Local Players**: Click the external player menu in the top bar to launch **PotPlayer**, **IINA**, **VLC**, **Infuse**, or copy the direct stream URL to **MPV** for hardware-accelerated local decoding.

---

### Q2: Google credentials error / 403 Forbidden / invalid_grant / 10000?

- **Causes**:
  1. Broken `PRIVATE_KEY` formatting or corrupted newline escape characters.
  2. Target folder not shared with the service account email.
  3. Cloudflare Pages edge configuration cache has not refreshed.
- **Solutions**:
  - **Verify Private Key**: Ensure `PRIVATE_KEY` begins with `-----BEGIN PRIVATE KEY-----` and ends with `-----END PRIVATE KEY-----`. If newline escapes get lost when pasting into the dashboard, use the single-line JSON string in `SERVICE_ACCOUNT_JSON` instead.
  - **Verify Folder Sharing**: Open Google Drive, check the root folder, and confirm `client_email` is listed under shared users.
  - **Redeploy**: In the Cloudflare Pages dashboard under **Deployments**, click **Retry deployment** on the latest build to re-inject variables.

---

### Q3: Seeking causes freeze or returns HTTP 416 Range Not Satisfiable?

- **Mechanism**:
  - Video seeking relies on HTTP 206 Partial Content. Requests send `Range: bytes=start-end`, and the edge proxy responds with `Content-Range: bytes start-end/total`.
  - [functions/api/stream/[id].js](functions/api/stream/[id].js) fully proxies `Accept-Ranges: bytes`, `Content-Range`, `Content-Length`, `ETag`, and `If-Range`.
- **Solutions**:
  - If a seek request exceeds total file size, Google Drive returns `416`. The edge handler intercepts this and returns a standard RFC 416 header to reset the client request.
  - Ensure any intermediate proxies or corporate firewalls do not strip HTTP Range headers.

---

### Q4: Does running without KV affect persistence? How does 3-tier storage work?

- **Verdict**: **The application works completely normally without KV.**
- **Storage Tier Breakdown**:
  1. **Tier 1 (Cloudflare KV)**: If `DRIVE_KV` is bound, configuration reads/writes sync globally with millisecond latency.
  2. **Tier 2 (Google Drive Properties)**: If KV is not bound, configurations are saved into private metadata properties (`properties.cf_sys_config`) of the root folder. This **does not consume Google Drive storage quota**, persists permanently, and survives redeployments.
  3. **Tier 3 (In-Memory & Environment Fallback)**: Initial system defaults are sourced from environment variables.

---

### Q5: "Quota: 0" or storageQuotaExceeded error when uploading files?

- **Cause**:
  - Google Cloud Service Accounts are virtual machine identities with **0 GB of dedicated free storage quota**.
- **Solutions**:
  - If you need write capabilities directly via the app, place your root folder inside a **Google Workspace Shared Drive**, which draws from enterprise organization storage.
  - Alternatively, upload files directly via the Google Drive web interface; the application will index them in real time.

---

### Q6: How do I launch external players (PotPlayer, IINA, VLC, Infuse, MPV)?

The player header includes an external player menu supporting the following protocols:

| Player | Protocol / Format | Supported Platforms |
| :--- | :--- | :--- |
| **PotPlayer** | `potplayer://<StreamUrl>` | Windows |
| **IINA** | `iina://weblink?url=<StreamUrl>` | macOS |
| **VLC** | `vlc://<StreamUrl>` | Windows / macOS / Linux |
| **Infuse** | `infuse://open?url=<StreamUrl>` | iOS / iPadOS / macOS / Apple TV |
| **MPV** | `mpv://<StreamUrl>` or run `mpv "<StreamUrl>"` | Cross-platform |
| **Android ExoPlayer** | `intent:<StreamUrl>#Intent;action=android.intent.action.VIEW;type=video/*;end` | Android Phone / Tablet / TV |

> **Note**: When site-wide visitor password protection is enabled, the external player URL automatically appends `?token=<token>` so streams authenticate seamlessly.

---

### Q7: Telegram bot returns 401 / 无操作权限 / 20MB limit?

| Symptom | Cause | Fix |
| :--- | :--- | :--- |
| Bot replies `无操作权限` | Sender is not in the allowlist | Add the numeric ID or `@username` to `TELEGRAM_ALLOWED_USERS` |
| Bot is silent on every file | Allowlist is empty (**fail-closed**) | Fill in `TELEGRAM_ALLOWED_USERS` |
| Telegram reports `last_error_message` | Secret mismatch or unreachable URL | Confirm `TELEGRAM_WEBHOOK_SECRET` matches on both sides; confirm the URL is public |
| `文件过大` on a 25 MB file | Telegram's 20 MB `getFile` limit | Compress/split the file, or upload it directly to Drive |
| Duplicate files after a retry | Idempotency key not stored | Confirm `appProperties` writes are allowed on the target folder |
| Quota error on upload | Service account has no own storage | Target a Shared Drive and grant manager rights |

---

## 6. Architecture Overview

```text
                           Client Browser / Third-Party Players
                                         │
                    ┌────────────────────┴────────────────────┐
                    ▼ (Static CDN Passthrough)                ▼ (/api/* Dynamic Functions)
           Cloudflare Edge CDN                     Cloudflare Pages Functions
        (HTML / CSS / JS / SVG)               ┌───────────────────────────────────┐
                    │                         │  functions/api/_middleware.js     │
                    │                         │  (Global CORS & Error Handling)   │
                    │                         └─────────────────┬─────────────────┘
                    │                                           │
                    │                    ┌──────────────────────┼──────────────────────┐
                    │                    ▼                      ▼                      ▼
                    │              /api/list.js           /api/stream/[id].js    /api/admin/*
                    │         (Listing/Search/Shortcut)   (HTTP 206 Range Proxy) (Admin Plane)
                    │                    │                      │                      │
                    │                    └──────────────┬───────┴──────────────────────┘
                    │                                   │
                    │                    ┌──────────────┴──────────────┐
                    │                    ▼                             ▼
                    │        functions/utils/googleAuth.js   functions/utils/configManager.js
                    │         (Web Crypto Native RS256 JWT)  (3-Tier: KV / Drive Meta / RAM)
                    │                    │                             │
                    ▼                    ▼                             ▼
            Anycast CDN Cache      Google Drive API v3           Cloudflare KV / Drive Properties
```

---

## 7. Local Development & Quality Gates

This repository includes automated static contract and security gate checks:

```bash
# 1. Clone repository
git clone https://github.com/yourname/Cloudflare-Drive-Player.git
cd Cloudflare-Drive-Player

# 2. Install dev dependencies (Wrangler)
npm install

# 3. Run all 7 automated quality gates
npm run test:syntax

# 4. Start local Cloudflare Pages preview
npx wrangler pages dev public
```

### Quality Gate Matrix (`scripts/ci-check.js`)
- **Step 1/7**: Native JavaScript AST syntax validation (zero tolerance for syntax defects).
- **Step 2/7**: Static asset presence and `public/_routes.json` edge isolation validation.
- **Step 3/7**: `wrangler.toml` output directory contract validation.
- **Step 4/7**: Streaming media HTTP 206 Range passthrough and MKV MIME contract validation.
- **Step 5/7**: Google preview zero-occlusion security sandbox and anti-popup gate verification.
- **Step 6/7**: Dual-phase adaptive fallback and smart source selection contract verification.
- **Step 7/7**: Minimalist 4-in-1 player header structure and edge security headers (CSP / nosniff) verification.

---

## 8. Documentation Index & Acknowledgements

### Technical Documentation
- [API Reference](docs/api-reference.md) ([简体中文](docs/api-reference_zh.md)) — Comprehensive endpoint parameters, status codes, authentication, and reproducible `curl` examples.
- [Player Architecture & User Guide](docs/player-architecture-and-user-guide.md) ([简体中文](docs/player-architecture-and-user-guide_zh.md)) — Failover state machine, viewport geometry clipping, and external player protocol guides.
- [CI/CD Deployment & Troubleshooting Guide](docs/ci-cd-deployment-guide.md) ([简体中文](docs/ci-cd-deployment-guide_zh.md)) — Dual-stage gates, edge readiness warmup, and incident runbooks.
- [ADR-0001: Media Streaming & Transcoding Architecture](docs/adr/0001-media-streaming-and-transcoding-architecture.md) ([简体中文](docs/adr/0001-media-streaming-and-transcoding-architecture_zh.md)) — Why edge realtime transcoding was rejected and multi-tier streaming design.
- [ADR-0002: Adaptive Playback Sandboxing & Minimalist Player](docs/adr/0002-adaptive-playback-sandboxing-and-minimalist-player.md) ([简体中文](docs/adr/0002-adaptive-playback-sandboxing-and-minimalist-player_zh.md)) — Zero-occlusion viewport and control plane convergence.
- [ADR-001: Edge Routing Isolation & CI Resilience](docs/adr/ADR-001-cf-pages-edge-routing-and-ci-resilience.md) ([简体中文](docs/adr/ADR-001-cf-pages-edge-routing-and-ci-resilience_zh.md)) — Routing separation and eliminating edge cold-start flakiness.
- [About & Project Vision](ABOUT.md) ([简体中文](ABOUT_zh.md)) — Design philosophy and complete feature suite overview.

### Acknowledgements
- [Cloudflare Pages & Workers](https://pages.cloudflare.com/) — High-performance serverless edge execution environment.
- [Google Drive API v3](https://developers.google.com/drive/api) — Reliable cloud storage and preview services.
- [ArtPlayer](https://artplayer.org/) — Feature-rich, customizable HTML5 web video player.
- [Tailwind CSS](https://tailwindcss.com/) — Utility-first styling framework.
- [OpenList](https://github.com/OpenListTeam/OpenList) — Inspiration for multi-selection patterns and smooth media interactions.
- [Lucide Icons](https://lucide.dev/) — Clean, consistent iconography.

---

## 9. License

This project is licensed under the [MIT License](LICENSE).
