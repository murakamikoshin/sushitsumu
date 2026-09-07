/* 全部いっぺんに確かめる。

       node tools/check.mjs

   走らせるもの:
     1. tools/asciify.mjs        配布物に非 ASCII の字が残っていないか
     2. tools/i18n-fit.mjs       十四言語ぶんの字が枠に収まるか
     3. site/build.mjs           サイトを組み直す
     4. site/tools/voice-check   出迎えの声が鳴っているか
     5. site/tools/interact      押した後まで動くか
     6. site/tools/audit         全ページ × 4 幅を見て回る

   どれか一つでも転んだら、そこで止めて 1 を返す。
   playwright-core が要る（`npm i playwright-core` を repo の根と
   site/tools に）。
*/
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';

const ROOT = new URL('..', import.meta.url).pathname.replace(/\/$/, '');
const JOBS = [
  ['字の点検',     ROOT + '/tools/asciify.mjs'],
  ['十四言語',     ROOT + '/tools/i18n-fit.mjs'],
  ['組み立て',     ROOT + '/site/build.mjs'],
  ['出迎えの声',   ROOT + '/site/tools/voice-check.mjs'],
  ['押した後',     ROOT + '/site/tools/interact.mjs'],
  ['見て回る',     ROOT + '/site/tools/audit.mjs'],
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
