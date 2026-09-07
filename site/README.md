# Koshin Studio — サイト

Cloudflare Pages に置く静的サイト。枠組み（Next.js など）は使っていない。
HTML と CSS と、外部 library を入れない JavaScript が一枚ずつ。

## 組み立て

    node site/build.mjs

ゲーム本体（sushitsumu の index.html）が隣に見つからないときは、場所を教える。

    GAME_DIR=~/Desktop/sushitsumu/sushitsumu node build.mjs
    node build.mjs ~/Desktop/sushitsumu/sushitsumu

やっていること:

- `index.html`（ゲーム本体）を `site/works/sushitsumu/play/` に写す
- `store/` の表紙を `site/assets/` に写す
- `site/data/*.json` から `works/index.html` と `notes/index.html` を書き出す
- トップの抜粋（`<!--works:start-->` の間）を差し替える

## 手を入れる場所（設定は data/ に集めてある）

| したいこと | いじる場所 |
|---|---|
| 作品を足す | `data/works.json` |
| 記録を足す | `data/notes.json` |
| 分野を足す・名前を変える | `data/kinds.json` |
| SNS を足す | `data/site.json` の `social` |
| 広告を出す | `data/site.json` の `ads`（`enabled: true` と client / slot） |
| 公開先の URL | `build.mjs` の `SITE`（または環境変数 `SITE_URL`） |
| 書体を作り直す | `python3 tools/fonts.py`（文章を足したら必ず） |
| 絵を作り直す | `python3 tools/images.py` |

どれも触ったあとは `node build.mjs`。

## 作品を足す

`site/data/works.json` に一つ足して、`node site/build.mjs`。
`kind` は `game` / `app` / `site` のどれか（`data/kinds.json` で増やせる）。
作品ごとの中身のページは、`site/works/<slug>/index.html` に手で書く。

## 記録を足す

`site/data/notes.json` に一つ足して、本文は `site/notes/<slug>/index.html`。

## 別リポジトリに切り出したあと

`build.mjs` はゲーム本体を次の順で探す。隣に `sushitsumu` が並んでいれば、
そのままで通る。

    ../index.html            （sushitsumu の中にあるとき）
    ../sushitsumu/index.html （隣に並んでいるとき）

Cloudflare Pages の Git 連携で自動配信するなら、ゲーム本体と表紙は
**site 側にも commit しておく**（`.gitignore` から外す）。Pages のビルド機で
隣のリポジトリは見えないため。ゲームを直したら `node build.mjs` して
commit し直す。

## 出す

    npx wrangler pages deploy site --project-name koshin-studio

別リポジトリに切り出したあとは、その中で

    npx wrangler pages deploy . --project-name koshin-studio

`.assetsignore` に、配らないもの（.git など）を並べてある。

## 中身

    site/
      index.html            トップ
      works/                作品（一覧は生成、中身は手書き）
      notes/                制作の記録
      profile/  privacy/    プロフィール・あつかい
      data/                 一覧のもと（JSON）
      style.css  motion.js  見た目と動き
      build.mjs             組み立て
      _headers              Pages のヘッダ設定
