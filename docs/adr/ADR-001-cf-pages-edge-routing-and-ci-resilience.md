<div align="center">

# ADR-001: Cloudflare Pages Edge Routing Isolation & Resilient CI/CD Smoke Testing

<p align="center">
  <img src="https://img.shields.io/badge/Status-Accepted-success?style=flat" alt="Status: Accepted">
  <img src="https://img.shields.io/badge/Deciders-Software%20Architects%20%26%20DevOps-blue?style=flat" alt="Deciders">
</p>

<p align="center">
  <b>English</b> · <a href="ADR-001-cf-pages-edge-routing-and-ci-resilience_zh.md">简体中文</a>
</p>

</div>

---

## Status
Accepted

## Participants
- Lead: Software Architect
- Collaborators: Backend Architect, DevOps Engineer

---

## Context
During GitHub Actions pipeline execution (`run/39524993381`), an automated post-deploy smoke test (`node scripts/healthcheck.js`) failed immediately after a successful Cloudflare Pages deployment:
1. The deployment step exited with status code 0 and generated preview domain `https://c180e05c.cf-pages-drive-player.pages.dev`.
2. Probing just 73ms later, `GET /` and `GET /css/style.css` returned HTTP 500, whereas `GET /api/info` succeeded with HTTP 200 after 500ms.
3. Because the initial smoke test lacked retry mechanisms, it exited immediately with code 1, failing the workflow. When manually inspected seconds later, all endpoints were completely healthy (HTTP 200/204).

Investigation identified two core architectural causes:
- **Global Middleware Scope Anti-Pattern**: Root-level middleware (`functions/_middleware.js`) was intercepting pure static assets (HTML, CSS, JS, SVG), routing them through the Serverless Worker isolate runtime. During initial edge cold starts and asset map synchronization windows, static file requests triggered unhandled errors caught by middleware and returned as HTTP 500 JSON.
- **Anycast Convergence Delay & Brittle Probing**: Cloudflare Pages relies on global Anycast DNS propagation across edge PoPs. Control-plane deployment confirmation precedes full data-plane edge distribution by 2–5 seconds. A single-shot rigid probe failed to accommodate this convergence window.

---

## Decisions

We established the following architectural and infrastructure changes:

1. **Middleware Scope Narrowing & Edge Routing Isolation**:
   - Relocated root middleware from `functions/_middleware.js` to `functions/api/_middleware.js`, strictly limiting its execution boundary to `/api/*` requests.
   - Added `public/_routes.json` with `include: ["/api/*"]`, instructing Cloudflare Pages at the edge layer to bypass Functions entirely for static files.
   - **Benefit**: Static assets are served 100% via Cloudflare's Anycast CDN with sub-20ms TTFB, zero cold start overhead, and zero consumption of daily Worker request quotas.

2. **Resilient Smoke Testing with Exponential Backoff**:
   - Refactored `scripts/healthcheck.js` to introduce edge readiness polling (`waitForEdgeReadiness`) and exponential backoff retries (up to 4 attempts: 1.5s -> 2.25s -> 3.37s).
   - Enhanced observability: Logs status codes, Cloudflare `CF-Ray` tracing headers, and error snippets during retries for rapid diagnostic insight.

3. **Pipeline Orchestration Alignment**:
   - Maintained clean separation between Stage 1 (Quality & Security Gate) and Stage 2 (Deployment & Smoke Testing).

---

## Alternatives & Tradeoff Analysis

| Alternative | Pros | Cons | Verdict |
| :--- | :--- | :--- | :--- |
| **Option A: Add a fixed `sleep 10` before CI smoke tests** | Minimal change (one line in YAML). | Blind wait anti-pattern. Fails on very slow network spikes and wastes CI minutes when edge propagation is fast. Does not resolve static asset Worker quota consumption. | **Rejected** |
| **Option B: Retain root middleware but filter URL paths in code** | Keeps routing logic in a single file. | Static requests still wake Worker isolates, causing cold starts and consuming invocation quotas without CDN passthrough benefits. | **Rejected** |
| **Option C (Adopted): Relocate middleware to `functions/api/` + `_routes.json` isolation + Adaptive retries** | Clear separation of concerns. Static assets achieve zero-cost CDN caching; API routes enjoy unified CORS and error handling; smoke testing withstands distributed propagation latency. | Requires adjusting folder structure and adding standard routing configuration. | **Adopted** |

---

## Consequences

- **Positive Outcomes**:
  - **Performance & Availability**: Shorter time-to-first-byte (TTFB) for web assets, shielded from cold starts and execution limits.
  - **CI/CD Reliability**: Eradicates false-negative build failures caused by distributed edge DNS convergence latencies.
  - **Architectural Clarity**: Strictly demarcates the boundary between the static UI presentation layer and edge API microservices.
- **Evolution Constraints**:
  - Any future dynamic routes outside `/api/*` (such as custom SSR endpoints or edge rewrites) must be explicitly registered in `public/_routes.json`.
