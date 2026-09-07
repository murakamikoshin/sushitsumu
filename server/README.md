# すし積む 番付サーバー

Cloudflare Workers + D1。無料枠（1日10万リクエスト、D1 5GB）に収まる規模なので、
運営費は 0 円のまま置いておける。クレジットカードの登録も要らない。

## 置き方

```sh
npm install -g wrangler
wrangler login

cd server
wrangler d1 create sushitsumu          # 出てきた database_id を wrangler.toml に貼る
wrangler d1 execute sushitsumu --remote --file=./schema.sql
wrangler deploy                        # https://sushitsumu-rank.<自分>.workers.dev が出る
```

出た URL を `index.html` の

```js
var RANK_API  = '';      // 例 'https://sushitsumu-rank.xxxx.workers.dev'
```

に入れれば、そちらを見にいくようになる。空のままなら、これまで通り
アーティファクトの共有データベースを使う（それも無ければ番付ごと隠れる）。

置き場所を絞りたくなったら `wrangler.toml` の `ALLOW_ORIGINS` に
ゲームの URL をカンマ区切りで並べる。

## 口

| | |
|---|---|
| `GET /top?kind=normal\|order&mode=day\|all&day=YYYY-MM-DD&limit=20` | 上位一覧 `[{id,name,score}]` |
| `POST /submit` `{id,name,score,kind,day}` | 自己ベストの更新 |

`kind` と `mode` で見る列が変わる。お任せは `best` / `dayBest`、
お品書きは `bestO` / `dayBestO` で、四つの番付は互いに混ざらない。

## 決めごと

- **一人一行。** 遊んだ回数ではなく人数でしか行が増えないので、無料枠を食い潰さない。
- **日付はサーバー側の日本時間で切る。** 客の時計を信じると日替わりがばらつく。
- **列名は表から引いた定数しか SQL に入れない。** 外から来た文字列は必ず bind に回す。
- **点数は 0〜1000万に丸める。** 名前は制御文字を落として12文字まで。表示側も `textContent`。

ブラウザで動くゲームである以上、点数の詐称そのものは防ぎきれない。
気になるようなら、後から「1手ごとの記録も一緒に送って、サーバー側で辻褄を見る」
という足し方ができるが、今の規模では割に合わない。
