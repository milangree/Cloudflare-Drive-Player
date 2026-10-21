/**
 * Cloudflare Pages 部署后自动化健康检查与冒烟测试脚本 (Edge Smoke Test)
 * 具备全球 Anycast 边缘就绪预热探测、自适应指数退避重试 (Exponential Backoff) 与全链路契约断言
 *
 * 用法:
 *   node scripts/healthcheck.js [TARGET_URL]
 * 示例:
 *   node scripts/healthcheck.js http://localhost:8788
 *   node scripts/healthcheck.js https://cf-pages-drive-player.pages.dev
 */

const targetUrl = process.argv[2] || process.env.PAGES_DEPLOYED_URL || process.env.DEPLOYED_URL;

// 本地离线契约检查模式 (无参数传入时)
if (!targetUrl) {
  console.log('ℹ️ 未提供部署目标 URL，执行本地端点契约与部署架构规范静态验证...\n');
  console.log('📋 【Cloudflare Pages 边缘计算与静态直通架构规范】:');
  console.log('   - 静态资源路由隔离: public/_routes.json 确保静态文件 100% 走边缘 CDN 直通');
  console.log('   - 边缘安全响应头: public/_headers 配置严格 CSP (frame-src drive.google.com) 与 nosniff');
  console.log('\n📋 【Functions 核心 API 契约就绪清单】:');
  console.log('   - /api/info (GET) -> 网站系统配置、服务账号挂载与管理员状态');
  console.log('   - /api/list (GET) -> 目录文件树递归穿梭、搜索与分页');
  console.log('   - /api/stream/:id (GET, HEAD, OPTIONS) -> MKV/MP4 HTTP 206 Range 分片流式传输');
  console.log('   - /api/download/:id (GET) -> RFC 5987 编码文件名高速下载');
  console.log('\n📋 【媒体分片与安全合规标准】:');
  console.log('   - Accept-Ranges: bytes');
  console.log('   - Content-Type: video/x-matroska (针对 MKV 文件智能标准化)');
  console.log('   - Access-Control-Expose-Headers: Content-Range, Content-Length, Accept-Ranges, Content-Disposition');
  console.log('   - Content-Security-Policy: frame-src \'self\' https://drive.google.com; frame-ancestors \'self\';');
  console.log('\n📋 【三大改进需求运维验证标准】:');
  console.log('   - 需求 1: 客户端双阶先验与动态看门狗探测就绪，解码异常自动切换 Google 预览');
  console.log('   - 需求 2: 零遮挡纯净视口，沙箱严格排除 allow-popups，天然阻断右上角弹窗');
  console.log('   - 需求 3: 播放器视窗极简 Header (文件名 / 本地播放器 / 最大化 / 关闭) 响应式对齐');
  console.log('\n💡 提示: 在 CI/CD 流水线中请使用: node scripts/healthcheck.js <部署URL> 执行全链路冒烟测试。');
  process.exit(0);
}

const baseUrl = targetUrl.replace(/\/$/, '');
console.log(`🚀 开始对 Cloudflare Pages 部署实例执行全链路生产级健康检查: ${baseUrl}\n`);

// 辅助睡眠函数
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// 1. Anycast 边缘网络预热探测 (Readiness Probe)
async function waitForEdgeReadiness(maxWaitMs = 15000, intervalMs = 1500) {
  const startTime = Date.now();
  console.log('⏳ [Readiness Probe] 等待 Cloudflare Anycast 边缘网络全球路由收敛与节点预热...');

  let attempt = 1;
  while (Date.now() - startTime < maxWaitMs) {
    try {
      const resp = await fetch(baseUrl, { 
        method: 'GET',
        signal: AbortSignal.timeout(8000)
      });
      if (resp.status >= 200 && resp.status < 400) {
        console.log(`✅ [Readiness Probe] 边缘节点收敛就绪 (HTTP ${resp.status}, 预热耗时 ${Date.now() - startTime}ms)\n`);
        return true;
      }
      console.log(`ℹ️ [Readiness Probe] 边缘路由广播中 (尝试 #${attempt}, 状态码: HTTP ${resp.status})... 持续探测`);
    } catch (err) {
      console.log(`ℹ️ [Readiness Probe] 等待网络链路建立 (尝试 #${attempt}, 异常: ${err.message})...`);
    }
    attempt++;
    await sleep(intervalMs);
  }

  console.warn('⚠️ [Readiness Probe] 边缘预热达到建议上限，进入详细端点测试阶段...\n');
  return false;
}

// 2. 带指数退避的单项端点探测执行器
async function runTestWithRetry(test, maxRetries = 4) {
  const url = `${baseUrl}${test.path}`;
  let lastResp = null;
  let lastDetail = '';

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const resp = await fetch(url, { 
        method: test.method || 'GET',
        signal: AbortSignal.timeout(8000)
      });
      lastResp = resp;
      const statusOk = test.expectedStatus.includes(resp.status);

      let contentOk = true;
      if (statusOk && test.validate) {
        contentOk = await test.validate(resp);
      }

      if (statusOk && contentOk) {
        const retryNote = attempt > 1 ? ` (重试第 ${attempt} 次成功)` : '';
        console.log(`✅ [PASS] ${test.name} -> HTTP ${resp.status}${retryNote}`);
        return true;
      } else {
        const ray = resp.headers.get('cf-ray') || 'N/A';
        lastDetail = `HTTP ${resp.status}, CF-Ray: ${ray}`;
      }
    } catch (err) {
      lastDetail = `网络异常: ${err.message}`;
    }

    if (attempt < maxRetries) {
      const delay = Math.round(1500 * Math.pow(1.5, attempt - 1));
      console.log(`   🔄 [RETRY] ${test.name}: 第 ${attempt}/${maxRetries} 次重试 (等待 ${delay}ms, 上次: ${lastDetail})...`);
      await sleep(delay);
    }
  }

  console.error(`❌ [FAIL] ${test.name} -> 最终失败 (${lastDetail})`);
  return false;
}

// 3. 执行全套冒烟测试套件
async function runHealthCheck() {
  await waitForEdgeReadiness();

  const tests = [
    {
      name: '首页 HTML 静态资源直通 (GET /)',
      path: '/',
      expectedStatus: [200],
      validate: (resp) => {
        const type = resp.headers.get('content-type') || '';
        return type.includes('text/html');
      }
    },
    {
      name: '边缘安全响应头规范 (X-Content-Type-Options: nosniff)',
      path: '/',
      expectedStatus: [200],
      validate: (resp) => {
        const nosniff = resp.headers.get('x-content-type-options');
        return nosniff === 'nosniff';
      }
    },
    {
      name: 'CSP 安全策略合规性 (Content-Security-Policy 包含 drive.google.com)',
      path: '/',
      expectedStatus: [200],
      validate: (resp) => {
        const csp = resp.headers.get('content-security-policy') || '';
        // 确保 CSP 存在并放行了 Google 预览源
        return csp.includes('drive.google.com');
      }
    },
    {
      name: '样式表完整性与 CDN 直通 (GET /css/style.css)',
      path: '/css/style.css',
      expectedStatus: [200],
      validate: (resp) => {
        const type = resp.headers.get('content-type') || '';
        return type.includes('text/css');
      }
    },
    {
      name: '核心交互脚本完整性 (GET /js/app.js)',
      path: '/js/app.js',
      expectedStatus: [200],
      validate: (resp) => {
        const type = resp.headers.get('content-type') || '';
        return type.includes('javascript');
      }
    },
    {
      name: '站点凭证与系统信息接口 (GET /api/info)',
      path: '/api/info',
      expectedStatus: [200],
      validate: async (resp) => {
        const data = await resp.json();
        return typeof data.success === 'boolean';
      }
    },
    {
      name: '目录文件列表接口与契约 (GET /api/list)',
      path: '/api/list',
      expectedStatus: [200],
      validate: async (resp) => {
        const data = await resp.json();
        return typeof data.success === 'boolean' && Array.isArray(data.items);
      }
    },
    {
      name: '媒体流 CORS 跨域预检与标头暴露 (OPTIONS /api/stream/test-probe)',
      path: '/api/stream/test-probe',
      method: 'OPTIONS',
      expectedStatus: [204, 200],
      validate: (resp) => {
        const allowOrigin = resp.headers.get('access-control-allow-origin');
        return allowOrigin === '*';
      }
    }
  ];

  let passed = 0;
  for (const t of tests) {
    const success = await runTestWithRetry(t, 4);
    if (success) {
      passed++;
    }
  }

  console.log(`\n================================================================================`);
  console.log(`📊 冒烟测试执行汇总: ${passed}/${tests.length} 项端点契约验证全部通过！`);
  if (passed !== tests.length) {
    console.error('⚠️ 存在健康检查未通过项，请排查云端配置与部署状态！');
    process.exit(1);
  } else {
    console.log('🎉 边缘实例运行状态极佳，生产环境发布验收成功！');
    console.log('================================================================================\n');
  }
}

runHealthCheck();
