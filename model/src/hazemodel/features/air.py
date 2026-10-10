"""Group 1: the state of the air at the issue time, from the instrument's own 24 h series and its neighbours."""

import numpy as np
import pandas as pd

from hazemodel.instruments import distance_km

STALE_HOURS = 6
NEAR_KM = (50, 150)
# A bounded window so a training row late in a long parquet sees the same history as a live row; the live
# service loads the same window.
HISTORY_DAYS = 30


def _at(series: pd.Series, when: pd.Timestamp, tolerance_h: int) -> float:
    before = series[:when]
    if before.empty or (when - before.index[-1]) > pd.Timedelta(hours=tolerance_h):
        return np.nan
    return float(before.iloc[-1])


def _one(series: pd.Series, issue: pd.Timestamp) -> dict | None:
    level = _at(series, issue, STALE_HOURS)
    if np.isnan(level):
        return None
    last24 = series[(series.index > issue - pd.Timedelta(hours=24)) & (series.index <= issue)]
    history = series[(series.index < issue) & (series.index >= issue - pd.Timedelta(days=HISTORY_DAYS))]
    lag24, lag48, lag72 = (_at(series, issue - pd.Timedelta(hours=h), STALE_HOURS) for h in (24, 48, 72))
    three = _at(series, issue - pd.Timedelta(hours=3), STALE_HOURS)
    peak_at = last24.idxmax() if not last24.empty else issue
    return {
        "level": level,
        "lag24": lag24,
        "lag48": lag48,
        "lag72": lag72,
        "d24": level - lag24,
        "d48": level - lag48,
        "slope3h": (level - three) / 3.0,
        "peak24": float(last24.max()) if not last24.empty else level,
        "peak_hour": int((peak_at + pd.Timedelta(hours=8)).hour),
        "hist_mean": float(history.mean()) if len(history) else np.nan,
        "hist_std": float(history.std()) if len(history) > 1 else np.nan,
    }


def air_features(series: pd.DataFrame, table: pd.DataFrame, issue_times: pd.DatetimeIndex) -> pd.DataFrame:
    by_id = {
        key: group.set_index("observed_at")["pm25_24h"].sort_index() for key, group in series.groupby("instrument_id")
    }
    rows = {}
    for instrument_id, own in by_id.items():
        for issue in issue_times:
            features = _one(own, issue)
            if features is not None:
                rows[(instrument_id, issue)] = features
    frame = pd.DataFrame.from_dict(rows, orient="index")
    frame.index = pd.MultiIndex.from_tuples(frame.index, names=["instrument_id", "issue_at"])
    return _with_neighbours(frame, table)


def _with_neighbours(frame: pd.DataFrame, table: pd.DataFrame) -> pd.DataFrame:
    coords = table.set_index("instrument_id")[["lat", "lon"]]
    ids = coords.index.to_numpy()
    lat, lon = coords["lat"].to_numpy(), coords["lon"].to_numpy()
    distances = distance_km(lat[:, None], lon[:, None], lat[None, :], lon[None, :])
    for km in NEAR_KM:
        column = f"near{km}"
        frame[column] = np.nan
        for _issue, group in frame.groupby(level="issue_at"):
            levels = group["level"].droplevel("issue_at")
            present = pd.Series(levels).reindex(ids)
            values = present.to_numpy(dtype=float)
            mask = (distances <= km) & ~np.eye(len(ids), dtype=bool) & ~np.isnan(values)[None, :]
            sums = np.where(mask, np.nan_to_num(values)[None, :], 0.0).sum(axis=1)
            counts = mask.sum(axis=1)
            means = pd.Series(np.where(counts > 0, sums / np.maximum(counts, 1), np.nan), index=ids)
            members = group.index.get_level_values("instrument_id")
            aligned = means.reindex(members)
            aligned.index = group.index
            frame.loc[group.index, column] = aligned
    return frame
