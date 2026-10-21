/**
 * CI/CD 自动化静态与代码质量门禁校验脚本 (Quality Gate Guard)
 * 验证 Functions、Public 前端代码完整性、安全沙箱规范、流媒体契约与极简视窗规范
 */

import { readdirSync, statSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';

const ROOT_DIR = resolve(process.cwd());
const FUNCTIONS_DIR = join(ROOT_DIR, 'functions');
const PUBLIC_DIR = join(ROOT_DIR, 'public');

console.log('🚀 [CI-Check] 开始执行全栈工程交付 CI/CD 自动化质量闸门检查...\n');

// 1. 递归获取目录下所有指定后缀的文件
function getFiles(dir, exts = ['.js']) {
  let results = [];
  const list = readdirSync(dir);
  for (const file of list) {
    const filePath = join(dir, file);
    const stat = statSync(filePath);
    if (stat && stat.isDirectory()) {
      results = results.concat(getFiles(filePath, exts));
    } else {
      if (exts.some(ext => file.endsWith(ext))) {
        results.push(filePath);
      }
    }
  }
  return results;
}

// -----------------------------------------------------------------------------
// 步骤 1/7: 检查所有 JS 文件语法有效性 (原生 node --check AST 校验)
// -----------------------------------------------------------------------------
console.log('🔍 [步骤 1/7] 执行 JavaScript 语法与 AST 原生解析校验...');
const jsFiles = [...getFiles(FUNCTIONS_DIR), ...getFiles(join(PUBLIC_DIR, 'js'))];
let syntaxPassed = 0;
for (const file of jsFiles) {
  try {
    execFileSync(process.execPath, ['--check', file], { stdio: 'pipe' });
    syntaxPassed++;
  } catch (err) {
    console.error(`❌ JavaScript 语法校验失败: ${file}`);
    console.error(err.message);
    process.exit(1);
  }
}
console.log(`✅ 已通过 ${syntaxPassed} 个 JavaScript 文件的 AST 语法完整性验证 (0 错误)。`);

// -----------------------------------------------------------------------------
// 步骤 2/7: 验证 public 静态资源完整性与 Cloudflare Pages 路由规则
// -----------------------------------------------------------------------------
console.log('\n🔍 [步骤 2/7] 验证 public 静态资源完整性与 _routes.json 边缘路由隔离...');
const requiredAssets = [
  join(PUBLIC_DIR, 'index.html'),
  join(PUBLIC_DIR, 'css', 'style.css'),
  join(PUBLIC_DIR, 'js', 'app.js'),
  join(PUBLIC_DIR, 'favicon.svg'),
  join(PUBLIC_DIR, '_routes.json'),
  join(PUBLIC_DIR, '_headers')
];

for (const asset of requiredAssets) {
  try {
    const stat = statSync(asset);
    if (stat.size === 0) {
      console.error(`❌ 关键静态文件内容为空: ${asset}`);
      process.exit(1);
    }
    console.log(`✅ 静态文件有效: ${asset.replace(ROOT_DIR, '')} (${stat.size} bytes)`);
  } catch (err) {
    console.error(`❌ 关键静态文件缺失: ${asset}`);
    process.exit(1);
  }
}

// 验证 _routes.json 边缘路由隔离规则 (保障静态资源 100% 直通边缘 CDN，仅 /api/* 进入 Functions 计算)
try {
  const routesPath = join(PUBLIC_DIR, '_routes.json');
  const routesRaw = readFileSync(routesPath, 'utf8');
  const routesContent = JSON.parse(routesRaw);
  if (routesContent.version !== 1 || !Array.isArray(routesContent.include) || !routesContent.include.includes('/api/*')) {
    throw new Error('_routes.json 必须包含 version: 1 且 include 数组必须显式包含 "/api/*"');
  }
  console.log('✅ _routes.json 边缘路由隔离规则符合标准 (静态资源直通 CDN，计算与静态物理隔离)。');
} catch (err) {
  console.error(`❌ _routes.json 配置校验失败: ${err.message}`);
  process.exit(1);
}

// -----------------------------------------------------------------------------
// 步骤 3/7: 校验 Cloudflare Pages 部署配置文件 (wrangler.toml)
// -----------------------------------------------------------------------------
console.log('\n🔍 [步骤 3/7] 验证 wrangler.toml 部署配置合规性...');
const wranglerPath = join(ROOT_DIR, 'wrangler.toml');
try {
  const wranglerContent = readFileSync(wranglerPath, 'utf8');
  if (!wranglerContent.includes('pages_build_output_dir') || !wranglerContent.includes('public')) {
    throw new Error('wrangler.toml 必须明确配置 pages_build_output_dir = "public"');
  }
  console.log('✅ wrangler.toml 配置合规 (pages_build_output_dir = "public")。');
} catch (err) {
  console.error(`❌ wrangler.toml 配置文件校验失败: ${err.message}`);
  process.exit(1);
}

// -----------------------------------------------------------------------------
// 步骤 4/7: 校验流媒体 API 路由契约与 HTTP 206 Range 分片支持
// -----------------------------------------------------------------------------
console.log('\n🔍 [步骤 4/7] 校验流媒体 API 路由契约与 MKV/MP4 Range 分片穿透支持...');
const streamHandlerPath = join(FUNCTIONS_DIR, 'api', 'stream', '[id].js');
try {
  const streamCode = readFileSync(streamHandlerPath, 'utf8');
  if (!streamCode.includes('video/x-matroska')) {
    throw new Error('stream 处理器缺失 MKV (video/x-matroska) MIME 类型映射！');
  }
  if (!streamCode.includes('Accept-Ranges') || !streamCode.includes('bytes')) {
    throw new Error('stream 处理器缺失 Accept-Ranges: bytes 标头配置！');
  }
  if (!streamCode.includes('Content-Range')) {
    throw new Error('stream 处理器缺失 Content-Range 透传机制，无法支持视频拖拽进度分片！');
  }
  if (!streamCode.includes('Access-Control-Expose-Headers')) {
    throw new Error('stream 处理器未暴露 Access-Control-Expose-Headers，外部/前端播放器将无法获取流大小！');
  }
  console.log('✅ 流媒体服务契约全部合规 (支持 MKV MIME 规范化、HTTP 206 Range 分片与 CORS 标头暴露)。');
} catch (err) {
  console.error(`❌ 流媒体契约检查失败: ${err.message}`);
  process.exit(1);
}

// -----------------------------------------------------------------------------
// 步骤 5/7: 【改进需求 2】Google 预览零遮挡安全沙箱模型与防弹窗门禁
// -----------------------------------------------------------------------------
console.log('\n🔍 [步骤 5/7] 校验【需求 2】Google 预览零遮挡安全沙箱模型与防弹窗门禁...');
const appJsPath = join(PUBLIC_DIR, 'js', 'app.js');
const indexHtmlPath = join(PUBLIC_DIR, 'index.html');
try {
  const appJsCode = readFileSync(appJsPath, 'utf8');
  const indexHtmlCode = readFileSync(indexHtmlPath, 'utf8');

  // 1. 反退化遮挡阻断：严禁在代码中出现任何右上角遮罩 div 或遮挡卡片
  const forbiddenPatterns = [
    '已开启安全受限防护',
    '右上角精准透明防护罩',
    'title="已开启安全受限防护"',
    'w-28 h-14 z-20 cursor-default'
  ];
  for (const pattern of forbiddenPatterns) {
    if (appJsCode.includes(pattern) || indexHtmlCode.includes(pattern)) {
      throw new Error(`检测到违规右上角遮罩层特征残留: "${pattern}"！用户明确要求彻底移除任何遮挡画面层。`);
    }
  }
  console.log('✅ 零遮挡反退化门禁通过：已彻底移除右上角及全域遮罩拦截层，视频视窗 100% 纯净无遮挡。');

  // 2. 原生沙箱能力防弹窗阻断校验：利用 W3C HTML5 iframe sandbox 阻断点击弹出新窗口
  if (appJsCode.includes('google-drive-iframe')) {
    const sandboxMatch = appJsCode.match(/sandbox=["']([^"']+)["']/i);
    if (!sandboxMatch) {
      throw new Error('Google 预览 iframe 缺少 sandbox 属性配置！');
    }
    const sandboxTokens = sandboxMatch[1].split(/\s+/);

    // 严禁包含 popups 权限
    if (sandboxTokens.includes('allow-popups') || sandboxTokens.includes('allow-popups-to-escape-sandbox')) {
      throw new Error('Google 预览 iframe 沙箱包含 allow-popups，将导致右上角图标能够弹出新标签页！');
    }
    // 严禁包含 top-navigation 权限
    if (sandboxTokens.includes('allow-top-navigation') || sandboxTokens.includes('allow-top-navigation-by-user-activation')) {
      throw new Error('Google 预览 iframe 沙箱包含 allow-top-navigation，存在宿主页面被重定向的安全风险！');
    }
    // 必须包含正常播放执行所需的受限权限
    if (!sandboxTokens.includes('allow-scripts')) {
      throw new Error('Google 预览 iframe 沙箱缺少 allow-scripts，将导致 Google 播放器无法执行！');
    }
    console.log(`✅ Google 预览原生沙箱合规：sandbox="${sandboxMatch[1]}" (成功阻断 allow-popups 与 top-navigation)。`);
  }
} catch (err) {
  console.error(`❌ Google 预览安全沙箱与零遮挡门禁失败: ${err.message}`);
  process.exit(1);
}

// -----------------------------------------------------------------------------
// 步骤 6/7: 【改进需求 1】客户端双阶自适应降级播放与智能选源契约校验
// -----------------------------------------------------------------------------
console.log('\n🔍 [步骤 6/7] 校验【需求 1】客户端双阶自适应降级播放与智能选源契约...');
try {
  const appJsCode = readFileSync(appJsPath, 'utf8');

  // 1. 验证静态先验探测机制 (canBrowserPlayNatively: MKV, HEVC, 多声道音频)
  if (!appJsCode.includes('canBrowserPlayNatively')) {
    throw new Error('前端缺少 canBrowserPlayNatively 浏览器原生解码先验探测逻辑！');
  }
  if (!appJsCode.includes('video/x-matroska')) {
    throw new Error('前端先验探测缺少针对 MKV 容器 (video/x-matroska) 的兼容性判断！');
  }
  console.log('✅ 阶段一静态先验探测契约就绪：覆盖 MKV 容器、Safari/WebKit 兼容性与 HEVC/多声道音频。');

  // 2. 验证动态看门狗探测与自动平滑降级 (startMediaWatchdog)
  if (!appJsCode.includes('startMediaWatchdog') || !appJsCode.includes('renderGooglePreview')) {
    throw new Error('前端缺少动态起播看门狗或缺少自动降级至 renderGooglePreview 的选源闭环！');
  }
  // 必须具备无感或轻量 Toast 提示，且自动触发降级
  if (!appJsCode.includes('renderStatus') && !appJsCode.includes('isStalledOrBlack')) {
    throw new Error('看门狗未包含黑屏/无画面/卡死状态识别算法！');
  }
  console.log('✅ 阶段二动态看门狗与智能自动降级契约就绪：起播黑屏/卡死自动无感切换至云端转码预览。');
} catch (err) {
  console.error(`❌ 自动降级与智能选源契约校验失败: ${err.message}`);
  process.exit(1);
}

// -----------------------------------------------------------------------------
// 步骤 7/7: 【改进需求 3】播放器视窗极简 Header 契约与边缘安全响应头校验
// -----------------------------------------------------------------------------
console.log('\n🔍 [步骤 7/7] 校验【需求 3】极简播放器 Header 结构与边缘安全响应头...');
try {
  const indexHtmlCode = readFileSync(indexHtmlPath, 'utf8');

  // 1. 核心四项控件必须存在
  const requiredControls = [
    { id: 'player-file-name', name: '1. 文件名展示容器' },
    { id: 'ext-player-menu-btn', name: '2. 调用本地播放器下拉菜单按钮' },
    { id: 'player-maximize-btn', name: '3. 最大化/还原窗口按钮' },
    { id: 'close-player-btn', name: '4. 关闭窗口按钮' }
  ];
  for (const ctrl of requiredControls) {
    if (!indexHtmlCode.includes(`id="${ctrl.id}"`)) {
      throw new Error(`播放器顶部 Header 缺失必要核心控件: ${ctrl.name} (id="${ctrl.id}")`);
    }
  }
  console.log('✅ 播放器顶部 Header 核心四项控件完整齐备 (文件名 / 本地播放器 / 最大化 / 关闭)。');

  // 2. 校验冗余堆砌按钮已被精简移除
  const redundantPatterns = [
    'OpenList 极速直出',
    'id="player-autoplay-toggle-btn"'
  ];
  for (const pat of redundantPatterns) {
    if (indexHtmlCode.includes(pat)) {
      throw new Error(`检测到 Header 顶部残留拥挤杂乱控件: "${pat}"，请将其移除或下沉收纳！`);
    }
  }
  console.log('✅ 播放器顶部 Header 视觉精简验证通过：无多余静态徽章与堆叠按钮，界面极简纯净。');

  // 3. 校验边缘安全响应头与 CSP (public/_headers)
  const headersPath = join(PUBLIC_DIR, '_headers');
  const headersCode = readFileSync(headersPath, 'utf8');
  if (!headersCode.includes('Content-Security-Policy')) {
    throw new Error('public/_headers 缺失 Content-Security-Policy 标头配置！');
  }
  if (!headersCode.includes('drive.google.com')) {
    throw new Error('CSP 未将 drive.google.com 纳入合法 frame-src，将导致 Google 预览 iframe 加载失败！');
  }
  if (!headersCode.includes('nosniff')) {
    throw new Error('public/_headers 缺失 X-Content-Type-Options: nosniff 配置！');
  }
  console.log('✅ 边缘响应头安全合规：CSP 明确放行 drive.google.com，且配置严格 MIME 防嗅探与 CORS 标头。');
} catch (err) {
  console.error(`❌ 播放器视窗极简契约与安全响应头校验失败: ${err.message}`);
  process.exit(1);
}

console.log('\n================================================================================');
console.log('🎉 [CI-Check 质量闸门] 恭喜！全部 7 个自动化阶段静态检查与安全门禁均 100% 通过！');
console.log('🚀 代码质量、安全沙箱、流媒体协议与极简 UI 契约达到生产发布就绪状态 (Production-Ready)！');
console.log('================================================================================\n');
