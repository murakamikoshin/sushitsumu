#!/usr/bin/env python3
"""KOSHIN STUDIO のロゴ字を起こす。

明朝の骨で欧文を組む。縦は太く、横は細く、終わりに「うろこ」を置く。
独特に見えるのはこの組み合わせのせいで、読みやすいのは骨がローマン体の
ままだから。使うのは 9 文字（K O S H I N T U D）だけ。

    python3 site/tools/logotype.py        # site/assets/logotype.svg を書く
"""
import os, sys

EM   = 1000
CAP  = 700          # 大文字の高さ
STEM = 92           # 縦の太さ
HAIR = 26           # 横の細さ
SRF  = 34           # うろこの張り出し（片側）
SRH  = 20           # うろこの高さ
OVER = 8            # 丸い字のオーバーシュート

def p(*cmds): return ' '.join(str(c) for c in cmds)

def serif_stem(x, w=STEM, top=CAP, bot=0, top_srf=True, bot_srf=True):
    """縦棒。上下に台形のうろこを置く"""
    l, r = x, x + w
    d = []
    if top_srf:
        d += [f'M{l-SRF},{top}', f'L{r+SRF},{top}', f'L{r},{top-SRH}', f'L{l},{top-SRH}', 'Z']
    d += [f'M{l},{top-(SRH if top_srf else 0)}', f'L{r},{top-(SRH if top_srf else 0)}',
          f'L{r},{bot+(SRH if bot_srf else 0)}', f'L{l},{bot+(SRH if bot_srf else 0)}', 'Z']
    if bot_srf:
        d += [f'M{l-SRF},{bot}', f'L{r+SRF},{bot}', f'L{r},{bot+SRH}', f'L{l},{bot+SRH}', 'Z']
    return ' '.join(d)

def bar(x1, x2, y, h=HAIR):
    return f'M{x1},{y+h/2} L{x2},{y+h/2} L{x2},{y-h/2} L{x1},{y-h/2} Z'

def ring(cx, cy, rx, ry, tw, th):
    """楕円の輪。左右が太く(tw)、上下が細い(th)。明朝の「O」"""
    o, i = [], []
    k = 0.5523
    # 外側
    o.append(f'M{cx},{cy+ry}')
    o.append(f'C{cx+rx*k},{cy+ry} {cx+rx},{cy+ry*k} {cx+rx},{cy}')
    o.append(f'C{cx+rx},{cy-ry*k} {cx+rx*k},{cy-ry} {cx},{cy-ry}')
    o.append(f'C{cx-rx*k},{cy-ry} {cx-rx},{cy-ry*k} {cx-rx},{cy}')
    o.append(f'C{cx-rx},{cy+ry*k} {cx-rx*k},{cy+ry} {cx},{cy+ry} Z')
    ix, iy = rx - tw, ry - th
    i.append(f'M{cx},{cy+iy}')
    i.append(f'C{cx-ix*k},{cy+iy} {cx-ix},{cy+iy*k} {cx-ix},{cy}')
    i.append(f'C{cx-ix},{cy-iy*k} {cx-ix*k},{cy-iy} {cx},{cy-iy}')
    i.append(f'C{cx+ix*k},{cy-iy} {cx+ix},{cy-iy*k} {cx+ix},{cy}')
    i.append(f'C{cx+ix},{cy+iy*k} {cx+ix*k},{cy+iy} {cx},{cy+iy} Z')
    return ' '.join(o + i)

def tri(x1, y1, x2, y2, x3, y3):
    return f'M{x1},{y1} L{x2},{y2} L{x3},{y3} Z'

def quad(a, b, c, d):
    return f'M{a[0]},{a[1]} L{b[0]},{b[1]} L{c[0]},{c[1]} L{d[0]},{d[1]} Z'

# ---- 字ごとの形と、その字幅 ----
G = {}

def add(ch, adv, d):
    """図形は「重ねて塗る別々の path」として持つ。ひとつの path に繋ぐと
    nonzero の塗り規則で、重なった所が打ち消し合って穴が空く。"""
    G[ch] = (adv, d if isinstance(d, list) else [d])

# I
add('I', 300, serif_stem(104))

# H
add('H', 760, [serif_stem(70), serif_stem(598), bar(162, 598, CAP*0.50)])

# N — 明朝では対角が太い
def N():
    return [serif_stem(70, top=CAP, bot=0),
            serif_stem(606, top=CAP, bot=0),
            quad((150, CAP-SRH+4), (272, CAP-SRH+4), (710, 62), (588, 62))]
add('N', 768, N())

# K
def K():
    j = CAP * 0.46            # 腕と脚が縦棒に取り付く高さ
    return [
        serif_stem(70),
        # 上へ伸びる細い腕。四隅は「左上→右上→右下→左下」の順に置く
        # （順序を違えると、ねじれた四角形になって形が崩れる）
        quad((120, j + 74), (726, CAP - SRH), (642, CAP - SRH), (120, j - 10)),
        # 下へ伸びる太い脚
        quad((120, j + 18), (216, j + 18), (790, SRH), (676, SRH)),
        # 先のうろこ
        quad((620, CAP), (784, CAP), (784, CAP - SRH), (620, CAP - SRH)),
        quad((620, 0), (804, 0), (804, SRH), (620, SRH)),
    ]
add('K', 800, K())

# T
def T():
    return [
        serif_stem(340, top=CAP-HAIR, bot=0, top_srf=False),
        bar(48, 724, CAP-HAIR/2, HAIR*1.15),
        quad((48, CAP-HAIR), (96, CAP-HAIR), (96, CAP-HAIR-40), (48, CAP-HAIR-46)),
        quad((676, CAP-HAIR), (724, CAP-HAIR), (724, CAP-HAIR-46), (676, CAP-HAIR-40)),
    ]
add('T', 772, T())

# U
def U():
    k = 0.5523
    x1, x2 = 70, 660
    yb = 190
    d = quad((x1, CAP), (x1+STEM, CAP), (x1+STEM, yb), (x1, yb))
    d += ' ' + quad((x2, CAP), (x2+STEM, CAP), (x2+STEM, yb), (x2, yb))
    cx = (x1 + x2 + STEM) / 2
    rx = cx - x1
    ry = yb
    d += f' M{x1},{yb} C{x1},{yb-ry*k} {cx-rx*k},{-OVER} {cx},{-OVER}'
    d += f' C{cx+rx*k},{-OVER} {x2+STEM},{yb-ry*k} {x2+STEM},{yb}'
    d += f' L{x2},{yb} C{x2},{yb-(ry-HAIR*1.1)*k} {cx+(rx-STEM)*k},{HAIR*1.25} {cx},{HAIR*1.25}'
    d += f' C{cx-(rx-STEM)*k},{HAIR*1.25} {x1+STEM},{yb-(ry-HAIR*1.1)*k} {x1+STEM},{yb} Z'
    return [d,
        quad((x1-SRF, CAP), (x1+STEM+SRF, CAP), (x1+STEM, CAP-SRH), (x1, CAP-SRH)),
        quad((x2-SRF, CAP), (x2+STEM+SRF, CAP), (x2+STEM, CAP-SRH), (x2, CAP-SRH))]
add('U', 800, U())

# O
add('O', 830, ring(415, CAP/2, 375, CAP/2 + OVER, STEM*1.02, HAIR*1.5))

# D
def D():
    k = 0.5523
    x = 70
    stem = serif_stem(x, top=CAP, bot=0)
    d = ''
    rx, ry = 400, CAP/2
    cy = CAP/2
    x0 = x + STEM
    d = f'M{x0},{CAP} L{x0+120},{CAP}'
    d += f' C{x0+120+rx*k*.9},{CAP} {x0+rx},{cy+ry*k} {x0+rx},{cy}'
    d += f' C{x0+rx},{cy-ry*k} {x0+120+rx*k*.9},{0} {x0+120},{0}'
    d += f' L{x0},{0} L{x0},{SRH} L{x0+110},{SRH}'
    d += f' C{x0+110+(rx-STEM)*k*.9},{SRH} {x0+rx-STEM*1.05},{cy-(ry-HAIR)*k} {x0+rx-STEM*1.05},{cy}'
    d += f' C{x0+rx-STEM*1.05},{cy+(ry-HAIR)*k} {x0+110+(rx-STEM)*k*.9},{CAP-SRH} {x0+110},{CAP-SRH}'
    d += f' L{x0},{CAP-SRH} Z'
    return [stem, d.strip()]
add('D', 700, D())

# S
def S():
    """明朝の S。上下の終わりを水平に切って、うろこを置く"""
    d = []
    # 骨をなぞる帯として組む（外→内）
    d.append('M735,545')
    d.append('C700,640 610,700 470,700')
    d.append('C300,700 150,625 150,505')
    d.append('C150,410 225,360 380,318')
    d.append('L470,294')
    d.append('C600,259 640,225 640,170')
    d.append('C640,105 570,62 460,62')
    d.append('C340,62 262,112 232,205')
    d.append('L150,182')
    d.append('C190,62 300,0 468,0')
    d.append('C640,0 760,78 760,196')
    d.append('C760,292 690,340 530,383')
    d.append('L440,407')
    d.append('C310,442 268,478 268,530')
    d.append('C268,596 340,638 462,638')
    d.append('C578,638 650,596 668,520')
    d.append('Z')
    return ' '.join(d)
add('S', 830, S())

# ---- 組む ----
WORD1, WORD2 = 'KOSHIN', 'STUDIO'
TRACK = 96          # 字間

def line(word):
    """字ごとに <g> を作る。押した字だけを弾けさせたいので、
    一字ずつ触れる形にしておく。cells には (x, 送り幅, 中身) を残す。"""
    x, parts, cells = 0, [], []
    for ch in word:
        adv, shapes = G[ch]
        inner = ''.join(f'<path d="{d}"/>' for d in shapes)
        parts.append(f'<g class="ks-ch" transform="translate({x},0)">{inner}</g>')
        cells.append((x, adv, inner))
        x += adv + TRACK
    return ''.join(parts), x - TRACK, cells

l1, w1, c1 = line(WORD1)
l2, w2, c2 = line(WORD2)
W = max(w1, w2)
GAP = 150
H = CAP * 2 + GAP

# 下段は「字＝マスク、色＝矩形」で塗る。字ごとに弾けさせたいので、
# 一枚の大きな矩形ではなく、字ごとにマスクと矩形を用意する。
# グラデーションは userSpaceOnUse なので、分けても継ぎ目は出ない。
# 矩形は <g> で包む。変形を <g> に掛ければ、マスクも一緒に動く
# （矩形だけ動かすと、字が止まったまま色だけ滑ってしまう）。
off2 = (W - w2) / 2
masks = ''.join(
    f'\n    <mask id="ksM{i}" maskUnits="userSpaceOnUse" x="0" y="0" width="{W}" height="{H}">'
    f'<g fill="#fff" transform="translate(0,{H}) scale(1,-1)">'
    f'<g transform="translate({off2 + x},0)">{inner}</g></g></mask>'
    for i, (x, adv, inner) in enumerate(c2))
rects = ''.join(
    f'\n    <g class="ks-ch"><rect x="{off2 + x}" y="{H - CAP - 1}" width="{adv}" height="{CAP + 2}"'
    f' fill="url(#ksGrad)" mask="url(#ksM{i})"/></g>'
    for i, (x, adv, inner) in enumerate(c2))

svg = f'''<svg class="ks-logo" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" role="img" aria-label="Koshin Studio" preserveAspectRatio="xMidYMid meet">
  <defs>
    <!-- グラデーションは、字ごとの座標系で解決されると先頭の色しか拾わない。
         だから文字は「マスク」にして、色は矩形の側に塗る。
         矩形は字ごとに分けてある（押した字だけを弾けさせるため）。
         userSpaceOnUse なので、分けても色の繋がりは変わらない。 -->
    <linearGradient id="ksGrad" gradientUnits="userSpaceOnUse" x1="{(W-w2)/2}" y1="0" x2="{(W-w2)/2+w2}" y2="0">
      <stop offset="0%" stop-color="#eef6fc"/><stop offset="24%" stop-color="#9adcf0"/>
      <stop offset="54%" stop-color="#4f95e0"/><stop offset="80%" stop-color="#2a63c4"/>
      <stop offset="100%" stop-color="#7ec8e3"/>
    </linearGradient>
{masks}
  </defs>
  <g class="ks-l1" fill="currentColor" transform="translate(0,{H}) scale(1,-1)">
    <g transform="translate({(W-w1)/2},{CAP+GAP})">{l1}</g>
  </g>
  <g class="ks-l2">{rects}
  </g>
</svg>
'''
out = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'assets', 'logotype.svg')
os.makedirs(os.path.dirname(out), exist_ok=True)
open(out, 'w', encoding='utf-8').write(svg)
print('書きました:', os.path.normpath(out), f'({W}x{H})')
