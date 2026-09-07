/* ゲームの画面写真を撮る。
   表紙の絵より、実際に動いている画面のほうが伝わる。

   置き方を決める頭は tools/sim/bot.js をそのまま借りる。
   ただし早送り用の仕掛け（描画を止める・時計を進める）は外して、
   本物の時間で普通に遊ばせる。そうしないと絵が撮れない。

       node site/tools/shots.mjs

   撮ったままの絵は assets/shots/raw に置く。
   配る形（jpg と webp）にするのは tools/images.py の仕事。
*/
import { chromium } from 'playwright-core';
import { mkdirSync, existsSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const SITE = new URL('..', import.meta.url).pathname.replace(/\/$/, '');
const ROOT = SITE + '/..';
const SIM = ROOT + '/tools/sim';
const OUT = SITE + '/assets/shots/raw';
const CHROME = process.env.CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const PLAY = SITE + '/works/sushitsumu/play/index.html';
if (!existsSync(PLAY)) { console.error('ゲーム本体がありません。先に build.mjs を。'); process.exit(1); }
mkdirSync(OUT, { recursive: true });

/* 中を覗ける写し（lab.html）を作る。配布物には手を入れない */
execFileSync(process.execPath, [SIM + '/make-lab.mjs'], { stdio: 'ignore' });
const LAB = 'file://' + SIM + '/lab.html';

/* bot.js の頭（描画を止める部分）だけ落として使う */
const BOT = readFileSync(SIM + '/bot.js', 'utf8').slice(
  readFileSync(SIM + '/bot.js', 'utf8').indexOf('window.__CFG'));

const AUTO = `
  window.__vstep = function () {};        /* 実時間で動くので、時計は触らない */
  window.__vclearTimers = function () {};
  ${BOT}
  window.__auto = function () {
    __lab.start('normal');
    (function f() { if (!__lab.chunk(1).over) requestAnimationFrame(f); })();
  };
  window.__st = function () { return __lab.chunk(0); };
`;

const b = await chromium.launch({ executablePath: CHROME });

/* 一局まるごと遊ばせて、終わる直前の絵を残す。
   何度も撮り直して上書きするので、最後に残るのが一番積み上がった姿になる */
async function playShot(p, file, budget) {
  await p.evaluate(AUTO + '; __auto();');
  const end = Date.now() + budget;
  let last = null;
  while (Date.now() < end) {
    await p.waitForTimeout(1500);
    const st = await p.evaluate('__st()');
    if (st.over) break;
    await p.screenshot({ path: file });
    last = st;
  }
  return last;
}

/* 1. 表紙（たて） */
const c = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, locale: 'ja-JP' });
const p = await c.newPage();
await p.goto('file://' + PLAY);
await p.waitForTimeout(1400);
await p.screenshot({ path: OUT + '/title.png' });

/* 2. 遊んでいるところ（たて） */
await p.goto(LAB);
await p.waitForTimeout(1200);
let st = await playShot(p, OUT + '/play.png', 210000);
console.log('たて: ' + (st ? st.score + ' 点 / ' + st.drops + ' 個' : '撮れず'));

/* 3. 寿司図鑑 */
await p.goto('file://' + PLAY);
await p.waitForTimeout(1000);
try {
  await p.locator('#openDex').click({ timeout: 1500 });
  await p.waitForTimeout(800);
  await p.screenshot({ path: OUT + '/dex.png' });
} catch (e) {
  console.log('図鑑は撮れませんでした（画面の出方が変わったかもしれません）');
}

/* 4. パソコンの画面（番付の柱つき）
   画面の大きさを変えた直後は、背景の下地が描き直る前で縞になる。
   読み直してから、たっぷり待ってから撮る */
await p.setViewportSize({ width: 1360, height: 850 });
await p.goto(LAB);
await p.waitForTimeout(2400);
st = await playShot(p, OUT + '/desktop.png', 210000);
console.log('よこ: ' + (st ? st.score + ' 点 / ' + st.drops + ' 個' : '撮れず'));

await b.close();
console.log('画面写真を ' + OUT + ' に置きました');
