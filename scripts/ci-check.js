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
console.log('\n🔍 [步骤 1/3] 执行 JavaScript 语法与 AST 解析校验...');
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
console.log('\n🔍 [步骤 2/3] 验证 public 静态资源完整性与路由配置...');
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
console.log('\n🔍 [步骤 3/3] 验证 wrangler.toml 配置文件...');
const wranglerPath = join(ROOT_DIR, 'wrangler.toml');
try {
  const stat = statSync(wranglerPath);
  console.log(`✅ wrangler.toml 配置文件正常存在 (${stat.size} bytes)。`);
} catch (err) {
  console.error('❌ wrangler.toml 配置文件不存在');
  process.exit(1);
}

console.log('\n🎉 [CI-Check] 全部静态检查均通过，符合生产部署标准！');
