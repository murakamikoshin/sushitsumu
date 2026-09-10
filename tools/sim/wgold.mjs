/* 金の桶が二つ、桶の中で同時に成立するかを直に確かめる。
   bot 任せだと「そこまで生き残れない」のか「物理的に無理」なのか分からない。

       SIZES=... BTOP=... node wgold.mjs
*/
import { chromium } from 'playwright-core';
import { readFileSync } from 'node:fs';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const c = await b.newContext({ viewport: { width: 200, height: 356 }, locale: 'ja-JP' });
await c.addInitScript(readFileSync(import.meta.dirname + '/vclock.js', 'utf8'));
if (process.env.SIZES) await c.addInitScript('window.__SIZES = ' + JSON.stringify(process.env.SIZES.split(',').map(Number)));
if (process.env.BTOP) await c.addInitScript('window.__BTOP = ' + Number(process.env.BTOP));
const p = await c.newPage();
p.on('pageerror', e => console.log('PAGEERROR', '' + e));
await p.goto('file://' + import.meta.dirname + '/lab.html');
await p.evaluate(() => { for (let i = 0; i < 120; i++) window.__vstep(); });

const geo = await p.evaluate(() => ({
  L: __dbg.LEFT, R: __dbg.RIGHT, F: __dbg.FLOOR, T: __dbg.BARREL_TOP,
  gold: __dbg.SUSHI[10].hw * 2, ise: __dbg.SUSHI[9].hw * 2
}));
console.log(`桶の内寸 ${geo.R - geo.L} × ${geo.F - geo.T}   金の桶 ${geo.gold}   伊勢海老 ${geo.ise}`);

async function trial(name, spawns, frames = 1400) {
  const r = await p.evaluate(async ({ sp, fr }) => {
    window.__vclearTimers();
    __dbg.begin('normal');
    __dbg.clear();
    window.__made = {};
    sp.forEach(s => __dbg.spawn(s[0], s[1], s[2]));
    for (let i = 0; i < fr; i++) window.__vstep();
    return { st: __dbg.state(), made: window.__made,
             bs: __dbg.bodies().map(x => ({ lv: x.lv, x: Math.round(x.x), y: Math.round(x.y), top: Math.round(x.minY) })),
             dead: __dbg.DEAD_Y };
  }, { sp: spawns, fr: frames });
  const golds = r.bs.filter(x => x.lv === 10);
  const top = r.bs.length ? Math.min(...r.bs.map(x => x.top)) : 9999;
  console.log(`\n■ ${name}`);
  console.log('  残り:', r.bs.map(x => `lv${x.lv}(${x.x},${x.y})`).join(' ') || '（空＝合体して消えた）');
  console.log(`  金の桶 ${golds.length} 個  山の頂 ${top} / 死線 ${r.dead}  ${top < r.dead ? '★死線を越えた' : '余裕あり'}  state=${r.st}`);
  return r;
}

const cx = (geo.L + geo.R) / 2, g = geo.gold;
/* 1) 二つ横に並べて置けるか（触れないよう少し離す） */
await trial('金の桶 ×2 横に並べる', [[10, cx - g / 2 - 3, geo.F - g / 2 - 4], [10, cx + g / 2 + 3, geo.F - g / 2 - 4]]);
/* 2) 二つ縦に積めるか */
await trial('金の桶 ×2 縦に積む', [[10, cx, geo.F - g / 2 - 4], [10, cx, geo.F - g * 1.5 - 10]]);
/* 3) 触れさせて合体するか（W 金の桶が成立するか） */
await trial('金の桶 ×2 触れさせる', [[10, cx - g / 2 + 6, geo.F - g / 2 - 4], [10, cx + g / 2 - 6, geo.F - g / 2 - 4]]);
/* 4) 一個ある所に、伊勢海老二匹を持ち込めるか */
await trial('金の桶 + 伊勢海老 ×2', [[10, cx - g / 2, geo.F - g / 2 - 4],
                                    [9, cx + geo.ise / 2 - 20, geo.F - 40],
                                    [9, cx + geo.ise / 2 - 20, geo.F - 120]]);
await b.close();
