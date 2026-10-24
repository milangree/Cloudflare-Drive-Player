/**
 * 文档漂移闸门 (Documentation Drift Gate)
 *
 * 目的：把「文档是否跟得上代码」从人工自觉变成 CI 硬门禁。
 * 校验四类漂移：
 *   1. functions/api/** 的每个真实路由都必须在 api-reference(.md/_zh.md) 中出现
 *   2. 每个 .md 必须有对应的 _zh.md 中英双语孪生（仓库既有约定）
 *   3. README 目录锚点必须能在本文件内解析到真实标题（防止死链）
 *   4. 关键文档必须存在且非空
 *
 * 退出码非 0 即阻断 CI，与 ci-check.js 同级。
 */

import { readdirSync, statSync, readFileSync, existsSync } from 'node:fs';
import { join, resolve, dirname, basename, extname } from 'node:path';

const ROOT_DIR = resolve(process.cwd());
const FUNCTIONS_DIR = join(ROOT_DIR, 'functions');
const DOCS_DIR = join(ROOT_DIR, 'docs');

console.log('📚 [Docs-Check] 开始执行文档漂移闸门检查...\n');

const failures = [];
const notes = [];

function fail(message) {
  failures.push(message);
  console.error(`❌ ${message}`);
}

function note(message) {
  notes.push(message);
  console.log(`   ${message}`);
}

// -----------------------------------------------------------------------------
// 工具：递归收集文件
// -----------------------------------------------------------------------------
function getFiles(dir, exts = ['.js', '.md']) {
  if (!existsSync(dir)) return [];
  let results = [];
  for (const entry of readdirSync(dir)) {
    const filePath = join(dir, entry);
    const stat = statSync(filePath);
    if (stat.isDirectory()) {
      results = results.concat(getFiles(filePath, exts));
    } else if (exts.some((ext) => entry.endsWith(ext))) {
      results.push(filePath);
    }
  }
  return results;
}

// -----------------------------------------------------------------------------
// 步骤 1/4: 路由覆盖 —— functions/api/** 的每个路由都要被文档记录
// -----------------------------------------------------------------------------
console.log('🔍 [步骤 1/4] 校验 API 路由文档覆盖率...');

const apiDir = join(FUNCTIONS_DIR, 'api');
const routeFiles = getFiles(apiDir, ['.js']).filter((f) => !basename(f).startsWith('_'));

/** 把文件路径换算成公开路由：api/download/[id].js -> /api/download/:id */
function toRoutePath(filePath) {
  const rel = filePath.replace(FUNCTIONS_DIR + '\\', '').replace(FUNCTIONS_DIR + '/', '');
  const noExt = rel.replace(/\.js$/, '');
  const parts = noExt.split(/[\\/]/);
  const normalized = parts.map((p) => (/^\[.+\]$/.test(p) ? ':' + p.slice(1, -1) : p));
  return '/' + normalized.join('/');
}

const routes = routeFiles.map(toRoutePath).sort();
note(`扫描到 ${routes.length} 个真实路由：${routes.join(', ')}`);

const apiRefEn = readFileSync(join(DOCS_DIR, 'api-reference.md'), 'utf8');
const apiRefZh = readFileSync(join(DOCS_DIR, 'api-reference_zh.md'), 'utf8');

for (const route of routes) {
  // 路由可能以 /api/xxx/:id 形式出现，文档里也可能是 /api/xxx/<id>，做双向宽松匹配
  const altForms = new Set([
    route,
    route.replace(/:([a-z]+)/gi, '<$1>'),
    route.replace(/:([a-z]+)/gi, '$1'),
  ]);
  const coveredEn = [...altForms].some((form) => apiRefEn.includes(form));
  const coveredZh = [...altForms].some((form) => apiRefZh.includes(form));
  if (!coveredEn) fail(`api-reference.md 缺失路由文档: ${route}`);
  if (!coveredZh) fail(`api-reference_zh.md 缺失路由文档: ${route}`);
}
if (failures.length === 0) {
  console.log(`✅ 全部 ${routes.length} 个 API 路由在中英双语文档中均有记录。`);
}

// -----------------------------------------------------------------------------
// 步骤 2/4: 中英双语孪生配对
// -----------------------------------------------------------------------------
console.log('\n🔍 [步骤 2/4] 校验中英双语文档配对...');

const allDocs = [
  ...getFiles(DOCS_DIR, ['.md']).map((f) => f.replace(ROOT_DIR + '\\', '').replace(ROOT_DIR + '/', '')),
  ...getFiles(ROOT_DIR, ['.md']).map((f) => f.replace(ROOT_DIR + '\\', '').replace(ROOT_DIR + '/', '')),
].filter((rel) => !rel.includes('node_modules'));

const withoutZh = allDocs.filter((rel) => !rel.endsWith('_zh.md'));
for (const rel of withoutZh) {
  const base = rel.slice(0, -extname(rel).length);
  const zh = `${base}_zh.md`;
  const zhRel = allDocs.find((d) => d.toLowerCase() === zh.toLowerCase());
  if (!zhRel) {
    fail(`文档缺少中文孪生: ${rel} -> 期望存在 ${zh}`);
  } else {
    // 体量差异过大通常意味着一方已过期
    const enSize = statSync(join(ROOT_DIR, rel)).size;
    const zhSize = statSync(join(ROOT_DIR, zhRel)).size;
    if (enSize > 0 && zhSize / enSize < 0.3) {
      fail(`中文孪生体量明显不足（疑似长期未同步）: ${rel} (${enSize}B) vs ${zhRel} (${zhSize}B)`);
    } else {
      note(`配对正常: ${rel} <-> ${zhRel}`);
    }
  }
}
if (failures.length === 0) {
  console.log(`✅ ${withoutZh.length} 组中英双语文档配对完整。`);
}

// -----------------------------------------------------------------------------
// 步骤 3/4: README 目录锚点可解析
// -----------------------------------------------------------------------------
console.log('\n🔍 [步骤 3/4] 校验 README 目录锚点是否为真实标题...');

/**
 * 复刻 GitHub 的锚点算法：转小写 -> 去掉标点（保留空格与连字符） -> 每个空格变成一个连字符。
 * 注意不能合并连续空格：「Positioning & Core」的 & 被去掉后留下两个空格，
 * 因此锚点是 positioning--core（两个连字符），与 GitHub 行为一致。
 */
function slugify(text) {
  return text
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s_-]/gu, '')
    .replace(/ /g, '-');
}

for (const readme of ['README.md', 'README_zh.md']) {
  const full = join(ROOT_DIR, readme);
  if (!existsSync(full)) {
    fail(`缺少 ${readme}`);
    continue;
  }
  const content = readFileSync(full, 'utf8');
  const headings = new Set(
    [...content.matchAll(/^(#{1,6})\s+(.+)$/gm)].map((m) => slugify(m[2].trim()))
  );
  const anchors = [...content.matchAll(/\]\(#([^)]+)\)/g)].map((m) => m[1].trim());
  const dead = anchors.filter((a) => !headings.has(a));
  if (dead.length > 0) {
    fail(`${readme} 存在 ${dead.length} 个指向不存在标题的目录锚点: ${dead.slice(0, 5).join(', ')}`);
  } else {
    console.log(`✅ ${readme} 目录锚点全部可解析（共 ${anchors.length} 个）。`);
  }
}

// -----------------------------------------------------------------------------
// 步骤 4/4: 关键文档存在性
// -----------------------------------------------------------------------------
console.log('\n🔍 [步骤 4/4] 校验关键文档存在且非空...');

const requiredDocs = [
  'README.md',
  'README_zh.md',
  'docs/api-reference.md',
  'docs/api-reference_zh.md',
  'docs/telegram-integration.md',
  'docs/telegram-integration_zh.md',
];
for (const doc of requiredDocs) {
  const full = join(ROOT_DIR, doc);
  if (!existsSync(full)) {
    fail(`关键文档缺失: ${doc}`);
    continue;
  }
  const size = statSync(full).size;
  if (size === 0) {
    fail(`关键文档为空: ${doc}`);
  } else {
    console.log(`✅ 文档有效: ${doc} (${size} bytes)`);
  }
}

// -----------------------------------------------------------------------------
// 汇总
// -----------------------------------------------------------------------------
console.log('\n================================================================================');
if (failures.length > 0) {
  console.error(`🚫 [Docs-Check 文档漂移闸门] 未通过：${failures.length} 项失败。`);
  console.error('   文档与代码已发生漂移，请在提交前同步更新文档。');
  console.error('================================================================================\n');
  process.exit(1);
}
console.log(`🎉 [Docs-Check 文档漂移闸门] 全部通过（${routes.length} 路由覆盖、${withoutZh.length} 组双语配对）。`);
console.log('================================================================================\n');
