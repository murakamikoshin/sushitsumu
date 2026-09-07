/* ============================================================
   Koshin Studio — 動き
   外の library は入れない。粒は米粒のつもりで、静かに漂わせる。
   動きを嫌う設定（prefers-reduced-motion）なら、全部止める。
   ============================================================ */
(function () {
  'use strict';
  var calm = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---- 現れ方 ---- */
  var rv = document.querySelectorAll('.rv');
  if (!('IntersectionObserver' in window) || calm) {
    for (var i = 0; i < rv.length; i++) rv[i].classList.add('on');
  } else {
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        if (!e.isIntersecting) return;
        var d = e.target.getAttribute('data-delay') || 0;
        setTimeout(function () { e.target.classList.add('on'); }, d * 1);
        io.unobserve(e.target);
      });
    }, { rootMargin: '0px 0px -12% 0px', threshold: .06 });
    for (var j = 0; j < rv.length; j++) io.observe(rv[j]);
  }

  /* ---- 見出しの一字ずつ ---- */
  var mark = document.querySelector('.hero .mark');
  if (mark && !mark.dataset.split) {
    mark.dataset.split = '1';
    var txt = mark.textContent, out = '';
    for (var k = 0; k < txt.length; k++) {
      var ch = txt[k];
      out += ch === ' '
        ? '<span style="width:.34em">&nbsp;</span>'
        : '<span style="animation-delay:' + (0.16 + k * 0.045).toFixed(3) + 's">' + ch + '</span>';
    }
    mark.innerHTML = out;
  }

  /* ---- 作品札：指の位置に光を寄せる ---- */
  var works = document.querySelectorAll('.work');
  for (var w = 0; w < works.length; w++) {
    (function (el) {
      el.addEventListener('pointermove', function (e) {
        var r = el.getBoundingClientRect();
        el.style.setProperty('--mx', (e.clientX - r.left) + 'px');
        el.style.setProperty('--my', (e.clientY - r.top) + 'px');
      });
    })(works[w]);
  }

  /* ---- 漂う粒 ---- */
  var cv = document.getElementById('motes');
  if (!cv || calm) return;
  var c = cv.getContext('2d');
  var W = 0, H = 0, dpr = 1, parts = [], px = 0, py = 0, tx = 0, ty = 0;

  function seed() {
    var n = Math.round(Math.min(78, Math.max(26, (W * H) / 26000)));
    parts = [];
    for (var i = 0; i < n; i++) {
      var z = Math.random();                       // 奥行き。奥ほど小さく淡く遅い
      parts.push({
        x: Math.random() * W, y: Math.random() * H,
        z: z, r: 0.7 + z * 2.5,
        vy: -(0.05 + z * 0.22), vx: (Math.random() - .5) * 0.12,
        a: 0.06 + z * 0.30,
        ph: Math.random() * Math.PI * 2, sw: 0.25 + Math.random() * 0.75,
        gold: Math.random() < 0.18
      });
    }
  }
  function resize() {
    dpr = Math.min(2, window.devicePixelRatio || 1);
    W = cv.clientWidth; H = cv.clientHeight;
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    seed();
  }
  window.addEventListener('resize', resize);
  window.addEventListener('pointermove', function (e) {
    tx = (e.clientX / window.innerWidth - .5) * 26;
    ty = (e.clientY / window.innerHeight - .5) * 18;
  });

  var t = 0;
  function frame() {
    requestAnimationFrame(frame);
    t += 0.006;
    px += (tx - px) * 0.045; py += (ty - py) * 0.045;
    c.clearRect(0, 0, W, H);
    for (var i = 0; i < parts.length; i++) {
      var p = parts[i];
      p.y += p.vy; p.x += p.vx + Math.sin(t * p.sw + p.ph) * 0.18;
      if (p.y < -12) { p.y = H + 12; p.x = Math.random() * W; }
      if (p.x < -12) p.x = W + 12; else if (p.x > W + 12) p.x = -12;
      var x = p.x + px * (0.25 + p.z), y = p.y + py * (0.25 + p.z);
      var tw = 0.72 + 0.28 * Math.sin(t * 2.1 + p.ph);
      c.beginPath();
      c.arc(x, y, p.r, 0, 6.2832);
      c.fillStyle = p.gold
        ? 'rgba(232,182,44,' + (p.a * tw * 0.85).toFixed(3) + ')'
        : 'rgba(236,230,216,' + (p.a * tw).toFixed(3) + ')';
      c.fill();
    }
  }
  resize();
  requestAnimationFrame(frame);
})();

/* ---- 種類で絞る（Works） ---- */
(function () {
  var chips = document.querySelectorAll('.chip');
  var list = document.getElementById('worklist');
  if (!chips.length || !list) return;
  var items = list.querySelectorAll('li');
  var empty = document.getElementById('empty');
  for (var i = 0; i < chips.length; i++) {
    chips[i].addEventListener('click', function () {
      var f = this.getAttribute('data-f'), shown = 0;
      for (var c = 0; c < chips.length; c++) chips[c].classList.toggle('on', chips[c] === this);
      for (var k = 0; k < items.length; k++) {
        var ok = (f === 'all' || items[k].getAttribute('data-kind') === f);
        items[k].hidden = !ok;
        if (ok) { shown++; items[k].classList.add('on'); }
      }
      if (empty) empty.hidden = shown > 0;
      try { history.replaceState(null, '', f === 'all' ? location.pathname : '#' + f); } catch (e) {}
    });
  }
  var h = (location.hash || '').slice(1);
  if (h) for (var m = 0; m < chips.length; m++)
    if (chips[m].getAttribute('data-f') === h) chips[m].click();
})();
