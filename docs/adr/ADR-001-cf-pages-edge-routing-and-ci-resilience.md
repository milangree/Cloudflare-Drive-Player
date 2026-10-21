# ADR-001: Cloudflare Pages 边缘路由隔离与 CI/CD 冒烟测试弹性重试策略

## 状态
已接受 (Accepted)

## 参与角色
- 主导：软件架构师 (engineering-software-architect)
- 协同：后端架构师 (engineering-backend-architect)
- 关联：DevOps 工程师 (engineering-devops-automator)

## 背景
在 GitHub Actions 运行记录 (`run/39524993381`) 中，CI/CD 流水线在完成 Cloudflare Pages 部署后立即执行冒烟测试 (`node scripts/healthcheck.js`)，遭遇以下故障：
1. 部署步骤已完成并输出预览域名 `https://c180e05c.cf-pages-drive-player.pages.dev`（Wrangler 退出状态码为 0）。
2. 在部署完成仅 73ms 后发起的冒烟测试中，`GET /` 和 `GET /css/style.css` 均收到 HTTP 500 错误，而 500ms 后的 `GET /api/info` 却成功返回 HTTP 200。
3. 冒烟测试在无重试机制下直接以退出码 1 退出，导致整条流水线被判定为失败。然而数秒后手动探测该站点，所有端点均已恢复正常 (HTTP 200/204)。

经过架构与网络链路排查，定位到两层核心设计缺陷：
- **微服务/边缘中间件拦截范围反模式 (Global Middleware Scope Anti-Pattern)**：全局中间件 `functions/_middleware.js` 部署在根层级，导致纯静态资源（HTML、CSS、JS、SVG）被强制经过 Serverless Worker 运行时拦截与重新包装。在部署初期的边缘冷启动与资产映射同步窗口期，静态资源访问容易触发未捕获异常并被中间件降级为 HTTP 500 JSON 错误。
- **分布式边缘收敛延迟与冒烟探测脆弱性 (Anycast Convergence Delay & Brittle Probing)**：Cloudflare Pages 依赖全球 Anycast DNS 与边缘 PoP 节点同步。部署完成指令仅代表控制面提交成功，数据面资产分发存在 2~5 秒的收敛窗口。原健康检查脚本属于单次刚性探测，缺乏弹性重试机制。

## 决策
我们做出以下架构设计与基础设施调整决策：

1. **中间件关注点下沉与边缘路由隔离**：
   - 将原位于根路径的 `functions/_middleware.js` 迁移至 `functions/api/_middleware.js`，严格限制中间件的生效范围仅覆盖 `/api/*` 接口。
   - 增加 `public/_routes.json` 显式路由清单，声明 `include: ["/api/*"]`，从 Cloudflare Pages 边缘底层将所有静态资源彻底排除在 Functions 计算调度之外。
   - 收益：静态资源 100% 走 Cloudflare 边缘 CDN 零开销直通传输，不仅彻底消除静态资源被 Worker 异常拖垮的风险，还节省了每日 Worker 请求计费额度，并使首屏加载具备极致缓存特性。

2. **CI/CD 冒烟测试韧性化 (Resilient Smoke Testing)**：
   - 重构 `scripts/healthcheck.js`，引入“预热探测 (Readiness Check)”与“指数退避重试 (Exponential Backoff & Retry)”模式（默认最多重试 4 次，退避间隔 1.5s -> 2.25s -> 3.37s）。
   - 增强诊断可观测性：在重试与失败时，打印 HTTP 状态码、Cloudflare `CF-Ray` 追踪标头及响应正文摘要，提供清晰的调试上下文。

3. **流水线编排平滑适配**：
   - 保持 CI/CD 阶段 1（质量与安全门禁）与阶段 2（部署与冒烟）的清晰阶段划分，确保依赖审计与静态检查不被绕过。

## 备选方案与权衡分析

| 方案 | 优点 | 缺点 | 裁决 |
| :--- | :--- | :--- | :--- |
| **方案 A：仅在 CI 脚本前加固定 `sleep 10`** | 改动极小，仅需修改 YAML 一行。 | 属于盲目等待反模式；网络极慢时仍可能失败，网络快时浪费构建时长；未解决静态资源消耗 Worker 配额与中间件耦合的架构缺陷。 | **否决** |
| **方案 B：保持根中间件，但在中间件内做 URL path 判断排除静态资源** | 依然集中在单一中间件文件中控制逻辑。 | 静态请求依然会被 Worker 唤醒（产生 Worker 启动耗时与请求配额消耗），无法利用 Cloudflare 边缘 CDN 的静态直通优势。 | **否决** |
| **方案 C（采纳）：中间件下沉至 `functions/api/` + 配合 `_routes.json` 隔离 + 冒烟测试自适应重试** | 架构职责清晰；静态走 CDN 零成本零故障，API 走 Worker 享用统一 CORS 与错误保护；冒烟测试具备分布式容灾弹性，兼顾速度与可靠性。 | 需要微调目录结构及增加一个标准路由配置文件。 | **采纳** |

## 影响
- **正面影响**：
  - 系统可用性与性能提升：静态资源首字节时间 (TTFB) 缩短，彻底免受 Functions 边缘冷启动与配额限制。
  - 流水线稳定性大幅提升：彻底消除由于边缘 Anycast 毫秒级传播时差造成的虚假告警 (False Negative CI Failure)。
  - 架构清晰：符合领域驱动设计与关注点分离原则，明确了静态 UI 层与边缘计算 API 层的边界。
- **后续演进约束**：
  - 未来若增加非 `/api` 开头的自定义动态路由（如动态重定向或 SSR 路由），须在 `public/_routes.json` 中的 `include` 列表中同步显式声明。
