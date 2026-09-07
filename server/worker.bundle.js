/*
 * すし積む 番付サーバー（一枚に綴じた版）
 *
 * これは生成物です。直に触らないでください。
 * 直すのは server/worker.js と server/verify.js の方で、そのあと
 *   node server/build-bundle.mjs
 * を流し直してください。
 *
 * 端末を使わずに置く場合は、この中身を丸ごと
 * Cloudflare のダッシュボードの Worker 編集画面に貼ってください。
 */

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
function verifyLog(text, claimedScore, claimedKind) {
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


/*
 * すし積む オンライン番付 — Cloudflare Workers + D1
 *
 * 無料枠（1日10万リクエスト / D1 5GB）で動かすことを前提にしている。
 * 自己ベストの取り回しはここで済ませるので、ゲーム側は投げるだけでよい。
 *
 *   GET  /top?kind=normal|order&mode=day|all&day=YYYY-MM-DD&limit=20
 *   POST /submit  {id, name, score, kind, day, log}
 *
 * log は一手ごとの控え。verify.js で帳尻を見て、合わない申告は弾く。
 */

const MAX_SCORE = 10000000;   // これを超える点は受け取らない
const MAX_LIMIT = 100;
const SCAN      = 100;        // 順位はここまで数える。これより下は「圏外」

const FIELDS = {
  normal: { all: 'best',  day: 'dayBest'  },
  order:  { all: 'bestO', day: 'dayBestO' }
};

/* 日付はゲーム側と同じく日本時間で切る。客の時計は当てにしない */
function jstDay() {
  return new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);
}

/* 制御文字を落として長さを切る。表示側も textContent なので二重に守る */
function cleanName(n) {
  let out = '';
  const src = String(n == null ? '' : n);
  for (let i = 0; i < src.length && out.length < 12; i++) {
    const c = src.charCodeAt(i);
    if (c < 32 || c === 127) continue;
    out += src.charAt(i);
  }
  return out.trim().slice(0, 12) || '名無し';
}

function cors(env, req) {
  const allow = String(env.ALLOW_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);
  const origin = req.headers.get('Origin') || '';
  const ok = allow.length === 0 ? '*' : (allow.includes(origin) ? origin : allow[0]);
  return {
    'Access-Control-Allow-Origin': ok,
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Max-Age': '86400'
  };
}

function json(body, env, req, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...cors(env, req) }
  });
}

async function top(url, env, req) {
  const kind = FIELDS[url.searchParams.get('kind')] ? url.searchParams.get('kind') : 'normal';
  const mode = url.searchParams.get('mode') === 'all' ? 'all' : 'day';
  const day = /^\d{4}-\d{2}-\d{2}$/.test(url.searchParams.get('day') || '')
    ? url.searchParams.get('day') : jstDay();
  let limit = parseInt(url.searchParams.get('limit') || '20', 10);
  if (!(limit > 0)) limit = 20;
  limit = Math.min(limit, MAX_LIMIT);

  // 列名は上の表から引いた定数だけ。外から来た文字は SQL に混ぜない
  const col = mode === 'day' ? FIELDS[kind].day : FIELDS[kind].all;
  const sql = mode === 'day'
    ? `SELECT id, name, ${col} AS score FROM scores WHERE day = ?1 AND ${col} > 0 ORDER BY score DESC LIMIT ?2`
    : `SELECT id, name, ${col} AS score FROM scores WHERE ${col} > 0 ORDER BY score DESC LIMIT ?1`;

  const st = mode === 'day'
    ? env.DB.prepare(sql).bind(day, limit)
    : env.DB.prepare(sql).bind(limit);

  const { results } = await st.all();
  return json(results || [], env, req);
}

/*
 * 順位を数える。無料枠は「1日に読んだ行数」で頭打ちになるので、
 * 上位 SCAN 件で打ち切る。上にいる人ほど読む行が少なくて済む。
 */
async function placeOf(env, kind, mode, day, score) {
  if (!(score > 0)) return 0;
  const col = mode === 'day' ? FIELDS[kind].day : FIELDS[kind].all;
  const st = mode === 'day'
    ? env.DB.prepare(
        `SELECT COUNT(*) AS n FROM (SELECT 1 FROM scores WHERE day = ?1 AND ${col} > ?2 LIMIT ?3)`
      ).bind(day, score, SCAN)
    : env.DB.prepare(
        `SELECT COUNT(*) AS n FROM (SELECT 1 FROM scores WHERE ${col} > ?1 LIMIT ?2)`
      ).bind(score, SCAN);
  const { results } = await st.all();
  const n = (results && results[0] && results[0].n) || 0;
  return n >= SCAN ? 0 : n + 1;          // 0 は圏外
}

async function submit(req, env) {
  // ゲーム側は前置きの OPTIONS を避けるため text/plain で送ってくる。
  // 中身は JSON なので、型は見ずに本文を読む
  let b;
  try { b = JSON.parse(await req.text()); }
  catch (e) { return json({ error: 'bad json' }, env, req, 400); }

  const id = String(b.id || '').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 64);
  const kind = FIELDS[b.kind] ? b.kind : 'normal';
  const score = Math.floor(Number(b.score));
  if (!id) return json({ error: 'bad id' }, env, req, 400);
  if (!(score >= 0) || score > MAX_SCORE) return json({ error: 'bad score' }, env, req, 400);

  // 手順の辻褄を見る。合わなければ点は入れない
  const checked = verifyLog(b.log, score, kind);
  if (!checked.ok) {
    return json({ error: checked.why === 'too-long' ? 'too-long' : 'mismatch', why: checked.why },
                env, req, 400);
  }

  const name = cleanName(b.name);
  const day = jstDay();                       // 客の申告ではなく server の日付を使う
  const f = FIELDS[kind];
  const v = { best: 0, bestO: 0, dayBest: 0, dayBestO: 0 };
  v[f.all] = score;
  v[f.day] = score;

  // 日をまたいだら、その日の記録だけ 0 に戻してから入れ直す。
  // UPDATE の右辺はどれも更新前の行を見るので、day の代入順は気にしなくてよい。
  await env.DB.prepare(`
    INSERT INTO scores (id, name, day, best, bestO, dayBest, dayBestO, updatedAt)
    VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)
    ON CONFLICT(id) DO UPDATE SET
      name     = excluded.name,
      best     = MAX(scores.best,  excluded.best),
      bestO    = MAX(scores.bestO, excluded.bestO),
      dayBest  = CASE WHEN scores.day = excluded.day
                      THEN MAX(scores.dayBest,  excluded.dayBest)  ELSE excluded.dayBest  END,
      dayBestO = CASE WHEN scores.day = excluded.day
                      THEN MAX(scores.dayBestO, excluded.dayBestO) ELSE excluded.dayBestO END,
      day       = excluded.day,
      updatedAt = excluded.updatedAt
  `).bind(id, name, day, v.best, v.bestO, v.dayBest, v.dayBestO, new Date().toISOString()).run();

  // 順位はここで数えて返す。ゲーム側が一覧を二度引かずに済み、
  // 一回の登録が 3 呼び出しから 1 呼び出しになる。
  // 数えるのは自己ベストであって、いま送られてきた点ではない
  const { results } = await env.DB.prepare(
    'SELECT best, bestO, dayBest, dayBestO FROM scores WHERE id = ?1'
  ).bind(id).all();
  const row = (results && results[0]) || v;
  const rankDay = await placeOf(env, kind, 'day', day, row[f.day]);
  const rankAll = await placeOf(env, kind, 'all', day, row[f.all]);

  return json({ ok: true, scan: SCAN, rankDay, rankAll }, env, req);
}

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    if (req.method === 'OPTIONS') return new Response(null, { headers: cors(env, req) });
    try {
      if (url.pathname === '/top' && req.method === 'GET') return await top(url, env, req);
      if (url.pathname === '/submit' && req.method === 'POST') return await submit(req, env);
    } catch (e) {
      return json({ error: 'server' }, env, req, 500);
    }
    return json({ error: 'not found' }, env, req, 404);
  }
};
