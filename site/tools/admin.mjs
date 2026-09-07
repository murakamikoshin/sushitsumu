/* ============================================================
   管理画面（手元だけで動く）

       node site/tools/admin.mjs      →  http://localhost:4321

   作品・記録・道具・サイトの設定を、画面から足したり直したりできる。
   保存を押すと data/*.json に書いて、そのまま build.mjs を走らせる。
   外へは出していないので、公開先には影響しない。
   ============================================================ */
import { createServer } from 'node:http';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const SITE = new URL('..', import.meta.url).pathname.replace(/\/$/, '');
const PORT = Number(process.env.PORT || 4321);
const FILES = {
  works: '/data/works.json', notes: '/data/notes.json',
  kinds: '/data/kinds.json', stack: '/data/stack.json', site: '/data/site.json',
};
const read = (k) => existsSync(SITE + FILES[k]) ? readFileSync(SITE + FILES[k], 'utf8') : '[]';

const PAGE = `<!doctype html><html lang="ja"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Koshin Studio — 管理</title><style>
:root{--ink:#0b1220;--pnl:#131c2e;--line:#26334a;--txt:#e9eef6;--mut:#9db0c8;--sky:#7ec8e3;--blue:#2f6fd0}
*{box-sizing:border-box}
body{margin:0;background:var(--ink);color:var(--txt);font:14px/1.7 -apple-system,"Hiragino Sans","Noto Sans JP",sans-serif}
header{position:sticky;top:0;background:rgba(11,18,32,.94);backdrop-filter:blur(10px);
  border-bottom:1px solid var(--line);padding:14px 22px;display:flex;gap:16px;align-items:center;z-index:9}
header b{font-size:15px;letter-spacing:.14em}
header .sp{flex:1}
main{max-width:960px;margin:0 auto;padding:26px 22px 90px}
.tabs{display:flex;gap:6px;flex-wrap:wrap;margin:0 0 20px}
.tab{background:transparent;border:1px solid var(--line);color:var(--mut);border-radius:99px;
  padding:8px 18px;cursor:pointer;font:inherit;font-size:13px}
.tab.on{background:var(--sky);border-color:var(--sky);color:#06101f;font-weight:600}
textarea{width:100%;min-height:56vh;background:#0d1626;color:var(--txt);border:1px solid var(--line);
  border-radius:8px;padding:16px;font:13px/1.65 ui-monospace,Menlo,Consolas,monospace;resize:vertical;tab-size:2}
textarea.bad{border-color:#e0533f}
.row{display:flex;gap:10px;align-items:center;margin:14px 0 0;flex-wrap:wrap}
button.go{background:var(--blue);border:0;color:#fff;border-radius:6px;padding:12px 26px;
  cursor:pointer;font:inherit;font-weight:600;letter-spacing:.08em}
button.go:disabled{opacity:.45;cursor:not-allowed}
button.sub{background:transparent;border:1px solid var(--line);color:var(--txt);border-radius:6px;
  padding:11px 20px;cursor:pointer;font:inherit}
.msg{font-size:13px;color:var(--mut);min-height:22px;white-space:pre-wrap}
.msg.ok{color:var(--sky)}.msg.err{color:#e0533f}
.hint{font-size:12.5px;color:var(--mut);margin:0 0 14px;border-left:2px solid var(--line);padding-left:12px}
kbd{background:#0d1626;border:1px solid var(--line);border-radius:4px;padding:1px 6px;font-size:12px}
</style></head><body>
<header><b>Koshin Studio 管理</b><span class="sp"></span>
  <a href="http://localhost:8000/" target="_blank" style="color:var(--sky);font-size:13px">サイトを見る</a>
</header>
<main>
  <div class="tabs" id="tabs"></div>
  <p class="hint" id="hint"></p>
  <textarea id="ed" spellcheck="false"></textarea>
  <div class="row">
    <button class="go" id="save">保存して組み直す</button>
    <button class="sub" id="fmt">整える</button>
    <button class="sub" id="reload">読み直す</button>
    <span class="msg" id="msg"></span>
  </div>
</main>
<script>
const HINTS = {
  works: '作品。kind は game / app / site / cg。featured を true にすると表紙の代表作になる。cover は /assets/… の絵。',
  notes: '記録。date は YYYY-MM-DD。本文のページは site/notes/<slug>/index.html に手で置く。',
  kinds: '分野。ここに足すと Works の絞り込みと表紙の札が増える。',
  stack: '使っている道具。level は 主力 / 実務 / 触った。',
  site:  'SNS・広告・連絡先。contact.email を入れると Contact に出る。ads.enabled を true にすると記事に広告が入る。',
};
let cur = 'works', dirty = false;
const $ = (id) => document.getElementById(id);
function tabs(){ $('tabs').innerHTML = Object.keys(HINTS).map(k =>
  '<button class="tab'+(k===cur?' on':'')+'" data-k="'+k+'">'+k+'</button>').join(''); }
async function load(k){
  if (dirty && !confirm('保存していない変更があります。読み直しますか？')) return;
  cur = k; tabs(); $('hint').textContent = HINTS[k];
  const r = await fetch('/api/'+k); $('ed').value = await r.text();
  dirty = false; $('msg').textContent = ''; $('msg').className = 'msg';
}
$('tabs').onclick = (e) => { if (e.target.dataset.k) load(e.target.dataset.k); };
$('ed').oninput = () => { dirty = true; check(); };
function check(){
  try { JSON.parse($('ed').value); $('ed').classList.remove('bad'); $('save').disabled = false; return true; }
  catch (err) { $('ed').classList.add('bad'); $('save').disabled = true;
    $('msg').className='msg err'; $('msg').textContent = '書式が壊れています: '+err.message; return false; }
}
$('fmt').onclick = () => { if (!check()) return;
  $('ed').value = JSON.stringify(JSON.parse($('ed').value), null, 2) + '\\n'; dirty = true; };
$('reload').onclick = () => load(cur);
$('save').onclick = async () => {
  if (!check()) return;
  $('save').disabled = true; $('msg').className='msg'; $('msg').textContent = '書いています…';
  const r = await fetch('/api/'+cur, { method:'POST', body: $('ed').value });
  const t = await r.text();
  $('msg').className = r.ok ? 'msg ok' : 'msg err'; $('msg').textContent = t;
  $('save').disabled = false; if (r.ok) dirty = false;
};
window.onbeforeunload = () => dirty ? '' : undefined;
document.addEventListener('keydown', (e) => {
  if ((e.metaKey || e.ctrlKey) && e.key === 's') { e.preventDefault(); $('save').click(); }
});
load('works');
</script></body></html>`;

createServer((req, res) => {
  const [, api, key] = req.url.split('?')[0].split('/');
  if (api === 'api' && FILES[key]) {
    if (req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      return res.end(read(key));
    }
    if (req.method === 'POST') {
      let body = '';
      req.on('data', (c) => { body += c; });
      req.on('end', () => {
        try {
          const parsed = JSON.parse(body);
          mkdirSync(SITE + '/data', { recursive: true });
          writeFileSync(SITE + FILES[key], JSON.stringify(parsed, null, 2) + '\n');
          let out = '';
          try {
            out = execFileSync(process.execPath, [SITE + '/build.mjs'], { encoding: 'utf8' });
          } catch (e) { out = '組み直しでつまずきました:\n' + (e.stdout || '') + (e.stderr || ''); }
          res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
          res.end('保存しました。\n' + out.trim());
        } catch (e) {
          res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
          res.end('書式が壊れています: ' + e.message);
        }
      });
      return;
    }
  }
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(PAGE);
}).listen(PORT, '127.0.0.1', () => {
  console.log(`管理画面: http://localhost:${PORT}`);
  console.log('（手元だけで開いています。公開先には出ません）');
});
