# CrazyGames に出すための一式

`node server/build-store.mjs` で作り直せる（`index.html` を直したら流し直すこと）。

| ファイル | 用途 |
|---|---|
| `sushitsumu.zip` | 上げるゲーム本体。`index.html` が根に一つだけ入っている |
| `cover-landscape-1920x1080.png` | 横向きの表紙（16:9） |
| `cover-portrait-800x1200.png` | 縦向きの表紙（2:3） |
| `cover-square-800x800.png` | 正方形の表紙（1:1） |

表紙は下書き。もっと良いものが作れるなら差し替えてよい。

## 提出時に貼る文（英語）

**Title**

```
Sushi Tsumu
```

**Short description**

```
Stack sushi, match to merge. Work your way from a ball of rice up to the golden sushi tub.
```

**Description**

```
Drop sushi into the barrel and let matching neta touch — they merge into the next
one up the menu. Eleven kinds, from a plain ball of rice through tamago, ebi,
salmon, maguro, gunkan and otoro, all the way to the golden sushi tub.

Two ways to play:

OMAKASE — no rules but your own. Stack as high as your nerve allows.
ORDERS — the chef calls out an order. Make it before the timer runs out for bonus
points, and keep the streak alive to multiply them.

Chain merges together for combo bonuses. A stray piece of gari will clear one neta
it touches. Let the pile rise past the noren for three seconds and service is over.

Daily and all-time leaderboards, a sushi book that fills in as you discover each
kind, and 14 languages.
```

**Controls**

```
Mouse / touch: drag to aim, release to drop.
Keyboard: arrow keys to move, Space to drop.
Escape pauses.
```

**Tags / genre**

```
puzzle, merge, casual, arcade, relaxing, sushi, food, one-button, singleplayer
```

## 出したあとに足すもの

反応が良くて Full Launch に呼ばれたら、`index.html` の `<head>` にある覚書の
うち CrazyGames の一行を有効にする。それだけで広告が出るようになる（何プレイ
ごとに挟むかは `AD_EVERY`、既定 5）。

出す前に番付を空にしておきたい場合：

```sh
cd server && npx wrangler d1 execute sushitsumu --remote --command "DELETE FROM scores" -y
```
