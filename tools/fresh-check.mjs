/* 「新しく clone した所」で、ちゃんと組めて、欠けが無いかを見る。

   手元には、git に入れていない絵や、前に作ったままの残りがある。
   そのせいで手元だけ動いて、配ると 404 になることがある。
   commit 済みの中身だけを別の場所へ写して、組み直して、
   全ページを読み込んでみる。

       node tools/fresh-check.mjs

   playwright-core が要る。
*/
import { chromium } from 'playwright-core';
import { createServer } from 'node:http';
import { readFileSync, existsSync, statSync, rmSync, mkdtempSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';

const REPO = new URL('..', import.meta.url).pathname.replace(/\/$/, '');
const CHROME = process.env.CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const PORT = 8794;
const dir = mkdtempSync(tmpdir() + '/fresh-');

const dirty = execFileSync('git', ['status', '--porcelain'], { cwd: REPO, encoding: 'utf8' }).trim();
if (dirty) console.log('※ commit していない変更は写りません:\n' + dirty.split('\n').map((x) => '   ' + x).join('\n'));

console.log('写しています …');
execFileSync('git', ['clone', '-q', REPO, dir]);
execFileSync(process.execPath, [dir + '/site/build.mjs'], { stdio: 'ignore' });

const ROOT = dir + '/site';
const T = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.svg': 'image/svg+xml', '.jpg': 'image/jpeg',
  '.webp': 'image/webp', '.png': 'image/png', '.woff2': 'font/woff2', '.ico': 'image/x-icon',
  '.json': 'application/json', '.webmanifest': 'application/manifest+json',
  '.xml': 'application/xml', '.txt': 'text/plain; charset=utf-8' };
const srv = createServer((q, r) => {
  let p = ROOT + decodeURIComponent(q.url.split('?')[0]);
  if (existsSync(p) && statSync(p).isDirectory()) p += '/index.html';
  if (!existsSync(p) || statSync(p).isDirectory()) { r.writeHead(404); return r.end('404'); }
  r.writeHead(200, { 'Content-Type': T[p.slice(p.lastIndexOf('.'))] || 'application/octet-stream' });
  r.end(readFileSync(p));
}).listen(PORT);

const paths = ['/', '/works/', '/works/sushitsumu/', '/works/sushitsumu/guide.html',
  '/works/sushitsumu/play/', '/notes/', '/notes/anago/', '/stack/', '/contact/',
  '/profile/', '/privacy/', '/404.html'];

const b = await chromium.launch({ executablePath: CHROME });
const c = await b.newContext({ viewport: { width: 1280, height: 860 }, locale: 'ja-JP' });
const bad = [];
for (const path of paths) {
  const p = await c.newPage();
  const miss = [];
  p.on('response', (r) => { if (r.status() >= 400) miss.push(r.status() + ' ' + r.url().replace('http://127.0.0.1:' + PORT, '')); });
  p.on('pageerror', (e) => miss.push('JS ' + e.message));
  p.on('console', (m) => { if (m.type() === 'error' && !/TUNNEL|net::ERR/.test(m.text())) miss.push('CONSOLE ' + m.text()); });
  await p.goto('http://127.0.0.1:' + PORT + path, { waitUntil: 'load' });
  await p.waitForTimeout(1500);
  if (miss.length) bad.push(path + ': ' + [...new Set(miss)].join(' | '));
  await p.close();
}
await b.close();
srv.close();
rmSync(dir, { recursive: true, force: true });

if (bad.length) {
  console.error('\n写した先で足りないもの:');
  bad.forEach((x) => console.error('  ' + x));
  process.exit(1);
}
console.log(`\n${paths.length} 頁、写した先でも欠けなし。`);
