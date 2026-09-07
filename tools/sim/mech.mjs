import { chromium } from 'playwright-core';
import { readFileSync } from 'node:fs';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const c = await b.newContext({ viewport: { width: 200, height: 356 }, locale: 'ja-JP' });
await c.addInitScript(readFileSync(import.meta.dirname + '/vclock.js', 'utf8'));
const p = await c.newPage();
p.on('pageerror', e => console.log('PAGEERROR', '' + e));
await p.goto('file://' + import.meta.dirname + '/lab.html');
await p.evaluate(() => { for (let i = 0; i < 120; i++) window.__vstep(); });
const N = ['シャリ','玉子','エビ','サーモン','マグロ','いくら','ウニ','大トロ','穴子','伊勢海老','金の桶'];

async function scene(title, base, drops) {
  await p.evaluate((bs) => {
    window.__vclearTimers(); __dbg.begin('normal'); __dbg.clear(); window.__made = {};
    bs.forEach(s => __dbg.spawn(s[0], s[1], s[2]));
  }, base);
  await p.evaluate(() => { for (let i = 0; i < 240; i++) window.__vstep(); });
  for (const d of drops) {
    await p.evaluate((s) => __dbg.spawn(s[0], s[1], s[2]), d);
    await p.evaluate(() => { for (let i = 0; i < 180; i++) window.__vstep(); });
  }
  await p.evaluate(() => { for (let i = 0; i < 300; i++) window.__vstep(); });
  const r = await p.evaluate(() => ({
    bs: __dbg.bodies().map(x => ({ lv: x.lv, x: Math.round(x.x), top: Math.round(x.minY), deg: Math.round(x.ang * 180 / Math.PI) })),
    dead: __dbg.DEAD_Y }));
  const top = Math.min(...r.bs.map(x => x.top));
  console.log(`\n■ ${title}`);
  r.bs.sort((a, z) => a.top - z.top).forEach(x => console.log(`    ${N[x.lv].padEnd(6)} x=${String(x.x).padStart(3)} 頂=${String(x.top).padStart(3)} 傾き=${String(x.deg).padStart(4)}°`));
  console.log(`    → 山の頂 ${top}（死線 ${r.dead}）${top < r.dead ? ' ★死線超え' : ''}`);
}

// 穴子の上に大トロを2枚：2枚目の穴子が作れるか
await scene('穴子 1 本の上に、大トロ ×2（＝2 本目の穴子を作る手順）',
  [[8, 180, 560]], [[7, 130, 380], [7, 240, 380]]);
// 比べる：大トロの上にウニ ×2（一段下の同じ手順）
await scene('［比較］大トロ 1 枚の上に、ウニ ×2（＝2 枚目の大トロを作る手順）',
  [[7, 180, 580]], [[6, 130, 420], [6, 240, 420]]);
// 穴子の横に何が置けるか
await scene('穴子の横（余り幅 89px）に大トロを置こうとする',
  [[8, 180, 580]], [[7, 320, 380]]);
await b.close();
