/* 全部いっぺんに確かめる。

       node tools/check.mjs

   走らせるもの:
     1. tools/asciify.mjs        配布物に非 ASCII の字が残っていないか
     2. tools/i18n-fit.mjs       十四言語ぶんの字が枠に収まるか
     3. tools/dist.mjs           配る形（dist/）に組む
     4. tools/fresh-check.mjs    新しく clone した所で組んで、欠けが無いか

   どれか一つでも転んだら、そこで止めて 1 を返す。
   playwright-core が要る（`npm i playwright-core`）。

   サイト側の検査は koshin-studio の tools/check.mjs にある。
*/
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';

const ROOT = new URL('..', import.meta.url).pathname.replace(/\/$/, '');
const JOBS = [
  ['字の点検',     ROOT + '/tools/asciify.mjs'],
  ['十四言語',     ROOT + '/tools/i18n-fit.mjs'],
  ['配る形',       ROOT + '/tools/dist.mjs'],
  ['写した先',     ROOT + '/tools/fresh-check.mjs'],
];

let failed = 0;
for (const [name, file] of JOBS) {
  if (!existsSync(file)) { console.log(`— ${name}（${file} が無いので飛ばす）`); continue; }
  process.stdout.write(`\n=== ${name} ===\n`);
  const r = spawnSync(process.execPath, [file], { stdio: 'inherit', cwd: ROOT });
  if (r.status !== 0) { console.error(`\n× ${name} で止まりました`); failed = 1; break; }
}
if (!failed) console.log('\n全部通りました。');
process.exit(failed);
