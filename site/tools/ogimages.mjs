/* ページごとの「共有カード」（1200x630）を作る。
   SNS に貼られたときに出る絵。ロゴと見出しを組んで撮る。
       node site/tools/ogimages.mjs
*/
import { chromium } from 'playwright-core';
import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync, statSync } from 'node:fs';

const SITE_DIR = new URL('..', import.meta.url).pathname.replace(/\/$/, '');
const OUT = SITE_DIR + '/assets/og';
mkdirSync(OUT, { recursive: true });
const CHROME = process.env.CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const logo = readFileSync(SITE_DIR + '/assets/logotype.svg', 'utf8');
const css = readFileSync(SITE_DIR + '/style.css', 'utf8');

function pages(dir = SITE_DIR, out = []) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const full = dir + '/' + e.name;
    if (e.isDirectory()) {
      if (['vendor', 'assets', 'data', 'tools', 'node_modules', '.git'].includes(e.name)) continue;
      if (full.endsWith('/works/sushitsumu/play')) continue;
      pages(full, out);
    } else if (e.name === 'index.html' ||
               (e.name.endsWith('.html') && e.name !== '404.html')) {
      /* 遊び方のように index.html でない頁にも、共有カードを作る */
      out.push(full);
    }
  }
  return out;
}

const b = await chromium.launch({ executablePath: CHROME });
const p = await b.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });

for (const f of pages()) {
  const html = readFileSync(f, 'utf8');
  const rel = f.slice(SITE_DIR.length);
  const title = (html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/) || [, ''])[1]
    .replace(/<[^>]+>/g, '').replace(/&#x([0-9a-f]+);/gi, (m, h) => String.fromCodePoint(parseInt(h, 16)))
    .trim() || 'Koshin Studio';
  const lead = (html.match(/class="lead"[^>]*>([\s\S]*?)<\/p>/) || [, ''])[1]
    .replace(/<br\s*\/?>/g, ' ').replace(/<[^>]+>/g, '').trim().slice(0, 52);
  const home = rel === '/index.html';
  /* build.mjs の og パス組み立てと同じ規則にする。ずれると 404 になる */
  const name = 'og' + (home ? '_home'
    : rel.replace(/\/index\.html$/, '').replace(/\.html$/, '').replace(/\//g, '_')) + '.jpg';

  await p.setContent(`<style>${css}
    html,body{margin:0;width:1200px;height:630px;overflow:hidden}
    .card{width:1200px;height:630px;position:relative;display:flex;flex-direction:column;
      justify-content:center;padding:0 88px;
      background:radial-gradient(70% 60% at 18% 4%, rgba(47,111,208,.42), transparent 62%),
        radial-gradient(52% 46% at 88% 22%, rgba(126,200,227,.2), transparent 66%),
        linear-gradient(170deg,#0b1navy 0%,#070c17 60%,#050912 100%),#070c17}
    .card .ks-logo{width:${home ? 660 : 300}px;margin:0 0 ${home ? 40 : 34}px}
    .card h1{font-family:var(--mincho);font-size:${home ? 34 : 56}px;letter-spacing:.1em;
      color:#e9eef6;margin:0;line-height:1.4;max-width:960px}
    .card p{font-family:var(--gothic);font-size:20px;letter-spacing:.1em;color:#9db0c8;margin:22px 0 0}
    .card .bar{width:64px;height:3px;background:linear-gradient(90deg,#7ec8e3,#2f6fd0);margin:26px 0 0}
  </style>
  <div class="card">${logo}
    ${home ? '<h1>ゲーム、アプリ、サイト、3D。ひとりで、ぜんぶ。</h1>'
           : `<h1>${title}</h1>${lead ? `<p>${lead}</p>` : ''}`}
    <div class="bar"></div>
  </div>`);
  await p.waitForTimeout(320);
  await p.screenshot({ path: OUT + '/' + name, type: 'jpeg', quality: 86 });
  console.log('  ' + name + '  ' + title.slice(0, 24));
}
await b.close();
console.log(`共有カードを ${readdirSync(OUT).length} 枚 書きました`);
