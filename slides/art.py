"""The drawings on the How it works and Engines slides: one per data source, one per engine.

Each function draws into a build.G at an origin (x, y) with the palette C from build.py. The
drawings are pictures of what a source measures, not of data; the few numbers on them are real
readings named in the slide's source line.
"""
import math, random


def flame(g, x, y, h, C):
    w = h * 0.42
    def shape(h, w, fill):
        g.E(f'<path d="M{x:.1f},{y - h:.1f} C{x + w * .2:.1f},{y - h * .6:.1f} {x + w:.1f},{y - h * .5:.1f} {x + w * .7:.1f},{y - h * .12:.1f} '
            f'Q{x:.1f},{y + h * .1:.1f} {x - w * .7:.1f},{y - h * .12:.1f} C{x - w:.1f},{y - h * .5:.1f} {x - w * .2:.1f},{y - h * .6:.1f} {x:.1f},{y - h:.1f} Z" fill="{fill}"/>')
    shape(h, w, C['FIRE'])
    shape(h * .55, w * .55, C['ACCENT'])


def arrowhead(g, x, y, ang, size, color):
    a = math.radians(ang)
    p = [(x, y), (x - size * math.cos(a - .45), y - size * math.sin(a - .45)), (x - size * math.cos(a + .45), y - size * math.sin(a + .45))]
    g.E('<polygon points="' + ' '.join(f'{px:.1f},{py:.1f}' for px, py in p) + f'" fill="{color}"/>')


def satellite(g, x, y, C):
    g.rect(x - 70, y - 11, 46, 22, C['PANEL'], 2)
    g.rect(x + 24, y - 11, 46, 22, C['PANEL'], 2)
    for dx in (-55, -40, 39, 54):
        g.line(x + dx, y - 11, x + dx, y + 11, C['BG'], 2)
    g.line(x - 24, y, x + 24, y, C['INK3'], 3)
    g.rect(x - 18, y - 16, 36, 32, C['INK2'], 4)
    g.E(f'<circle cx="{x}" cy="{y + 24}" r="7" fill="{C["INK3"]}"/>')


def fires_art(g, x, y, C):
    """A satellite looking down a scan swath at fires on the ground."""
    cx, gy = x + 196, y + 250
    g.E(f'<polygon points="{cx - 8},{y + 82} {cx + 8},{y + 82} {x + 340},{gy} {x + 52},{gy}" fill="{C["ACCENT"]}" opacity=".08"/>')
    g.line(cx - 8, y + 82, x + 52, gy, C['INK3'], 1.5, '5 6')
    g.line(cx + 8, y + 82, x + 340, gy, C['INK3'], 1.5, '5 6')
    satellite(g, cx, y + 58, C)
    g.line(x + 24, gy, x + 368, gy, C['HAIRS'], 2)
    for fx, fh in ((x + 120, 44), (x + 160, 64), (x + 210, 38), (x + 262, 56)):
        flame(g, fx, gy - 2, fh, C)
    for px in (x + 92, x + 300):
        g.E(f'<circle cx="{px}" cy="{gy - 6}" r="5" fill="{C["FIRE"]}" opacity=".7"/>')


def wind_art(g, x, y, C):
    """Two wind levels above the ground carrying smoke, and a rain cloud."""
    gy = y + 250
    for i, (ly, lab) in enumerate(((y + 128, '850 hPa, 1.5 km'), (y + 202, '925 hPa, 750 m'))):
        pts = ' '.join(f'{x + 34 + t * 3.1:.1f},{ly + 12 * math.sin(t / 16 + i):.1f}' for t in range(0, 101, 4))
        g.E(f'<polyline points="{pts}" fill="none" stroke="{C["INK2"]}" stroke-width="3" stroke-linecap="round"/>')
        ex = x + 34 + 310; ey = ly + 12 * math.sin(100 / 16 + i)
        arrowhead(g, ex + 6, ey, 4, 18, C['INK2'])
        g.text(x + 34, ly - 20, lab, 18, C['INK3'])
    cx, cy = x + 310, y + 34
    for dx, dy, r in ((-26, 6, 18), (0, -4, 24), (26, 6, 18)):
        g.E(f'<circle cx="{cx + dx}" cy="{cy + dy}" r="{r}" fill="{C["HAIRS"]}"/>')
    g.rect(cx - 44, cy + 6, 88, 18, C['HAIRS'], 9)
    for dx in (-24, 0, 24):
        g.line(cx + dx, cy + 34, cx + dx - 6, cy + 50, C['RAIN'], 2.5)
    g.line(x + 24, gy, x + 368, gy, C['HAIRS'], 2)


def stations_art(g, x, y, C):
    """A monitoring station on the ground and three of its hourly readings."""
    gy = y + 250
    sx = x + 76
    g.rect(sx - 34, gy - 62, 68, 62, C['INK3'], 4)
    g.rect(sx - 22, gy - 48, 44, 14, C['BG'], 2)
    g.line(sx + 18, gy - 62, sx + 18, gy - 120, C['INK3'], 3)
    g.E(f'<circle cx="{sx + 18}" cy="{gy - 124}" r="6" fill="{C["INK2"]}"/>')
    for r in (18, 32):
        g.E(f'<path d="M{sx + 18 + r * .7:.1f},{gy - 124 - r * .7:.1f} A{r},{r} 0 0 1 {sx + 18 + r * .7:.1f},{gy - 124 + r * .7:.1f}" fill="none" stroke="{C["INK3"]}" stroke-width="2"/>')
    for i, (name, v) in enumerate((('Segamat', 187), ('Cheras', 172), ('Shah Alam', 170))):
        ty = y + 52 + i * 62
        g.rect(x + 150, ty, 218, 46, C['BG'], 8)
        g.E(f'<circle cx="{x + 172}" cy="{ty + 23}" r="8" fill="{C["API150"]}"/>')
        g.text(x + 190, ty + 30, name, 20, C['INK2'])
        g.text(x + 352, ty + 30, str(v), 22, C['INK'], 'end', weight=600)
    g.line(x + 24, gy, x + 368, gy, C['HAIRS'], 2)


def airports_art(g, x, y, C):
    """A control tower whose sightline fades into haze before its far mark."""
    gy = y + 250
    tx = x + 70
    g.rect(tx - 12, gy - 120, 24, 120, C['INK3'], 2)
    g.E(f'<polygon points="{tx - 34},{gy - 156} {tx + 34},{gy - 156} {tx + 24},{gy - 122} {tx - 24},{gy - 122}" fill="{C["INK2"]}"/>')
    g.rect(tx - 26, gy - 150, 52, 14, C['BG'], 2)
    g.rect(tx - 4, gy - 172, 8, 16, C['INK3'], 1)
    g.E(f'<defs><linearGradient id="haze" x1="0" x2="1"><stop offset="0" stop-color="{C["HAZE"]}" stop-opacity="0"/>'
        f'<stop offset="1" stop-color="{C["HAZE"]}" stop-opacity=".55"/></linearGradient></defs>')
    g.rect(x + 150, y + 30, 218, gy - y - 32, 'url(#haze)', 6)
    g.line(tx + 30, gy - 140, x + 330, gy - 140, C['INK'], 2, '8 7')
    arrowhead(g, x + 340, gy - 140, 0, 16, C['INK'])
    for i in range(5):
        px = tx + 30 + i * 65
        g.line(px, gy - 10, px, gy, C['INK3'], 2)
    g.text(x + 228, gy - 40, '4 km haze', 22, C['INK'], 'middle', weight=600)
    g.line(x + 24, gy, x + 368, gy, C['HAIRS'], 2)


def simulator_art(g, x, y, w, h, C):
    """Fires release particles; ten jittered wind runs carry them toward a town."""
    rnd = random.Random(7)
    g.E(f'<clipPath id="simclip"><rect x="{x}" y="{y}" width="{w}" height="{h}" rx="12"/></clipPath><g clip-path="url(#simclip)">')
    fx, fy = x + 100, y + h - 100
    tx, ty = x + w - 120, y + 110
    base = math.atan2(ty - fy, tx - fx)
    dist = math.hypot(tx - fx, ty - fy)
    for m in range(10):
        a = base + rnd.gauss(0, .1)
        pts = []
        for k in range(0, 41):
            d = dist * k / 40 * rnd.uniform(.97, 1.03)
            bend = math.sin(k / 40 * math.pi) * 30
            pts.append((fx + d * math.cos(a) - bend * math.sin(a), fy + d * math.sin(a) + bend * math.cos(a)))
        g.poly(pts, C['INK3'], 1.2)
        for k in range(4, 41, 3):
            px, py = pts[k]
            s = 4 + k * .9
            for _ in range(2):
                g.E(f'<circle cx="{px + rnd.gauss(0, s):.1f}" cy="{py + rnd.gauss(0, s):.1f}" r="3" fill="{C["ACCENT"]}" opacity="{.75 - k / 70:.2f}"/>')
    g.E('</g>')
    for dx, fh in ((-28, 40), (0, 58), (28, 36)):
        flame(g, fx + dx, fy + 34, fh, C)
    g.E(f'<circle cx="{tx}" cy="{ty}" r="11" fill="{C["INK"]}" stroke="{C["BG"]}" stroke-width="3"/>')
    g.text(tx + 22, ty + 7, 'a town', 22, C['INK'])
    g.text(fx, fy + 70, 'fire hotspots', 20, C['INK3'], 'middle')
    wx, wy = x + w - 250, y + h - 60
    g.line(wx, wy, wx + 120, wy - 34, C['INK2'], 3)
    arrowhead(g, wx + 126, wy - 36, -16, 18, C['INK2'])
    g.text(wx + 140, wy - 30, 'wind', 20, C['INK3'])


def tree(g, x, y, C, s=1):
    nodes = [(x, y), (x - 44 * s, y + 52 * s), (x + 44 * s, y + 52 * s), (x - 66 * s, y + 104 * s), (x - 22 * s, y + 104 * s), (x + 22 * s, y + 104 * s), (x + 66 * s, y + 104 * s)]
    for a, b in ((0, 1), (0, 2), (1, 3), (1, 4), (2, 5), (2, 6)):
        g.line(*nodes[a], *nodes[b], C['HAIRS'], 2.5)
    for i, (nx, ny) in enumerate(nodes):
        g.E(f'<circle cx="{nx:.1f}" cy="{ny:.1f}" r="{9 * s:.1f}" fill="{C["ACCENT"] if i >= 3 else C["INK3"]}"/>')


def forecast_art(g, x, y, w, h, C):
    """Boosted trees, then one real forecast: Shah Alam on 7 Oct 2026 for 8 Oct."""
    for i in range(3):
        tree(g, x + 80 + i * 112, y + 70 + (i % 2) * 40, C, .7)
    g.text(x + 192, y + h - 34, 'trees, each fixing the last', 20, C['INK3'], 'middle')
    ax = x + 430; X1 = x + w - 40
    lo, hi = 90, 125
    yf = lambda v: y + h - 60 - (v - lo) / (hi - lo) * (h - 110)
    g.line(ax, yf(lo), ax, yf(hi), C['HAIRS'], 2)
    for v in (100, 120):
        g.text(ax - 12, yf(v) + 7, str(v), 18, C['INK3'], 'end')
    nx, fx = ax + 60, X1 - 150
    g.E(f'<circle cx="{nx}" cy="{yf(112.4):.1f}" r="9" fill="{C["INK"]}"/>')
    g.text(nx, yf(112.4) - 22, 'now 112.4', 20, C['INK2'], 'middle')
    g.rect(fx - 26, yf(121), 52, yf(97) - yf(121), C['ACCENT'], 6, .25)
    g.line(fx - 26, yf(98.9), fx + 26, yf(98.9), C['ACCENT'], 4)
    g.text(fx, yf(121) - 14, 'band 97 to 121', 20, C['ACCENT'], 'middle')
    g.E(f'<circle cx="{fx}" cy="{yf(97.2):.1f}" r="7" fill="{C["BG"]}" stroke="{C["INK"]}" stroke-width="3"/>')
    g.text(fx + 40, yf(98.9) - 4, 'forecast 98.9', 20, C['INK'], weight=600)
    g.text(fx + 40, yf(97.2) + 22, 'read 97.2', 20, C['INK3'])
    g.text(nx, y + h - 34, '7 Oct', 20, C['INK3'], 'middle')
    g.text(fx, y + h - 34, '8 Oct', 20, C['INK3'], 'middle')
