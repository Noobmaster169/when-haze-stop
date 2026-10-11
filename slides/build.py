"""Builds deck.html: eight dark slides in the product's own palette, one claim each.

Every number traces to docs/MODEL.md, the app's database on 11 October 2026 (data/), the Model
page's published scores, or the press reports named on the slide. Screenshots in assets/shots/
are the running app in dark mode. Run: python3 build.py, then node render.mjs --png.
"""
import os

import art

HERE = os.path.dirname(os.path.abspath(__file__))

# The product's dark theme (frontend/app/globals.css) and its API ramp.
BG, CANVAS, SURFACE = '#0f1115', '#15181d', '#1b1e24'
INK, INK2, INK3, FAINT = '#f3f4f6', '#c4c9d1', '#9aa1ab', '#6b727d'
HAIR, HAIRS = '#2a2e36', '#3a404a'
ACCENT, ACCENT_TINT = '#f2b84b', '#2d2412'
API = {0: '#3fb15f', 50: '#e6cf45', 100: '#f2a33a', 150: '#e8553a', 200: '#c4246b', 300: '#7d2bb8'}
SERIF, SANS, MONO = 'Newsreader', 'Inter', 'JetBrains Mono'
C = dict(BG=BG, INK=INK, INK2=INK2, INK3=INK3, HAIRS=HAIRS, ACCENT=ACCENT, API150=API[150], FIRE=API[150],
         PANEL='#3a4a63', RAIN='#6b8fb8', HAZE='#9aa1ab')


def esc(t):
    return t.replace('&', '&amp;').replace('<', '&lt;')


class G:
    def __init__(s): s.o = []
    def E(s, x): s.o.append(x)
    def text(s, x, y, t, size=24, fill=INK, anchor='start', font=SANS, weight=400, ls=0):
        s.E(f'<text x="{x:.0f}" y="{y:.0f}" font-family="{font}" font-size="{size}" font-weight="{weight}" fill="{fill}" text-anchor="{anchor}" letter-spacing="{ls}">{esc(t)}</text>')
    def line(s, x1, y1, x2, y2, color=HAIR, sw=1.5, dash=None):
        da = f' stroke-dasharray="{dash}"' if dash else ''
        s.E(f'<line x1="{x1:.1f}" y1="{y1:.1f}" x2="{x2:.1f}" y2="{y2:.1f}" stroke="{color}" stroke-width="{sw}"{da}/>')
    def poly(s, pts, color=INK, sw=3):
        s.E('<polyline points="' + ' '.join(f'{x:.1f},{y:.1f}' for x, y in pts) + f'" fill="none" stroke="{color}" stroke-width="{sw}" stroke-linejoin="round" stroke-linecap="round"/>')
    def rect(s, x, y, w, h, fill, r=0, opacity=1):
        s.E(f'<rect x="{x:.1f}" y="{y:.1f}" width="{w:.1f}" height="{h:.1f}" rx="{r}" fill="{fill}" opacity="{opacity}"/>')
    def dot(s, x, y, r=8, fill=ACCENT, ring=BG):
        s.E(f'<circle cx="{x:.1f}" cy="{y:.1f}" r="{r}" fill="{fill}" stroke="{ring}" stroke-width="3"/>')
    def svg(s, w=1920, h=1080, style='position:absolute;left:0;top:0'):
        return f'<svg width="{w}" height="{h}" viewBox="0 0 {w} {h}" style="{style}">\n' + '\n'.join(s.o) + '\n</svg>'


def head(eyebrow, title, width=1500):
    return (f'<div class="head"><p class="eyebrow">{esc(eyebrow)}</p>'
            f'<h2 class="title" style="width:{width}px">{esc(title)}</h2></div>')


def hero(x, y, figure, label, size=150, w=560, fill=INK):
    return (f'<div class="hero" style="left:{x}px;top:{y}px;width:{w}px">'
            f'<p class="big" style="font-size:{size}px;color:{fill}">{esc(figure)}</p>'
            f'<p class="lab">{esc(label)}</p></div>')


# ---------------------------------------------------------------- 01 cover
def s01():
    return f'''<section class="slide" style="padding:0">
  <img src="assets/shots/dark-map.png" style="position:absolute;left:0;top:0;width:1920px;height:1080px;object-fit:cover">
  <div style="position:absolute;left:0;top:0;width:1920px;height:1080px;background:linear-gradient(90deg, rgba(15,17,21,.96) 0%, rgba(15,17,21,.9) 38%, rgba(15,17,21,.35) 62%, rgba(15,17,21,0) 100%)"></div>
  <div style="position:absolute;left:128px;top:300px;width:900px">
    <h1 class="big" style="font-size:176px;line-height:.96;letter-spacing:-5px">When Haze Stop</h1>
    <p style="font-size:40px;line-height:1.3;margin-top:44px;color:{INK2};width:720px">Real-Time Detection, Forecast, and Simulation for Air Pollution</p>
  </div>
</section>'''


# ---------------------------------------------------------------- 02 problem
def s02():
    # The press screenshots and the photo the user supplied, uncropped except the photo, which fills its cell.
    return f'''<section class="slide">
  {head('Problem', 'The haze is back, and the air is unhealthy to breathe.', 1600)}
  <div class="shot" style="position:absolute;left:128px;top:250px;width:814px;height:720px">
    <img src="assets/haze3.png" style="width:814px;height:720px;object-fit:cover;object-position:top">
  </div>
  <div class="shot" style="position:absolute;left:982px;top:250px;width:810px;height:217px">
    <img src="assets/haze2.png" style="width:810px;height:217px;object-fit:cover">
  </div>
  <div class="shot" style="position:absolute;left:982px;top:499px;width:810px;height:471px">
    <img src="assets/haze1.jpg" style="width:810px;height:471px;object-fit:cover">
  </div>
</section>'''


# ---------------------------------------------------------------- 02b today's options
def s02b():
    shots = [('assets/iqair.png', 1708, 716, 'IQAir: readings and smoke across the region'),
             ('assets/kl-pollution.png', 1532, 693, 'A city AQI page: the last two days, by pollutant')]
    cells, x, ih, top = [], 128, 352, 440
    for src, w, h, cap in shots:
        iw = round(ih * w / h)
        cells.append(f'''<div class="shot" style="position:absolute;left:{x}px;top:{top}px;width:{iw}px;height:{ih}px;background:#fff">
    <img src="{src}" style="width:{iw}px;height:{ih}px">
  </div>''')
        x += iw + 40
    return f'''<section class="slide">
  {head('Problem', 'Informational sources for haze data are limited.', 1600)}
  {''.join(cells)}
</section>'''


# ---------------------------------------------------------------- 03 how it works
SOURCES = [
    (art.fires_art, 'Fire hotspots', 'NASA FIRMS, 3 satellites', 'Where fires burn and how hot. Gas flares and industry screened out.', 'Every 3 hours'),
    (art.wind_art, 'Wind and rain', 'Open-Meteo forecast', 'Wind at the height smoke travels, and the rain that washes it out, 84 hours ahead.', 'Every hour'),
    (art.stations_art, 'Air quality', 'DOE Malaysia, 68 stations', 'The Air Pollutant Index that school and work rules read.', 'Every hour'),
    (art.airports_art, 'Airport visibility', 'METAR reports, 29 airports', 'How far the observer could see, and whether they called it haze or smoke.', 'Every hour'),
]


def s03():
    g = G(); cards = []
    for i, (draw, name, src, what, when) in enumerate(SOURCES):
        x = 128 + i * 424
        g.rect(x, 270, 392, 320, SURFACE, 12)
        draw(g, x, 280, C)
        cards.append(f'''<div style="position:absolute;left:{x}px;top:632px;width:392px;height:310px">
    <p style="font-size:32px;font-weight:600">{esc(name)}</p>
    <p style="font-size:24px;color:{ACCENT};margin-top:8px">{esc(src)}</p>
    <p style="font-size:24px;line-height:1.45;color:{INK2};margin-top:16px">{esc(what)}</p>
    <p style="position:absolute;left:0;bottom:0;font-size:20px;color:{INK3};font-family:'JetBrains Mono',monospace">{esc(when)}</p>
  </div>''')
    return f'''<section class="slide">
  {g.svg()}
  {head('How it works', 'Four public data sources, none more than three hours old.', 1600)}
  {''.join(cards)}
</section>'''


# ---------------------------------------------------------------- 04 engines
ENGINES = [
    (art.simulator_art, 'Simulator Engine', 'Monte Carlo smoke simulation',
     ['In: fire hotspots, wind and rain',
      'Particles from every fire, carried by the wind',
      'Ten randomised runs, 84 hours ahead']),
    (art.forecast_art, 'Forecast Engine', 'LightGBM',
     ['In: the air now, simulated smoke, fires, wind',
      'Trained on 189 instruments since July 2025',
      'Out: peak PM2.5 for two days, with a range']),
]


def s04():
    g = G(); cols = []
    for i, (draw, name, sub, points) in enumerate(ENGINES):
        x = 128 + i * 848
        g.rect(x, 250, 816, 370, SURFACE, 12)
        draw(g, x, 250, 816, 370, C)
        items = ''.join(f'<p style="font-size:26px;line-height:1.4;color:{INK2};margin-top:14px;padding-left:24px;text-indent:-24px"><span style="color:{ACCENT}">&#8226;</span>&nbsp; {esc(p)}</p>' for p in points)
        cols.append(f'''<div style="position:absolute;left:{x}px;top:668px;width:816px">
    <p style="font-size:34px;font-weight:600">{esc(name)}<span style="font-weight:400;color:{ACCENT};font-size:24px;margin-left:16px">{esc(sub)}</span></p>
    {items}
  </div>''')
    return f'''<section class="slide">
  {g.svg()}
  {head('Model', 'Two Engine Aggregation for Detection', 1600)}
  {''.join(cols)}
</section>'''


# ---------------------------------------------------------------- 05 performance
def catch_bar(g, x, y, w, label, caught, fill, ink):
    g.text(x, y, label, 26, INK, weight=600)
    g.rect(x, y + 20, w, 52, HAIR, 4)
    g.rect(x, y + 20, w * caught, 52, fill, 4)
    g.text(x + 18, y + 55, f'{caught:.0%} caught', 24, ink, weight=600)


def s05():
    g = G()
    # DOE stations, next day, crossings of API 150: the Model page (lib/data/model-performance.json, overall.doe).
    catch_bar(g, 900, 420, 892, 'Forecast Engine', .79, ACCENT, BG)
    catch_bar(g, 900, 560, 892, 'No change (tomorrow = today)', .65, HAIRS, INK)
    return f'''<section class="slide">
  {g.svg()}
  {head('Performance', 'Catches unhealthy air a day ahead.', 1600)}
  {hero(128, 360, '79%', 'of days above API 150 at DOE stations caught a day ahead.', 220, 640, ACCENT)}
  <p style="position:absolute;left:900px;top:720px;width:892px;font-size:26px;line-height:1.45;color:{INK2}">156 such days across 340 station-days, 3 to 9 October 2026.<br>False alarms: 7%.</p>
</section>'''


# ---------------------------------------------------------------- 06 evidence
SERIES = [('#2a78d6', 'solid', 'Real next-day peak'), ('#d9552e', 'solid', 'Model'), ('#1f8a5a', 'dashed', 'No change')]


def s06e():
    legend = ''.join(f'<span style="display:inline-flex;align-items:center;gap:10px;margin-right:28px">'
                     f'<span style="display:inline-block;width:32px;border-top:4px {style} {c}"></span>{esc(t)}</span>'
                     for c, style, t in SERIES)
    return f'''<section class="slide">
  {head('Performance', 'The forecast follows what the stations read.', 1600)}
  <div class="shot" style="position:absolute;left:128px;top:250px;width:940px;height:678px;padding:0">
    <img src="assets/shots/model-scatter.png" style="width:940px;height:678px">
  </div>
  <p style="position:absolute;left:128px;top:944px;width:940px;font-size:20px;color:{INK3}">Each dot is one station-day. On the diagonal, the forecast change equals the real one.</p>
  <p style="position:absolute;left:1192px;top:250px;font-size:20px;color:{INK2}">{legend}</p>
  <div class="shot" style="position:absolute;left:1192px;top:296px;width:600px;height:297px">
    <img src="assets/shots/model-sg-central.png" style="width:600px;height:297px">
  </div>
  <div class="shot" style="position:absolute;left:1192px;top:609px;width:600px;height:297px">
    <img src="assets/shots/model-sg-north.png" style="width:600px;height:297px">
  </div>
  <p style="position:absolute;left:1192px;top:922px;width:600px;font-size:20px;color:{INK3}">All five Singapore regions: 84 to 94% of days within 20 µg/m³.</p>
</section>'''


# ---------------------------------------------------------------- 07 demo
def s07():
    return '''<section class="slide" style="display:flex;align-items:center;justify-content:center;padding:0">
  <h1 class="big" style="font-size:320px;letter-spacing:-8px">Demo</h1>
</section>'''


CSS = f'''
  @font-face {{ font-family: "Newsreader"; font-weight: 400 500; src: url(assets/fonts/newsreader.woff2) format("woff2"); }}
  @font-face {{ font-family: "Inter"; font-weight: 400 600; src: url(assets/fonts/inter.woff2) format("woff2"); }}
  @font-face {{ font-family: "JetBrains Mono"; font-weight: 400 500; src: url(assets/fonts/jetbrains.woff2) format("woff2"); }}
  @page {{ size: 1920px 1080px; margin: 0; }}
  html, body {{ margin: 0; padding: 0; background: #000; }}
  body {{ font-family: Inter, Arial, sans-serif; color: {INK}; font-variant-numeric: tabular-nums; -webkit-print-color-adjust: exact; print-color-adjust: exact; }}
  * {{ box-sizing: border-box; }}
  p, h1, h2 {{ margin: 0; }}
  section.slide {{ width: 1920px; height: 1080px; position: relative; overflow: hidden; background: {BG}; padding: 104px 128px 150px;
                   page-break-after: always; break-after: page; }}
  section.slide:last-child {{ page-break-after: auto; break-after: auto; }}
  @media screen {{ section.slide {{ margin: 24px auto; }} }}
  .eyebrow {{ font-size: 20px; font-weight: 600; letter-spacing: 3px; text-transform: uppercase; color: {ACCENT}; }}
  h2.title {{ font-family: Newsreader, Georgia, serif; font-weight: 400; font-size: 60px; line-height: 1.1; letter-spacing: -1px; margin-top: 12px; text-wrap: balance; }}
  .head {{ position: relative; }}
  .big {{ font-family: Newsreader, Georgia, serif; font-weight: 400; line-height: 1; letter-spacing: -3px; }}
  .hero {{ position: absolute; }}
  .hero .lab {{ font-size: 26px; line-height: 1.4; color: {INK2}; margin-top: 16px; text-wrap: balance; }}
  .shot {{ background: {SURFACE}; border: 1px solid {HAIRS}; border-radius: 12px; overflow: hidden; }}
  .shot img {{ display: block; }}
'''

html = ('<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n<title>When Haze Stop</title>\n<style>' + CSS + '</style>\n</head>\n<body>\n'
        + '\n'.join(f() for f in (s01, s02, s02b, s03, s04, s05, s06e, s07)) + '\n</body>\n</html>\n')
open(os.path.join(HERE, 'deck.html'), 'w').write(html)
print('deck.html written')
