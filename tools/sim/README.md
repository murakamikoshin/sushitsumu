# 釣り合いを測る道具

配布物（index.html）は一切変えずに、遊びの釣り合いだけを数える仕掛け。
実時間を待たずに早送りできるので、1 戦がおよそ 2 秒で終わる。

    node make-lab.mjs                       # index.html に覗き窓を足した lab.html を作る
    node sim.mjs 100 normal runs.json       # 100 戦まわして書き出す
    node feas.mjs                           # 「そもそも最後まで行けるのか」を組んで確かめる
    node mech.mjs                           # 特定の場面だけを再現して見る

- `vclock.js` … rAF と setTimeout を自前で回す仮想時計。実時間を待たない。
- `bot.js`   … 貪欲な打ち手。合体を最優先し、山が落ち着くまで待ってから置く。
- `lab.html` は作業用の写しで、覗き窓（`window.__dbg`）が付いている。配らない。

`sim.mjs` は `PW=/opt/pw-browsers/...` の chromium を直に叩く。
環境が違うときは `sim.mjs` の executablePath を直すこと。

## 使う前に

    cd tools/sim && npm i playwright-core

`sim.mjs` の `executablePath` は環境の chromium に合わせて直す。
