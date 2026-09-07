/* あいさつの声が、ちゃんと声になっているかを見る。

   OfflineAudioContext に同じものを組んで波形を取り出し、
     ・全体の長さ
     ・音が割れていないか（頭打ち）
     ・母音・子音の一つ一つに、ちゃんと音が出ているか
   を確かめる。声色の良し悪しは測れないが、
   「鳴らなくなった」「割れた」「途中で落ちた」は必ず捕まる。

       node site/tools/voice-check.mjs
*/
import { chromium } from 'playwright-core';
import { readFileSync } from 'node:fs';

const SITE = new URL('..', import.meta.url).pathname.replace(/\/$/, '');
const CHROME = process.env.CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const SR = 24000;

const b = await chromium.launch({ executablePath: CHROME });
const p = await (await b.newContext()).newPage();
await p.setContent('<!doctype html><meta charset="utf-8"><title>voice</title>');
await p.addScriptTag({ content: readFileSync(SITE + '/voice.js', 'utf8') });

const r = await p.evaluate(async (SR) => {
  const V = window.KoshinVoice;
  const marks = V.marks();
  const dur = marks[marks.length - 1].b + 0.6;
  const ac = new OfflineAudioContext(1, Math.ceil(dur * SR), SR);
  V.render(ac);
  const buf = await ac.startRendering();
  const d = buf.getChannelData(0);
  /* 5 ミリ秒ごとの実効値。位置で当たりを付けられるように粗く畳む */
  const step = Math.round(SR * 0.005), env = [];
  for (let i = 0; i + step <= d.length; i += step) {
    let s = 0;
    for (let j = 0; j < step; j++) s += d[i + j] * d[i + j];
    env.push(Math.sqrt(s / step));
  }
  let peak = 0, clipped = 0;
  for (let i = 0; i < d.length; i++) {
    const a = Math.abs(d[i]);
    if (a > peak) peak = a;
    if (a > 0.999) clipped++;
  }
  const rmsIn = (a, bb) => {
    const i0 = Math.max(0, Math.floor(a / 0.005)), i1 = Math.min(env.length, Math.ceil(bb / 0.005));
    let m = 0;
    for (let i = i0; i < i1; i++) m = Math.max(m, env[i]);
    return m;
  };
  return {
    dur: buf.duration, peak, clipped,
    parts: marks.map((m) => ({ k: m.k, a: +m.a.toFixed(3), b: +m.b.toFixed(3), rms: +rmsIn(m.a, m.b).toFixed(4) })),
  };
}, SR);
await b.close();

const bad = [];
if (r.dur < 1.4 || r.dur > 5.0) bad.push(`長さが変（${r.dur.toFixed(2)} 秒）`);
if (r.peak < 0.05) bad.push(`音が小さすぎる（頂点 ${r.peak.toFixed(3)}）`);
if (r.peak > 0.99 || r.clipped > 0) bad.push(`音が割れている（頭打ち ${r.clipped} 点）`);
const quiet = r.parts.filter((x) => x.rms < 0.004);
if (quiet.length) bad.push('鳴っていない音: ' + quiet.map((x) => `${x.k}@${x.a}`).join(' '));

console.log(`長さ ${r.dur.toFixed(2)} 秒 / 頂点 ${r.peak.toFixed(3)} / 音 ${r.parts.length} 個`);
console.log(r.parts.map((x) => `${x.k}:${x.rms}`).join(' '));
if (bad.length) { console.error('\n問題:'); bad.forEach((x) => console.error('  ' + x)); process.exit(1); }
console.log('\nあいさつの声は出ています。');
