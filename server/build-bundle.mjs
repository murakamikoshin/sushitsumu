/*
 * worker.js と verify.js を一つに綴じる。
 *
 * 端末が使えない時、Cloudflare のダッシュボードに直に貼って置けるように。
 * 出来上がりの worker.bundle.js は生成物なので、直に触らないこと。
 * 直すのは worker.js と verify.js の方で、そのあと
 *   node server/build-bundle.mjs
 * を流し直す。
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const read = (f) => readFileSync(join(HERE, f), 'utf8');

const verify = read('verify.js')
  .replace(/^export\s+function\s+verifyLog/m, 'function verifyLog');
const worker = read('worker.js')
  .replace(/^import\s+\{[^}]*\}\s+from\s+'\.\/verify\.js';\s*\n/m, '');

if (verify.includes('export ')) throw new Error('verify.js に外向けの宣言が残っています');
if (worker.includes("from './verify.js'")) throw new Error('worker.js の取り込みが消せていません');

const out = `/*
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

${verify}

${worker}`;

writeFileSync(join(HERE, 'worker.bundle.js'), out);
console.log('worker.bundle.js', Buffer.byteLength(out), 'bytes', out.split('\n').length, '行');
