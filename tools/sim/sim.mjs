import { chromium } from 'playwright-core';
import { readFileSync, writeFileSync } from 'node:fs';

const N = Number(process.argv[2] || 3);
const MODE = process.argv[3] || 'normal';
const OUT = process.argv[4] || 'runs.json';
const MAXF = 90000;                     // 1戦の上限（仮想25分）

const vclock = readFileSync(import.meta.dirname + '/vclock.js', 'utf8');
const bot = readFileSync(import.meta.dirname + '/bot.js', 'utf8');

const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const c = await b.newContext({ viewport: { width: 200, height: 356 }, locale: 'ja-JP' });
await c.addInitScript(vclock);
const p = await c.newPage();
p.on('pageerror', e => console.log('PAGEERROR', '' + e));
await p.goto('file://' + import.meta.dirname + '/' + (process.env.LAB || 'lab') + '.html');
await p.evaluate(() => { for (let i = 0; i < 120; i++) window.__vstep(); });
await p.evaluate('window.__CFG = ' + JSON.stringify({ wait: process.env.WAIT !== '0', look: process.env.LOOK !== '0' }));
await p.evaluate(bot);

const rows = [];
const t0 = Date.now();
for (let g = 0; g < N; g++) {
  await p.evaluate((m) => __lab.start(m), MODE);
  let r;
  for (;;) {
    r = await p.evaluate(() => __lab.chunk(900));
    if (r.over || r.frames >= MAXF) break;
  }
  rows.push({ ...r, timeout: !r.over });
  const el = (Date.now() - t0) / 1000;
  console.log(`${String(g + 1).padStart(3)}/${N}  点=${String(r.score).padStart(7)}  最高ネタ=${r.maxLv}  投下=${String(r.drops).padStart(4)}  連鎖=${r.chain} 間隔=${(r.frames/Math.max(1,r.drops)).toFixed(1)}f  ${r.sec.toFixed(0)}秒${r.over ? '' : ' (打切)'}  [経過 ${el.toFixed(0)}s]`);
  writeFileSync(OUT, JSON.stringify(rows, null, 1));
}
await b.close();
