/* 配信用の一式を dist/ に組む。

   ゲーム本体（index.html）はどこへ出しても同じものだが、
   置き場所ごとに少しだけ足したいものがある。
   ここでは「Koshin Studio の一台」として出すぶんを組む。

       node tools/dist.mjs
       npx wrangler pages deploy dist --project-name sushitsumu

   ゲームポータル（CrazyGames など）へ出すときは、
   dist ではなく index.html を一枚そのまま渡す。何も足さない。

   設定は deploy.json（無くてもよい）。
     { "lang": "ja", "adsClient": "", "adFrequencyHint": "60s" }
*/
import { readFileSync, writeFileSync, mkdirSync, existsSync, copyFileSync } from 'node:fs';

const ROOT = new URL('..', import.meta.url).pathname.replace(/\/$/, '');
const OUT = ROOT + '/dist';
const conf = existsSync(ROOT + '/deploy.json')
  ? JSON.parse(readFileSync(ROOT + '/deploy.json', 'utf8')) : {};
const LANG = conf.lang || 'ja';

mkdirSync(OUT, { recursive: true });

let html = readFileSync(ROOT + '/index.html', 'utf8');

/* 足すもの:
   ・noindex … 検索の当たり先は Koshin Studio の作品ページに寄せる。
                ここが別に載ると、どちらも中途半端に扱われる
   ・icon   … 無いと /favicon.ico を探しに行って 404
   ・__lang0 … この一台は日本向け。ブラウザが何語でも日本語で始める
                （?lang=en を付ければそちらが勝つ）
   ・広告   … deploy.json に client を入れたときだけ */
const ads = conf.adsClient
  ? `<script async data-ad-frequency-hint="${conf.adFrequencyHint || '60s'}"`
    + ` src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${conf.adsClient}"`
    + ` crossorigin="anonymous"></script>\n`
  : '';

html = html.replace('<meta name="viewport"',
  '<meta name="robots" content="noindex,follow">\n'
  + '<link rel="icon" href="/favicon.svg" type="image/svg+xml">\n'
  + `<script>window.__lang0=${JSON.stringify(LANG)}</script>\n`
  + ads
  + '<meta name="viewport"');

writeFileSync(OUT + '/index.html', html);
if (existsSync(ROOT + '/favicon.svg')) copyFileSync(ROOT + '/favicon.svg', OUT + '/favicon.svg');

/* 一枚しか無いので、持たせ方も一行で足りる */
writeFileSync(OUT + '/_headers', `/*
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
  Permissions-Policy: geolocation=(), camera=(), microphone=(), payment=()

# 中身が変わっても名前は変わらないので、毎回確かめさせる
/
  Cache-Control: public, max-age=0, must-revalidate
/index.html
  Cache-Control: public, max-age=0, must-revalidate
`);

const kb = (p) => Math.round(readFileSync(p).length / 1024);
console.log(`dist/index.html  ${kb(OUT + '/index.html')} KB（最初の言葉 ${LANG}${ads ? ' / 広告あり' : ''}）`);
console.log('出す: npx wrangler pages deploy dist --project-name sushitsumu');
