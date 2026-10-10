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
MIN_HOURS_FOR_OWN_FIT = 100


def is_dry(weather) -> bool:
    if weather is None or (isinstance(weather, float) and np.isnan(weather)):
        return True
    return not any(code in str(weather) for code in WET)


def extinction(visibility_m) -> float:
    return KOSCHMIEDER / (np.asarray(visibility_m, dtype=float) / 1000.0)


def _hourly_extinction(reports: pd.DataFrame) -> pd.DataFrame:
    dry = reports[reports["visibility_m"].notna() & reports["weather"].map(is_dry)].copy()
    dry["extinction"] = extinction(dry["visibility_m"].clip(upper=CAP_M))
    dry["capped"] = dry["visibility_m"] >= CAP_M
    hourly = dry.set_index("observed_at").sort_index()
    mean = hourly["extinction"].rolling("24h", min_periods=MIN_REPORTS_IN_MEAN).mean()
    all_capped = hourly["capped"].rolling("24h", min_periods=MIN_REPORTS_IN_MEAN).min().astype(bool)
    out = pd.DataFrame({"extinction_24h": mean, "censored": all_capped}).dropna(subset=["extinction_24h"])
    return out.resample("1h").last().dropna(subset=["extinction_24h"])


def airport_series(data: SourceData, series: pd.DataFrame, table: pd.DataFrame) -> tuple[pd.DataFrame, pd.DataFrame]:
    by_id = {key: group.set_index("observed_at")["pm25_24h"] for key, group in series.groupby("instrument_id")}
    per_airport = {}
    pooled_x, pooled_y = [], []
    for icao in table[table["kind"] == "airport"]["instrument_id"]:
        hourly = _hourly_extinction(data.metar_obs[data.metar_obs["icao"] == icao])
        reference_id, _ = nearest_reference(table, icao)
        ref = by_id.get(reference_id, pd.Series(dtype=float))
        per_airport[icao] = (hourly, reference_id, ref)
        shared = hourly.index.intersection(ref.index)
        pooled_x.append(hourly.loc[shared, "extinction_24h"])
        pooled_y.append(ref[shared])
    empty = pd.Series(dtype=float)
    pooled = fit_line(pd.concat(pooled_x) if pooled_x else empty, pd.concat(pooled_y) if pooled_y else empty)
    rows, decisions = [], []
    for icao, (hourly, reference_id, ref) in per_airport.items():
        own = fit_line(hourly["extinction_24h"], ref)
        intercept, slope, correlation, hours = own if own[3] >= MIN_HOURS_FOR_OWN_FIT else pooled
        use_pooled = own[3] < MIN_HOURS_FOR_OWN_FIT
        pm25 = intercept + slope * hourly["extinction_24h"]
        pm25 = np.where(hourly["censored"], np.minimum(pm25, CENSOR_UGM3), pm25)
        rows.append(
            pd.DataFrame(
                {
                    "instrument_id": icao,
                    "observed_at": hourly.index,
                    "pm25_24h": pm25,
                    "censored": hourly["censored"].to_numpy(),
                }
            )
        )
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
    columns = ["instrument_id", "observed_at", "pm25_24h", "censored"]
    proxy = pd.concat(rows, ignore_index=True) if rows else pd.DataFrame(columns=columns)
    return proxy, pd.DataFrame(decisions)
