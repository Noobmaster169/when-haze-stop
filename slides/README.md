# The pitch deck

Eight 1920 x 1080 slides in the product's dark palette, one claim each, built by `build.py` (drawings in `art.py`) into
`deck.html`; `deck.pdf` is its print and `preview/` one PNG per slide. The slides carry no footer, so the sources are listed here. Slide 2: Reuters, 9 Oct 2026, and a press
report of 9 Oct 2026. Slide 3: screenshots of IQAir and a Kuala Lumpur AQI page supplied by the team. Slide 4: station readings from Malay Mail, 8 Oct 2026; airport visibility
from METAR, 11 Oct 2026. Slide 5: `docs/FEATURES.md` section 4.2 and `docs/MODEL.md`. Slide 6:
the Model page's DOE scores (`frontend/lib/data/model-performance.json`, 340 station-days, 3 to 9 Oct 2026). Slide 7: the Model page
on 11 October 2026. Screenshots in `assets/shots/` are the running
app in dark mode, taken by `shots-dark.mjs`, `shots-dark2.mjs` (the assistant's answer) and
`shots-card.mjs` (the alert card), and `shots-model.mjs` (the Model page charts).

```sh
python3 build.py
PLAYWRIGHT_MODULE=/root/.claude/skills/gstack/node_modules/playwright/index.mjs node render.mjs --png
cp deck.html deck.pdf ../frontend/public/slides/ && cp -r assets ../frontend/public/slides/
```

The copy under `frontend/public/slides/` is served by the app at `/slides/deck.html` after the
next frontend build.
