/* index.html の写しに、中を覗くための窓だけを足す。配布物は触らない */
import { readFileSync, writeFileSync } from 'node:fs';
const src = readFileSync(new URL('../../index.html', import.meta.url), 'utf8');
const hook = `
window.__dbg = {
  SUSHI: SUSHI, W: W, H: H, LEFT: LEFT, RIGHT: RIGHT, FLOOR: FLOOR,
  BARREL_TOP: BARREL_TOP, DEAD_Y: DEAD_Y, DROP_INTERVAL: DROP_INTERVAL,
  begin: function (m) { beginGame(m); },
  forceOver: function () { gameOver(); },
  state: function () { return state; },
  score: function () { return score; },
  cur: function () { return current; },
  nxt: function () { return next; },
  maxMade: function () { return maxLevelMade; },
  chainBest: function () { return chainBest; },
  canDrop: function () { return state === 'ready' && !!current && !dropLock; },
  halfW: function (it) { return itemHalfWidth(it); },
  dropAt: function (x) {
    if (state !== 'ready' || !current || dropLock) return false;
    previewX = x; previewY = DROP_Y; clampPreview(); dropCurrent(); return true;
  },
  spawn: function (lv, x, y) { Composite.add(world, makeSushi(lv, x, y)); return true; },
  clear: function () {
    var bs = Composite.allBodies(world);
    for (var i = 0; i < bs.length; i++) if (!bs[i].isStatic) Composite.remove(world, bs[i]);
  },
  bodies: function () {
    var out = [], bs = Composite.allBodies(world), i, b;
    for (i = 0; i < bs.length; i++) {
      b = bs[i]; if (b.isStatic || !(b.sushi || b.gari)) continue;
      out.push({ x: b.position.x, y: b.position.y, ang: b.angle,
                 lv: b.sushi ? b.sushi.level : -1, gari: !!b.gari,
                 sp: Math.abs(b.velocity.x) + Math.abs(b.velocity.y),
                 av: Math.abs(b.angularVelocity),
                 minX: b.bounds.min.x, maxX: b.bounds.max.x,
                 minY: b.bounds.min.y, maxY: b.bounds.max.y });
    }
    return out;
  }
};
`;
/* 寸法をまるごと差し替えられるようにする。
   段ごとの倍率を window.__SIZES で渡すと、その通りに組み直す。
   配布物は触らず、写しの中だけで効く */
/* 出てくるネタの割り振りも振れるようにする */
const rollHook = `  if (window.__SPAWNW) {
    var __w = window.__SPAWNW, __t = 0, __k, __r;
    for (__k = 0; __k < __w.length; __k++) __t += __w[__k];
    __r = rnd() * __t;
    for (__k = 0; __k < __w.length; __k++) { __r -= __w[__k]; if (__r < 0) return { level: __k }; }
    return { level: 0 };
  }
`;
const sizeHook = `if (window.__SIZES) {
  for (var __i = 0; __i < SUSHI.length && __i < window.__SIZES.length; __i++) {
    var __s = window.__SIZES[__i], __d = SUSHI[__i];
    if (__d.shape === 'circle') { __d.r = Math.round(__d.r * __s); }
    else { __d.w = Math.round(__d.w * __s); __d.h = Math.round(__d.h * __s);
           if (__d.ch) __d.ch = Math.round(__d.ch * __s); }
  }
}
`;
let out = src.replace('function orderMade(level) {\n  if (level > maxLevelMade) maxLevelMade = level;',
  'function orderMade(level) {\n  if (level > maxLevelMade) maxLevelMade = level;\n  if (window.__made) window.__made[level] = (window.__made[level] || 0) + 1;');
{
  const a3 = 'var DEAD_Y = BARREL_TOP + 6;';
  if (out.indexOf(a3) < 0) throw new Error('桶の縁を差し込む場所が見つかりません');
  out = out.replace(a3, 'if (window.__BTOP) BARREL_TOP = window.__BTOP;\n' + a3);
}
{
  const a2 = "  return { level: Math.floor(rnd() * 3) };";
  if (out.indexOf(a2) < 0) throw new Error('ネタの割り振りを差し込む場所が見つかりません');
  out = out.replace(a2, rollHook + a2);
}
{
  const anchor = 'SUSHI.forEach(function (d) {';
  const at = out.indexOf(anchor);
  if (at < 0) throw new Error('寸法を差し込む場所が見つかりません');
  out = out.slice(0, at) + sizeHook + out.slice(at);
}
const i = out.lastIndexOf('\n})();\n</script>');
out = out.slice(0, i) + '\n' + hook + out.slice(i);
writeFileSync(new URL('./lab.html', import.meta.url), out);
console.log('lab.html を書きました');
