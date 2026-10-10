"""Correct each low-cost sensor against its nearest reference monitor.

Over the week of 3 to 10 October 2026 the sensors near Kuala Lumpur ranked hours like the DOE
station (0.90 to 0.99) but several read tens of ug/m3 high. A line fitted on shared hours fixes
the level; a sensor that does not rank hours with its reference is not truth at all.
"""
import numpy as np
import pandas as pd

from hazemodel.instruments import distance_km

ACCEPT_CORRELATION = 0.8
ACCEPT_HOURS = 200


def nearest_reference(table: pd.DataFrame, instrument_id: str) -> tuple[str, float]:
    me = table.set_index("instrument_id").loc[instrument_id]
    candidates = table[table["reference"] & (table["instrument_id"] != instrument_id)]
    distances = distance_km(me["lat"], me["lon"], candidates["lat"].to_numpy(), candidates["lon"].to_numpy())
    best = int(np.argmin(distances))
    return str(candidates["instrument_id"].iloc[best]), float(distances[best])


def fit_line(x: pd.Series, y: pd.Series) -> tuple[float, float, float, int]:
    """intercept, slope, correlation, hours of a least squares line y = a + b x on the shared index."""
    shared = x.index.intersection(y.index)
    if len(shared) < 2:
        return 0.0, 1.0, 0.0, len(shared)
    xs, ys = x[shared].to_numpy(dtype=float), y[shared].to_numpy(dtype=float)
    if xs.std() == 0 or ys.std() == 0:
        return 0.0, 1.0, 0.0, len(shared)
    slope, intercept = np.polyfit(xs, ys, 1)
    return float(intercept), float(slope), float(np.corrcoef(xs, ys)[0, 1]), len(shared)


def correct_sensors(series: pd.DataFrame, table: pd.DataFrame) -> tuple[pd.DataFrame, pd.DataFrame]:
    by_id = {key: group.set_index("observed_at")["pm25_24h"] for key, group in series.groupby("instrument_id")}
    corrected = series.copy()
    decisions = []
    for instrument_id in table[table["kind"] == "openaq"]["instrument_id"]:
        reference_id, distance = nearest_reference(table, instrument_id)
        raw = by_id.get(instrument_id, pd.Series(dtype=float))
        ref = by_id.get(reference_id, pd.Series(dtype=float))
        intercept, slope, correlation, hours = fit_line(raw, ref)
        accepted = correlation >= ACCEPT_CORRELATION and hours >= ACCEPT_HOURS
        if accepted:
            mask = corrected["instrument_id"] == instrument_id
            corrected.loc[mask, "pm25_24h"] = intercept + slope * corrected.loc[mask, "pm25_24h"]
        decisions.append(
            {
                "instrument_id": instrument_id,
                "reference_id": reference_id,
                "distance_km": distance,
                "hours": hours,
                "correlation": correlation,
                "intercept": intercept,
                "slope": slope,
                "accepted": accepted,
            }
        )
    return corrected, pd.DataFrame(decisions)
