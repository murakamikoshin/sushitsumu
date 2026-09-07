/*
 * 番付サーバーを Cloudflare に置く。
 *
 *   1. npx wrangler login      （これだけ先に、自分で済ませておく）
 *   2. node server/setup.mjs
 *
 * データベースを作り、その id を wrangler.toml に書き込み、表を用意して、
 * Worker を上げるところまでやる。最後に URL を出すので、それを
 * index.html の RANK_API に入れれば繋がる。
 *
 * 何度流しても構わない。二度目からは既にあるものを使い回す。
 * Windows・Mac・Linux のどれでも同じように動く。
 */
import { spawn } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const DB = 'sushitsumu';
const W = 'npx --yes wrangler@4';

const bold = (s) => `\x1b[1m${s}\x1b[0m`;
const red  = (s) => `\x1b[31m${s}\x1b[0m`;
const say  = (s) => console.log('\n' + bold(s));
function die(msg) { console.error('\n' + red(msg)); process.exit(1); }

/* 画面には出しつつ、中身も控える。聞かれ事にはそのまま答えられる */
function run(cmd, { quiet = false } = {}) {
  return new Promise((resolve) => {
    const child = spawn(cmd, {
      shell: true, cwd: HERE,
      stdio: ['inherit', 'pipe', quiet ? 'pipe' : 'inherit']
    });
    let out = '';
    child.stdout.on('data', (d) => { out += d; if (!quiet) process.stdout.write(d); });
    if (quiet && child.stderr) child.stderr.on('data', (d) => { out += d; });
    child.on('close', (code) => resolve({ code, out }));
    child.on('error', () => resolve({ code: 1, out }));
  });
}

/* wrangler は「▲ [WARNING] …」を前置きすることがある。その角括弧を
   配列の始まりと取り違えないよう、読める所が見つかるまで順に試す */
function pickArray(text) {
  const end = text.lastIndexOf(']');
  for (let i = text.indexOf('['); i !== -1; i = text.indexOf('[', i + 1)) {
    if (end < i) break;
    try {
      const v = JSON.parse(text.slice(i, end + 1));
      if (Array.isArray(v)) return v;
    } catch (e) { /* 次の候補へ */ }
  }
  return null;
}

const [maj] = process.versions.node.split('.').map(Number);
if (maj < 18) die(`Node.js が古すぎます（今 v${process.versions.node}）。v18 以上を https://nodejs.org から入れてください。`);

say('[1/5] ログインを確かめます');
// whoami は未ログインでも 0 で終わる。中身を読んで判断する
const who = await run(`${W} whoami`, { quiet: true });
if (who.code !== 0 || /not authenticated|認証されて/i.test(who.out)) {
  die('まだログインできていません。\n\n  先に  npx wrangler login  を実行してください。\n  ブラウザが開くので、置きたいアカウントで許可すれば終わりです。');
}
const acct = who.out.split('\n').filter((l) => /account|email|logged in/i.test(l));
console.log(acct.length ? acct.join('\n') : who.out.trim());
console.log('\n↑ ここに出ているアカウントに置きます。');
console.log('  違うアカウントにしたい場合は、いま Ctrl+C で止めて、');
console.log('  wrangler.toml の account_id にそのアカウントの ID を書いてください。');

say(`[2/5] データベースを用意します（${DB}）`);
const created = await run(`${W} d1 create ${DB}`, { quiet: true });
if (/already exists|既に/i.test(created.out)) console.log('  すでにあるので、それを使います。');
else if (created.code !== 0) { console.log(created.out); die('データベースを作れませんでした。上の内容を貼ってください。'); }
else console.log('  作りました。');

say('[3/5] データベースの id を wrangler.toml に書き込みます');
const listed = await run(`${W} d1 list --json`, { quiet: true });
const rows = pickArray(listed.out) || [];
const hit = rows.find((r) => r && r.name === DB);
const id = hit && (hit.uuid || hit.database_id || hit.id);
if (!id) {
  console.log(listed.out);
  die(`id が読み取れませんでした。 npx wrangler d1 list を手で流して、\n${DB} の uuid を server/wrangler.toml の database_id に貼ってください。`);
}
const toml = join(HERE, 'wrangler.toml');
writeFileSync(toml, readFileSync(toml, 'utf8').replace(/^database_id\s*=.*$/m, `database_id = "${id}"`));
console.log(`  database_id = ${id}`);

say('[4/5] 表を用意します');
const schema = await run(`${W} d1 execute ${DB} --remote --file=./schema.sql -y`);
if (schema.code !== 0) die('表を作れませんでした。上の内容を貼ってください。');

say('[5/5] Worker を上げます');
console.log('  初回は workers.dev の名前を決めるよう聞かれることがあります。素直に答えてください。');
const dep = await run(`${W} deploy`);
if (dep.code !== 0) die('上げられませんでした。上の内容を貼ってください。');

const url = (dep.out.match(/https:\/\/[a-z0-9.-]+\.workers\.dev/i) || [])[0];

say('できました');
if (url) {
  console.log(`\n  番付サーバー: ${bold(url)}\n`);
  console.log('  動いているか確かめる:');
  console.log(`    curl "${url}/top?kind=normal&mode=all&limit=5"`);
  console.log('    → [] と返ればちゃんと動いています（まだ誰も載っていないので空）\n');
  console.log('  この URL を Claude に貼れば、ゲームに組み込んで push します。');
  console.log('  自分でやるなら index.html の一行を書き換えるだけです:');
  console.log(`    var RANK_API  = '${url}';`);
} else {
  console.log('  URL が読み取れませんでした。上の出力にある workers.dev の URL を使ってください。');
}
