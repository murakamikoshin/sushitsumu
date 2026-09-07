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
let out = src.replace('function orderMade(level) {\n  if (level > maxLevelMade) maxLevelMade = level;',
  'function orderMade(level) {\n  if (level > maxLevelMade) maxLevelMade = level;\n  if (window.__made) window.__made[level] = (window.__made[level] || 0) + 1;');
const i = out.lastIndexOf('\n})();\n</script>');
out = out.slice(0, i) + '\n' + hook + out.slice(i);
writeFileSync(new URL('./lab.html', import.meta.url), out);
console.log('lab.html を書きました');
