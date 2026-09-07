#!/usr/bin/env bash
#
# 番付サーバーを Cloudflare に置く。
#
#   1. npx wrangler login   （これだけ先に、自分で済ませておく）
#   2. bash server/setup.sh
#
# データベースを作り、その id を wrangler.toml に書き込み、表を用意して、
# Worker を上げるところまでやる。最後に URL を出すので、それを
# index.html の RANK_API に入れれば繋がる。
#
# 何度流しても構わない。二度目からは既にあるものを使い回す。

set -euo pipefail
cd "$(dirname "$0")"

DB=sushitsumu
W="npx --yes wrangler@4"

say() { printf '\n\033[1m%s\033[0m\n' "$*"; }
die() { printf '\n\033[31m%s\033[0m\n' "$*" >&2; exit 1; }

command -v node >/dev/null 2>&1 || die "Node.js が入っていません。https://nodejs.org から入れてください。"
command -v npx  >/dev/null 2>&1 || die "npx が見つかりません。Node.js を入れ直してください。"

say "[1/5] ログインを確かめます"
if ! $W whoami >/tmp/sushi-whoami.txt 2>&1; then
  cat /tmp/sushi-whoami.txt
  die "ログインできていません。先に  npx wrangler login  を実行してください。"
fi
grep -iE 'account|email' /tmp/sushi-whoami.txt | head -20 || true
echo
echo "↑ ここに出ているアカウントに置きます。別のアカウントにしたい場合は"
echo "  中断して、wrangler.toml の account_id にそのアカウントの ID を書いてください。"

say "[2/5] データベースを用意します（$DB）"
if $W d1 create "$DB" 2>&1 | tee /tmp/sushi-create.txt | grep -qi 'already exists'; then
  echo "  すでにあるので、それを使います。"
fi

say "[3/5] データベースの id を wrangler.toml に書き込みます"
ID=$($W d1 list --json 2>/dev/null | node -e '
  let s = "";
  process.stdin.on("data", d => s += d);
  process.stdin.on("end", () => {
    // 「[WARNING]」のような前置きが混ざることがあるので、
    // 角括弧の位置を片端から試して、配列として読めた所を採る
    const end = s.lastIndexOf("]");
    let rows = null;
    for (let i = s.indexOf("["); i !== -1 && !rows; i = s.indexOf("[", i + 1)) {
      if (end < i) break;
      try {
        const v = JSON.parse(s.slice(i, end + 1));
        if (Array.isArray(v)) rows = v;
      } catch (e) {}
    }
    const r = (rows || []).find(x => x && x.name === process.argv[1]);
    process.stdout.write(r ? (r.uuid || r.database_id || r.id || "") : "");
  });
' "$DB")

[ -n "$ID" ] || die "データベースの id が読み取れませんでした。npx wrangler d1 list を手で流して、出てきた uuid を wrangler.toml の database_id に貼ってください。"

node -e '
  const fs = require("fs");
  const p = "wrangler.toml";
  const s = fs.readFileSync(p, "utf8")
    .replace(/^database_id\s*=.*$/m, `database_id = "${process.argv[1]}"`);
  fs.writeFileSync(p, s);
' "$ID"
echo "  database_id = $ID"

say "[4/5] 表を用意します"
$W d1 execute "$DB" --remote --file=./schema.sql -y

say "[5/5] Worker を上げます"
# 初回は workers.dev の名前を決めるよう聞かれることがあります。素直に答えてください。
$W deploy 2>&1 | tee /tmp/sushi-deploy.txt

URL=$(grep -oE 'https://[a-z0-9.-]+\.workers\.dev' /tmp/sushi-deploy.txt | head -1 || true)

say "できました"
if [ -n "$URL" ]; then
  echo "  番付サーバー: $URL"
  echo
  echo "  動いているか確かめる:"
  echo "    curl '$URL/top?kind=normal&mode=all&limit=5'"
  echo "    → [] と返ればちゃんと動いています（まだ誰も載っていないので空）"
  echo
  echo "  あとは index.html の RANK_API にこの URL を入れれば繋がります:"
  echo "    var RANK_API  = '$URL';"
else
  echo "  URL が読み取れませんでした。上の出力に出ている workers.dev の URL を使ってください。"
fi
