/* ============================================================
   サイトの組み立て
     ・ゲーム本体と絵を、配る形に並べる
     ・data/*.json から、一覧のページを書き出す
   作品が増えたら data/works.json に一行足して、これを走らせるだけ。
       node site/build.mjs
   ============================================================ */
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';

const here = import.meta.dirname;

/* ゲーム本体の在り処。site/ が sushitsumu の中にあっても、
   別のリポジトリとして隣に並んでいても、どちらでも見つかるようにする。 */
const CANDIDATES = [here + '/..', here + '/../sushitsumu', here + '/../../sushitsumu'];
const root = CANDIDATES.find((d) => existsSync(d + '/index.html'));
if (!root) {
  console.error('ゲーム本体（index.html）が見つかりません。探した場所:\n  ' + CANDIDATES.join('\n  '));
  process.exit(1);
}
const read = (p) => JSON.parse(readFileSync(here + p, 'utf8'));
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/* ---- ゲーム本体と絵 ---- */
mkdirSync(here + '/works/sushitsumu/play', { recursive: true });
mkdirSync(here + '/assets', { recursive: true });
copyFileSync(root + '/index.html', here + '/works/sushitsumu/play/index.html');
for (const [from, to] of [
  ['cover-square-800x800.png', 'sushitsumu-square.png'],
  ['cover-portrait-800x1200.png', 'sushitsumu-portrait.png'],
  ['cover-landscape-1920x1080.png', 'sushitsumu-landscape.png'],
]) copyFileSync(root + '/store/' + from, here + '/assets/' + to);

/* ---- 部品 ---- */
const works = read('/data/works.json');
const notes = read('/data/notes.json');
const kinds = read('/data/kinds.json');

const head = (title, desc, extra = '') => `<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<meta name="theme-color" content="#080d16">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:type" content="website">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="stylesheet" href="/style.css">${extra}
</head>
<body>
<canvas id="motes"></canvas>

<header class="site"><div class="wrap">
  <a class="logo" href="/">Koshin Studio</a>
  <nav><a href="/works/">Works</a><a href="/notes/">Notes</a><a href="/profile/">Profile</a></nav>
</div></header>
`;
const foot = `
<footer class="site"><div class="wrap">
  <span>© 2026 Koshin Studio</span>
  <nav><a href="/profile/">Profile</a><a href="/privacy/">あつかい</a></nav>
</div></footer>
<script src="/motion.js" defer></script>
</body>
</html>
`;

const workCard = (w, i) => `      <li class="rv" data-kind="${w.kind}" data-delay="${i * 70}"><a class="work" href="${w.url}">
        <img src="${w.cover}" alt="${esc(w.title)}の表紙" width="800" height="800" loading="lazy">
        <div>
          <h3>${esc(w.title)}</h3>
          <p>${esc(w.blurb)}</p>
          <div class="tags"><span class="tag kind">${kinds[w.kind].ja}</span>${
            w.tags.map((t) => `<span class="tag">${esc(t)}</span>`).join('')
          }<span class="tag">${esc(w.year)}</span></div>
        </div>
      </a></li>`;

/* ---- /works/ ---- */
const chips = ['<button class="chip on" data-f="all">All<i>すべて</i></button>']
  .concat(Object.keys(kinds).map((k) =>
    `<button class="chip" data-f="${k}">${kinds[k].label}<i>${kinds[k].ja}</i></button>`)).join('');

writeFileSync(here + '/works/index.html',
  head('Works — Koshin Studio', '作ったものの一覧。ブラウザゲーム、スマートフォンのアプリ、Web サイト。') +
`<main><div class="wrap">
  <h1>Works</h1>
  <div class="rule"></div>
  <p class="lead">作ったものの一覧です。増えたらここに並びます。</p>

  <div class="chips rv">${chips}</div>
  <ul class="works" id="worklist">
${works.map(workCard).join('\n')}
  </ul>
  <p class="soon rv" id="empty" hidden>こ の 種 類 は ま だ あ り ま せ ん</p>
  <p class="soon rv" style="margin-top:22px">次 の 作 品 を 用 意 し て い ま す</p>
</div></main>` + foot);

/* ---- /notes/ ---- */
const noteRow = (n, i) => `    <li class="rv" data-delay="${i * 70}"><a class="note-row" href="${n.url}">
      <time datetime="${n.date}">${n.date.replace(/-/g, '.')}</time>
      <div><h3>${esc(n.title)}</h3><p>${esc(n.blurb)}</p>
      <div class="tags"><span class="tag">${esc(n.work)}</span></div></div>
    </a></li>`;

writeFileSync(here + '/notes/index.html',
  head('Notes — Koshin Studio', '作りながら考えたことの記録。数字を取って直した話が中心です。') +
`<main><div class="wrap">
  <h1>Notes</h1>
  <div class="rule"></div>
  <p class="lead">作りながら考えたことの記録。<br>勘で直す前に、まず測る——という話が多いです。</p>
  <ul class="notes">
${notes.map(noteRow).join('\n')}
  </ul>
</div></main>` + foot);

/* ---- トップの抜粋 ---- */
const home = readFileSync(here + '/index.html', 'utf8');
const marked = home.replace(
  /<!--works:start-->[\s\S]*?<!--works:end-->/,
  `<!--works:start-->\n${works.slice(0, 3).map(workCard).join('\n')}\n    <!--works:end-->`
);
writeFileSync(here + '/index.html', marked);

console.log(`site: works ${works.length} / notes ${notes.length} 件を書き出しました`);
