/* ============================================================
   サイト全体を機械で見て回る

     ・全ページ × 4 つの画面幅で、崩れと不具合を探す
     ・コンソールのエラー、読み込めなかったもの
     ・リンク切れ（内部）
     ・横にはみ出していないか
     ・文字と背景の明暗差（WCAG）
     ・見出しの並び、画像の代替文字、押せる物の大きさ
     ・動きを止めた設定での見え方
     ・重さ

       node site/tools/audit.mjs
   ============================================================ */
import { chromium } from 'playwright-core';
import { createServer } from 'node:http';
import { readFileSync, existsSync, statSync, readdirSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';

const ROOT = new URL('..', import.meta.url).pathname.replace(/\/$/, '');
const SHOT = process.env.SHOT_DIR || '/tmp/claude-0/audit';
mkdirSync(SHOT, { recursive: true });
const CHROME = process.env.CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const PORT = 8791;

const TYPES = { '.html':'text/html; charset=utf-8', '.css':'text/css; charset=utf-8',
  '.js':'text/javascript; charset=utf-8', '.png':'image/png', '.webp':'image/webp',
  '.jpg':'image/jpeg', '.svg':'image/svg+xml', '.woff2':'font/woff2', '.xml':'application/xml',
  '.txt':'text/plain; charset=utf-8', '.json':'application/json' };

const srv = createServer((q, r) => {
  let p = ROOT + decodeURIComponent(q.url.split('?')[0]);
  if (existsSync(p) && statSync(p).isDirectory()) p += '/index.html';
  if (!existsSync(p) || statSync(p).isDirectory()) { r.writeHead(404); return r.end('404'); }
  r.writeHead(200, { 'Content-Type': TYPES[p.slice(p.lastIndexOf('.'))] || 'application/octet-stream' });
  r.end(readFileSync(p));
}).listen(PORT);

/* ページを集める */
function pages(dir = ROOT, out = []) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const full = dir + '/' + e.name;
    if (e.isDirectory()) {
      if (['vendor', 'assets', 'data', 'tools', 'node_modules', '.git'].includes(e.name)) continue;
      if (full.endsWith('/works/sushitsumu/play')) continue;
      pages(full, out);
    } else if (e.name === 'index.html') {
      out.push(full.slice(ROOT.length).replace(/index\.html$/, ''));
    } else if (e.name.endsWith('.html') && e.name !== '404.html') {
      /* 遊び方のように、index.html ではない頁も見る */
      out.push(full.slice(ROOT.length));
    }
  }
  return out;
}
const PATHS = ['/'].concat(pages().filter((p) => p !== '/')).sort();
const SIZES = [
  { n: 'sp',  w: 390,  h: 844,  mobile: true },
  { n: 'tab', w: 768,  h: 1024, mobile: true },
  { n: 'pc',  w: 1280, h: 860,  mobile: false },
  { n: 'wide',w: 1920, h: 1080, mobile: false },
];

const issues = [];
const add = (sev, where, what) => issues.push({ sev, where, what });

/* 明暗差（WCAG 2.1） */
const lum = ([r, g, b]) => {
  const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
};

/* ---- 組み直しても同じ形になるか ----
   build.mjs は出来上がりの HTML を書き換える作りなので、差し込みが
   きちんと入れ替わらないと、組むたびに増えていく（パンくずが 14 個に
   なっていた）。二度組んで、一文字でも変わったら報せる。 */
{
  const files = pages().map((p) => ROOT + (p === '/' ? '/index.html'
    : (p.endsWith('/') ? p + 'index.html' : p)));
  const snap = () => files.map((f) =>
    existsSync(f) ? createHash('sha1').update(readFileSync(f)).digest('hex') : '');
  const before = snap();
  try {
    execFileSync(process.execPath, [ROOT + '/build.mjs'], { encoding: 'utf8' });
    const after = snap();
    files.forEach((f, i) => {
      if (before[i] !== after[i]) {
        add('高', f.slice(ROOT.length), '組み直すたびに中身が変わる（差し込みが入れ替わっていない）');
      }
    });
  } catch (e) { add('高', 'build.mjs', '組み直しでつまずいた: ' + (e.message || e)); }
}

/* ---- 出てくる絵が、写した先にも残るか ----
   手元では見えているのに、git に入っていない絵がある状態で配ると、
   向こうでだけ 404 になる。元の PNG を追跡から外したときに一度やった。
   ページから指されている /assets 以下を、git の一覧と突き合わせる。 */
{
  let tracked = null;
  try {
    tracked = new Set(execFileSync('git', ['ls-files', 'site'],
      { cwd: ROOT + '/..', encoding: 'utf8' }).split('\n').filter(Boolean));
  } catch (e) { /* git が無い所では見送る */ }
  if (tracked) {
    const seen = new Set();
    for (const p of pages()) {
      const f = ROOT + (p.endsWith('/') ? p + 'index.html' : p);
      if (!existsSync(f)) continue;
      const html = readFileSync(f, 'utf8');
      for (const m of html.matchAll(/["'( ]\/((?:assets|vendor|fonts)\/[A-Za-z0-9@._/-]+)/g)) {
        const rel = m[1].replace(/[),]+$/, '');
        if (seen.has(rel)) continue;
        seen.add(rel);
        if (!tracked.has('site/' + rel)) {
          add(existsSync(ROOT + '/' + rel) ? '高' : '高', p,
            existsSync(ROOT + '/' + rel)
              ? `git に入っていない絵を指している（配ると 404 になる）: /${rel}`
              : `そもそも無いものを指している: /${rel}`);
        }
      }
    }
  }
}

const browser = await chromium.launch({ executablePath: CHROME });
let totalBytes = 0;
const worst = { lcp: 0, cls: 0 };
const seenRes = new Set();

for (const size of SIZES) {
  const ctx = await browser.newContext({
    viewport: { width: size.w, height: size.h }, deviceScaleFactor: 1,
    locale: 'ja-JP', isMobile: size.mobile, hasTouch: size.mobile,
  });
  for (const path of PATHS) {
    const page = await ctx.newPage();
    const errs = [];
    page.on('pageerror', (e) => errs.push('JS: ' + e.message));
    page.on('console', (m) => { if (m.type() === 'error') errs.push('CONSOLE: ' + m.text()); });
    page.on('response', (r) => {
      const u = r.url();
      if (r.status() >= 400) errs.push(`HTTP ${r.status()}: ${u}`);
      if (!seenRes.has(u) && u.startsWith('http://localhost')) {
        seenRes.add(u);
        r.body().then((b) => { totalBytes += b.length; }).catch(() => {});
      }
    });
    /* 読み込みの間に、いちばん大きい絵がいつ出たか（LCP）と、
       出たあとに文章がどれだけ飛んだか（CLS）を数える。
       絵の寸法を書き忘れると、ここに出る */
    await page.addInitScript(() => {
      window.__lcp = 0; window.__cls = 0;
      try {
        new PerformanceObserver((l) => {
          for (const e of l.getEntries()) window.__lcp = e.startTime;
        }).observe({ type: 'largest-contentful-paint', buffered: true });
        new PerformanceObserver((l) => {
          for (const e of l.getEntries()) if (!e.hadRecentInput) window.__cls += e.value;
        }).observe({ type: 'layout-shift', buffered: true });
      } catch (e) { /* 対応していない所では見送る */ }
    });
    await page.goto(`http://localhost:${PORT}${path}`, { waitUntil: 'load' });
    await page.waitForTimeout(size.n === 'pc' ? 2200 : 1400);
    const vitals = await page.evaluate(() => ({ lcp: window.__lcp || 0, cls: window.__cls || 0 }));
    if (vitals.cls > 0.1) {
      add('中', `${path} [${size.n}]`,
        `読み込み中に文章が飛ぶ（CLS ${vitals.cls.toFixed(3)}）。絵か枠の寸法が抜けている`);
    }
    if (vitals.lcp > 2500) {
      add('中', `${path} [${size.n}]`,
        `いちばん大きいものが出るまで ${(vitals.lcp / 1000).toFixed(1)} 秒（手元で 2.5 秒超）`);
    }
    worst.lcp = Math.max(worst.lcp, vitals.lcp);
    worst.cls = Math.max(worst.cls, vitals.cls);
    /* 下まで送って、現れ方の仕掛けを全部起こす。
       滑らかスクロール（Lenis）は window.scrollTo を押し戻すので、
       本物の車輪の動きで送る。 */
    const docH = await page.evaluate(() => document.body.scrollHeight);
    const steps = Math.ceil(docH / (size.h * 0.6)) + 2;
    for (let k = 0; k < steps; k++) {
      await page.mouse.wheel(0, size.h * 0.6);
      await page.waitForTimeout(160);
    }
    await page.waitForTimeout(700);
    const stillHidden = await page.evaluate(() => [...document.querySelectorAll('.rv')]
      .filter((el) => +getComputedStyle(el).opacity < 0.9)
      .map((el) => el.tagName + '.' + (String(el.className).split(' ')[0] || '')).slice(0, 3));
    for (const h of stillHidden) add('高', `${path} [${size.n}]`, `下まで送っても現れない要素: ${h}`);

    for (const e of errs) add('高', `${path} [${size.n}]`, e);

    const r = await page.evaluate(() => {
      const out = { overflow: null, small: [], noalt: [], nosize: [], badsize: [],
                    heads: [], contrast: [], links: [], dupIds: [] };
      /* 横にはみ出し */
      const de = document.documentElement;
      if (de.scrollWidth > de.clientWidth + 1) {
        const wide = [...document.querySelectorAll('*')].filter((el) => {
          const b = el.getBoundingClientRect();
          return b.right > de.clientWidth + 1 && b.width > 0 && getComputedStyle(el).position !== 'fixed';
        }).slice(0, 4).map((el) => el.tagName + '.' + (String(el.className).split(' ')[0] || ''));
        out.overflow = { doc: de.scrollWidth, view: de.clientWidth, by: wide };
      }
      /* 押せる物の大きさ */
      const inlineInText = (el) => {
        if (getComputedStyle(el).display !== 'inline') return false;
        const par = el.parentElement;
        if (!par) return false;
        /* 前後に文字があるなら、文の中のリンク */
        return (par.textContent || '').trim().length > (el.textContent || '').trim().length + 2;
      };
      for (const el of document.querySelectorAll('a[href], button, input, [role="button"]')) {
        const b = el.getBoundingClientRect();
        if (b.width === 0 || b.height === 0) continue;
        if (inlineInText(el)) continue;
        if (b.height < 24 || b.width < 24) {
          out.small.push(`${el.tagName}${el.className ? '.' + String(el.className).split(' ')[0] : ''} ${Math.round(b.width)}x${Math.round(b.height)} "${(el.textContent || '').trim().slice(0, 14)}"`);
        }
      }
      /* 小さな部品が不自然に膨らんでいないか
         （別のクラスの箱指定を拾ってしまう事故を捕まえる） */
      out.puffy = [];
      for (const el of document.querySelectorAll('span,i,b,em,small,button,a')) {
        if (el.children.length) continue;
        const txt = (el.textContent || '').trim();
        if (!txt || txt.length > 20) continue;
        const r = el.getBoundingClientRect();
        if (!r.height || !r.width) continue;
        const c = getComputedStyle(el);
        if (c.display === 'inline') continue;
        if (c.height && c.height !== 'auto' && el.style.height !== '') continue;
        if (parseFloat(c.minHeight) > 40) continue;
        if (el.closest('#orbit')) continue;   // 回る札は意図して正方形
        const lh = parseFloat(c.lineHeight) || parseFloat(c.fontSize) * 1.6;
        const pad = parseFloat(c.paddingTop) + parseFloat(c.paddingBottom);
        if (r.height > lh + pad + 14 && r.height > lh * 2.2) {
          out.puffy.push(`${el.tagName}.${String(el.className).split(' ')[0] || ''} `
            + `${Math.round(r.width)}x${Math.round(r.height)}（行の高さ ${Math.round(lh)}）「${txt.slice(0, 10)}」`);
        }
      }

      /* 画像の代替文字と、書いてある寸法が本物と合っているか。
         合っていないと、読み込む前に空ける場所を間違えて、
         絵が出た瞬間に文章が飛ぶ */
      for (const im of document.querySelectorAll('img')) {
        if (!im.hasAttribute('alt')) out.noalt.push(im.getAttribute('src') || '(src なし)');
        const w = parseInt(im.getAttribute('width') || '0', 10);
        const h = parseInt(im.getAttribute('height') || '0', 10);
        if (!w || !h) { out.nosize.push(im.getAttribute('src') || '(src なし)'); continue; }
        const nw = im.naturalWidth, nh = im.naturalHeight;
        if (!nw || !nh) continue;                    /* まだ読めていない */
        if (Math.abs(w / h - nw / nh) > 0.02) {
          out.badsize.push(`${im.getAttribute('src')} 書いてある ${w}x${h} / 本物 ${nw}x${nh}`);
        }
      }
      /* 見出しの並び */
      out.heads = [...document.querySelectorAll('h1,h2,h3,h4')].map((h) => h.tagName);
      /* 明暗差 */
      const hidden = (el) => {
        const c = getComputedStyle(el);
        if (c.clipPath === 'inset(50%)' || /rect\(0px,? 0px,? 0px,? 0px\)/.test(c.clip)) return true;
        const b = el.getBoundingClientRect();
        return b.width <= 1 || b.height <= 1;
      };
      const pick = [...document.querySelectorAll('p,li,span,a,h1,h2,h3,td,th,b,i,time')]
        .filter((el) => el.textContent.trim() && el.offsetParent !== null && !hidden(el))
        .slice(0, 90);
      const bgOf = (el) => {
        let n = el;
        while (n && n !== document.documentElement) {
          const c = getComputedStyle(n).backgroundColor;
          const m = c.match(/[\d.]+/g);
          if (m && (m.length < 4 || Number(m[3]) > 0.55)) return [+m[0], +m[1], +m[2]];
          n = n.parentElement;
        }
        return [7, 12, 23];
      };
      for (const el of pick) {
        const cs = getComputedStyle(el);
        const fg = (cs.color.match(/[\d.]+/g) || []).slice(0, 3).map(Number);
        if (fg.length < 3) continue;
        const fs = parseFloat(cs.fontSize), bold = +cs.fontWeight >= 700;
        out.contrast.push({
          fg, bg: bgOf(el), fs, big: fs >= 24 || (fs >= 18.66 && bold),
          t: el.textContent.trim().slice(0, 22),
          sel: el.tagName + (el.className ? '.' + String(el.className).split(' ')[0] : ''),
        });
      }
      /* 目印になる部分が二重に出ていないか */
      out.dupes = [];
      for (const [sel, max] of [['header.site', 1], ['footer.site', 1], ['main', 1],
                                ['nav.crumbs', 1], ['h1', 1], ['#orbit', 1], ['canvas#motes', 1]]) {
        const n2 = document.querySelectorAll(sel).length;
        if (n2 > max) out.dupes.push(`${sel} が ${n2} 個`);
      }

      /* リンク */
      out.links = [...document.querySelectorAll('a[href]')].map((a) => a.getAttribute('href'));
      /* id の重複 */
      const ids = {};
      for (const el of document.querySelectorAll('[id]')) ids[el.id] = (ids[el.id] || 0) + 1;
      out.dupIds = Object.entries(ids).filter(([, n]) => n > 1).map(([k]) => k);
      return out;
    });

    if (r.overflow) add('高', `${path} [${size.n}]`,
      `横にはみ出し ${r.overflow.doc} > ${r.overflow.view}（${r.overflow.by.join(', ')}）`);
    for (const s of new Set(r.small)) add('中', `${path} [${size.n}]`, `押しにくい: ${s}`);
    for (const s of new Set(r.puffy)) add('高', `${path} [${size.n}]`, `不自然に膨らんだ部品: ${s}`);
    for (const a of r.noalt) add('中', `${path} [${size.n}]`, `alt が無い画像: ${a}`);
    for (const a of r.nosize) add('低', `${path} [${size.n}]`, `寸法が書いていない画像: ${a}`);
    for (const a of r.badsize) add('中', `${path} [${size.n}]`, `寸法が合っていない画像: ${a}`);
    for (const d of r.dupIds) add('中', `${path} [${size.n}]`, `id の重複: ${d}`);
    for (const d of r.dupes) add('高', `${path} [${size.n}]`, `二重に出ている: ${d}`);
    for (const c of r.contrast) {
      const L1 = lum(c.fg), L2 = lum(c.bg);
      const ratio = (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05);
      const need = c.big ? 3 : 4.5;
      if (ratio < need) add(ratio < need - 1 ? '高' : '低', `${path} [${size.n}]`,
        `明暗差 ${ratio.toFixed(2)}（要 ${need}）${c.sel} ${c.fs}px「${c.t}」`);
    }
    /* 見出しの飛び */
    let prev = 0;
    for (const h of r.heads) {
      const lvl = +h[1];
      if (prev && lvl > prev + 1) add('低', `${path} [${size.n}]`, `見出しが飛んでいる h${prev} → h${lvl}`);
      prev = lvl;
    }
    if (size.n === 'pc') {
      /* リンク切れ */
      for (const href of new Set(r.links)) {
        if (!href || /^(https?:|mailto:|tel:|#)/.test(href)) continue;
        const res = await page.request.get(`http://localhost:${PORT}${href}`).catch(() => null);
        if (!res || res.status() >= 400) add('高', path, `リンク切れ: ${href}`);
      }
    }
    await page.screenshot({ path: `${SHOT}/${size.n}${path.replace(/\//g, '_') || '_'}.png`, fullPage: size.n === 'pc' });
    await page.close();
  }
  await ctx.close();
}

/* 動きを止めた設定 */
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 860 }, locale: 'ja-JP',
    reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push('JS: ' + e.message));
  await page.goto(`http://localhost:${PORT}/`);
  await page.waitForTimeout(1600);
  const vis = await page.evaluate(() => {
    const hidden = [...document.querySelectorAll('.rv')].filter((el) =>
      +getComputedStyle(el).opacity < 0.9).length;
    return { hidden, logo: !!document.querySelector('.ks-logo') };
  });
  if (vis.hidden) add('高', '/ [動きを止めた設定]', `${vis.hidden} 個の要素が透明のままで読めない`);
  if (!vis.logo) add('高', '/ [動きを止めた設定]', 'ロゴが出ていない');
  for (const e of errs) add('高', '/ [動きを止めた設定]', e);
  await page.screenshot({ path: `${SHOT}/calm.png` });
  await ctx.close();
}

/* JS が動かない時 */
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 860 }, locale: 'ja-JP',
    javaScriptEnabled: false });
  for (const path of PATHS) {
    const page = await ctx.newPage();
    await page.goto(`http://localhost:${PORT}${path}`);
    const r = await page.evaluate ? null : null;
    const txt = await page.textContent('main').catch(() => '');
    const hidden = await page.$$eval('.rv', (els) =>
      els.filter((el) => +getComputedStyle(el).opacity < 0.9).length).catch(() => 0);
    if ((txt || '').trim().length < 60) add('高', `${path} [JS なし]`, '本文がほとんど出ていない');
    if (hidden) add('高', `${path} [JS なし]`, `${hidden} 個の要素が透明のまま`);
    await page.close();
  }
  await ctx.close();
}

/* 鍵盤で辿れるか */
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 860 }, locale: 'ja-JP' });
  const page = await ctx.newPage();
  await page.goto(`http://localhost:${PORT}/`);
  await page.waitForTimeout(1200);
  const seq = [];
  for (let i = 0; i < 12; i++) {
    await page.keyboard.press('Tab');
    seq.push(await page.evaluate(() => {
      const a = document.activeElement;
      const o = getComputedStyle(a).outlineStyle;
      return { tag: a.tagName, t: (a.textContent || '').trim().slice(0, 16), outline: o };
    }));
  }
  const noRing = seq.filter((s) => s.outline === 'none').length;
  if (noRing > 2) add('中', '/ [鍵盤]', `${noRing}/12 の行き先で、いまどこに居るかの枠が出ない`);
  await ctx.close();
}

await browser.close();
srv.close();

/* ---- まとめ ---- */
const order = { '高': 0, '中': 1, '低': 2 };
issues.sort((a, b) => order[a.sev] - order[b.sev]);
const byWhat = new Map();
for (const i of issues) {
  const k = i.sev + '|' + i.what.replace(/\[\w+\]/, '');
  if (!byWhat.has(k)) byWhat.set(k, { ...i, where: [i.where] });
  else byWhat.get(k).where.push(i.where);
}
console.log(`\n=== ${PATHS.length} ページ × ${SIZES.length} 幅 を見ました ===`);
console.log(`読み込んだもの 合計 ${(totalBytes / 1024).toFixed(0)} KB`);
console.log(`いちばん遅かった LCP ${(worst.lcp / 1000).toFixed(2)} 秒 / いちばん飛んだ CLS ${worst.cls.toFixed(3)}\n`);
if (!byWhat.size) console.log('見つかった問題: なし');
for (const v of byWhat.values()) {
  const w = v.where.length > 3 ? `${v.where.slice(0, 3).join(' / ')} ほか ${v.where.length - 3}` : v.where.join(' / ');
  console.log(`[${v.sev}] ${v.what}\n      ${w}`);
}
console.log(`\n高 ${issues.filter(i=>i.sev==='高').length} / 中 ${issues.filter(i=>i.sev==='中').length} / 低 ${issues.filter(i=>i.sev==='低').length}`);
console.log(`画面の写しは ${SHOT}`);
