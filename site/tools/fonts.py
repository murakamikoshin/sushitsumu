#!/usr/bin/env python3
"""サイトで実際に使っている字だけを持つ書体を作る。

Noto Serif JP（SIL Open Font License 1.1）から、このサイトの HTML に出てくる
文字だけを取り出して woff2 にする。全部入りは 1.4MB あるが、これで数十 KB に
収まる。文章を書き足したら、もう一度これを走らせること。

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

# --- サイトに出てくる字を集める（ゲーム本体は自前で完結しているので除く） ---
chars = set(' 　')
for f in glob.glob(os.path.join(site, '**', '*.html'), recursive=True):
    if 'works/sushitsumu/play' in f or '/vendor/' in f:
        continue
    s = open(f, encoding='utf-8').read()
    s = re.sub(r'<(script|style)\b[^>]*>[\s\S]*?</\1>', ' ', s)
    s = re.sub(r'<!--[\s\S]*?-->', ' ', s)
    s = re.sub(r'<[^>]+>', ' ', s)
    s = re.sub(r'&#x([0-9a-fA-F]+);', lambda m: chr(int(m.group(1), 16)), s)
    chars |= set(s)
# 作品や記録が増えたときのために、かなと数字と英字は全部入れておく
for a, b in [(0x3041, 0x309f), (0x30a0, 0x30ff), (0x0020, 0x007e),
             (0xff01, 0xff5e), (0x2010, 0x201f), (0x3000, 0x303f)]:
    chars |= {chr(c) for c in range(a, b + 1)}
chars = {c for c in chars if ord(c) > 31}
text = ''.join(sorted(chars))
print(f'集めた字: {len(chars)} 種')

total = 0
for w in (400, 600):
    src = os.path.join(SRC, f'noto-serif-jp-japanese-{w}-normal.woff2')
    lat = os.path.join(SRC, f'noto-serif-jp-latin-{w}-normal.woff2')
    if not os.path.exists(src):
        print('元の書体が無い:', src); sys.exit(1)
    for tag, path in (('jp', src), ('la', lat)):
        dst = os.path.join(out, f'koshin-{tag}-{w}.woff2')
        subprocess.run([sys.executable, '-m', 'fontTools.subset', path,
            f'--text={text}', '--flavor=woff2', '--layout-features=*',
            '--no-hinting', '--desubroutinize', f'--output-file={dst}'], check=True)
        n = os.path.getsize(dst); total += n
        print(f'  koshin-{tag}-{w}.woff2  {n // 1024} KB')
print(f'合計 {total // 1024} KB')
