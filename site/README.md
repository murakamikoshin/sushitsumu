# Koshin Studio — サイト

Cloudflare Pages に置く静的サイト。枠組み（Next.js など）は使っていない。
動きに使う library（GSAP / ScrollTrigger / Lenis）は `vendor/` に置いて
自前で配る。外部 CDN には繋がない。

## 組み立て

    node site/build.mjs

ゲーム本体（sushitsumu の index.html）が隣に見つからないときは、場所を教える。

    GAME_DIR=~/Desktop/sushitsumu/sushitsumu node site/build.mjs

やっていること:

- ゲーム本体と表紙を `works/sushitsumu/play/` `assets/` に写す
- `data/*.json` から Works / Notes / Stack / トップの一覧を書き出す
- 全ページに canonical・og・JSON-LD を入れ、`sitemap.xml` `robots.txt` `feed.xml` を書く

## 管理画面（手元だけ）

    node site/tools/admin.mjs      →  http://localhost:4321

作品・記録・道具・設定を画面から直せる。保存すると JSON に書いて、
そのまま組み直す。公開先には出ない。

## 手を入れる場所（設定は data/ に集めてある）

| したいこと | いじる場所 |
|---|---|
| 作品を足す | `data/works.json` |
| 記録を足す | `data/notes.json` |
| 分野を足す・名前を変える | `data/kinds.json` |
| 使っている道具 | `data/stack.json` |
| SNS を足す | `data/site.json` の `social` |
| 連絡先を出す | `data/site.json` の `contact` |
| 広告を出す | `data/site.json` の `ads` |
| 公開先の URL | `build.mjs` の `SITE`（または環境変数 `SITE_URL`） |

どれも触ったあとは `node build.mjs`。

## 道具（site/tools/）

| | |
|---|---|
| `admin.mjs` | 手元の管理画面 |
| `audit.mjs` | サイト全体を機械で見て回る（下記） |
| `fonts.py` | 使っている字だけの書体を作る |
| `images.py` | 絵を配る形（WebP / JPEG）に落とす |
| `logotype.py` | ロゴの字（KOSHIN STUDIO）を起こす |
| `ogimages.mjs` | ページごとの共有カード（1200×630）を撮る |

文章を書き足したら `fonts.py`、絵を差し替えたら `images.py`、
ページを足したら `ogimages.mjs` を走らせ直す。

## 検査

    node site/tools/audit.mjs

全ページ × 4 つの画面幅を回って数える。

- コンソールのエラー、読み込み失敗、リンク切れ
- 横のはみ出し、文字と背景の明暗差（WCAG）、見出しの並び、alt、押せる物の大きさ
- 下まで送っても現れない要素（現れ方の仕掛けの取りこぼし）
- **JS を切った状態**で本文が読めるか
- 動きを嫌う設定での見え方、鍵盤での辿りやすさ、重さ

## 出す

    npx wrangler pages deploy site --project-name koshin-studio

別リポジトリに切り出したあとは、その中で

    npx wrangler pages deploy . --project-name koshin-studio

`.assetsignore` に、配らないもの（.git など）を並べてある。
Cloudflare Pages の Git 連携で自動配信するなら、ゲーム本体と絵は
site 側にも commit しておく（Pages のビルド機から隣のリポジトリは見えない）。

## 中身

    site/
      index.html            トップ
      works/                作品（一覧は生成、中身は手書き）
      notes/                制作の記録
      stack/                使っている道具
      contact/              ご依頼
      profile/  privacy/    プロフィール・あつかい
      404.html
      data/                 一覧のもと（JSON）
      style.css  motion.js  見た目と動き
      vendor/               GSAP / ScrollTrigger / Lenis / 書体
      tools/                作る・測る道具
      build.mjs             組み立て
      _headers              Pages のヘッダ設定
