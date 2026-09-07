/* ============================================================
   サイトの組み立て
     ・ゲーム本体と絵を、配る形に並べる
     ・data/*.json から、一覧のページを書き出す
   作品が増えたら data/works.json に一行足して、これを走らせるだけ。
       node site/build.mjs
   ============================================================ */
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';

/* 公開先。独自ドメインを繋いだら、ここだけ書き換える */
const SITE = process.env.SITE_URL || 'https://koshin-studio.pages.dev';

const here = import.meta.dirname;

/* ゲーム本体（sushitsumu）の在り処。
   site/ が sushitsumu の中にあっても、別のリポジトリとして
   どこかに置かれていても動くように、順に探す。
   見つからないときは環境変数か引数で教える:
       GAME_DIR=~/Desktop/sushitsumu/sushitsumu node build.mjs
       node build.mjs ~/Desktop/sushitsumu/sushitsumu
   すでに写し終わっていれば、見つからなくても一覧は書き出す。 */
const HOME = process.env.HOME || '';
const tidy = (d) => {
  d = String(d).trim().replace(/^~(?=$|\/)/, HOME).replace(/\/+$/, '');
  return d.endsWith('/index.html') ? d.slice(0, -'/index.html'.length) : d;
};
const told = process.argv[2] || process.env.GAME_DIR;
const CANDIDATES = [
  told,
  here + '/..',
  here + '/../sushitsumu',
  here + '/../../sushitsumu',
  here + '/../../sushitsumu/sushitsumu',
  HOME + '/Desktop/sushitsumu/sushitsumu',
  HOME + '/sushitsumu',
].filter(Boolean).map(tidy);
const root = CANDIDATES.find((d) => existsSync(d + '/index.html'));

/* 見つからないとき、何が起きているかその場で分かるようにする */
function why() {
  return CANDIDATES.map(function (d) {
    if (!existsSync(d)) return '  ✗ ' + d + '  … その場所が無い';
    var inside;
    try {
      inside = readdirSync(d).slice(0, 12).join(' ');
    } catch (e) {
      return '  ✗ ' + d + '  … 中が読めない（' + e.code + '）';
    }
    return '  ✗ ' + d + '  … 場所はあるが index.html が無い\n      中身: ' + inside;
  }).join('\n');
}

/* ---- ゲーム本体と絵を、配る形に並べる ---- */
if (root) {
  mkdirSync(here + '/works/sushitsumu/play', { recursive: true });
  mkdirSync(here + '/assets', { recursive: true });
  /* 本体はそのまま写すが、検索の当たり先だけ作品ページに寄せる。
     遊ぶだけの頁と作品ページが並ぶと、どちらも中途半端に扱われる。
     配る本体（CrazyGames へ出すもの）には手を入れない */
  writeFileSync(here + '/works/sushitsumu/play/index.html',
    readFileSync(root + '/index.html', 'utf8').replace(
      '<meta name="viewport"',
      '<meta name="robots" content="noindex,follow">\n<meta name="viewport"'));
  for (const [from, to] of [
    ['cover-square-800x800.png', 'sushitsumu-square.png'],
    ['cover-portrait-800x1200.png', 'sushitsumu-portrait.png'],
    ['cover-landscape-1920x1080.png', 'sushitsumu-landscape.png'],
  ]) copyFileSync(root + '/store/' + from, here + '/assets/' + to);
  console.log('site: ゲーム本体と表紙を写しました（' + root + '）');
} else if (existsSync(here + '/works/sushitsumu/play/index.html')) {
  console.log('site: ゲーム本体は写し済みのものを使います');
} else {
  console.warn('site: ゲーム本体（index.html）が見つかりません。一覧だけ書き出します。');
  console.warn(why());
  console.warn('  → 場所を教える: GAME_DIR=<sushitsumu の場所> node build.mjs');
}

/* ---- 部品 ---- */
const read = (p) => JSON.parse(readFileSync(here + p, 'utf8'));
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const works = read('/data/works.json');
const notes = read('/data/notes.json');
const kinds = read('/data/kinds.json');
const conf  = existsSync(here + '/data/site.json') ? read('/data/site.json') : { social: [], ads: {} };
const stack = existsSync(here + '/data/stack.json') ? read('/data/stack.json') : { groups: [] };

/* 絵の在り処は拡張子なしで持つ決まり。古い書き方（.png 付き）も受ける */
const base = (p) => String(p || '').replace(/\.(png|jpe?g|webp|avif|gif)$/i, '');

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
<script>document.documentElement.className+=" js"</script>
<link rel="stylesheet" href="/style.css">${extra}
</head>
<body>
<canvas id="motes"></canvas>

<header class="site"><div class="wrap">
  <a class="logo" href="/">Koshin Studio</a>
  <nav><a href="/works/">Works</a><a href="/notes/">Notes</a><a href="/stack/">Stack</a><a href="/profile/">Profile</a><a class="nav-cta" href="/contact/">Contact</a></nav>
</div></header>
`;
const socialHtml = (conf.social || []).map((x) =>
  `<a class="sns" href="${x.url}" rel="me noopener" target="_blank">${esc(x.label)}<i>${esc(x.handle || '')}</i></a>`
).join('');

const foot = `
<footer class="site"><div class="wrap">
  <span>© 2026 Koshin Studio</span>
  <div class="sns-row">${socialHtml}</div>
  <nav><a href="/profile/">Profile</a><a href="/privacy/">あつかい</a></nav>
</div></footer>
<script src="/voice.js" defer></script>
<script src="/motion.js" defer></script>
</body>
</html>
`;

/* 絵は拡張子を付けずに持つ。webp を先に出し、読めない相手には jpg を渡す。
   元の PNG は重すぎるので配らない */
const workCard = (w, i) => `      <li class="rv" data-kind="${w.kind}" data-delay="${i * 70}"><a class="work" href="${w.url}">
        <picture>
          <source srcset="${base(w.cover)}.webp 360w, ${base(w.cover)}@2x.webp 720w" sizes="132px" type="image/webp">
          <img src="${base(w.cover)}.jpg" srcset="${base(w.cover)}.jpg 360w, ${base(w.cover)}@2x.jpg 720w" sizes="132px"
               alt="${esc(w.title)}の表紙" width="${w.coverW || 720}" height="${w.coverH || 720}" loading="lazy" decoding="async">
        </picture>
        <div>
          <h3>${esc(w.title)}</h3>
          <p>${esc(w.blurb)}</p>
          <div class="tags"><span class="tag tag-kind">${kinds[w.kind].ja}</span>${
            w.tags.map((t) => `<span class="tag">${esc(t)}</span>`).join('')
          }<span class="tag">${esc(w.year)}</span></div>
        </div>
      </a></li>`;

/* ---- /works/ ---- */
const chips = ['<button class="chip on" data-f="all">All<i>すべて</i></button>']
  .concat(Object.keys(kinds).map((k) =>
    `<button class="chip" data-f="${k}">${kinds[k].label}<i>${kinds[k].ja}</i></button>`)).join('');

writeFileSync(here + '/works/index.html',
  head('Works — ブラウザゲーム・アプリ・Web サイトの制作一覧 — Koshin Studio', 'これまでに作ったものの一覧。ブラウザゲーム、スマートフォンのアプリ、Web サイト、3D モデル。分野で絞り込めます。') +
`<main><div class="wrap">
  <h1>Works</h1>
  <div class="rule"></div>
  <p class="lead">作ったものの一覧です。増えたらここに並びます。</p>

  <h2 class="sr">作品の一覧</h2>
  <div class="chips rv">${chips}</div>
  <ul class="works" id="worklist">
${works.map(workCard).join('\n')}
  </ul>
  <p class="soon rv" id="empty" hidden>こ の 種 類 は ま だ あ り ま せ ん</p>
  <p class="soon rv" style="margin-top:22px">次 の 作 品 を 用 意 し て い ま す</p>
</div></main>` + foot);

/* ---- 使っている道具 ---- */
if (existsSync(here + '/stack/index.html')) {
  const html = (stack.groups || []).map((g, gi) => `  <section class="stack-g">
    <h2 class="rv">${esc(g.name)}</h2>
    <div class="stack">
${g.items.map((it, i) => `      <div class="si rv" data-delay="${i * 40}">
        <b>${esc(it.n)}</b><span class="lv" data-l="${esc(it.level)}">${esc(it.level)}</span>
        <p>${esc(it.d)}</p>
      </div>`).join('\n')}
    </div>
  </section>`).join('\n');
  const f = here + '/stack/index.html';
  writeFileSync(f, readFileSync(f, 'utf8').replace(
    /<!--stack:start-->[\s\S]*?<!--stack:end-->/,
    '<!--stack:start-->\n' + html + '\n  <!--stack:end-->'));
}

/* ---- 記録の配信（RSS） ---- */
writeFileSync(here + '/feed.xml',
  '<?xml version="1.0" encoding="UTF-8"?>\n' +
  '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">\n<channel>\n' +
  `  <title>Koshin Studio — Notes</title>\n  <link>${SITE}/notes/</link>\n` +
  '  <description>作りながら考えたことの記録</description>\n  <language>ja</language>\n' +
  `  <atom:link href="${SITE}/feed.xml" rel="self" type="application/rss+xml"/>\n` +
  notes.map((n) => `  <item>\n    <title>${esc(n.title)}</title>\n` +
    `    <link>${SITE}${n.url}</link>\n    <guid isPermaLink="true">${SITE}${n.url}</guid>\n` +
    `    <pubDate>${new Date(n.date + 'T00:00:00+09:00').toUTCString()}</pubDate>\n` +
    `    <description>${esc(n.blurb)}</description>\n  </item>`).join('\n') +
  '\n</channel>\n</rss>\n');

/* ---- /notes/ ---- */
const noteRow = (n, i) => `    <li class="rv" data-delay="${i * 70}"><a class="note-row" href="${n.url}">
      <time datetime="${n.date}">${n.date.replace(/-/g, '.')}</time>
      <div><h3>${esc(n.title)}</h3><p>${esc(n.blurb)}</p>
      <div class="tags"><span class="tag">${esc(n.work)}</span></div></div>
    </a></li>`;

writeFileSync(here + '/notes/index.html',
  head('Notes — 作りながら考えたことの記録 — Koshin Studio', '作りながら考えたことの記録。数字を取って直した話が中心です。') +
`<main><div class="wrap">
  <h1>Notes</h1>
  <div class="rule"></div>
  <p class="lead">作りながら考えたことの記録。<br>勘で直す前に、まず測る——という話が多いです。</p>
  <h2 class="sr">記録の一覧</h2>
  <ul class="notes">
${notes.map(noteRow).join('\n')}
  </ul>
</div></main>` + foot);

/* ---- トップ ---- */
const kindKeys = Object.keys(kinds);

/* まわりを回るもの：作品の表紙が先、足りない分は分野の札で埋める */
const orbitCells = []
  .concat(works.map((w) => ({
    href: w.url, img: w.cover, label: w.title, sub: kinds[w.kind].ja,
  })))
  .concat(kindKeys.map((k) => ({
    href: '/works/#' + k, label: kinds[k].label, sub: kinds[k].ja, note: kinds[k].note,
  })));

const orbitHtml = orbitCells.map((c, i) => `      <a class="orb${c.img ? ' has-img' : ''}" href="${c.href}" style="--i:${i}">
        ${c.img
          ? `<picture><source srcset="${base(c.img)}.webp" type="image/webp"><img src="${base(c.img)}.jpg" alt="${esc(c.label)}" width="360" height="360" loading="eager" decoding="async"></picture>`
          : `<span class="orb-mark">${esc(c.label)}</span>`}
        <span class="orb-cap">${esc(c.img ? c.label : c.sub)}</span>
      </a>`).join('\n');

/* 分野の札（本文側） */
const kindHtml = kindKeys.map((k, i) => {
  const n = works.filter((w) => w.kind === k).length;
  return `      <a class="kind rv" data-delay="${i * 70}" href="/works/#${k}">
        <span class="kind-n">${String(i + 1).padStart(2, '0')}</span>
        <h3>${kinds[k].label}<i>${kinds[k].ja}</i></h3>
        <p>${kinds[k].note}</p>
        <span class="kind-count">${n ? n + ' 点' : '準備中'}</span>
      </a>`;
}).join('\n');

/* 代表作 */
const f = works.find((w) => w.featured) || works[0];
/* 出す絵と数字は works.json から取る。作品が入れ替わっても書き換えずに済む */
const featImg = base((f && f.hero) || (f && f.cover) || '');
const featHtml = f ? `    <div class="feat-media rv">
      <picture>
        <source srcset="${featImg}.webp" type="image/webp">
        <img src="${featImg}.jpg" alt="${esc(f.heroAlt || f.title)}"
             width="${f.heroW || f.coverW || 1200}" height="${f.heroH || f.coverH || 831}"
             loading="lazy" decoding="async">
      </picture>
    </div>
    <div class="wrap feat-body">
      <p class="eyebrow rv">代表作 / ${kinds[f.kind].ja}</p>
      <h2 class="rv" data-delay="60">${esc(f.title)}</h2>
      <p class="rv" data-delay="100" style="max-width:32em;color:var(--muted)">${esc(f.blurb)}</p>
      <div class="stats rv" data-delay="140">${(f.stats || []).map((x) =>
        `\n        <div><b data-count="${x.n}">0</b><span>${esc(x.label)}</span></div>`).join('')}
      </div>
      <p class="rv" data-delay="180" style="margin-top:30px">
        <a class="btn" href="/works/sushitsumu/play/">遊 ぶ</a>
        <a class="btn ghost" href="${f.url}">くわしく</a>
      </p>
    </div>` : '';

/* 記録の抜粋 */
const noteTeaser = notes.slice(0, 2).map(noteRow).join('\n');

let home = readFileSync(here + '/index.html', 'utf8');
const put = (key, body) => {
  home = home.replace(
    new RegExp('<!--' + key + ':start-->[\\s\\S]*?<!--' + key + ':end-->'),
    '<!--' + key + ':start-->\n' + body + '\n    <!--' + key + ':end-->'
  );
};
const logoSvg = existsSync(here + '/assets/logotype.svg')
  ? readFileSync(here + '/assets/logotype.svg', 'utf8').replace(/\n\s*/g, ' ')
  : '';
put('logo', logoSvg);
put('orbit', orbitHtml);
put('kinds', kindHtml);
put('featured', featHtml);
put('notes', noteTeaser);
writeFileSync(here + '/index.html', home);


/* ============================================================
   さがしてもらうための下ごしらえ
     ・正規 URL（canonical）と og:url を全ページに入れる
     ・構造化データ（JSON-LD）を、ページの種類に応じて入れる
     ・sitemap.xml と robots.txt を書き出す
   手で書いたページにも後から差し込むので、ページを足しても勝手に付く。
   ============================================================ */
function walk(dir, out = []) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const full = dir + '/' + e.name;
    if (e.isDirectory()) {
      if (['vendor', 'assets', 'data', 'tools'].includes(e.name)) continue;
      if (full.endsWith('/works/sushitsumu/play')) continue;
      walk(full, out);
    } else if (e.name.endsWith('.html') && e.name !== '404.html') out.push(full);
  }
  return out;
}

const pages = walk(here).sort();
const urlOf = (f) => {
  let u = f.slice(here.length).replace(/\/index\.html$/, '/');
  if (!u.endsWith('/') && u.endsWith('.html')) u = u;
  return SITE + (u === '' ? '/' : u);
};

const workBySlug = Object.fromEntries(works.map((w) => [w.slug, w]));
const noteBySlug = Object.fromEntries(notes.map((n) => [n.slug, n]));

/* 本名は書かない。確かめようのないことを構造化データに入れると、
   検索側にも読む人にも嘘をつくことになる。
   代わりに、footer に出しているのと同じ公開の持ち場だけを繋ぐ */
const PERSON = {
  '@type': 'Organization', '@id': SITE + '#studio', name: 'Koshin Studio',
  url: SITE, description: 'ゲーム、アプリ、Web サイト、3D モデルを個人で制作しています。',
  logo: SITE + '/assets/og/og_home.jpg',
  sameAs: (conf.social || []).map((x) => x.url),
};

/* og 画像の在り処。head に入れるものと同じ絵を構造化データからも指す */
const ogFor = (rel) => {
  const n = 'og' + (rel === '/index.html' ? '_home'
    : rel.replace(/\/index\.html$/, '').replace(/\.html$/, '').replace(/\//g, '_')) + '.jpg';
  return existsSync(here + '/assets/og/' + n)
    ? SITE + '/assets/og/' + n : SITE + '/assets/sushitsumu-wide.jpg';
};

function ldFor(file, url) {
  const rel = file.slice(here.length);
  const page = (name) => ({ '@type': 'WebPage', name: name, url: url,
    inLanguage: 'ja', isPartOf: { '@id': SITE + '#studio' }, primaryImageOfPage: ogFor(rel) });
  const crumbs = (trail) => ({
    '@type': 'BreadcrumbList',
    itemListElement: trail.map((t, i) => ({
      '@type': 'ListItem', position: i + 1, name: t[0], item: SITE + t[1],
    })),
  });
  if (rel === '/index.html') {
    return [
      PERSON,
      { '@type': 'WebSite', url: SITE, name: 'Koshin Studio', publisher: { '@id': SITE + '#studio' },
        inLanguage: 'ja' },
      { '@type': 'ItemList', name: '作ったもの',
        itemListElement: works.map((w, i) => ({
          '@type': 'ListItem', position: i + 1, url: SITE + w.url, name: w.title })) },
    ];
  }
  const wm = rel.match(/^\/works\/([^/]+)\/index\.html$/);
  if (wm && workBySlug[wm[1]]) {
    const w = workBySlug[wm[1]];
    const type = w.kind === 'game' ? 'VideoGame' : 'SoftwareApplication';
    return [
      { '@type': type, name: w.title, url: SITE + w.url, description: w.blurb,
        inLanguage: 'ja', image: SITE + '/assets/sushitsumu-wide.jpg',
        applicationCategory: w.kind === 'game' ? 'GameApplication' : 'UtilitiesApplication',
        operatingSystem: 'Web', datePublished: w.year,
        ...(w.kind === 'game'
          ? { genre: ['パズル', '落ち物パズル'], gamePlatform: 'Web browser', playMode: 'SinglePlayer' }
          : {}),
        author: { '@id': SITE + '#studio' }, publisher: { '@id': SITE + '#studio' },
        offers: { '@type': 'Offer', price: '0', priceCurrency: 'JPY' } },
      crumbs([['Koshin Studio', '/'], ['Works', '/works/'], [w.title, w.url]]),
    ];
  }
  const nm = rel.match(/^\/notes\/([^/]+)\/index\.html$/);
  if (nm && noteBySlug[nm[1]]) {
    const nn = noteBySlug[nm[1]];
    return [
      { '@type': 'BlogPosting', headline: nn.title, url: SITE + nn.url, description: nn.blurb,
        datePublished: nn.date, dateModified: nn.date, inLanguage: 'ja',
        image: ogFor(rel),
        author: { '@id': SITE + '#studio' }, publisher: { '@id': SITE + '#studio' },
        mainEntityOfPage: SITE + nn.url },
      crumbs([['Koshin Studio', '/'], ['Notes', '/notes/'], [nn.title, nn.url]]),
    ];
  }
  if (rel === '/works/index.html') return [crumbs([['Koshin Studio', '/'], ['Works', '/works/']])];
  if (rel === '/notes/index.html') return [crumbs([['Koshin Studio', '/'], ['Notes', '/notes/']])];
  if (rel === '/profile/index.html') return [PERSON, crumbs([['Koshin Studio', '/'], ['Profile', '/profile/']])];
  if (rel === '/stack/index.html') {
    const tools = [].concat(...(stack.groups || []).map((g) => g.items || []));
    return [
      page('使っている道具'),
      { '@type': 'ItemList', name: '使っている道具',
        itemListElement: tools.map((t, i) => ({
          '@type': 'ListItem', position: i + 1, name: t.name })) },
      crumbs([['Koshin Studio', '/'], ['Stack', '/stack/']]),
    ];
  }
  if (rel === '/contact/index.html') {
    return [
      { '@type': 'ContactPage', name: 'ご依頼・お問い合わせ', url: url, inLanguage: 'ja' },
      { '@type': 'Service', serviceType: 'Web サイト制作',
        provider: { '@id': SITE + '#studio' }, areaServed: 'JP',
        offers: { '@type': 'Offer', priceCurrency: 'JPY',
          priceSpecification: { '@type': 'PriceSpecification', minPrice: '50000',
            priceCurrency: 'JPY', valueAddedTaxIncluded: false,
            description: '1 ページあたり・税別' } } },
      crumbs([['Koshin Studio', '/'], ['Contact', '/contact/']]),
    ];
  }
  if (rel === '/privacy/index.html') {
    return [page('あつかい（プライバシー）'),
      crumbs([['Koshin Studio', '/'], ['あつかい', '/privacy/']])];
  }
  const gm = rel.match(/^\/works\/([^/]+)\/guide\.html$/);
  if (gm && workBySlug[gm[1]]) {
    const w = workBySlug[gm[1]];
    return [
      { '@type': 'WebPage', name: w.title + ' 遊び方', url: url, inLanguage: 'ja',
        primaryImageOfPage: ogFor(rel),
        about: { '@type': 'VideoGame', name: w.title, url: SITE + w.url } },
      crumbs([['Koshin Studio', '/'], ['Works', '/works/'], [w.title, w.url],
              ['遊び方', w.url + 'guide.html']]),
    ];
  }
  return null;
}

for (const file of pages) {
  const rel = file.slice(here.length);
  let html = readFileSync(file, 'utf8');
  /* 脚の SNS 欄と、広告の枠を差し替える（data/site.json が元） */
  html = html.replace(/<nav><a href="\/works\/">Works<\/a><a href="\/notes\/">Notes<\/a>(<a href="\/stack\/">Stack<\/a>)?<a href="\/profile\/">Profile<\/a>(<a[^>]*>Contact<\/a>)?<\/nav>/g,
    '<nav><a href="/works/">Works</a><a href="/notes/">Notes</a><a href="/stack/">Stack</a><a href="/profile/">Profile</a><a class="nav-cta" href="/contact/">Contact</a></nav>');
  html = html.replace(/<div class="sns-row">[\s\S]*?<\/div>/g, `<div class="sns-row">${socialHtml}</div>`);
  if (!/class="sns-row"/.test(html)) {
    html = html.replace('<footer class="site"><div class="wrap">\n  <span>© 2026 Koshin Studio</span>',
      `<footer class="site"><div class="wrap">\n  <span>© 2026 Koshin Studio</span>\n  <div class="sns-row">${socialHtml}</div>`);
  }
  /* 連絡先（data/site.json の contact） */
  const ct = conf.contact || {};
  const ctHtml = (ct.email || ct.form)
    ? [ct.email ? `<a class="ct-main" href="mailto:${ct.email}?subject=${encodeURIComponent('制作のご相談')}">${esc(ct.email)}<span>メールで相談する</span></a>` : '',
       ct.form ? `<a class="ct-sub" href="${ct.form}" target="_blank" rel="noopener">フォームから送る</a>` : ''].filter(Boolean).join('')
    : ((conf.social || []).length
        ? `<p class="ct-soon">いまは ${(conf.social || []).map((x) =>
             `<a href="${x.url}" rel="noopener" target="_blank">${esc(x.label)}</a>`).join(' か ')}` +
          ` からご連絡ください。<br><span>専用の窓口は近く用意します。</span></p>`
        : `<p class="ct-soon">連絡先は近く用意します。<br><span>もう少しお待ちください。</span></p>`);
  html = html.replace(/<!--contact:start-->[\s\S]*?<!--contact:end-->/,
    '<!--contact:start-->' + ctHtml + '<!--contact:end-->');

  /* パンくず（見る人にも、検索にも効く） */
  const TRAIL = {
    '/works/index.html': [['Works', '/works/']],
    '/notes/index.html': [['Notes', '/notes/']],
    '/stack/index.html': [['Stack', '/stack/']],
    '/profile/index.html': [['Profile', '/profile/']],
    '/contact/index.html': [['Contact', '/contact/']],
    '/privacy/index.html': [['あつかい', '/privacy/']],
  };
  let trail = TRAIL[rel];
  const wm2 = rel.match(/^\/works\/([^/]+)\//);
  const nm2 = rel.match(/^\/notes\/([^/]+)\//);
  if (wm2 && workBySlug[wm2[1]]) {
    const w = workBySlug[wm2[1]];
    trail = [['Works', '/works/']].concat(
      rel.endsWith('/index.html') && rel === w.url + 'index.html'
        ? [[w.title, w.url]] : [[w.title, w.url], ['遊び方', rel.replace('index.html', '')]]);
  } else if (nm2 && noteBySlug[nm2[1]]) {
    trail = [['Notes', '/notes/'], [noteBySlug[nm2[1]].title, noteBySlug[nm2[1]].url]];
  }
  /* 属性付きも消えるようにする（class="crumbs" だけを見ると一致せず、
     組み直すたびに増え続けていた） */
  html = html.replace(/\s*<nav class="crumbs"[^>]*>[\s\S]*?<\/nav>/g, '');
  if (trail) {
    const items = [['Koshin Studio', '/']].concat(trail);
    const cr = '<nav class="crumbs" aria-label="現在地">' + items.map((t, i) =>
      i === items.length - 1
        ? `<span aria-current="page">${esc(t[0])}</span>`
        : `<a href="${t[1]}">${esc(t[0])}</a><i aria-hidden="true">›</i>`).join('') + '</nav>';
    html = html.replace(/(<main[^>]*>\s*<div class="wrap">)/, `$1\n  ${cr}`);
  }

  const ads = conf.ads || {};
  html = html.replace(/<div class="ad-slot"[^>]*>[\s\S]*?<\/div>\s*<!--\/ad-->/g, (m) => {
    const kind = (m.match(/data-slot="([^"]+)"/) || [, 'article'])[1];
    const id = (ads.slots || {})[kind];
    const inner = ads.enabled && ads.client && id
      ? `<ins class="adsbygoogle" style="display:block" data-ad-client="${ads.client}" data-ad-slot="${id}" data-ad-format="auto" data-full-width-responsive="true"></ins><script>(adsbygoogle=window.adsbygoogle||[]).push({});</script>`
      : '';
    return `<div class="ad-slot" data-slot="${kind}"${inner ? '' : ' hidden'}>${inner}</div>\n<!--/ad-->`;
  });
  const url = urlOf(file);
  html = html.replace(/\n?\s*<link rel="canonical"[^>]*>/g, '')
             .replace(/\n?\s*<meta property="og:url"[^>]*>/g, '')
             .replace(/\n?\s*<meta name="twitter:card"[^>]*>/g, '')
             .replace(/\n?\s*<meta property="og:site_name"[^>]*>/g, '')
             .replace(/\n?\s*<meta property="og:locale"[^>]*>/g, '')
             .replace(/\n?\s*<link rel="alternate" type="application\/rss\+xml"[^>]*>/g, '')
             .replace(/\n?\s*<script type="application\/ld\+json">[\s\S]*?<\/script>/g, '');
  const ld = ldFor(file, url);
  const head = [
    `<link rel="canonical" href="${url}">`,
    `<meta property="og:url" content="${url}">`,
    `<meta property="og:site_name" content="Koshin Studio">`,
    `<meta property="og:locale" content="ja_JP">`,
    `<meta name="twitter:card" content="summary_large_image">`,
    `<link rel="alternate" type="application/rss+xml" title="Koshin Studio — Notes" href="${SITE}/feed.xml">`,
    ld ? `<script type="application/ld+json">${JSON.stringify(
      { '@context': 'https://schema.org', '@graph': ld })}</script>` : '',
  ].filter(Boolean).join('\n');
  html = html.replace('</head>', head + '\n</head>');
  const ogName = 'og' + (rel === '/index.html' ? '_home' : rel.replace(/\/index\.html$/, '').replace(/\//g, '_')) + '.jpg';
  const ogPath = existsSync(here + '/assets/og/' + ogName)
    ? `${SITE}/assets/og/${ogName}` : `${SITE}/assets/sushitsumu-wide.jpg`;
  html = html.replace(/\n?\s*<meta property="og:image"[^>]*>/g, '')
             .replace(/\n?\s*<meta property="og:image:width"[^>]*>/g, '')
             .replace(/\n?\s*<meta property="og:image:height"[^>]*>/g, '');
  html = html.replace('</head>',
    `<meta property="og:image" content="${ogPath}">\n` +
    `<meta property="og:image:width" content="1200">\n` +
    `<meta property="og:image:height" content="630">\n</head>`);
  writeFileSync(file, html);
}

writeFileSync(here + '/sitemap.xml',
  '<?xml version="1.0" encoding="UTF-8"?>\n' +
  '<urlset xmlns="http://www.sitemap.org/schemas/sitemap/0.9">\n'.replace('sitemap.org', 'sitemaps.org') +
  pages.map((f) => {
    const rel = f.slice(here.length);
    const pri = rel === '/index.html' ? '1.0'
      : /^\/(works|notes)\/index\.html$/.test(rel) ? '0.8' : '0.6';
    return `  <url><loc>${urlOf(f)}</loc><priority>${pri}</priority></url>`;
  }).join('\n') + '\n</urlset>\n');

writeFileSync(here + '/robots.txt',
  'User-agent: *\nAllow: /\n\nSitemap: ' + SITE + '/sitemap.xml\n');

console.log(`site: ${pages.length} ページに canonical と構造化データ、sitemap.xml を書きました`);

console.log(`site: works ${works.length} / notes ${notes.length} / 分野 ${kindKeys.length} を書き出しました`);
