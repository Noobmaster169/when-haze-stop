"""Correct each low-cost sensor against its nearest reference monitor.

Over the week of 3 to 10 October 2026 the sensors near Kuala Lumpur ranked hours like the DOE
station (0.90 to 0.99) but several read tens of ug/m3 high. A line fitted on shared hours fixes
the level; a sensor that does not rank hours with its reference is not truth at all.
"""

import numpy as np
import pandas as pd

from hazemodel.instruments import distance_km

ACCEPT_CORRELATION = 0.8
# Five full days of shared hours: DOE stations hold one week, so 200 is out of reach.
ACCEPT_HOURS = 120
DECISION_COLUMNS = [
    "instrument_id",
    "reference_id",
    "distance_km",
    "hours",
    "correlation",
    "intercept",
    "slope",
    "accepted",
]


def nearest_reference(
    table: pd.DataFrame, instrument_id: str, series_by_id: dict[str, pd.Series] | None = None
) -> tuple[str, float]:
    """Nearest reference sharing ACCEPT_HOURS hours with the instrument; nearest overall when none does."""
    me = table.set_index("instrument_id").loc[instrument_id]
    candidates = table[table["reference"] & (table["instrument_id"] != instrument_id)]
    distances = distance_km(me["lat"], me["lon"], candidates["lat"].to_numpy(), candidates["lon"].to_numpy())
    ids = candidates["instrument_id"].to_numpy()
    order = np.argsort(distances)
    if series_by_id is not None and instrument_id in series_by_id:
        mine = series_by_id[instrument_id].index
        for i in order:
            theirs = series_by_id.get(str(ids[i]))
            if theirs is not None and len(mine.intersection(theirs.index)) >= ACCEPT_HOURS:
                return str(ids[i]), float(distances[i])
    return str(ids[order[0]]), float(distances[order[0]])


def fit_line(x: pd.Series, y: pd.Series) -> tuple[float, float, float, int]:
    """intercept, slope, correlation, hours of a least squares line y = a + b x on the shared index."""
    shared = x.index.intersection(y.index)
    if len(shared) < 2:
        return 0.0, 1.0, 0.0, len(shared)
    xs, ys = x[shared].to_numpy(dtype=float), y[shared].to_numpy(dtype=float)
    if np.ptp(xs) == 0 or np.ptp(ys) == 0:
        return 0.0, 1.0, 0.0, len(shared)
    slope, intercept = np.polyfit(xs, ys, 1)
    return float(intercept), float(slope), float(np.corrcoef(xs, ys)[0, 1]), len(shared)


def _fit_sensors(by_id: dict[str, pd.Series], table: pd.DataFrame) -> pd.DataFrame:
    decisions = []
    for instrument_id in table[table["kind"] == "openaq"]["instrument_id"]:
        reference_id, distance = nearest_reference(table, instrument_id, by_id)
        raw = by_id.get(instrument_id, pd.Series(dtype=float))
        ref = by_id.get(reference_id, pd.Series(dtype=float))
        intercept, slope, correlation, hours = fit_line(raw, ref)
        decisions.append(
            {
                "instrument_id": instrument_id,
                "reference_id": reference_id,
                "distance_km": distance,
                "hours": hours,
                "correlation": correlation,
                "intercept": intercept,
                "slope": slope,
                "accepted": correlation >= ACCEPT_CORRELATION and hours >= ACCEPT_HOURS,
            }
        )
    return pd.DataFrame(decisions, columns=DECISION_COLUMNS)


def correct_sensors(
    series: pd.DataFrame, table: pd.DataFrame, decisions: pd.DataFrame | None = None
) -> tuple[pd.DataFrame, pd.DataFrame]:
    """Fit and apply each sensor's line, or apply the frozen `decisions` of a trained artifact unchanged.

    Serving applies the decisions its artifact was trained with, because a refit on a shorter window can
    unaccept a sensor the trees learned from and move its level by tens of ug/m3.
    """
    if decisions is None:
        by_id = {key: group.set_index("observed_at")["pm25_24h"] for key, group in series.groupby("instrument_id")}
        decisions = _fit_sensors(by_id, table)
    corrected = series.copy()
    for row in decisions[decisions["accepted"].astype(bool)].itertuples():
        mask = corrected["instrument_id"] == row.instrument_id
        corrected.loc[mask, "pm25_24h"] = row.intercept + row.slope * corrected.loc[mask, "pm25_24h"]
    return corrected, decisions
