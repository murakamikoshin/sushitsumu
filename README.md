# すし積む / Koshin Studio

一つの repo に二つ入っている。

| | | |
|---|---|---|
| **ゲーム** | `index.html` | 「すし積む」本体。HTML 一枚で完結する。これをそのまま配る |
| **サイト** | `site/` | Koshin Studio。作ったものを並べる場所。`site/README.md` に詳しい |

その他:

| | |
|---|---|
| `server/` | 番付（オンラインランキング）の Cloudflare Worker と D1 |
| `store/` | ゲームポータルへ出すときの表紙（正方形・縦・横） |
| `tools/` | 測る・確かめる道具（下記） |
| `artifact/` | 会話のアーティファクトに貼るための断片 |

## ゲーム本体（index.html）

- 枠組みも build も無い。ブラウザで開けばそのまま動く
- 物理演算は Matter.js を中に入れてある。寿司の絵は画像ではなく Canvas に毎回描く
- **表に出る字は全部 `\uXXXX` と `&#xXXXX;` で書く。** 環境によっては
  UTF-8 として読まれず、文字化けするため（CrazyGames でそうなった）。
  直したあとは必ず `node tools/asciify.mjs` を通す。コメントは日本語のままでよい
- 番付を出すときは `server/` の Worker が要る

## 道具（tools/）

| | |
|---|---|
| `check.mjs` | **下の全部をいっぺんに走らせる** |
| `asciify.mjs` | 表に出る字を `\uXXXX` に直し、非 ASCII が残っていないか見る |
| `i18n-fit.mjs` | 十四言語ぶんの字が枠に収まるか |
| `fresh-check.mjs` | 新しく clone した所で組んで、欠けが無いか |
| `sim/` | 自動で何百戦も遊ばせて、釣り合いを数える（`sim/README.md`） |

    npm i playwright-core        # 初回だけ（repo の根と site/tools に）
    node tools/check.mjs

サイト側の検査（`site/tools/audit.mjs` ほか）も `check.mjs` から一緒に走る。

## 出す

- **ゲーム** … `index.html` を一枚そのまま。ゲームポータルへは `store/` の表紙を添える
- **サイト** … `site/` で `npx wrangler pages deploy . --project-name koshin-studio`
- **番付** … `server/README.md`

## 寸法を触ったら

ネタの大きさや点数を変えたら、`tools/sim/` で三百戦まわして数字を取り直し、
`tools/sim/README.md` の表と、サイト側（`site/data/works.json` の `stats`、
`site/notes/anago/`）を書き換えること。数字は三箇所に出ている。
