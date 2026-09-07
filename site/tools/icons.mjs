/* favicon.svg から、貼り付け用の PNG を起こす。

   SVG だけだと、iOS のホーム画面や古い環境で何も出ない。
   180 / 192 / 512 の三枚と、web manifest を用意する。

       node site/tools/icons.mjs
*/
import { chromium } from 'playwright-core';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

const SITE = new URL('..', import.meta.url).pathname.replace(/\/$/, '');
const CHROME = process.env.CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const svg = readFileSync(SITE + '/favicon.svg', 'utf8');
mkdirSync(SITE + '/assets/icon', { recursive: true });

const b = await chromium.launch({ executablePath: CHROME });
for (const n of [180, 192, 512]) {
  const p = await b.newPage({ viewport: { width: n, height: n }, deviceScaleFactor: 1 });
  await p.setContent(`<style>html,body{margin:0;width:${n}px;height:${n}px}
    svg{display:block;width:${n}px;height:${n}px}</style>${svg}`);
  await p.waitForTimeout(120);
  await p.screenshot({ path: `${SITE}/assets/icon/icon-${n}.png`, omitBackground: false });
  await p.close();
  console.log(`  icon-${n}.png`);
}
await b.close();

writeFileSync(SITE + '/site.webmanifest', JSON.stringify({
  name: 'Koshin Studio',
  short_name: 'Koshin',
  description: 'ゲーム、アプリ、Web サイト、3D モデル。ひとりで、ぜんぶ作っています。',
  start_url: '/',
  scope: '/',
  display: 'browser',
  lang: 'ja',
  background_color: '#070c17',
  theme_color: '#080d16',
  icons: [
    { src: '/favicon.svg', type: 'image/svg+xml', sizes: 'any', purpose: 'any' },
    { src: '/assets/icon/icon-192.png', type: 'image/png', sizes: '192x192' },
    { src: '/assets/icon/icon-512.png', type: 'image/png', sizes: '512x512' },
  ],
}, null, 2) + '\n');
console.log('  site.webmanifest');
