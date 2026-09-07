/*
 * 送られてきた手順の辻褄を見る。
 *
 * 物理まで再現すれば一番堅いが、それには Matter.js を回す必要があって、
 * 無料枠の CPU(1呼び出し 10ms)に収まらない。運営費 0 円を崩さない範囲で、
 * 「帳尻が合うか」だけを見る。具体的には四つ。
 *
 *   1. 出題の並び   種から作り直した並びと、落とした物が一致するか
 *   2. 在庫         同じ物が二つ無いのに合体していないか（負の在庫を許さない）
 *   3. 得点         書き留めた出来事から足し直して、申告と一致するか
 *   4. 間合い       落とす間隔・連鎖の親・注文の中身が決まりの範囲か
 *
 * これを通すには、結局まともに遊ぶか、まともに遊ぶ機械を書くしかない。
 * 点だけ書き換える手は、これで通らなくなる。
 *
 * ここの定数は index.html と同じ値でなければならない。片方だけ触ると
 * 正しい記録が弾かれるので、必ず両方を直すこと。
 */

const MERGE_SCORE  = [8, 18, 36, 70, 130, 230, 380, 600, 950, 1500];
const GOLDEN_BONUS = 8000;
const GARI_SCORE   = 40;
const GARI_RATE    = 20;
const LAST         = 10;      // ゴールデンすし桶のレベル
const CHAIN_CAP    = 4;
const CHAIN_WINDOW = 1400;
const DROP_INTERVAL = 420;
const REC_MAX      = 12000;

const SLACK_MS   = 120;       // 描画の揺れを見込んだ余裕
const MAX_MS     = 6 * 3600 * 1000;

function chainMult(n) { return Math.min(CHAIN_CAP, 1 + (n - 1) * 0.7); }
function orderReward(L) { return MERGE_SCORE[L - 1] * 6; }

/* index.html の rnd() と同じ mulberry32 */
function makeRng(seed) {
  let st = seed >>> 0;
  return function () {
    st = (st + 0x6D2B79F5) >>> 0;
    let t = st;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
/* index.html の rollItem() と同じ引き方。引く回数まで揃える */
function makeRoller(seed) {
  const r = makeRng(seed);
  return function () {
    if (Math.floor(r() * GARI_RATE) === 0) return -1;   // -1 = ガリ
    return Math.floor(r() * 3);
  };
}

/* '1|<種36>|<n|o>|d,0,1;m,5f,2;…' を解く */
function parseLog(text) {
  if (typeof text !== 'string' || text.length > 200000) return null;
  const head = text.split('|');
  if (head.length !== 4) return null;
  if (head[0] === '1t') return 'truncated';   // 長すぎて控えきれなかった
  if (head[0] !== '1') return null;
  const seed = parseInt(head[1], 36);
  if (!Number.isFinite(seed) || seed < 0 || seed > 0xFFFFFFFF) return null;
  if (head[2] !== 'n' && head[2] !== 'o') return null;

  const body = head[3];
  const rows = body === '' ? [] : body.split(';');
  if (rows.length > REC_MAX) return null;

  const events = [];
  for (const row of rows) {
    const f = row.split(',');
    const kind = f[0];
    if (!'dpgmox'.includes(kind) || kind.length !== 1) return null;
    const t = parseInt(f[1], 36);
    if (!Number.isFinite(t) || t < 0 || t > MAX_MS) return null;
    const a = f.length > 2 ? parseInt(f[2], 10) : null;
    const b = f.length > 3 ? parseInt(f[3], 10) : null;
    if ((f.length > 2 && !Number.isFinite(a)) || (f.length > 3 && !Number.isFinite(b))) return null;
    if (f.length > 4) return null;
    events.push({ kind, t, a, b });
  }
  return { seed, mode: head[2] === 'o' ? 'order' : 'normal', events };
}

/*
 * 手順を頭から辿って、点を足し直す。
 * 返り値 { ok:true, score } / { ok:false, why }
 */
export function verifyLog(text, claimedScore, claimedKind) {
  const parsed = parseLog(text);
  if (parsed === 'truncated') return { ok: false, why: 'too-long' };
  if (!parsed) return { ok: false, why: 'log-shape' };
  if (parsed.mode !== claimedKind) return { ok: false, why: 'mode' };

  const roll = makeRoller(parsed.seed);
  const inv = new Array(LAST + 1).fill(0);   // 桶の中にある数
  let gariHeld = 0;                          // 落としてまだ使われていないガリ
  let score = 0;
  let lastT = -1, lastDropT = -Infinity;
  let maxLevelMade = 2;
  let orderStreak = 0;
  let lastMerge = null;                      // 直前の合体（注文の裏取り用）
  const recent = [];                         // level ごとの、まだ窓の内側にある合体

  for (const e of parsed.events) {
    if (e.t < lastT) return { ok: false, why: 'time-order' };
    lastT = e.t;

    if (e.kind === 'd' || e.kind === 'p') {
      // 落とす間隔は決まっている。速すぎる手は通さない
      if (e.t - lastDropT < DROP_INTERVAL - SLACK_MS) return { ok: false, why: 'too-fast' };
      lastDropT = e.t;
      const want = roll();
      if (e.kind === 'p') {
        if (want !== -1) return { ok: false, why: 'roll' };
        gariHeld++;
      } else {
        if (want !== e.a) return { ok: false, why: 'roll' };
        inv[e.a]++;
      }
      continue;
    }

    if (e.kind === 'g') {                    // ガリで一つ消した
      const lv = e.a;
      if (!(lv >= 0 && lv <= LAST)) return { ok: false, why: 'gari-level' };
      if (gariHeld <= 0) return { ok: false, why: 'gari-none' };
      if (inv[lv] <= 0) return { ok: false, why: 'gari-empty' };
      gariHeld--;
      inv[lv]--;
      score += GARI_SCORE + lv * 10;
      continue;
    }

    if (e.kind === 'm') {                    // 合体
      const lv = e.a, chain = e.b;
      if (!(lv >= 0 && lv <= LAST)) return { ok: false, why: 'merge-level' };
      if (!(chain >= 1 && chain <= 40)) return { ok: false, why: 'chain-range' };
      if (inv[lv] < 2) return { ok: false, why: 'merge-stock' };
      inv[lv] -= 2;

      if (chain > 1) {
        // 連鎖は「一つ下のレベルで、間を置かず連鎖 chain-1 の合体があった」時にだけ成り立つ。
        // 直近の一つではなく、窓の内側に残っているもの全部から探す
        const pool = recent[lv - 1] || [];
        let ok = false;
        for (const q of pool) {
          if (e.t - q.t <= CHAIN_WINDOW + SLACK_MS && q.chain >= chain - 1) { ok = true; break; }
        }
        if (!ok) return { ok: false, why: 'chain-parent' };
      }
      if (!recent[lv]) recent[lv] = [];
      recent[lv].push({ t: e.t, chain });
      // 窓から出たものは捨てる（際限なく伸ばさない）
      if (recent[lv].length > 64) {
        recent[lv] = recent[lv].filter(function (q) { return e.t - q.t <= CHAIN_WINDOW + SLACK_MS; });
      }

      if (lv >= LAST) {
        score += GOLDEN_BONUS;               // ゴールデン同士は消えて大入り
      } else {
        inv[lv + 1]++;
        score += Math.round(MERGE_SCORE[lv] * chainMult(chain));
        if (lv + 1 > maxLevelMade) maxLevelMade = lv + 1;
      }
      lastMerge = { t: e.t, level: lv + 1 };
      continue;
    }

    if (e.kind === 'o') {                    // 注文をこなした
      if (parsed.mode !== 'order') return { ok: false, why: 'order-mode' };
      const L = e.a, need = e.b;
      if (!(L >= 1 && L <= LAST)) return { ok: false, why: 'order-level' };
      // 注文は「作れる見込みのある範囲」からしか出ない
      if (L > Math.min(maxLevelMade + 1, LAST - 1)) return { ok: false, why: 'order-reach' };
      const maxNeed = L <= 3 ? 3 : L <= 6 ? 2 : 1;
      if (!(need >= 1 && need <= maxNeed)) return { ok: false, why: 'order-need' };
      // 注文が片付くのは、その品を作った合体と同時でなければならない
      if (!lastMerge || lastMerge.level !== L || e.t - lastMerge.t > SLACK_MS) {
        return { ok: false, why: 'order-timing' };
      }
      const mult = Math.min(3, 1 + orderStreak * 0.5);
      score += Math.round(orderReward(L) * need * mult);
      orderStreak++;
      continue;
    }

    if (e.kind === 'x') {                    // 間に合わなかった
      if (parsed.mode !== 'order') return { ok: false, why: 'order-mode' };
      orderStreak = 0;
      continue;
    }
  }

  if (score !== claimedScore) return { ok: false, why: 'score', score };
  return { ok: true, score };
}
