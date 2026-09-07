#!/usr/bin/env python3
"""サイトで実際に使っている字だけを持つ書体を作る。

Noto Serif JP（SIL Open Font License 1.1）から、このサイトの HTML に出てくる
文字だけを取り出して woff2 にする。全部入りは 1.4MB あるが、これで数十 KB に
収まる。

元の書体は断片に分かれていて、「japanese」の断片に無い字（※ ← → など）が
別の番号の断片に入っている。だから、足りない字は全断片から探して集める。

@font-face の並びは style.css の目印のあいだへ書き戻すので、
文章を書き足したらこれを走らせるだけでよい。

    pip install fonttools brotli
    python3 site/tools/fonts.py
"""
import os, re, sys, glob, subprocess

here = os.path.dirname(os.path.abspath(__file__))
site = os.path.dirname(here)
out  = os.path.join(site, 'vendor', 'fonts')
os.makedirs(out, exist_ok=True)

SRC = os.environ.get('FONTSOURCE',
    '/tmp/claude-0/node_modules/@fontsource/noto-serif-jp/files')
WEIGHTS = (400, 600)
BASE = ('japanese', 'latin')          # まずここから引く

# --- サイトに出てくる字を集める（ゲーム本体は自前で完結しているので除く） ---
used = set(' 　')
for f in glob.glob(os.path.join(site, '**', '*.html'), recursive=True):
    if 'works/sushitsumu/play' in f or '/vendor/' in f:
        continue
    s = open(f, encoding='utf-8').read()
    s = re.sub(r'<(script|style)\b[^>]*>[\s\S]*?</\1>', ' ', s)
    s = re.sub(r'<!--[\s\S]*?-->', ' ', s)
    s = re.sub(r'<[^>]+>', ' ', s)
    s = re.sub(r'&#x([0-9a-fA-F]+);', lambda m: chr(int(m.group(1), 16)), s)
    used |= set(s)
used = {c for c in used if ord(c) > 31}

# 作品や記録が増えたときのために、かなと英数は先回りで入れておく
future = set()
for a, b in [(0x3041, 0x309f), (0x30a0, 0x30ff), (0x0020, 0x007e),
             (0xff01, 0xff5e), (0x3000, 0x303f)]:
    future |= {chr(c) for c in range(a, b + 1)}
print(f'本文の字 {len(used)} 種（先回りぶんを足して {len(used | future)} 種）')

def cmap_of(path):
    from fontTools.ttLib import TTFont
    try:
        return set(TTFont(path).getBestCmap().keys())
    except Exception:
        return set()

def subset(src, chars, dst):
    subprocess.run([sys.executable, '-m', 'fontTools.subset', src,
        '--text=' + ''.join(sorted(chars)), '--flavor=woff2', '--layout-features=*',
        '--no-hinting', '--desubroutinize', '--output-file=' + dst], check=True)
    return os.path.getsize(dst)

faces, total = [], 0
for w in WEIGHTS:
    want = used | future
    covered = set()
    # 1) 主な断片
    for tag in BASE:
        src = os.path.join(SRC, f'noto-serif-jp-{tag}-{w}-normal.woff2')
        if not os.path.exists(src):
            print('元の書体が無い:', src); sys.exit(1)
        have = cmap_of(src)
        take = {c for c in want if ord(c) in have}
        if not take:
            continue
        dst = os.path.join(out, f'koshin-{tag[:2]}-{w}.woff2')
        total += subset(src, take, dst)
        covered |= take
        rng = 'U+0000-00FF,U+2000-206F' if tag == 'latin' else None
        faces.append((w, f'/vendor/fonts/koshin-{tag[:2]}-{w}.woff2', rng))
        print(f'  koshin-{tag[:2]}-{w}.woff2  {os.path.getsize(dst)//1024} KB  ({len(take)} 字)')

    # 2) 主な断片で足りなかった字を、残り全部の断片から探す
    rest = {c for c in used if c not in covered}
    if rest:
        pool = sorted(glob.glob(os.path.join(SRC, f'noto-serif-jp-*-{w}-normal.woff2')))
        bucket = {}
        for path in pool:
            name = os.path.basename(path)
            if any(f'-{t}-' in name for t in BASE):
                continue
            have = cmap_of(path)
            take = {c for c in rest if ord(c) in have}
            if take:
                bucket[path] = take
                rest -= take
            if not rest:
                break
        for i, (path, take) in enumerate(bucket.items()):
            dst = os.path.join(out, f'koshin-ex{i}-{w}.woff2')
            total += subset(path, take, dst)
            rng = ','.join(f'U+{ord(c):04X}' for c in sorted(take))
            faces.append((w, f'/vendor/fonts/koshin-ex{i}-{w}.woff2', rng))
            print(f'  koshin-ex{i}-{w}.woff2  {os.path.getsize(dst)//1024} KB  ({"".join(sorted(take))})')
        if rest:
            print('⚠ どの断片にも無い字:', ''.join(sorted(rest))[:60])

print(f'合計 {total // 1024} KB')

# --- @font-face を style.css へ書き戻す ---
css = ['/* ここは site/tools/fonts.py が書きます。手で直さないこと */']
for w, url, rng in faces:
    css.append('@font-face{font-family:"Koshin Mincho";font-style:normal;'
               f'font-weight:{w};font-display:swap;src:url("{url}") format("woff2");'
               + (f'unicode-range:{rng};' if rng else '') + '}')
block = '\n'.join(css)
cp = os.path.join(site, 'style.css')
s = open(cp, encoding='utf-8').read()
mark_a, mark_b = '/* font-face:start */', '/* font-face:end */'
new = mark_a + '\n' + block + '\n' + mark_b
if mark_a in s:
    s = re.sub(re.escape(mark_a) + r'[\s\S]*?' + re.escape(mark_b), new, s)
else:
    s = new + '\n\n' + s
open(cp, 'w', encoding='utf-8').write(s)
print('style.css の @font-face を書き直しました')

# --- 取りこぼしが無いか照合 ---
have = set()
for _, url, _ in faces:
    have |= cmap_of(os.path.join(site, url.lstrip('/')))
missing = sorted({c for c in used if ord(c) > 0x2000} - {chr(c) for c in have})
if missing:
    print(f'⚠ 書体に無い字が {len(missing)} 種: ' + ''.join(missing)[:80]); sys.exit(1)
print('取りこぼしなし')
