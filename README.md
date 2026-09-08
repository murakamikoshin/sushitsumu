# すし積む

ブラウザで遊ぶ落ち物パズル。**`index.html` 一枚で完結する**。
枠組みも build も無い。ブラウザで開けばそのまま動く。

サイト（Koshin Studio / koshinstudio.com）は別のリポジトリ
[`murakamikoshin/koshin-studio`](https://github.com/murakamikoshin/koshin-studio)
に移した。ここには入っていない。

| | |
|---|---|
| `index.html` | ゲーム本体。これをそのまま配る |
| `server/` | 番付（オンラインランキング）の Cloudflare Worker と D1 |
| `store/` | ゲームポータルへ出すときの表紙（正方形・縦・横） |
| `tools/` | 測る・確かめる道具（下記） |
| `artifact/` | 会話のアーティファクトに貼るための断片 |
| `dist/` | 配る形（`tools/dist.mjs` が作る。git には入れない） |

## 触るときの決まり

- **表に出る字は全部 `\uXXXX` と `&#xXXXX;` で書く。** 環境によっては
  UTF-8 として読まれず、文字化けするため（CrazyGames でそうなった）。
  直したあとは必ず `node tools/asciify.mjs` を通す。コメントは日本語のままでよい
- 物理演算は Matter.js を中に入れてある。寿司の絵は画像ではなく Canvas に毎回描く
- 番付を出すときは `server/` の Worker が要る

## 道具（tools/）

| | |
|---|---|
| `check.mjs` | **下の全部をいっぺんに走らせる** |
| `asciify.mjs` | 表に出る字を `\uXXXX` に直し、非 ASCII が残っていないか見る |
| `i18n-fit.mjs` | 十四言語ぶんの字が枠に収まるか |
| `dist.mjs` | 配る形（`dist/`）に組む |
| `fresh-check.mjs` | 新しく clone した所で組んで、欠けが無いか |
| `sim/` | 自動で何百戦も遊ばせて、釣り合いを数える（`sim/README.md`） |

    npm i playwright-core        # 初回だけ
    node tools/check.mjs

## 出す

**ゲームポータル（CrazyGames など）** … `index.html` を一枚そのまま渡す。
何も足さない。表紙は `store/` のものを添える。言語はブラウザの設定に従う。

**Koshin Studio（koshinstudio.com/play/sushitsumu/）** …
置き場所ごとの一手間（日本語で開始・`noindex, follow`・見出しの絵・広告）を
足して `dist/` に組んでから出す。

    node tools/dist.mjs
    npx wrangler pages deploy dist --project-name sushitsumu

出す先は `sushitsumu.pages.dev`。そこへ `koshinstudio.com/play/sushitsumu/`
から中継が繋がっている（中継の設定は koshin-studio 側の `worker/`）。
**道は変わらないので、中身を直した時にサイト側は触らなくていい。**

設定は `deploy.json`（無くてもよい）。`lang`・`adsClient`・`adFrequencyHint` を持つ。

**番付** … `server/README.md`

## 寸法を触ったら

ネタの大きさや点数を変えたら、`tools/sim/` で三百戦まわして数字を取り直し、
`tools/sim/README.md` の表を書き換える。サイト側にも同じ数字が出ているので
（koshin-studio の `data/works.json` の `stats` と `notes/anago/`）、
そちらも合わせること。
