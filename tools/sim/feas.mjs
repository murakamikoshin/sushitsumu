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
async function trial(name, spawns, frames = 900) {
  await p.evaluate((sp) => {
    window.__vclearTimers();
    __dbg.begin('normal');
    __dbg.clear();
    window.__made = {};
    sp.forEach(s => __dbg.spawn(s[0], s[1], s[2]));
  }, spawns);
  await p.evaluate((f) => { for (let i = 0; i < f; i++) window.__vstep(); }, frames);
  const r = await p.evaluate(() => ({
    st: __dbg.state(), made: window.__made,
    bs: __dbg.bodies().map(b => ({ lv: b.lv, y: Math.round(b.y), x: Math.round(b.x),
      top: Math.round(b.minY), deg: Math.round(b.ang * 180 / Math.PI) })),
    dead: __dbg.DEAD_Y, floor: __dbg.FLOOR
  }));
  const top = Math.min(...r.bs.map(x => x.top));
  console.log(`\n■ ${name}`);
  console.log('  結果:', r.bs.map(x => `${N[x.lv]}(top=${x.top},${x.deg}°)`).join(' / ') || '（空）');
  console.log(`  山の頂 = ${top}   死線 = ${r.dead}   → ${top < r.dead ? '死線を越えている' : '余裕あり'}   state=${r.st}`);
  return r;
}

// 1) 伊勢海老 2 匹は金の桶になるか
await trial('伊勢海老 ×2 → 金の桶', [[9, 180, 520], [9, 180, 380]]);
// 2) 金の桶が桶に収まるか
await trial('金の桶 単体', [[10, 180, 500]]);
// 3) 最終局面：伊勢海老 1 + 穴子 2（2匹目を作る直前）
await trial('伊勢海老 + 穴子 ×2', [[9, 180, 560], [8, 180, 460], [8, 180, 380]]);
// 4) その一段手前：伊勢海老 + 穴子 + 大トロ ×2
await trial('伊勢海老 + 穴子 + 大トロ ×2', [[9, 180, 560], [8, 180, 470], [7, 105, 400], [7, 255, 400]]);
// 5) さらに手前：伊勢海老 + 穴子 + 大トロ + ウニ ×2
await trial('伊勢海老 + 穴子 + 大トロ + ウニ ×2', [[9, 180, 560], [8, 180, 470], [7, 180, 395], [6, 115, 330], [6, 245, 330]]);
await b.close();
