"""The region, the weather grid and the issue hour, from env, with the backend's defaults.

The grid layout must equal backend/src/haze/grid.ts: a weather_hours row holds nx * ny values,
row by row from the south-west corner, so index = row * nx + column.
"""
import datetime as dt
import os
from dataclasses import dataclass

import pandas as pd

MALAYSIA_OFFSET = dt.timedelta(hours=8)


@dataclass(frozen=True)
class Region:
    lon0: float
    lon1: float
    lat0: float
    lat1: float
    step: float
    issue_hour_utc: int

    @property
    def nx(self) -> int:
        return int(round((self.lon1 - self.lon0) / self.step)) + 1

    @property
    def ny(self) -> int:
        return int(round((self.lat1 - self.lat0) / self.step)) + 1


def region_from_env() -> Region:
    env = os.environ
    return Region(
        lon0=float(env.get("REGION_LON0", 96)),
        lon1=float(env.get("REGION_LON1", 120)),
        lat0=float(env.get("REGION_LAT0", -6)),
        lat1=float(env.get("REGION_LAT1", 8)),
        step=float(env.get("WEATHER_STEP", 1)),
        issue_hour_utc=int(env.get("ISSUE_HOUR_UTC", 0)),
    )


def grid_index(region: Region, lat: float, lon: float) -> int:
    column = int(round((lon - region.lon0) / region.step))
    row = int(round((lat - region.lat0) / region.step))
    column = min(max(column, 0), region.nx - 1)
    row = min(max(row, 0), region.ny - 1)
    return row * region.nx + column


def malaysian_day(ts: pd.Timestamp) -> dt.date:
    return (ts.tz_convert("UTC") + MALAYSIA_OFFSET).date()
