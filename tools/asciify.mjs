/* ============================================================
   asciify — index.html から非 ASCII のバイト列を消す

   配信先（CrazyGames など）の受け渡しで多バイト文字が壊れても
   画面の文字が化けないように、実際に表示される文字だけを
   ASCII の表記に置き換える。

     ・スクリプトの文字列リテラル → \uXXXX
     ・HTML の本文と属性値        → &#xXXXX;
   コメントはそのまま残す（化けても表示されない）。

   日本語のまま書き直したあと、node tools/asciify.mjs で整える。
   ============================================================ */
import { readFileSync, writeFileSync } from 'node:fs';

const FILE = new URL('../index.html', import.meta.url);
const src = readFileSync(FILE, 'utf8');

const esc = (ch) => '\\u' + ch.codePointAt(0).toString(16).padStart(4, '0');
const ent = (ch) => '&#x' + ch.codePointAt(0).toString(16) + ';';
const ascii = (s) => !/[^\x00-\x7f]/.test(s);

/* --- スクリプト：文字列リテラルの中だけを \uXXXX にする --- */
function asciifyJs(js) {
  let out = '';
  let i = 0;
  while (i < js.length) {
    const c = js[i];
    if (c === '/' && js[i + 1] === '/') {                    // 行コメント
      const e = js.indexOf('\n', i); const j = e < 0 ? js.length : e;
      out += js.slice(i, j); i = j; continue;
    }
    if (c === '/' && js[i + 1] === '*') {                    // ブロックコメント
      const e = js.indexOf('*/', i + 2); const j = e < 0 ? js.length : e + 2;
      out += js.slice(i, j); i = j; continue;
    }
    if (c === '"' || c === "'") {                            // 文字列リテラル
      const q = c; let s = q; i++;
      while (i < js.length) {
        const d = js[i];
        if (d === '\\') { s += js.slice(i, i + 2); i += 2; continue; }
        if (d === q) { s += q; i++; break; }
        s += d.codePointAt(0) > 127 ? esc(d) : d;
        i += 1;
      }
      out += s; continue;
    }
    out += c; i++;
  }
  return out;
}

/* --- HTML：コメント以外の非 ASCII を &#xXXXX; にする --- */
function asciifyHtml(html) {
  let out = '';
  let i = 0;
  while (i < html.length) {
    if (html.startsWith('<!--', i)) {
      const e = html.indexOf('-->', i); const j = e < 0 ? html.length : e + 3;
      out += html.slice(i, j); i = j; continue;
    }
    const cp = html.codePointAt(i);
    const c = String.fromCodePoint(cp);
    out += cp > 127 ? ent(c) : c;
    i += c.length;
  }
  return out;
}

/* --- 切り分け：script / style / それ以外 --- */
const re = /<(script|style)\b[^>]*>([\s\S]*?)<\/\1>/g;
let out = '';
let last = 0;
let m;
while ((m = re.exec(src)) !== null) {
  out += asciifyHtml(src.slice(last, m.index));
  const open = m[0].slice(0, m[0].indexOf('>') + 1);
  const body = m[2];
  out += open + (m[1] === 'script' ? asciifyJs(body) : body) + '</' + m[1] + '>';
  last = m.index + m[0].length;
}
out += asciifyHtml(src.slice(last));

/* --- 検算：戻したら元どおりか --- */
const back = out
  .replace(/\\u([0-9a-fA-F]{4})/g, (s, h) => String.fromCharCode(parseInt(h, 16)))
  .replace(/&#x([0-9a-fA-F]+);/g, (s, h) => String.fromCodePoint(parseInt(h, 16)));
const norm = src
  .replace(/\\u([0-9a-fA-F]{4})/g, (s, h) => String.fromCharCode(parseInt(h, 16)))
  .replace(/&#x([0-9a-fA-F]+);/g, (s, h) => String.fromCodePoint(parseInt(h, 16)));
if (back !== norm) {
  console.error('asciify: 復元できませんでした。中止します。');
  process.exit(1);
}

/* --- 検算：スクリプトのコメント以外に非 ASCII が残っていないか --- */
const stripJsComments = (js) => js
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/\/\/[^\n]*/g, '');
for (const x of out.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)) {
  const left = stripJsComments(x[1]).match(/[^\x00-\x7f]/g);
  if (left) { console.error('asciify: 文字列の外に非 ASCII が残りました: ' + left.join('')); process.exit(1); }
}

const styleLeft = [...out.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/g)]
  .map((x) => x[1]).join('').split(/\/\*[\s\S]*?\*\//).join('');
if (!ascii(styleLeft)) console.warn('asciify: style に非 ASCII が残っています。');

writeFileSync(FILE, out);
const left = (out.match(/[^\x00-\x7f]/g) || []).length;
console.log('asciify: 残りの非 ASCII（コメントのみのはず）=' + left);
