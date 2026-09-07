/*
 * すし積む オンライン番付 — Cloudflare Workers + D1
 *
 * 無料枠（1日10万リクエスト / D1 5GB）で動かすことを前提にしている。
 * 自己ベストの取り回しはここで済ませるので、ゲーム側は投げるだけでよい。
 *
 *   GET  /top?kind=normal|order&mode=day|all&day=YYYY-MM-DD&limit=20
 *   POST /submit  {id, name, score, kind, day}
 */

const MAX_SCORE = 10000000;   // これを超える点は受け取らない
const MAX_LIMIT = 100;

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

async function submit(req, env) {
  let b;
  try { b = await req.json(); } catch (e) { return json({ error: 'bad json' }, env, req, 400); }

  const id = String(b.id || '').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 64);
  const kind = FIELDS[b.kind] ? b.kind : 'normal';
  const score = Math.floor(Number(b.score));
  if (!id) return json({ error: 'bad id' }, env, req, 400);
  if (!(score >= 0) || score > MAX_SCORE) return json({ error: 'bad score' }, env, req, 400);

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

  return json({ ok: true }, env, req);
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
