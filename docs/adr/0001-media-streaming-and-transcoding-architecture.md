<div align="center">

# ADR-0001: Media Streaming Architecture, Transcoding Fallback & Edge Authentication

<p align="center">
  <img src="https://img.shields.io/badge/Status-Accepted-success?style=flat" alt="Status: Accepted">
  <img src="https://img.shields.io/badge/Deciders-Software%20%26%20Backend%20Architects-blue?style=flat" alt="Deciders">
</p>

<p align="center">
  <b>English</b> · <a href="0001-media-streaming-and-transcoding-architecture_zh.md">简体中文</a>
</p>

</div>

---

## Status
Accepted

## Context
Cloudflare Drive Player is a lightweight Google Drive directory indexer and media streaming proxy built on Cloudflare Pages (V8 Functions) and Google Cloud Service Account credentials.
In production usage, users reported that "one-click cloud transcoding preview does not work, whereas opening previews on Google Drive directly functioned as expected."
Architectural investigation revealed three structural issues:
1. **Misleading Transcoding Guarantees & Dual-Auth Desynchronization**:
   The edge backend (Cloudflare Pages Functions) does not maintain an FFmpeg transcoding pipeline. The frontend feature labeled "one-click cloud transcoding" was actually embedding Google Drive's web preview iframe (`https://drive.google.com/file/d/${id}/preview`).
   - The backend streaming proxy authenticates with Google Drive via a Service Account Bearer Token, allowing access to private files.
   - However, the Google Drive Web Preview iframe runs client-side inside the user's browser, relying on the user's personal Google session cookie. When a file lacks "Anyone with the link can view" permissions, Google returns an HTTP 302 redirecting to `accounts.google.com/ServiceLogin`.
   - The Google login page sends `X-Frame-Options: DENY`. When combined with restrictive sandboxes or overlay masks, the browser blocked iframe rendering completely, resulting in a black or white blank screen.
2. **Streaming and Download Authorization Bypasses**:
   Earlier iterations only verified visitor passwords within `/api/list`, while `/api/stream/[id]` and `/api/download/[id]` lacked token verification, exposing files to unauthorized direct access.
3. **Google API Rate Limiting & Concurrency Spikes**:
   Unbounded parallel API requests (`Promise.all`) querying directory stats inside `/api/list` frequently triggered HTTP 429 rate limit errors from Google.

---

## Architecture Decisions

### 1. Multi-Tier Playback Architecture
Rather than relying on a monolithic transcoding assumption, we establish a deterministic multi-tier playback matrix:
- **Tier 1 (Native Direct Stream + HTTP 206 Range Passthrough)**:
  For browser-supported codecs (H.264, AAC, MP4, WebM), Cloudflare Pages edge nodes proxy byte-range requests directly via `HTTP 206 Partial Content`, providing instantaneous, zero-transcode playback.
- **Tier 2 (Google Official Transcoding Preview - Repaired & Permission-Guaranteed)**:
  - Provide an `ensure_public` action in the admin console to apply `anyoneWithLink: viewer` permissions via Google Drive API with a single click, eliminating 302 login redirects.
  - Apply clean CSS negative margin clipping to eliminate popups and remove physical overlay masks that interfere with user interaction.
- **Tier 3 (Protocol-Based Local Desktop Player Launch)**:
  - For high-bitrate MKV containers, 10-bit HEVC, HDR, and commercial DTS/TrueHD tracks unsupported by browser decoders, standard URL schemes (`potplayer://`, `vlc://`, `iina://`, `mpv://`) launch native desktop media players to pull direct byte-range streams with hardware decoding.
- **Tier 4 (Future Roadmap: Edge Slicing & Dedicated Transcoding Workers)**:
  - Future expansion can explore Cloudflare Stream or containerized transcoding workers if required.

### 2. Defense-in-Depth Authentication
- Enforce dual-token validation (Visitor Access Token + Admin Token) across the unified edge gateway and media routes (`/api/stream/[id]`, `/api/download/[id]`, `/api/list`).
- Support both `Authorization: Bearer <token>` headers and URL query parameters (`?token=<token>`) to accommodate HTML5 `<video>` tags and desktop players incapable of setting custom request headers.
- Utilize constant-time byte comparisons via Web Crypto (`timingSafeEqual`) to prevent timing side-channel attacks on secret credentials.

### 3. API Throttling & Concurrency Pool
- Implement a worker concurrency limiter (`CONCURRENCY_LIMIT = 5`) inside `/api/list` to smooth traffic bursts and prevent HTTP 429 errors from Google Drive.

---

## Rejected Alternatives

1. **Option A: WebAssembly FFmpeg Transcoding Inside Cloudflare Workers**
   - **Reason for Rejection**: Cloudflare Workers enforce CPU time execution limits (50ms to 30s) and 128MB of memory per isolate. Real-time video re-encoding (e.g., 1080p HEVC to H.264) demands significant CPU and memory resources that far exceed serverless limits, leading to out-of-memory crashes and execution timeouts.
2. **Option B: Remove Google Preview Entirely and Force All Complex Media to External Desktop Players**
   - **Reason for Rejection**: Mobile and casual web users expect out-of-the-box playback without installing native software. Correctly configured Google previews remain the most cost-effective and accessible zero-ops fallback.

---

## Consequences & Evolution Constraints
1. **External Player Token Lifetime**: Query string tokens (`?token=...`) must remain valid throughout long media playback sessions, or support dedicated media-scoped ticket tokens.
2. **Google Drive Download Quotas**: Google Drive enforces daily download quota ceilings on single files. Ultra-high-traffic deployments should plan for multi-account key rotation or Cloudflare R2 caching tiers.
