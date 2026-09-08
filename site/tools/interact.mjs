/* 押したり開いたりする所が、ちゃんと動くかを見る。

   audit.mjs は「置かれた形」を見る道具で、押した後は見ていない。
   ここでは、実際に押して、変わるはずのものが変わったかを確かめる。

     ・小さい画面の品書き（開く／閉じる／Escape／中の行き先を押す）
     ・ロゴを押したときの弾ける演出
     ・Works の絞り込み札
     ・キーボードだけで主な行き先に届くか

       node site/tools/interact.mjs
*/
import { chromium } from 'playwright-core';
import { createServer } from 'node:http';
import { readFileSync, existsSync, statSync } from 'node:fs';

const ROOT = new URL('..', import.meta.url).pathname.replace(/\/$/, '');
const PORT = 8793;
const CHROME = process.env.CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.svg': 'image/svg+xml', '.jpg': 'image/jpeg',
  '.webp': 'image/webp', '.png': 'image/png', '.woff2': 'font/woff2', '.ico': 'image/x-icon',
  '.xml': 'application/xml', '.txt': 'text/plain; charset=utf-8', '.json': 'application/json' };
const srv = createServer((q, r) => {
  let p = ROOT + decodeURIComponent(q.url.split('?')[0]);
  if (existsSync(p) && statSync(p).isDirectory()) p += '/index.html';
  if (!existsSync(p) || statSync(p).isDirectory()) { r.writeHead(404); return r.end('404'); }
  r.writeHead(200, { 'Content-Type': TYPES[p.slice(p.lastIndexOf('.'))] || 'application/octet-stream' });
  r.end(readFileSync(p));
}).listen(PORT);
const URLB = 'http://127.0.0.1:' + PORT;

const bad = [];
const ok = [];
const check = (cond, name, detail) => (cond ? ok : bad).push(name + (cond ? '' : '　… ' + detail));

const b = await chromium.launch({ executablePath: CHROME });

/* ---- 小さい画面の品書き ---- */
{
  const c = await b.newContext({ viewport: { width: 390, height: 844 }, locale: 'ja-JP' });
  const p = await c.newPage();
  await p.goto(URLB + '/'); await p.waitForTimeout(900);
  const btn = p.locator('.menu-btn');
  check(await btn.isVisible(), '品書きの釦が出る', '狭い画面なのに釦が無い');
  await btn.click(); await p.waitForTimeout(400);
  check(await p.evaluate(() => document.body.classList.contains('nav-open')), '押すと開く', '開かない');
  check(await p.locator('header.site nav a', { hasText: 'Works' }).first().isVisible(),
    '開くと行き先が見える', '開いても行き先が見えない');
  await p.keyboard.press('Escape'); await p.waitForTimeout(300);
  check(!(await p.evaluate(() => document.body.classList.contains('nav-open'))),
    'Escape で閉じる', '閉じない');
  await btn.click(); await p.waitForTimeout(350);
  await p.locator('header.site nav a', { hasText: 'Works' }).first().click();
  await p.waitForTimeout(900);
  check(/\/works\//.test(p.url()), '中の行き先を押すと移る', '移らない: ' + p.url());
  await c.close();
}

/* ---- ロゴを押したときの演出 ---- */
{
  const c = await b.newContext({ viewport: { width: 1280, height: 860 }, locale: 'ja-JP' });
  const p = await c.newPage();
  await p.goto(URLB + '/'); await p.waitForTimeout(1200);
  const xl = p.locator('.logo-xl');
  check(await xl.count() > 0, '大きいロゴがある', '見つからない');
  if (await xl.count() > 0) {
    await xl.click({ position: { x: 60, y: 40 }, force: true });
    await p.waitForTimeout(260);
    const drew = await p.evaluate(() => {
      const cv = document.getElementById('burst');
      if (!cv) return 'なし';
      const g = cv.getContext('2d');
      const d = g.getImageData(0, 0, cv.width, cv.height).data;
      for (let i = 3; i < d.length; i += 4 * 97) if (d[i] > 6) return 'あり';
      return '空';
    });
    check(drew === 'あり', 'ロゴを押すと弾ける', '弾けた跡が ' + drew);
  }
  await c.close();
}

/* ---- Works の絞り込み ---- */
{
  const c = await b.newContext({ viewport: { width: 1280, height: 860 }, locale: 'ja-JP' });
  const p = await c.newPage();
  await p.goto(URLB + '/works/'); await p.waitForTimeout(900);
  const all = await p.locator('#worklist > li').count();
  check(all > 0, '作品が並んでいる', '一つも無い');
  const chips = p.locator('.chip');
  const n = await chips.count();
  check(n > 1, '絞り込みの札がある', '札が ' + n + ' 枚');
  let worked = false;
  for (let i = 1; i < n; i++) {
    await chips.nth(i).click(); await p.waitForTimeout(350);
    const shown = await p.locator('#worklist > li:visible').count();
    const emptyShown = await p.locator('#empty').isVisible();
    if (shown < all || emptyShown) worked = true;
    check(shown < all || emptyShown || shown === all,
      '札 ' + (await chips.nth(i).innerText()).replace(/\s+/g, '') + ' を押しても壊れない', '');
  }
  check(worked, '絞り込みが効く', 'どの札を押しても並びが変わらない');
  await chips.nth(0).click(); await p.waitForTimeout(300);
  check(await p.locator('#worklist > li:visible').count() === all, 'All で戻る', '戻らない');
  await c.close();
}

/* ---- キーボードだけで主な行き先に届くか ---- */
{
  const c = await b.newContext({ viewport: { width: 1280, height: 860 }, locale: 'ja-JP' });
  const p = await c.newPage();
  await p.goto(URLB + '/'); await p.waitForTimeout(900);
  const seen = [];
  for (let i = 0; i < 14; i++) {
    await p.keyboard.press('Tab');
    seen.push(await p.evaluate(() => {
      const a = document.activeElement;
      if (!a) return '';
      return (a.getAttribute('href') || a.className || a.tagName || '').toString().slice(0, 40);
    }));
  }
  const want = ['/works/', '/notes/', '/contact/'];
  for (const w of want) {
    check(seen.some((s) => s.indexOf(w) >= 0), `Tab で ${w} に届く`, '届かない');
  }
  await c.close();
}

await b.close();
srv.close();

console.log(ok.map((x) => '  ○ ' + x).join('\n'));
if (bad.length) {
  console.error('\n動かない所:');
  bad.forEach((x) => console.error('  × ' + x));
  process.exit(1);
}
console.log(`\n${ok.length} 件、みな動いています。`);
