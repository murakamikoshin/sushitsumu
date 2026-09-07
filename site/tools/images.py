#!/usr/bin/env python3
"""絵を配る形に落とす。元の PNG は重すぎるので、WebP と JPEG を用意する。

    pip install Pillow
    python3 site/tools/images.py <sushitsumu の場所>
"""
import os, sys
from PIL import Image

here = os.path.dirname(os.path.abspath(__file__))
site = os.path.dirname(here)
game = sys.argv[1] if len(sys.argv) > 1 else os.path.join(site, '..')
out = os.path.join(site, 'assets')
os.makedirs(out, exist_ok=True)

JOBS = [
    ('cover-square-800x800.png',     'sushitsumu-square',    [360, 720]),
    ('cover-portrait-800x1200.png',  'sushitsumu-portrait',  [400, 800]),
    ('cover-landscape-1920x1080.png','sushitsumu-wide',      [960, 1600]),
]

for src, name, widths in JOBS:
    path = os.path.join(game, 'store', src)
    if not os.path.exists(path):
        print('見つからない:', path); continue
    im = Image.open(path).convert('RGB')
    for w in widths:
        h = round(im.height * w / im.width)
        r = im.resize((w, h), Image.LANCZOS)
        suffix = '' if w == widths[0] else '@2x'
        r.save(os.path.join(out, f'{name}{suffix}.webp'), 'WEBP', quality=82, method=6)
        r.save(os.path.join(out, f'{name}{suffix}.jpg'), 'JPEG', quality=84,
               optimize=True, progressive=True)
    print(f'{name}: {" ".join(str(w) for w in widths)}')

# 画面の周りは暗く落としてあるので、明るい所だけに切り詰める。
# 縦（'y'）なら上下の余白を、横（'x'）なら左右の余白を落とす。
TRIM = {'title': 'y', 'desktop': 'x'}
BRIGHT = 78          # これより明るい点が一つでもあれば「中身がある」とみなす
PAD = 0.02           # 切り口に少しだけ余白を残す


def trim(im, axis):
    g = im.convert('L')
    px = g.load()
    n = g.height if axis == 'y' else g.width
    m = g.width if axis == 'y' else g.height
    step = max(1, m // 220)
    live = []
    for i in range(n):
        hi = 0
        for j in range(0, m, step):
            v = px[j, i] if axis == 'y' else px[i, j]
            if v > hi:
                hi = v
                if hi > BRIGHT:
                    break
        if hi > BRIGHT:
            live.append(i)
    if not live:
        return im
    pad = int(n * PAD)
    a = max(0, live[0] - pad); b = min(n, live[-1] + 1 + pad)
    if b - a < n * 0.3:      # 切りすぎたら、そのまま返す
        return im
    return im.crop((0, a, im.width, b)) if axis == 'y' else im.crop((a, 0, b, im.height))

# 画面写真も配る形に落とす。
# 元は shots/raw の PNG（tools/shots.mjs が撮ったまま）。
# 出す先は shots の jpg と webp。元を書き換えないので、何度やっても同じ結果になる。
shots = os.path.join(site, 'assets', 'shots')
raw = os.path.join(shots, 'raw')
if os.path.isdir(raw):
    os.makedirs(shots, exist_ok=True)
    for name, w in (('title', 560), ('play', 560), ('dex', 560), ('desktop', 1200)):
        src = os.path.join(raw, name + '.png')
        if not os.path.exists(src):
            continue
        im = Image.open(src).convert('RGB')
        if name in TRIM:
            im = trim(im, TRIM[name])
        h = round(im.height * w / im.width)
        r = im.resize((w, h), Image.LANCZOS)
        r.save(os.path.join(shots, name + '.webp'), 'WEBP', quality=80, method=6)
        r.save(os.path.join(shots, name + '.jpg'), 'JPEG', quality=84,
               optimize=True, progressive=True)
        print(f'  shots/{name}: {w}x{h}')

total = sum(os.path.getsize(os.path.join(out, f)) for f in os.listdir(out)
            if f.endswith(('.webp', '.jpg')))
total += sum(os.path.getsize(os.path.join(shots, f)) for f in os.listdir(shots)
             if f.endswith(('.webp', '.jpg'))) if os.path.isdir(shots) else 0
print(f'合計 {total // 1024} KB')
