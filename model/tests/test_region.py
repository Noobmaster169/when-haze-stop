import datetime as dt

import pandas as pd

from hazemodel.region import Region, grid_index, malaysian_day, region_from_env


def test_default_region_matches_grid_ts(monkeypatch):
    for key in ("REGION_LON0", "REGION_LON1", "REGION_LAT0", "REGION_LAT1"):
        monkeypatch.delenv(key, raising=False)
    region = region_from_env()
    assert (region.lon0, region.lon1, region.lat0, region.lat1) == (96, 120, -6, 8)
    assert (region.nx, region.ny) == (25, 15)
    assert region.issue_hour_utc == 0


def test_grid_index_is_row_major_from_south_west():
    region = Region(lon0=96, lon1=120, lat0=-6, lat1=8, step=1, issue_hour_utc=0)
    assert grid_index(region, -6, 96) == 0
    assert grid_index(region, -6, 97) == 1
    assert grid_index(region, -5, 96) == 25
    assert grid_index(region, 8, 120) == 25 * 15 - 1
    # Kuala Lumpur, 3.14 N 101.69 E, snaps to 3 N 102 E.
    assert grid_index(region, 3.14, 101.69) == 9 * 25 + 6


def test_malaysian_day_is_utc_plus_eight():
    assert malaysian_day(pd.Timestamp("2026-10-10T15:59:00Z")) == dt.date(2026, 10, 10)
    assert malaysian_day(pd.Timestamp("2026-10-10T16:00:00Z")) == dt.date(2026, 10, 11)
