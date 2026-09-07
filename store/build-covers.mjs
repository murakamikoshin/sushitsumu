/*
 * 表紙3枚を作り直す。
 *   node store/build-covers.mjs
 *
 * 実際に遊んで桶を撮り、その桶（ネタが積まれた部分だけ）を絵として使う。
 * 上は飾りの暖簾で埋める。CrazyGames は表紙の左上に「NEW」等の札を
 * 重ねるので、そこに題字も桶も置かない。
 *
 * 要るもの:
 *   npm i playwright @ffmpeg-installer/ffmpeg
 * Chromium の場所は CHROME_PATH で渡せる（既定は Playwright の同梱版）。
 *
 * 文言や寸法を変えたいときは cover.specs.json を、
 * 組み方そのものを変えたいときは cover.tpl.html を触る。
 */
import { chromium } from 'playwright';
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createRequire } from 'node:module';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const TMP = join(HERE, '.work');
const CHROME = process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';

function ffmpeg() {
  try { return createRequire(import.meta.url)('@ffmpeg-installer/ffmpeg').path; }
  catch (e) { return 'ffmpeg'; }
}

mkdirSync(TMP, { recursive: true });

/* ---- 1. 遊んで、賑わった桶を撮る ---- */
const b = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox'] });
const p = await (await b.newContext({ viewport: { width: 600, height: 1100 }, locale: 'en-US' })).newPage();
await p.goto('file://' + join(ROOT, 'index.html'));
await p.waitForTimeout(700);
await p.click('#startBtn');
await p.waitForTimeout(400);
const box = await p.locator('#game').boundingBox();
const spots = [0.5, 0.38, 0.62, 0.5, 0.45, 0.55, 0.5, 0.34, 0.66];
for (let i = 0; i < 70; i++) {
  await p.mouse.move(box.x + box.width * spots[i % spots.length], box.y + box.height * 0.72);
  await p.mouse.down(); await p.mouse.up();
  await p.waitForTimeout(420);
  if (!(await p.evaluate(() => document.getElementById('overModal').hidden))) break;
}
await p.waitForTimeout(800);
writeFileSync(join(TMP, 'barrel.png'), await p.locator('#game').screenshot());
await p.close();

/* ---- 2. 桶の下半分（ネタの積まれたところ）だけ切り出す ---- */
execFileSync(ffmpeg(), ['-hide_banner', '-loglevel', 'error', '-y',
  '-i', join(TMP, 'barrel.png'), '-vf', 'crop=iw:ih*0.50:0:ih*0.50', join(TMP, 'tub.png')]);
const art = readFileSync(join(TMP, 'tub.png')).toString('base64');

/* ---- 3. 組んで撮る ---- */
const TPL = readFileSync(join(HERE, 'cover.tpl.html'), 'utf8');
const SPECS = JSON.parse(readFileSync(join(HERE, 'cover.specs.json'), 'utf8'));
for (const [name, sp] of Object.entries(SPECS)) {
  let html = TPL.replace(/@ART@/g, art);
  for (const [k, v] of Object.entries(sp.vars)) html = html.replaceAll('@' + k + '@', String(v));
  const f = join(TMP, name + '.html');
  writeFileSync(f, html);
  const q = await (await b.newContext({ viewport: { width: sp.w, height: sp.h }, deviceScaleFactor: 1 })).newPage();
  await q.goto('file://' + f);
  await q.waitForTimeout(700);
  await q.screenshot({ path: join(HERE, name + '.png') });
  console.log(name + '.png', sp.w + 'x' + sp.h);
  await q.close();
}
await b.close();
rmSync(TMP, { recursive: true, force: true });
