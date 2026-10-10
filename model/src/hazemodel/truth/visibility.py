"""Airport visibility as a PM2.5 proxy, through the Koschmieder relation fitted to the nearest monitor.

Visibility says when haze arrived and roughly how thick, but it stops at ten kilometres, so it
cannot tell one clean day from another: a 24 h mean built only from capped reports is censored
and carries no information on the clean side. Rain, mist and fog shorten visibility too and are
dropped before a report is read as smoke.
"""

import numpy as np
import pandas as pd

from hazemodel.store import SourceData
from hazemodel.truth.sensors import fit_line, nearest_reference

KOSCHMIEDER = 3.912
CAP_M = 10000
CENSOR_UGM3 = 35.0
WET = ("RA", "SH", "TS", "DZ", "BR", "FG")
MIN_REPORTS_IN_MEAN = 12
MIN_VISIBILITY_M = 50
MIN_HOURS_FOR_OWN_FIT = 100
DECISION_COLUMNS = ["instrument_id", "reference_id", "hours", "correlation", "intercept", "slope", "pooled"]


def is_dry(weather) -> bool:
    if weather is None or (isinstance(weather, float) and np.isnan(weather)):
        return True
    return not any(code in str(weather) for code in WET)


def extinction(visibility_m) -> float:
    return KOSCHMIEDER / (np.asarray(visibility_m, dtype=float) / 1000.0)


def _hourly_extinction(reports: pd.DataFrame) -> pd.DataFrame:
    # A zero or tiny visibility is a sensor glitch or a code for nil; it would make extinction infinite.
    usable = reports["visibility_m"].notna() & (reports["visibility_m"] >= MIN_VISIBILITY_M)
    dry = reports[usable & reports["weather"].map(is_dry)].copy()
    dry["extinction"] = extinction(dry["visibility_m"].clip(upper=CAP_M))
    dry["capped"] = dry["visibility_m"] >= CAP_M
    hourly = dry.set_index("observed_at").sort_index()
    mean = hourly["extinction"].rolling("24h", min_periods=MIN_REPORTS_IN_MEAN).mean()
    all_capped = hourly["capped"].rolling("24h", min_periods=MIN_REPORTS_IN_MEAN).min().astype(bool)
    out = pd.DataFrame({"extinction_24h": mean, "censored": all_capped}).dropna(subset=["extinction_24h"])
    # Label each hour by its right edge so a mean is stamped at or after the newest report in it: a left label
    # would put a 06:30 report into the 06:00 value, half an hour before anyone could have read it.
    hourly_out = out.resample("1h", label="right", closed="right").last().dropna(subset=["extinction_24h"])
    hourly_out["censored"] = hourly_out["censored"].astype(bool)
    return hourly_out


def _fit_airports(hourlies: dict[str, pd.DataFrame], series: pd.DataFrame, table: pd.DataFrame) -> pd.DataFrame:
    by_id = {key: group.set_index("observed_at")["pm25_24h"] for key, group in series.groupby("instrument_id")}
    per_airport = {}
    pooled_x, pooled_y = [], []
    for icao, hourly in hourlies.items():
        reference_id, _ = nearest_reference(table, icao, {**by_id, icao: hourly["extinction_24h"]})
        ref = by_id.get(reference_id, pd.Series(dtype=float))
        per_airport[icao] = (reference_id, ref)
        shared = hourly.index.intersection(ref.index)
        pooled_x.append(hourly.loc[shared, "extinction_24h"])
        pooled_y.append(ref[shared])
    empty = pd.Series(dtype=float)
    pooled = fit_line(pd.concat(pooled_x) if pooled_x else empty, pd.concat(pooled_y) if pooled_y else empty)
    decisions = []
    for icao, (reference_id, ref) in per_airport.items():
        own = fit_line(hourlies[icao]["extinction_24h"], ref)
        use_pooled = own[3] < MIN_HOURS_FOR_OWN_FIT
        intercept, slope, correlation, _ = pooled if use_pooled else own
        decisions.append(
            {
                "instrument_id": icao,
                "reference_id": reference_id,
                "hours": own[3],
                "correlation": correlation,
                "intercept": intercept,
                "slope": slope,
                "pooled": use_pooled,
            }
        )
    return pd.DataFrame(decisions, columns=DECISION_COLUMNS)


def _proxy(icao: str, hourly: pd.DataFrame, intercept: float, slope: float) -> pd.DataFrame:
    pm25 = np.maximum(intercept + slope * hourly["extinction_24h"], 0.0)
    pm25 = np.where(hourly["censored"], np.minimum(pm25, CENSOR_UGM3), pm25)
    censored = hourly["censored"].to_numpy()
    return pd.DataFrame({"instrument_id": icao, "observed_at": hourly.index, "pm25_24h": pm25, "censored": censored})


def airport_series(
    data: SourceData, series: pd.DataFrame, table: pd.DataFrame, decisions: pd.DataFrame | None = None
) -> tuple[pd.DataFrame, pd.DataFrame]:
    """Fit and apply each airport's line, or apply the frozen `decisions` of a trained artifact unchanged.

    With frozen decisions an airport the artifact holds no line for gets no proxy, since serving never fits.
    """
    hourlies = {
        icao: _hourly_extinction(data.metar_obs[data.metar_obs["icao"] == icao])
        for icao in table[table["kind"] == "airport"]["instrument_id"]
    }
    if decisions is None:
        decisions = _fit_airports(hourlies, series, table)
    lines = decisions.set_index("instrument_id")
    rows = [
        _proxy(icao, hourly, float(lines.at[icao, "intercept"]), float(lines.at[icao, "slope"]))
        for icao, hourly in hourlies.items()
        if icao in lines.index
    ]
    columns = ["instrument_id", "observed_at", "pm25_24h", "censored"]
    proxy = pd.concat(rows, ignore_index=True) if rows else pd.DataFrame(columns=columns)
    return proxy, decisions
