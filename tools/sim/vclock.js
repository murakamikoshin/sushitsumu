/* 仮想時計：rAF と setTimeout を自前で回し、実時間を待たずに早送りする */
(function () {
  var vnow = 0, timers = [], tid = 1, rafs = [], nextRaf = 1;
  window.__realSetTimeout = window.setTimeout.bind(window);
  performance.now = function () { return vnow; };
  window.setTimeout = function (fn, ms) {
    var id = tid++; timers.push({ id: id, at: vnow + (ms || 0), fn: fn, args: [].slice.call(arguments, 2) });
    return id;
  };
  window.clearTimeout = function (id) {
    for (var i = 0; i < timers.length; i++) if (timers[i].id === id) { timers.splice(i, 1); return; }
  };
  window.setInterval = function (fn, ms) {
    var id = tid++, every = Math.max(1, ms || 1);
    function again() { timers.push({ id: id, at: vnow + every, fn: function () { fn(); again(); } }); }
    again(); return id;
  };
  window.clearInterval = window.clearTimeout;
  window.requestAnimationFrame = function (cb) { var id = nextRaf++; rafs.push({ id: id, cb: cb }); return id; };
  window.cancelAnimationFrame = function (id) {
    for (var i = 0; i < rafs.length; i++) if (rafs[i].id === id) { rafs.splice(i, 1); return; }
  };
  window.__vstep = function () {
    vnow += 1000 / 60;
    for (var guard = 0; guard < 200; guard++) {
      var idx = -1, best = Infinity;
      for (var i = 0; i < timers.length; i++) if (timers[i].at <= vnow && timers[i].at < best) { best = timers[i].at; idx = i; }
      if (idx < 0) break;
      var t = timers.splice(idx, 1)[0];
      try { t.fn.apply(null, t.args); } catch (e) {}
    }
    var list = rafs; rafs = [];
    for (var j = 0; j < list.length; j++) { try { list[j].cb(vnow); } catch (e) {} }
  };
  window.__vnow = function () { return vnow; };
  /* 試合をまたいでタイマーが残ると落下間隔が壊れる。一戦ごとに捨てる */
  window.__vclearTimers = function () { timers.length = 0; };
})();
