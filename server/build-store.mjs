/*
 * ポータルに出す一式を作り直す。
 *   node server/build-store.mjs
 * ゲーム本体の zip と、表紙3枚を store/ に置く。
 * index.html を直したら流し直すこと。
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, rmSync, copyFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const STORE = join(ROOT, 'store');
const TMP = join(ROOT, '.pack');

mkdirSync(STORE, { recursive: true });
rmSync(TMP, { recursive: true, force: true });
mkdirSync(TMP, { recursive: true });

// zip は index.html を根に一つだけ。CrazyGames はこの形を求める
copyFileSync(join(ROOT, 'index.html'), join(TMP, 'index.html'));
const zip = join(STORE, 'sushitsumu.zip');
rmSync(zip, { force: true });
execFileSync('zip', ['-q', '-9', zip, 'index.html'], { cwd: TMP });
rmSync(TMP, { recursive: true, force: true });
console.log('store/sushitsumu.zip');

if (!existsSync(join(STORE, 'cover-square-800x800.png'))) {
  console.log('表紙がまだ無い。scratchpad の cover.js / shoot.js で作る');
}
