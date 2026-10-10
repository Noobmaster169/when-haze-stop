"""Group 2: screened fire power by sector and ring around each instrument, over complete UTC days."""
import numpy as np
import pandas as pd

from hazemodel.instruments import bearing_deg, distance_km

SECTORS = 8
RINGS_KM = (0.0, 300.0, 800.0, 1500.0)
WINDOWS = (1, 3, 7)


def sector_of(bearing):
    return (np.floor(np.asarray(bearing) / (360.0 / SECTORS)).astype(int)) % SECTORS


def ring_of(distance):
    ring = np.searchsorted(RINGS_KM, np.asarray(distance), side="right") - 1
    return np.where((ring >= 0) & (ring < len(RINGS_KM) - 1), ring, -1)


def _bins(table: pd.DataFrame, cells: pd.DataFrame) -> np.ndarray:
    """For each (instrument, cell) the flat bin sector * 3 + ring, or -1 beyond the outer ring."""
    lat_i, lon_i = table["lat"].to_numpy()[:, None], table["lon"].to_numpy()[:, None]
    # lat10 and lon10 are integer tenths of a degree (lat10 = 25 is 2.5 N); the cell centre is a half tenth on.
    lat_c = cells["lat10"].to_numpy(dtype=float)[None, :] / 10.0 + 0.05
    lon_c = cells["lon10"].to_numpy(dtype=float)[None, :] / 10.0 + 0.05
    sector = sector_of(bearing_deg(lat_i, lon_i, lat_c, lon_c))
    ring = ring_of(distance_km(lat_i, lon_i, lat_c, lon_c))
    return np.where(ring >= 0, sector * (len(RINGS_KM) - 1) + ring, -1)


def _sums_for_days(table: pd.DataFrame, cells: pd.DataFrame) -> np.ndarray:
    """(instruments, 24 bins) of fire power, for one set of cell-days."""
    out = np.zeros((len(table), SECTORS * (len(RINGS_KM) - 1)))
    if cells.empty:
        return out
    power = cells["burning_mw"].fillna(cells["frp_mw"]).to_numpy(dtype=float)
    bins = _bins(table, cells)
    for i in range(len(table)):
        keep = bins[i] >= 0
        np.add.at(out[i], bins[i][keep], power[keep])
    return out


def _between(cells: pd.DataFrame, last: pd.Timestamp, first_offset: int, last_offset: int) -> pd.DataFrame:
    """Cell-days in (last - first_offset days, last - last_offset days]."""
    after = last - pd.Timedelta(days=first_offset)
    until = last - pd.Timedelta(days=last_offset)
    return cells[(cells["day"] > after) & (cells["day"] <= until)]


def _row(sums: dict, earlier_total: float, i: int) -> dict:
    row = {}
    for w in WINDOWS:
        for s in range(SECTORS):
            for r in range(len(RINGS_KM) - 1):
                row[f"fire_s{s}_r{r}_d{w}"] = sums[w][i, s * 3 + r]
    row["fire_total_d3"] = float(sums[3][i].sum())
    row["fire_total_change"] = float(sums[3][i].sum() - earlier_total)
    near = sums[7][i].reshape(SECTORS, 3)[:, :2].sum(axis=1)
    row["fire_heaviest_bearing"] = float(int(np.argmax(near)) * 45 + 22.5) if near.sum() > 0 else np.nan
    return row


def fire_features(data, table: pd.DataFrame, issue_times: pd.DatetimeIndex) -> pd.DataFrame:
    cells = data.fire_cells
    columns = {}
    for issue in issue_times:
        # The last UTC day wholly before the issue time; the day column is tz-naive midnight.
        last_complete = issue.normalize() - pd.Timedelta(days=1)
        last_complete = last_complete.tz_localize(None) if last_complete.tzinfo else last_complete
        sums = {w: _sums_for_days(table, _between(cells, last_complete, w, 0)) for w in WINDOWS}
        earlier = _sums_for_days(table, _between(cells, last_complete, 6, 3))
        for i, instrument_id in enumerate(table["instrument_id"]):
            columns[(instrument_id, issue)] = _row(sums, float(earlier[i].sum()), i)
    frame = pd.DataFrame.from_dict(columns, orient="index")
    frame.index = pd.MultiIndex.from_tuples(frame.index, names=["instrument_id", "issue_at"])
    return frame
