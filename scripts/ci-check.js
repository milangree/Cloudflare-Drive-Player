/**
 * CI/CD 自动化静态与语法一致性校验脚本
 * 用于流水线构建前检查 Functions 与 Public 前端代码的完整性与兼容性
 */

import { readdirSync, statSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';

const ROOT_DIR = resolve(process.cwd());
const FUNCTIONS_DIR = join(ROOT_DIR, 'functions');
const PUBLIC_DIR = join(ROOT_DIR, 'public');

console.log('🚀 [CI-Check] 开始自动化环境与代码质量闸门检查...');

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

// 2. 检查所有 JS 文件语法有效性 (利用 node --check)
console.log('\n🔍 [步骤 1/5] 执行 JavaScript 语法与 AST 解析校验...');
const jsFiles = [...getFiles(FUNCTIONS_DIR), ...getFiles(join(PUBLIC_DIR, 'js'))];
let syntaxPassed = 0;
for (const file of jsFiles) {
  try {
    execFileSync(process.execPath, ['--check', file], { stdio: 'pipe' });
    syntaxPassed++;
  } catch (err) {
    console.error(`❌ 语法错误: ${file}`);
    console.error(err.message);
    process.exit(1);
  }
}
console.log(`✅ 已完成 ${syntaxPassed} 个 JavaScript 文件的语法验证，0 错误。`);

// 3. 检查静态资源完整性 (HTML、CSS、JS 依赖引用及路由/标头规范)
console.log('\n🔍 [步骤 2/5] 验证 public 静态资源完整性与路由配置...');
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
      console.error(`❌ 静态资源文件为空: ${asset}`);
      process.exit(1);
    }
    console.log(`✅ 静态文件存在并有效: ${asset.replace(ROOT_DIR, '')} (${stat.size} bytes)`);
  } catch (err) {
    console.error(`❌ 关键静态文件缺失: ${asset}`);
    process.exit(1);
  }
}

// 附加校验: 验证 _routes.json 必须为有效 JSON 且包含合规字段
try {
  const routesPath = join(PUBLIC_DIR, '_routes.json');
  const routesRaw = readFileSync(routesPath, 'utf8');
  const routesContent = JSON.parse(routesRaw);
  if (routesContent.version !== 1 || !Array.isArray(routesContent.include)) {
    throw new Error('Cloudflare Pages _routes.json 格式非法，必须包含 version: 1 和 include 数组');
  }
  console.log('✅ _routes.json 路由配置语法与结构有效。');
} catch (err) {
  console.error(`❌ _routes.json 配置校验失败: ${err.message}`);
  process.exit(1);
}

// 4. 校验 Cloudflare 部署配置 (wrangler.toml)
console.log('\n🔍 [步骤 3/5] 验证 wrangler.toml 配置文件...');
const wranglerPath = join(ROOT_DIR, 'wrangler.toml');
try {
  const stat = statSync(wranglerPath);
  console.log(`✅ wrangler.toml 配置文件正常存在 (${stat.size} bytes)。`);
} catch (err) {
  console.error('❌ wrangler.toml 配置文件不存在');
  process.exit(1);
}

// 5. 校验流媒体服务契约与标头规范 (保障 MKV 及 Range 分片传输)
console.log('\n🔍 [步骤 4/5] 校验流媒体 API 路由契约与 MKV 标头支持...');
const streamHandlerPath = join(FUNCTIONS_DIR, 'api', 'stream', '[id].js');
try {
  const streamCode = readFileSync(streamHandlerPath, 'utf8');
  
  // 必须包含 MKV MIME 映射为 video/x-matroska
  if (!streamCode.includes('video/x-matroska')) {
    throw new Error('stream 处理器缺失 MKV (video/x-matroska) MIME 类型映射！');
  }
  // 必须支持 Accept-Ranges: bytes
  if (!streamCode.includes('Accept-Ranges') || !streamCode.includes('bytes')) {
    throw new Error('stream 处理器缺失 Accept-Ranges: bytes 标头配置！');
  }
  // 必须支持 HTTP 206 Content-Range
  if (!streamCode.includes('Content-Range')) {
    throw new Error('stream 处理器缺失 Content-Range 透传机制，无法支持视频拖拽进度分片！');
  }
  // 必须支持 Access-Control-Expose-Headers 暴露媒体标头
  if (!streamCode.includes('Access-Control-Expose-Headers')) {
    throw new Error('stream 处理器未暴露 Access-Control-Expose-Headers，可能导致前端/外部播放器无法获取流大小！');
  }
  console.log('✅ 流媒体处理契约合规：MKV MIME 规范化、Range 分片与 CORS 标头校验全部通过。');
} catch (err) {
  console.error(`❌ 流媒体契约检查失败: ${err.message}`);
  process.exit(1);
}

// 6. 校验播放器沙箱隔离与云端转码预览契约 (保障 Google Drive Preview 安全与功能兼备)
console.log('\n🔍 [步骤 5/5] 校验前端播放器沙箱配置与 Google 云端预览合规性...');
const appJsPath = join(PUBLIC_DIR, 'js', 'app.js');
try {
  const appJsCode = readFileSync(appJsPath, 'utf8');
  if (appJsCode.includes('google-drive-iframe')) {
    const sandboxMatch = appJsCode.match(/sandbox=["']([^"']+)["']/i);
    if (sandboxMatch) {
      const sandboxTokens = sandboxMatch[1].split(/\s+/);
      if (!sandboxTokens.includes('allow-scripts')) {
        throw new Error('Google 预览 iframe 缺少 allow-scripts，将导致 Google 播放器无法执行！');
      }
      if (!sandboxTokens.includes('allow-same-origin')) {
        console.warn('⚠️ [安全预警] Google 预览 iframe 沙箱缺少 allow-same-origin，将导致 Google 播放器存储与认证隔离失败 (白屏/黑屏)！请前端专家予以修复。');
      } else {
        console.log('✅ Google 预览 iframe 沙箱配置完整：包含 allow-scripts 与 allow-same-origin。');
      }
    }
  }
  console.log('✅ 播放器沙箱与云端预览契约审计完成。');
} catch (err) {
  console.error(`❌ 播放器合规性检查失败: ${err.message}`);
  process.exit(1);
}

console.log('\n🎉 [CI-Check] 全部静态检查均通过，符合生产部署标准！');
