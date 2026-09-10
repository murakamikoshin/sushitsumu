/* 寸法とネタの割り振りを振って、一戦の重さを比べる。
       node sweep.mjs 10
   候補は下の CANDS に並べる。各候補で N 戦まわして中央値を出す。 */
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
const N = Number(process.argv[2] || 8);
const CANDS = JSON.parse(readFileSync(new URL('./cands.json', import.meta.url), 'utf8'));
const med = (a) => { const b = [...a].sort((x, y) => x - y); return b[b.length >> 1]; };
const rows = [];
for (const cd of CANDS) {
  const env = { ...process.env };
  if (cd.sizes) env.SIZES = cd.sizes.join(',');
  if (cd.spawn) env.SPAWNW = cd.spawn.join(',');
  if (cd.btop) env.BTOP = String(cd.btop);
  const out = '/tmp/sweep-' + cd.name + '.json';
  const r = spawnSync(process.execPath, ['sim.mjs', String(N), 'normal', out],
                      { env, cwd: import.meta.dirname, encoding: 'utf8' });
  if (r.status !== 0) { console.log(cd.name, 'こけました', r.stderr?.slice(0, 400)); continue; }
  const g = JSON.parse(readFileSync(out, 'utf8'));
  const row = {
    name: cd.name,
    投下: med(g.map(x => x.drops)),
    最大投下: Math.max(...g.map(x => x.drops)),
    秒: Math.round(med(g.map(x => x.sec))),
    点: med(g.map(x => x.score)),
    穴子以上: g.filter(x => x.maxLv >= 8).length + '/' + g.length,
    伊勢海老: g.filter(x => x.maxLv >= 9).length + '/' + g.length,
    金の桶: g.filter(x => x.maxLv >= 10).length + '/' + g.length,
    W金の桶: g.filter(x => (x.made && x.made[10] || 0) >= 2).length + '/' + g.length,
    桶の数: g.reduce((a, x) => a + (x.made && x.made[10] || 0), 0),
    打切: g.filter(x => x.timeout).length,
  };
  rows.push(row);
  console.log(JSON.stringify(row));
}
console.table(rows);
