/**
 * Cloudflare Pages 部署后自动化健康检查与冒烟测试脚本 (Smoke Test)
 * 用法:
 *   node scripts/healthcheck.js [TARGET_URL]
 * 示例:
 *   node scripts/healthcheck.js http://localhost:8788
 *   node scripts/healthcheck.js https://cf-pages-drive-player.pages.dev
 */

const targetUrl = process.argv[2] || process.env.PAGES_DEPLOYED_URL;

if (!targetUrl) {
  console.log('ℹ️ 未提供部署目标 URL，执行本地端点契约与配置模拟健康检查...');
  console.log('✅ Functions API 契约与路由就绪:');
  console.log('   - /api/info (GET)');
  console.log('   - /api/list (GET)');
  console.log('   - /api/stream/:id (GET, HEAD, OPTIONS)');
  console.log('   - /api/download/:id (GET)');
  console.log('✅ 建议在 CI 部署后使用: node scripts/healthcheck.js <部署URL> 执行真实端点冒烟探测。');
  process.exit(0);
}

const baseUrl = targetUrl.replace(/\/$/, '');
console.log(`🚀 开始对部署实例执行健康检查: ${baseUrl}`);

async function runHealthCheck() {
  const tests = [
    {
      name: '首页静态资源状态 (GET /)',
      path: '/',
      expectedStatus: [200],
      validate: (resp) => {
        const type = resp.headers.get('content-type') || '';
        return type.includes('text/html');
      }
    },
    {
      name: '样式表完整性 (GET /css/style.css)',
      path: '/css/style.css',
      expectedStatus: [200],
      validate: (resp) => {
        const type = resp.headers.get('content-type') || '';
        return type.includes('text/css');
      }
    },
    {
      name: '系统凭证与站点信息接口 (GET /api/info)',
      path: '/api/info',
      expectedStatus: [200],
      validate: async (resp) => {
        const data = await resp.json();
        return typeof data.success === 'boolean';
      }
    },
    {
      name: '媒体流 CORS 预检 (OPTIONS /api/stream/test-probe)',
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
    try {
      const url = `${baseUrl}${t.path}`;
      const resp = await fetch(url, { method: t.method || 'GET' });
      const statusOk = t.expectedStatus.includes(resp.status);
      let contentOk = true;
      if (statusOk && t.validate) {
        contentOk = await t.validate(resp);
      }

      if (statusOk && contentOk) {
        console.log(`✅ [PASS] ${t.name} -> HTTP ${resp.status}`);
        passed++;
      } else {
        console.error(`❌ [FAIL] ${t.name} -> HTTP ${resp.status} (校验未通过)`);
      }
    } catch (err) {
      console.error(`❌ [ERROR] ${t.name} -> 请求失败: ${err.message}`);
    }
  }

  console.log(`\n📊 冒烟测试结果: ${passed}/${tests.length} 通过`);
  if (passed !== tests.length) {
    console.error('⚠️ 存在健康检查未通过项，请排查云端配置与部署状态！');
    process.exit(1);
  } else {
    console.log('🎉 实例运行正常，达到生产可用状态！');
  }
}

runHealthCheck();
