"""Group 4: the wind and rain over the next 48 hours at the instrument's grid point, as stored.

weather_hours holds the newest fetch: the analysis for past hours and the forecast for the hours
ahead. A training row built from it knows the real wind, which a live row never does; the
from_forecast flag records which it was (the CLI builds 0, the service 1), and track B's
weather_forecasts table is what makes from_forecast = 1 training rows possible later.
"""

import numpy as np
import pandas as pd

from hazemodel.region import Region, grid_index

HORIZONS = (24, 48)


def _window(weather: pd.DataFrame, issue: pd.Timestamp, hours: int) -> pd.DataFrame:
    return weather[(weather["valid_at"] > issue) & (weather["valid_at"] <= issue + pd.Timedelta(hours=hours))]


def _stats(window: pd.DataFrame, index: int) -> tuple[float, float, float, float]:
    if window.empty:
        return np.nan, np.nan, np.nan, np.nan
    u = np.array([row[index] for row in window["u_ms"]], dtype=float)
    v = np.array([row[index] for row in window["v_ms"]], dtype=float)
    rain = np.array([row[index] for row in window["rain_mm"]], dtype=float)
    speed = np.hypot(u, v).mean()
    vector = float(np.hypot(u.mean(), v.mean()))
    steady = vector / speed if speed > 0 else 0.0
    return float(u.mean()), float(v.mean()), steady, float(rain.sum())


def _along(bearing: float, u24: float, v24: float) -> float:
    if np.isnan(bearing) or np.isnan(u24):
        return np.nan
    # Wind blowing from the fires toward the instrument has a component along (bearing + 180).
    towards = np.radians(bearing + 180.0)
    return float(u24 * np.sin(towards) + v24 * np.cos(towards))


def weather_features(
    data,
    table: pd.DataFrame,
    region: Region,
    fires: pd.DataFrame,
    issue_times: pd.DatetimeIndex,
    from_forecast: int = 0,
) -> pd.DataFrame:
    weather = data.weather_hours.sort_values("valid_at")
    rows = {}
    for issue in issue_times:
        windows = {h: _window(weather, issue, h) for h in HORIZONS}
        for _, instrument in table.iterrows():
            index = grid_index(region, instrument["lat"], instrument["lon"])
            row = {"hours_present": len(windows[48]), "from_forecast": from_forecast}
            for h in HORIZONS:
                u, v, steady, rain = _stats(windows[h], index)
                row.update({f"u{h}": u, f"v{h}": v, f"steady{h}": steady, f"rain{h}": rain})
            key = (instrument["instrument_id"], issue)
            bearing = fires.loc[key, "fire_heaviest_bearing"] if key in fires.index else np.nan
            row["along_fire24"] = _along(bearing, row["u24"], row["v24"])
            rows[key] = row
    frame = pd.DataFrame.from_dict(rows, orient="index")
    frame.index = pd.MultiIndex.from_tuples(frame.index, names=["instrument_id", "issue_at"])
    return frame
