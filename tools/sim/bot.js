/* 描画は結果に関係しないので、重い塗りだけ空にして早送りを稼ぐ */
(function () {
  var P = CanvasRenderingContext2D.prototype;
  ['fill', 'stroke', 'fillRect', 'strokeRect', 'clearRect', 'fillText', 'strokeText',
   'drawImage', 'putImageData'].forEach(function (m) { P[m] = function () {}; });
})();

window.__CFG = window.__CFG || { wait: true, look: true };
window.__lab = (function () {
  var D = window.__dbg;
  var FLOOR = D.FLOOR;

  function surfaceAt(x, hw, bs) {
    var top = FLOOR;
    for (var i = 0; i < bs.length; i++) {
      var b = bs[i];
      if (b.maxX <= x - hw || b.minX >= x + hw) continue;
      if (b.minY < top) top = b.minY;
    }
    return top;
  }
  function roughness(x, hw, bs) {
    var lo = 1e9, hi = -1e9;
    for (var k = 0; k < 7; k++) {
      var px = x - hw + (2 * hw) * k / 6;
      var t = surfaceAt(px, 2, bs);
      if (t < lo) lo = t; if (t > hi) hi = t;
    }
    return hi - lo;
  }
  function evalDrop(x, lv, hw, bs) {
    var top = surfaceAt(x, hw, bs);
    var s = top * 10;                       // 低いところほど良い
    var merge = false, buried = 0;
    for (var i = 0; i < bs.length; i++) {
      var b = bs[i];
      if (b.maxX <= x - hw || b.minX >= x + hw) continue;
      if (b.minY > top + 10) continue;      // 表に出ていない駒は触れない
      if (b.lv === lv) merge = true;
      else if (b.lv >= 0 && b.lv < lv) buried += (lv - b.lv) * 14;
    }
    if (merge) {
      s += 12000 + lv * 900;
      for (var j = 0; j < bs.length; j++) {
        if (bs[j].lv === lv + 1 && Math.abs(bs[j].x - x) < 120) { s += 5000; break; }
      }
    } else {
      var nd = 1e9;
      for (var m = 0; m < bs.length; m++) if (bs[m].lv === lv) nd = Math.min(nd, Math.abs(bs[m].x - x));
      if (nd < 1e9) s -= Math.min(nd, 220) * 6;
      s -= buried;
    }
    return s - roughness(x, hw, bs) * 8;
  }
  /* 置いた後の姿をざっと作る（合体は 1 段だけ見る） */
  function mk(lv, x, y) {
    var d = D.SUSHI[lv];
    return { x: x, y: y, lv: lv, gari: false, sp: 0, av: 0,
             minX: x - d.hw, maxX: x + d.hw, minY: y - d.hh, maxY: y + d.hh };
  }
  function after(bs, lv, hw, x) {
    var top = surfaceAt(x, hw, bs), tgt = -1, i;
    for (i = 0; i < bs.length; i++) {
      var b = bs[i];
      if (b.maxX <= x - hw || b.minX >= x + hw) continue;
      if (b.minY > top + 10) continue;
      if (b.lv === lv) { tgt = i; break; }
    }
    var arr = [];
    for (i = 0; i < bs.length; i++) if (i !== tgt) arr.push(bs[i]);
    if (tgt >= 0) {
      var t = bs[tgt];
      arr.push(mk(Math.min(lv + 1, D.SUSHI.length - 1), (x + t.x) / 2, t.y));
    } else {
      arr.push(mk(lv, x, top - D.SUSHI[lv].hh));
    }
    return arr;
  }
  function bestScore(lv, bs) {
    var hw = D.SUSHI[lv].hw;
    var lo = D.LEFT + hw + 1, hi = D.RIGHT - hw - 1;
    if (hi <= lo) return evalDrop((D.LEFT + D.RIGHT) / 2, lv, hw, bs);
    var best = -1e18;
    for (var k = 0; k < 19; k++) {
      var v = evalDrop(lo + (hi - lo) * k / 18, lv, hw, bs);
      if (v > best) best = v;
    }
    return best;
  }

  function chooseX() {
    var cur = D.cur(); if (!cur) return null;
    var hw = D.halfW(cur);
    var lo = D.LEFT + hw + 1, hi = D.RIGHT - hw - 1;
    if (hi <= lo) return (D.LEFT + D.RIGHT) / 2;
    var bs = D.bodies();
    if (cur.gari) {                         // ガリは、上に取り残された小駒を消す
      var best = null, bs2 = -1e18;
      for (var i = 0; i < bs.length; i++) {
        var b = bs[i]; if (b.lv < 0) continue;
        var v = (FLOOR - b.minY) * 3 - b.lv * 60;
        if (v > bs2) { bs2 = v; best = b; }
      }
      return best ? Math.max(lo, Math.min(hi, best.x)) : (lo + hi) / 2;
    }
    var N = 45, cand = [];
    for (var k = 0; k < N; k++) {
      var x = lo + (hi - lo) * k / (N - 1);
      cand.push({ x: x, s: evalDrop(x, cur.level, hw, bs) });
    }
    cand.sort(function (a, b2) { return b2.s - a.s; });
    /* 上位だけ、控えのネタまで一手読む */
    var nx = D.nxt();
    if (window.__CFG.look && nx && !nx.gari) {
      var top5 = cand.slice(0, 5);
      for (var i = 0; i < top5.length; i++) {
        top5[i].s += 0.35 * bestScore(nx.level, after(bs, cur.level, hw, top5[i].x));
      }
      top5.sort(function (a, b2) { return b2.s - a.s; });
      return top5[0].x;
    }
    return cand[0].x;
  }

  var run = null;
  var WAIT_MAX = 150;          // これ以上は待たない（2.5秒）
  function settled(bs) {
    for (var i = 0; i < bs.length; i++) if (bs[i].sp > 0.55 || bs[i].av > 0.06) return false;
    return true;
  }
  function start(mode) {
    window.__vclearTimers();
    window.__made = {};
    D.begin(mode);
    run = { drops: 0, frames: 0, maxLv: 0, mode: mode, wait: 0 };
  }
  function tick() {
    window.__vstep();
    run.frames++;
    var m = D.maxMade(); if (m > run.maxLv) run.maxLv = m;
    var bs = D.bodies();
    for (var i = 0; i < bs.length; i++) if (bs[i].lv > run.maxLv) run.maxLv = bs[i].lv;
    if (D.canDrop()) {
      /* 山が揺れている間に置くと狙いが外れる。落ち着くまで待つ */
      if (window.__CFG.wait && !settled(bs) && run.wait < WAIT_MAX) { run.wait++; return; }
      run.wait = 0;
      var x = chooseX();
      if (x !== null && D.dropAt(x)) run.drops++;
    }
  }
  return {
    start: start,
    chunk: function (n) {
      for (var i = 0; i < n; i++) {
        if (D.state() === 'over') break;
        tick();
      }
      var fin = D.bodies().map(function (b) {
        return { lv: b.lv, top: Math.round(b.minY), deg: Math.round(b.ang * 180 / Math.PI) };
      });
      return { over: D.state() === 'over', score: D.score(), drops: run.drops,
               frames: run.frames, maxLv: run.maxLv, chain: D.chainBest(),
               sec: run.frames / 60, made: window.__made, fin: fin };
    }
  };
})();
