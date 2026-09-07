/* ============================================================
   Koshin Studio — 出迎えの声

   「コーシンスタジオへ ようこそ」

   音声ファイルは持たない。その場で合成する。
   声帯の代わりに声門波（倍音の多い波）を作り、口の形の代わりに
   共鳴（フォルマント）を四つ重ねて、母音ごとに移し替える。
   子音は雑音の破裂と摩擦で作る。ゲームの音と同じ作り方。

   声の高さは 172Hz あたり。男声(約120)と女声(約220)の中ほどに置いて、
   どちらとも取れる声にしている。

   ブラウザは、指が触れる前に音を鳴らせない決まりになっている。
   なので最初の操作を待って一度だけ鳴らし、切った覚えは残す。
   ============================================================ */
window.KoshinVoice = (function () {
  'use strict';

  var F0 = 172;          // 声の高さ（中性）
  var VOL = 0.36;        // 控えめに（出迎えなので小さめ）
  var KEY = 'koshin.voice';

  /* ---- 母音の共鳴（Hz）。中性の声道長に合わせてある ---- */
  var V = {
    a: [ 780, 1240, 2600, 3400],
    i: [ 305, 2230, 2930, 3600],
    u: [ 355, 1240, 2400, 3380],   // 日本語のウは唇を丸めない
    e: [ 500, 1900, 2560, 3400],
    o: [ 470,  850, 2500, 3300],
    N: [ 280, 1350, 2350, 3200]    // 撥音「ん」
  };

  /* ---- 語の並び。t は長さ(秒) ---- */
  var LINE_DEFAULT = [
    { c: 'k', t: 0.052 }, { v: 'o', t: 0.20 },
    { c: 'sh', t: 0.10 }, { v: 'i', t: 0.085 },
    { v: 'N', t: 0.11, nasal: true },
    { c: 's', t: 0.095 }, { v: 'u', t: 0.045, weak: true },
    { c: 't', t: 0.048 }, { v: 'a', t: 0.095 },
    { c: 'j', t: 0.07 }, { v: 'i', t: 0.08 },
    { v: 'o', t: 0.10 },
    { v: 'e', t: 0.09 },
    { gap: 0.075 },
    { v: 'i', t: 0.035, glide: 'o' }, { v: 'o', t: 0.17 },
    { c: 'k', t: 0.05 }, { v: 'o', t: 0.085 },
    { c: 's', t: 0.095 }, { v: 'o', t: 0.185, fade: true }
  ];

  /* 子音の作り。noise=雑音の中心/幅、hold=閉鎖の間 */
  var C = {
    k:  { hold: 0.040, burst: 0.012, f: 1500, q: 1.6, g: 0.55 },
    t:  { hold: 0.036, burst: 0.010, f: 3400, q: 2.0, g: 0.50 },
    s:  { hold: 0,     burst: 0.095, f: 5600, q: 3.2, g: 0.30 },
    sh: { hold: 0,     burst: 0.100, f: 2750, q: 2.4, g: 0.34 },
    j:  { hold: 0.022, burst: 0.048, f: 2600, q: 2.6, g: 0.30, voiced: true }
  };

  var ctx = null, noiseBuf = null, playing = false;

  function makeNoise(ac) {
    var n = ac.sampleRate * 0.5;
    var b = ac.createBuffer(1, n, ac.sampleRate);
    var d = b.getChannelData(0);
    for (var i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    return b;
  }

  /* 声帯の波。
     声門波そのものは -12dB/oct で落ちるが、口から出るときに +6dB/oct
     持ち上がる。差し引き -6dB/oct（1/k）にしないと、高い共鳴を
     鳴らすだけの倍音が残らない。ここを 1/k^2 にしていて、
     F2 から上が出ていなかった。 */
  function glottal(ac) {
    var n = 56, re = new Float32Array(n), im = new Float32Array(n);
    for (var k = 1; k < n; k++) {
      var a = 1 / k;
      if (k > 26) a *= Math.pow(0.88, k - 26);   // 高い方は自然に落とす
      im[k] = a;
      re[k] = a * 0.18 * Math.sin(k * 0.7);      // わずかな非対称で肉声らしく
    }
    return ac.createPeriodicWave(re, im, { disableNormalization: false });
  }

  function build(ac, t0, LINE) {
    var out = ac.createGain();
    out.gain.value = VOL;
    /* 耳に刺さらないよう、ゆるく頭を抑える */
    var lim = ac.createDynamicsCompressor();
    lim.threshold.value = -18; lim.knee.value = 12;
    lim.ratio.value = 4; lim.attack.value = 0.004; lim.release.value = 0.18;
    out.connect(lim); lim.connect(ac.destination);

    /* 共鳴を四つ、並列で重ねる */
    var bank = [], sum = ac.createGain();
    sum.gain.value = 1;
    var GAINS = [1.0, 0.86, 0.64, 0.40];
    for (var i = 0; i < 4; i++) {
      var bp = ac.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = V.o[i];
      bp.Q.value = [6.5, 8, 10, 12][i];
      var g = ac.createGain();
      g.gain.value = GAINS[i];
      bp.connect(g); g.connect(sum);
      bank.push(bp);
    }
    /* 少しだけ素の声も混ぜて、こもりを防ぐ */
    var thru = ac.createGain(); thru.gain.value = 0.035; thru.connect(sum);

    var tilt = ac.createBiquadFilter();
    tilt.type = 'highshelf'; tilt.frequency.value = 2600; tilt.gain.value = 4;
    sum.connect(tilt); tilt.connect(out);

    /* 声帯 */
    var osc = ac.createOscillator();
    osc.setPeriodicWave(glottal(ac));
    var voice = ac.createGain();
    voice.gain.value = 0;
    osc.connect(voice);
    bank.forEach(function (b) { voice.connect(b); });
    voice.connect(thru);

    /* 息（子音の雑音） */
    var nz = ac.createBufferSource();
    nz.buffer = noiseBuf; nz.loop = true;
    var nzF = ac.createBiquadFilter(); nzF.type = 'bandpass';
    var nzG = ac.createGain(); nzG.gain.value = 0;
    nz.connect(nzF); nzF.connect(nzG); nzG.connect(out);

    /* ---- 時間に沿って組み立てる ---- */
    var t = t0, total = 0, i2;
    for (i2 = 0; i2 < LINE.length; i2++) {
      total += LINE[i2].t || LINE[i2].gap || 0;
      if (LINE[i2].c) total += C[LINE[i2].c].hold;
    }

    /* 抑揚：頭でわずかに上げ、末に向けて下げる。「ようこそ」で少し戻す */
    function pitchAt(p) {
      var base = 1.0 + 0.055 * Math.sin(Math.min(1, p * 3.2) * Math.PI) - 0.20 * p;
      if (p > 0.60 && p < 0.80) base += 0.05 * Math.sin((p - 0.60) / 0.20 * Math.PI);
      return F0 * base;
    }
    osc.frequency.setValueAtTime(pitchAt(0), t);

    /* 口の形の移り変わり。
       指数追従（setTargetAtTime）だと、届く前に次の目標へ引っ張られて
       イの F2 が 2200 まで上がりきらなかった。今いる所から目標まで
       直線で動かし、そこで止める。確実に届く。 */
    var cur = V.o.slice();
    function setV(vow, at, dur) {
      var f = V[vow];
      var lead = 0.020;
      var ramp = Math.min(0.042, Math.max(0.016, dur * 0.45));
      var t1 = Math.max(t0 + 0.001, at - lead);
      for (var k = 0; k < 4; k++) {
        bank[k].frequency.setValueAtTime(cur[k], t1);
        bank[k].frequency.linearRampToValueAtTime(f[k], t1 + ramp);
        cur[k] = f[k];
      }
    }

    var elapsed = 0;
    for (var i = 0; i < LINE.length; i++) {
      var s = LINE[i];

      if (s.gap) { voice.gain.setTargetAtTime(0.0001, t, 0.02); t += s.gap; elapsed += s.gap; continue; }

      if (s.c) {
        var c = C[s.c];
        if (c.hold) {                                   // 閉鎖：いったん黙る
          voice.gain.setTargetAtTime(0.0001, t, 0.008);
          t += c.hold; elapsed += c.hold;
        }
        nzF.frequency.setValueAtTime(c.f, t);
        nzF.Q.setValueAtTime(c.q, t);
        nzG.gain.cancelScheduledValues(t);
        nzG.gain.setValueAtTime(0.0001, t);
        nzG.gain.exponentialRampToValueAtTime(c.g, t + Math.min(0.02, c.burst * 0.4));
        nzG.gain.exponentialRampToValueAtTime(0.0001, t + c.burst);
        if (c.voiced) {                                  // 濁った子音は声も薄く乗せる
          voice.gain.setTargetAtTime(0.14, t, 0.012);
        }
        t += c.burst; elapsed += c.burst;
        continue;
      }

      /* 母音 */
      var p = elapsed / total;
      osc.frequency.setTargetAtTime(pitchAt(p), t, 0.05);
      setV(s.glide || s.v, t, s.t);
      if (s.glide) setV(s.v, t + s.t * 0.55, s.t);
      var lv = s.weak ? 0.10 : s.nasal ? 0.42 : 0.72;
      voice.gain.setTargetAtTime(lv, t, Math.max(0.008, s.t * 0.16));
      if (s.fade) {
        voice.gain.setTargetAtTime(0.0001, t + s.t * 0.45, s.t * 0.28);
      }
      t += s.t; elapsed += s.t;
    }
    voice.gain.setTargetAtTime(0.0001, t, 0.05);
    out.gain.setTargetAtTime(0.0001, t + 0.10, 0.08);

    osc.start(t0); nz.start(t0);
    osc.stop(t + 0.5); nz.stop(t + 0.5);
    return t + 0.5;
  }

  function speak() {
    if (playing) return Promise.resolve(false);
    try {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return Promise.resolve(false);
      if (!ctx) ctx = new AC();
      if (ctx.state === 'suspended') ctx.resume();
      if (!noiseBuf) noiseBuf = makeNoise(ctx);
      playing = true;
      var end = build(ctx, ctx.currentTime + 0.05, LINE_DEFAULT);
      setTimeout(function () { playing = false; }, (end - ctx.currentTime) * 1000 + 60);
      return Promise.resolve(true);
    } catch (e) { playing = false; return Promise.resolve(false); }
  }

  /* ---- 出迎え ---- */
  function wanted() { try { return localStorage.getItem(KEY) !== 'off'; } catch (e) { return true; } }
  function remember(on) { try { localStorage.setItem(KEY, on ? 'on' : 'off'); } catch (e) {} }

  function greet() {
    if (!wanted()) return;
    try { if (sessionStorage.getItem(KEY + '.done')) return; } catch (e) {}
    var fired = false;
    function go() {
      if (fired) return; fired = true;
      try { sessionStorage.setItem(KEY + '.done', '1'); } catch (e) {}
      speak();
      off();
    }
    function off() {
      ['pointerdown', 'keydown', 'wheel', 'touchstart'].forEach(function (e) {
        window.removeEventListener(e, go);
      });
    }
    ['pointerdown', 'keydown', 'wheel', 'touchstart'].forEach(function (e) {
      window.addEventListener(e, go, { once: true, passive: true });
    });
  }

  /* 検査用：OfflineAudioContext に同じものを組んで、波形を取り出す */
  function render(ac, line) { noiseBuf = makeNoise(ac); return build(ac, 0, line || LINE_DEFAULT); }

  /* 検査用：どの音がいつ鳴るか */
  function marks() {
    var t = 0.05, out = [];
    var LINE = LINE_DEFAULT;
    for (var i = 0; i < LINE.length; i++) {
      var s = LINE[i];
      if (s.gap) { t += s.gap; continue; }
      if (s.c) { t += C[s.c].hold; out.push({ k: s.c, v: null, a: t, b: t + C[s.c].burst });
                 t += C[s.c].burst; continue; }
      out.push({ k: s.v, v: s.v, a: t, b: t + s.t });
      t += s.t;
    }
    return out;
  }

  return { speak: speak, greet: greet, wanted: wanted, remember: remember, render: render, marks: marks };
})();
