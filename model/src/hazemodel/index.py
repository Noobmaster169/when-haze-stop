"""DOE's Air Pollutant Index and the 24 hour PM2.5 behind it. A port of backend/src/haze/api-index.ts.

The model works in ug/m3 and converts at the edges, because the index bands are very unequal
(101 to 150 spans five ug/m3) and a tree trained on index points would learn the table, not the air.
"""

import numpy as np

BAND_EDGES = [
    (0.0, 0.0),
    (12.0, 50.0),
    (50.4, 100.0),
    (55.4, 150.0),
    (150.4, 200.0),
    (250.4, 300.0),
    (350.4, 400.0),
    (500.4, 500.0),
]


def _interpolate(value, source: int):
    target = 1 - source
    xs = np.array([edge[source] for edge in BAND_EDGES])
    ys = np.array([edge[target] for edge in BAND_EDGES])
    value = np.asarray(value, dtype=float)
    # Past the last edge the top band's slope carries on: an index above 500 has happened in Malaysia.
    top_slope = (ys[-1] - ys[-2]) / (xs[-1] - xs[-2])
    inside = np.interp(value, xs, ys)
    beyond = ys[-1] + (value - xs[-1]) * top_slope
    out = np.where(value > xs[-1], beyond, inside)
    out = np.where(value <= 0, 0.0, out)
    return float(out) if out.ndim == 0 else out


def pm25_to_api(ugm3):
    return _interpolate(ugm3, 0)


def api_to_pm25(api):
    return _interpolate(api, 1)
