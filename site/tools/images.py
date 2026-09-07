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

total = sum(os.path.getsize(os.path.join(out, f)) for f in os.listdir(out)
            if f.endswith(('.webp', '.jpg')))
print(f'合計 {total // 1024} KB')
