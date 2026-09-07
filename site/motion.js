/* ============================================================
   Koshin Studio — 動き

   使っているもの（すべて vendor/ に置いた自前配信。外部 CDN に繋がない）
     GSAP + ScrollTrigger … 立ち上がりの筋書きと、スクロール連動
     Lenis                … 滑らかなスクロール
   粒と、ロゴの周りを回る札は、軽さのために手書きの canvas / transform。

   動きを嫌う設定（prefers-reduced-motion）なら、全部止めて静止画にする。
   ============================================================ */
(function () {
  'use strict';
  var calm = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var G = window.gsap;
  if (G && window.ScrollTrigger) G.registerPlugin(window.ScrollTrigger);

  /* ---------- 滑らかなスクロール ---------- */
  if (window.Lenis && !calm && !('ontouchstart' in window)) {
    var lenis = new window.Lenis({ duration: 1.05, smoothWheel: true });
    if (G) {
      lenis.on('scroll', window.ScrollTrigger.update);
      G.ticker.add(function (t) { lenis.raf(t * 1000); });
      G.ticker.lagSmoothing(0);
    } else {
      requestAnimationFrame(function r(t) { lenis.raf(t); requestAnimationFrame(r); });
    }
  }

  /* ---------- 立ち上がり ---------- */
  var lock = document.querySelector('.lockup');
  if (G && lock && !calm) {
    var tl = G.timeline({ defaults: { ease: 'power3.out' } });
    tl.from('.logo-xl .l1', { yPercent: 118, opacity: 0, duration: 1.05 })
      .from('.logo-xl .l2', { yPercent: 118, opacity: 0, duration: 1.05 }, '-=0.86')
      .to('.hairline', { width: 'min(280px, 62%)', duration: .9, ease: 'power2.inOut' }, '-=0.5')
      .from('.tagline', { y: 16, opacity: 0, duration: .8 }, '-=0.55')
      .from('.hero-act > *', { y: 20, opacity: 0, duration: .7, stagger: .09 }, '-=0.45')
      .from('.cue', { opacity: 0, duration: .7 }, '-=0.3')
      .from('.orb', { scale: .25, opacity: 0, duration: 1.15, stagger: { each: .07, from: 'random' },
                      ease: 'back.out(1.5)' }, 0.35);
  } else {
    var hl = document.querySelector('.hairline');
    if (hl) hl.style.width = 'min(280px, 62%)';
  }

  /* ---------- 現れ方（GSAP が無くても動く） ---------- */
  var rv = document.querySelectorAll('.rv');
  if (calm) {
    for (var i = 0; i < rv.length; i++) rv[i].classList.add('on');
  } else if (G && window.ScrollTrigger) {
    for (var g = 0; g < rv.length; g++) {
      (function (el) {
        G.fromTo(el, { y: 26, opacity: 0 }, {
          y: 0, opacity: 1, duration: .9, ease: 'power3.out',
          delay: (Number(el.getAttribute('data-delay')) || 0) / 1000,
          scrollTrigger: { trigger: el, start: 'top 88%', once: true }
        });
        el.classList.add('on');
      })(rv[g]);
    }
  } else if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        if (!e.isIntersecting) return;
        setTimeout(function () { e.target.classList.add('on'); },
          Number(e.target.getAttribute('data-delay')) || 0);
        io.unobserve(e.target);
      });
    }, { rootMargin: '0px 0px -12% 0px', threshold: .06 });
    for (var j = 0; j < rv.length; j++) io.observe(rv[j]);
  } else {
    for (var k = 0; k < rv.length; k++) rv[k].classList.add('on');
  }

  /* ---------- 代表作の絵：スクロールで奥行きを出す ---------- */
  if (G && window.ScrollTrigger && !calm) {
    var media = document.querySelector('.feat-media');
    if (media) {
      G.fromTo(media, { scale: 1.14, yPercent: -4 }, {
        scale: 1, yPercent: 0, ease: 'none',
        scrollTrigger: { trigger: media, start: 'top bottom', end: 'bottom top', scrub: .6 }
      });
    }
    /* 数字を数え上げる */
    document.querySelectorAll('[data-count]').forEach(function (el) {
      var to = Number(el.getAttribute('data-count')) || 0, o = { v: 0 };
      G.to(o, {
        v: to, duration: 1.5, ease: 'power2.out',
        onUpdate: function () { el.textContent = Math.round(o.v).toLocaleString('ja-JP'); },
        scrollTrigger: { trigger: el, start: 'top 86%', once: true }
      });
    });
    /* 締めの一行 */
    var cl = document.querySelector('.closing-line');
    if (cl) {
      G.from(cl, { yPercent: 14, opacity: 0, duration: 1, ease: 'power3.out',
        scrollTrigger: { trigger: cl, start: 'top 84%', once: true } });
    }
  } else {
    document.querySelectorAll('[data-count]').forEach(function (el) {
      el.textContent = Number(el.getAttribute('data-count')).toLocaleString('ja-JP');
    });
  }

  /* ---------- ロゴの周りを回る札 ---------- */
  var orbit = document.getElementById('orbit');
  if (orbit) {
    var orbs = [].slice.call(orbit.querySelectorAll('.orb'));
    var n = orbs.length, ang = 0, spin = 1, hover = false;
    var lockEl = document.querySelector('.lockup');
    function place(now) {
      var box = orbit.getBoundingClientRect();
      /* ロゴの実寸を測って、札がそこへ食い込まない半径にする */
      var lb = lockEl ? lockEl.getBoundingClientRect() : { width: 0, height: 0 };
      var cw = orbs[0] ? orbs[0].offsetWidth : 120;
      var ch = orbs[0] ? orbs[0].offsetHeight : 150;
      /* ロゴの箱（札の半分ぶん膨らませたもの）。ここへは絶対に入れない */
      var Wc = lb.width / 2 + cw / 2 + 26;
      var Hc = lb.height / 2 + ch / 2 + 34;
      var rx = Math.min(box.width / 2 - cw / 2 - 6, Math.max(box.width * 0.30, Wc));
      var ry = Math.min(box.height / 2 - ch / 2 - 4, Math.max(box.height * 0.22, Hc));
      if (!calm) ang += 0.0022 * spin;
      for (var i = 0; i < n; i++) {
        var a = ang + (i / n) * Math.PI * 2;
        var z = Math.cos(a);
        var x = Math.sin(a) * rx;
        var y = -z * ry;
        /* 楕円の上では、斜めの位置がロゴの角に噛む。噛むぶんだけ外へ押し出す */
        y += Math.sin(now / 1400 + i) * 5;
        if (Math.abs(x) < Wc && Math.abs(y) < Hc) {
          var need = Math.min(Wc / Math.max(1, Math.abs(x)), Hc / Math.max(1, Math.abs(y)));
          x *= need; y *= need;
        }
        var s2 = 0.58 + 0.42 * (z + 1) / 2;
        var o = 0.26 + 0.74 * (z + 1) / 2;
        var el = orbs[i];
        el.style.transform = 'translate3d(' + x.toFixed(1) + 'px,' + y.toFixed(1) + 'px,0) scale(' + s2.toFixed(3) + ')';
        el.style.opacity = o.toFixed(3);
        el.style.zIndex = String(20 + Math.round(z * 28));
        el.style.filter = z < -0.1 ? 'blur(' + ((-z - 0.1) * 2.6).toFixed(2) + 'px)' : 'none';
      }
    }
    orbit.addEventListener('pointerenter', function () { hover = true; }, true);
    orbit.addEventListener('pointerleave', function () { hover = false; }, true);
    (function loop(t) {
      requestAnimationFrame(loop);
      spin += ((hover ? 0.22 : 1) - spin) * 0.06;
      place(t || 0);
    })(0);
  }

  /* ---------- ロゴを押すと弾ける ---------- */
  (function () {
    var xl = document.querySelector('.logo-xl');
    if (!xl) return;
    xl.style.pointerEvents = 'auto';
    xl.style.cursor = 'pointer';
    var bc = document.createElement('canvas');
    bc.id = 'burst';
    document.body.appendChild(bc);
    var bx = bc.getContext('2d'), bits = [], bw = 0, bh = 0, bd = 1;
    function bsize() {
      bd = Math.min(2, window.devicePixelRatio || 1);
      bw = window.innerWidth; bh = window.innerHeight;
      bc.width = Math.round(bw * bd); bc.height = Math.round(bh * bd);
      bx.setTransform(bd, 0, 0, bd, 0, 0);
    }
    bsize(); window.addEventListener('resize', bsize);
    var COL = ['#e8b62c', '#f6d98a', '#ece6d8', '#d8543f', '#7fa8d8'];
    function pop(cx, cy) {
      for (var i = 0; i < 92; i++) {
        var a = Math.random() * 6.2832, v = 2.4 + Math.random() * 9.5;
        bits.push({ x: cx, y: cy, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 2.2,
          r: 1.1 + Math.random() * 3.4, life: 1,
          c: COL[(Math.random() * COL.length) | 0], sp: Math.random() * 6.28 });
      }
      if (G && !calm) {
        G.fromTo(xl, { scale: .965 }, { scale: 1, duration: .85, ease: 'elastic.out(1,.42)' });
        G.fromTo('.logo-xl .l2', { filter: 'brightness(2.4)' },
          { filter: 'brightness(1)', duration: .8, ease: 'power2.out' });
      }
    }
    xl.addEventListener('pointerdown', function (e) {
      var r = xl.getBoundingClientRect();
      pop(e.clientX || r.left + r.width / 2, e.clientY || r.top + r.height / 2);
    });
    (function bloop() {
      requestAnimationFrame(bloop);
      bx.clearRect(0, 0, bw, bh);
      for (var i = bits.length - 1; i >= 0; i--) {
        var p = bits[i];
        p.vy += 0.19; p.vx *= 0.988; p.vy *= 0.988;
        p.x += p.vx; p.y += p.vy; p.life -= 0.0125; p.sp += 0.2;
        if (p.life <= 0) { bits.splice(i, 1); continue; }
        bx.globalAlpha = Math.max(0, p.life);
        bx.fillStyle = p.c;
        bx.beginPath();
        bx.ellipse(p.x, p.y, p.r, p.r * (0.5 + 0.5 * Math.abs(Math.cos(p.sp))), p.sp, 0, 6.2832);
        bx.fill();
      }
      bx.globalAlpha = 1;
    })();
  })();

  /* ---------- 漂う粒 ---------- */
  var cv = document.getElementById('motes');
  if (!cv || calm) return;
  var c = cv.getContext('2d');
  var W = 0, H = 0, dpr = 1, parts = [], px = 0, py = 0, tx = 0, ty = 0;
  function seed() {
    var num = Math.round(Math.min(80, Math.max(26, (W * H) / 25000)));
    parts = [];
    for (var i = 0; i < num; i++) {
      var z = Math.random();
      parts.push({ x: Math.random() * W, y: Math.random() * H, z: z, r: 0.7 + z * 2.5,
        vy: -(0.05 + z * 0.22), vx: (Math.random() - .5) * 0.12, a: 0.06 + z * 0.30,
        ph: Math.random() * 6.283, sw: 0.25 + Math.random() * 0.75, gold: Math.random() < 0.18 });
    }
  }
  function resize() {
    dpr = Math.min(2, window.devicePixelRatio || 1);
    W = cv.clientWidth; H = cv.clientHeight;
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    c.setTransform(dpr, 0, 0, dpr, 0, 0); seed();
  }
  window.addEventListener('resize', resize);
  window.addEventListener('pointermove', function (e) {
    tx = (e.clientX / window.innerWidth - .5) * 26;
    ty = (e.clientY / window.innerHeight - .5) * 18;
  });
  var t0 = 0;
  function frame() {
    requestAnimationFrame(frame);
    t0 += 0.006;
    px += (tx - px) * 0.045; py += (ty - py) * 0.045;
    c.clearRect(0, 0, W, H);
    for (var i = 0; i < parts.length; i++) {
      var p = parts[i];
      p.y += p.vy; p.x += p.vx + Math.sin(t0 * p.sw + p.ph) * 0.18;
      if (p.y < -12) { p.y = H + 12; p.x = Math.random() * W; }
      if (p.x < -12) p.x = W + 12; else if (p.x > W + 12) p.x = -12;
      var x = p.x + px * (0.25 + p.z), y = p.y + py * (0.25 + p.z);
      var tw = 0.72 + 0.28 * Math.sin(t0 * 2.1 + p.ph);
      c.beginPath(); c.arc(x, y, p.r, 0, 6.2832);
      c.fillStyle = p.gold ? 'rgba(232,182,44,' + (p.a * tw * .85).toFixed(3) + ')'
                           : 'rgba(236,230,216,' + (p.a * tw).toFixed(3) + ')';
      c.fill();
    }
  }
  resize(); requestAnimationFrame(frame);

  /* ---------- 種類で絞る（Works） ---------- */
  var chips = document.querySelectorAll('.chip');
  var list = document.getElementById('worklist');
  if (!chips.length || !list) return;
  var items = list.querySelectorAll('li');
  var empty = document.getElementById('empty');
  for (var m = 0; m < chips.length; m++) {
    chips[m].addEventListener('click', function () {
      var f = this.getAttribute('data-f'), shown = 0;
      for (var q = 0; q < chips.length; q++) chips[q].classList.toggle('on', chips[q] === this);
      for (var r = 0; r < items.length; r++) {
        var ok = (f === 'all' || items[r].getAttribute('data-kind') === f);
        items[r].hidden = !ok;
        if (ok) { shown++; items[r].classList.add('on'); items[r].style.opacity = 1; items[r].style.transform = 'none'; }
      }
      if (empty) empty.hidden = shown > 0;
      try { history.replaceState(null, '', f === 'all' ? location.pathname : '#' + f); } catch (e) {}
    });
  }
  var h = (location.hash || '').slice(1);
  if (h) for (var v = 0; v < chips.length; v++)
    if (chips[v].getAttribute('data-f') === h) chips[v].click();
})();
