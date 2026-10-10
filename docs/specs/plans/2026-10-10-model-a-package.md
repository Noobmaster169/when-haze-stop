# Model package (track A) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A Python package `model/` that reads the stored history from Postgres, builds the truth and the feature rows the spec defines, writes them to parquet, and serves `/health` and `/predict` from a promoted artifact.

**Architecture:** One package, `hazemodel`, with every SQL read in `store.py`, pure frame-to-frame functions everywhere else, and a FastAPI app that composes them for one issue time. Nothing here writes to the database. Training and backtesting are track D and read the parquet this track writes.

**Tech Stack:** Python 3.10, pandas, numpy, pyarrow, psycopg 3, lightgbm (for the serve test only here), fastapi, uvicorn, pydantic 2, pytest, ruff.

**Spec:** `docs/specs/2026-10-10-predictive-model-design.md`, sections 3, 4, 5, 8.1, 8.5, 9.

## Global Constraints

- Python `>=3.10`. Package name `haze-model`, import name `hazemodel`, layout `model/src/hazemodel/`, mirror of `proxy/`.
- `store.py` is the only module that contains SQL. It is read-only: no insert, update, delete, truncate, anywhere in the package.
- No test reaches Postgres or the network. Tests run on fixtures under `model/tests/fixtures/` that are real rows extracted from the database by `model/tests/fixtures/extract.py` (real data only, as `CLAUDE.md` requires).
- Files under 200 lines. One responsibility per file. Named functions, no classes except pydantic models and the FastAPI app.
- No emoji, no em dashes, in code, docs or comments. Comments say why.
- Instrument ids: `stations.id` as stored (DOE ids and `SG*`), `openaq:<sensor_id>`, the airport ICAO.
- Issue time is 00:00 UTC. A Malaysian day is the UTC+8 calendar date.
- All concentrations in ug/m3 of 24 hour mean PM2.5. The API conversion is an exact port of `backend/src/haze/api-index.ts`.
- Region, grid and issue hour come from env with the same defaults as `backend/src/haze/grid.ts`: lon 96 to 120, lat -6 to 8, weather step 1 degree, 25 by 15 points row-major from the south-west corner.
- `model/data/` and `model/artifacts/` are gitignored. Reports under `model/reports/` are committed (track D writes them).
- Commits: imperative subject, no emoji, end with `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`.
- Run tests as `cd model && .venv/bin/pytest -q`, lint as `.venv/bin/ruff check .`.

## Review Focus

1. An instrument with no data in the window (a sensor that went silent): `build_rows` must omit the row, never emit NaN features silently. Pinned in Task 9 (`test_build_skips_instrument_without_level`).
2. A METAR with `9999` and `weather` null on a hazy day elsewhere: the airport proxy must censor it (weight 0) rather than teach "clean". Pinned in Task 7 (`test_visibility_censors_at_cap`).
3. A fire cell exactly on a sector boundary (bearing 45.0 degrees): binning must be deterministic and never drop the cell. Pinned in Task 8 (`test_sector_boundary_is_kept`).
4. `/predict` with no promoted artifact must answer 503 with `{"error":"no live model"}`, not 500. Pinned in Task 11 (`test_predict_without_artifact_is_503`).
5. A weather hour missing inside the 48 hour window (Open-Meteo stops at the first incomplete hour): the weather features must use the hours present and record how many, never raise. Pinned in Task 8 (`test_weather_features_tolerate_missing_hours`).

---

### Task 1: Scaffold the package

**Files:**
- Create: `model/pyproject.toml`, `model/README.md`, `model/src/hazemodel/__init__.py`, `model/tests/__init__.py`, `model/tests/test_package.py`
- Modify: `.gitignore` (append `model/data/` and `model/artifacts/`)

**Interfaces:**
- Produces: `hazemodel.__version__ = "0.1.0"`.

- [ ] **Step 1: Write the failing test**

```python
# model/tests/test_package.py
import hazemodel


def test_version():
    assert hazemodel.__version__ == "0.1.0"
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd model && python3 -m venv .venv && .venv/bin/pip install -q pytest && .venv/bin/pytest -q tests/test_package.py`
Expected: FAIL, `ModuleNotFoundError: No module named 'hazemodel'`

- [ ] **Step 3: Write the package**

```toml
# model/pyproject.toml
[build-system]
requires = ["setuptools>=68"]
build-backend = "setuptools.build_meta"

[project]
name = "haze-model"
version = "0.1.0"
description = "The learned haze forecast: truth, features, training, backtest and the forecast service"
requires-python = ">=3.10"
dependencies = [
    "pandas>=2.2",
    "numpy>=1.26",
    "pyarrow>=16.0",
    "psycopg[binary]>=3.1",
    "lightgbm>=4.3",
    "fastapi>=0.115",
    "uvicorn[standard]>=0.30",
    "pydantic>=2.7",
]

[project.optional-dependencies]
dev = ["pytest>=8.0", "ruff>=0.6", "httpx>=0.27"]

[project.scripts]
hazemodel = "hazemodel.cli:main"

[tool.setuptools.packages.find]
where = ["src"]

[tool.pytest.ini_options]
testpaths = ["tests"]

[tool.ruff]
line-length = 120
src = ["src", "tests"]

[tool.ruff.lint]
select = ["E", "F", "W", "B", "BLE"]
```

```python
# model/src/hazemodel/__init__.py
"""The learned haze forecast. Every SQL read is in store.py; everything else is frames in, frames out."""

__version__ = "0.1.0"
```

```markdown
# model

The learned haze forecast. Reads the stored history from Postgres, builds truth and features,
trains and backtests (track D), and serves `/predict` to the jobs process. The method and its
results are in `docs/MODEL.md`; the design in `docs/specs/2026-10-10-predictive-model-design.md`.

    python3 -m venv .venv && .venv/bin/pip install -e ".[dev]"
    .venv/bin/pytest -q && .venv/bin/ruff check .
    PG_HOST=127.0.0.1 PG_PORT=5433 PG_DATABASE=postgres PG_USER=postgres PG_PASSWORD=postgres \
      .venv/bin/hazemodel features --from 2025-01-01 --to 2026-10-09   # writes model/data/features-*.parquet
    .venv/bin/hazemodel serve                                              # :4002

This package never writes to the database.
```

Append to `.gitignore`:

```
# python (model/): training data and artifacts are rebuilt, reports are committed
model/data/
model/artifacts/
```

- [ ] **Step 4: Install and run the test**

Run: `cd model && .venv/bin/pip install -q -e ".[dev]" && .venv/bin/pytest -q tests/test_package.py && .venv/bin/ruff check .`
Expected: `1 passed`, ruff clean

- [ ] **Step 5: Commit**

```bash
git add model/pyproject.toml model/README.md model/src/hazemodel/__init__.py model/tests/__init__.py model/tests/test_package.py .gitignore
git commit -m "Scaffold the model package

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

### Task 2: Region and the weather grid index

**Files:**
- Create: `model/src/hazemodel/region.py`, `model/tests/test_region.py`

**Interfaces:**
- Produces: `Region` dataclass with `lon0, lon1, lat0, lat1, step, nx, ny, issue_hour_utc`; `region_from_env() -> Region`; `grid_index(region, lat, lon) -> int` (nearest point, row-major from the south-west, the layout of `weather_hours.u_ms`); `malaysian_day(ts: pd.Timestamp) -> datetime.date`.

- [ ] **Step 1: Write the failing tests**

```python
# model/tests/test_region.py
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
```

- [ ] **Step 2: Run them to verify they fail**

Run: `cd model && .venv/bin/pytest -q tests/test_region.py`
Expected: FAIL, `ModuleNotFoundError: No module named 'hazemodel.region'`

- [ ] **Step 3: Write region.py**

```python
# model/src/hazemodel/region.py
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
```

- [ ] **Step 4: Run the tests**

Run: `cd model && .venv/bin/pytest -q tests/test_region.py && .venv/bin/ruff check .`
Expected: `3 passed`

- [ ] **Step 5: Commit**

```bash
git add model/src/hazemodel/region.py model/tests/test_region.py
git commit -m "Add the region and weather grid index to the model package

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

### Task 3: The API index conversion, an exact port

**Files:**
- Create: `model/src/hazemodel/index.py`, `model/tests/test_index.py`

**Interfaces:**
- Produces: `pm25_to_api(ugm3: float) -> float`, `api_to_pm25(api: float) -> float`, both vectorised over numpy arrays too; `BAND_EDGES`.

- [ ] **Step 1: Write the failing tests**

```python
# model/tests/test_index.py
import numpy as np

from hazemodel.index import api_to_pm25, pm25_to_api


def test_band_edges_round_trip():
    for ugm3, api in [(0, 0), (12.0, 50), (50.4, 100), (55.4, 150), (150.4, 200), (250.4, 300)]:
        assert pm25_to_api(ugm3) == api
        assert abs(api_to_pm25(api) - ugm3) < 1e-9


def test_the_narrow_band_is_steep():
    # 101 to 150 spans 50.4 to 55.4: ten index points per ug/m3.
    assert abs(pm25_to_api(52.9) - 125) < 1e-9


def test_above_the_table_the_top_slope_carries_on():
    assert pm25_to_api(650.4) > 500


def test_vectorised():
    out = pm25_to_api(np.array([12.0, 55.4]))
    assert out.tolist() == [50.0, 150.0]
```

- [ ] **Step 2: Run them to verify they fail**

Run: `cd model && .venv/bin/pytest -q tests/test_index.py`
Expected: FAIL, module not found

- [ ] **Step 3: Write index.py**

```python
# model/src/hazemodel/index.py
"""DOE's Air Pollutant Index and the 24 hour PM2.5 behind it. A port of backend/src/haze/api-index.ts.

The model works in ug/m3 and converts at the edges, because the index bands are very unequal
(101 to 150 spans five ug/m3) and a tree trained on index points would learn the table, not the air.
"""
import numpy as np

BAND_EDGES = [(0.0, 0.0), (12.0, 50.0), (50.4, 100.0), (55.4, 150.0), (150.4, 200.0), (250.4, 300.0), (350.4, 400.0), (500.4, 500.0)]


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
```

- [ ] **Step 4: Run the tests**

Run: `cd model && .venv/bin/pytest -q tests/test_index.py && .venv/bin/ruff check .`
Expected: `4 passed`

- [ ] **Step 5: Commit**

```bash
git add model/src/hazemodel/index.py model/tests/test_index.py
git commit -m "Port the API index conversion to the model package

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

### Task 4: Fixtures extracted from the database, and the store reads

**Files:**
- Create: `model/tests/fixtures/extract.py`, `model/tests/fixtures/README.md`, the CSVs it writes (`stations.csv`, `openaq_sensors.csv`, `airports.csv`, `readings.csv`, `nea_hours.csv`, `openaq_hours.csv`, `metar_obs.csv`, `fire_cells.csv`, `weather_hours.csv`, `smoke_hindcasts.csv` which may be empty), `model/tests/conftest.py`, `model/src/hazemodel/store.py`, `model/tests/test_store.py`

**Interfaces:**
- Produces: `SourceData` dataclass of frames: `stations, sensors, airports, readings, nea_hours, openaq_hours, metar_obs, fire_cells, weather_hours, smoke_hindcasts`; `connect() -> psycopg.Connection` from `PG_*` env; `load_source_data(conn, start: pd.Timestamp, end: pd.Timestamp, hindcast_model: str | None) -> SourceData`; `load_source_data_from_csv(directory) -> SourceData` for tests and offline runs. Every frame's timestamp columns are tz-aware UTC.

The fixture window is 3 to 10 October 2026, the one week with DOE readings, restricted to keep it small: the DOE stations of Selangor and Pahang plus the five NEA regions, OpenAQ sensors within 60 km of Kuala Lumpur, five airports (WMKK, WMSA, WMKP, WMKC, WSSS), fire cells over Sumatra between 0 and 3 N and 100 to 104 E, and the whole weather grid for the week. Under 5 MB together. The CSVs are real values and are labelled so in `README.md`.

- [ ] **Step 1: Write the extraction script and run it once**

```python
# model/tests/fixtures/extract.py
"""Extract the test fixtures from a database that holds the week of 3 to 10 October 2026.

Run from model/ with the PG_* env of the compose postgres:
    PG_HOST=127.0.0.1 PG_PORT=5433 PG_DATABASE=postgres PG_USER=postgres PG_PASSWORD=postgres \
      .venv/bin/python tests/fixtures/extract.py
Every row written is a real stored value. Rerun only to refresh; commit the result.
"""
import pathlib

import pandas as pd

from hazemodel.store import connect

HERE = pathlib.Path(__file__).parent
START, END = "2026-10-02T00:00:00Z", "2026-10-11T00:00:00Z"
QUERIES = {
    "stations": "select id, name, lat, lon, network from stations where state in ('Selangor', 'Pahang') or network = 'nea' order by id",
    "openaq_sensors": "select sensor_id, name, provider, reference, lat, lon from openaq_sensors "
    "where sqrt(power((lat - 3.14) * 111, 2) + power((lon - 101.69) * 111, 2)) < 60 order by sensor_id",
    "airports": "select icao, name, lat, lon from airports where icao in ('WMKK', 'WMSA', 'WMKP', 'WMKC', 'WSSS') order by icao",
    "readings": f"select r.station_id, r.observed_at, r.api from readings r join stations s on s.id = r.station_id "
    f"where (s.state in ('Selangor', 'Pahang') or s.network = 'nea') and r.observed_at >= '{START}' and r.observed_at < '{END}' order by 1, 2",
    "nea_hours": f"select region, observed_at, pm25_hourly, pm25_24h, psi_24h from nea_hours where observed_at >= '{START}' and observed_at < '{END}' order by 1, 2",
    "openaq_hours": f"select h.sensor_id, h.observed_at, h.pm25 from openaq_hours h join openaq_sensors s on s.sensor_id = h.sensor_id "
    f"where sqrt(power((s.lat - 3.14) * 111, 2) + power((s.lon - 101.69) * 111, 2)) < 60 and h.observed_at >= '{START}' and h.observed_at < '{END}' order by 1, 2",
    "metar_obs": f"select icao, observed_at, visibility_m, weather from metar_obs where icao in ('WMKK', 'WMSA', 'WMKP', 'WMKC', 'WSSS') "
    f"and observed_at >= '{START}' and observed_at < '{END}' order by 1, 2",
    "fire_cells": f"select day, lat10, lon10, frp_mw, burning_mw from fire_cells where day >= '2026-09-25' and day < '2026-10-11' "
    f"and lat10 between 0 and 3 and lon10 between 100 and 104 order by 1, 2, 3",
    "weather_hours": f"select valid_at, u_ms, v_ms, rain_mm from weather_hours where valid_at >= '{START}' and valid_at < '2026-10-13T00:00:00Z' order by 1",
    "smoke_hindcasts": f"select as_of, instrument_id, smoke_now, smoke_24h, smoke_48h, model from smoke_hindcasts where as_of >= '{START}' and as_of < '{END}' order by 1, 2",
}


def main() -> None:
    with connect() as conn:
        for name, sql in QUERIES.items():
            frame = pd.read_sql(sql, conn)
            for column in ("u_ms", "v_ms", "rain_mm"):
                if column in frame:
                    frame[column] = frame[column].map(lambda values: " ".join(f"{v:.3f}" for v in values))
            frame.to_csv(HERE / f"{name}.csv", index=False)
            print(name, len(frame))


if __name__ == "__main__":
    main()
```

Write `model/tests/fixtures/README.md`:

```markdown
Real rows from the database, 2 to 11 October 2026, cut to Selangor, Pahang, Singapore, the
sensors near Kuala Lumpur, five airports and the Sumatran fire cells between 0 and 3 N.
Written by `extract.py`; nothing here is invented. The weather arrays are space-separated,
375 values row-major from the south-west corner, as `weather_hours` stores them.
`smoke_hindcasts.csv` is empty until `pnpm haze:hindcast` has run on the source database.
```

This script imports `store.connect`, so write Step 3 first, then run: `cd model && PG_HOST=127.0.0.1 PG_PORT=5433 PG_DATABASE=postgres PG_USER=postgres PG_PASSWORD=postgres .venv/bin/python tests/fixtures/extract.py` (the compose postgres; `backend/.env` has the password) and check `du -sh tests/fixtures` is under 5 MB.

- [ ] **Step 2: Write the failing store test**

```python
# model/tests/conftest.py
import pathlib

import pytest

from hazemodel.store import SourceData, load_source_data_from_csv

FIXTURES = pathlib.Path(__file__).parent / "fixtures"


@pytest.fixture(scope="session")
def data() -> SourceData:
    return load_source_data_from_csv(FIXTURES)
```

```python
# model/tests/test_store.py
import pandas as pd

from hazemodel.store import SourceData


def test_csv_fixtures_load_with_utc_timestamps(data: SourceData):
    assert data.readings["observed_at"].dt.tz is not None
    assert str(data.readings["observed_at"].dt.tz) == "UTC"
    assert data.weather_hours["u_ms"].iloc[0].shape == (375,)
    assert pd.api.types.is_datetime64_any_dtype(data.fire_cells["day"])
    assert set(data.stations["network"]) == {"doe", "nea"}
    assert len(data.airports) == 5


def test_store_has_no_writes():
    import inspect

    from hazemodel import store

    text = inspect.getsource(store).lower()
    for word in ("insert ", "update ", "delete ", "truncate ", "drop "):
        assert word not in text
```

- [ ] **Step 3: Write store.py**

```python
# model/src/hazemodel/store.py
"""Every SQL read the package makes, and the same frames from CSV for tests and offline runs. Read-only."""
import os
import pathlib
from dataclasses import dataclass

import numpy as np
import pandas as pd
import psycopg

TIME_COLUMNS = {"observed_at", "valid_at", "as_of"}


@dataclass
class SourceData:
    stations: pd.DataFrame
    sensors: pd.DataFrame
    airports: pd.DataFrame
    readings: pd.DataFrame
    nea_hours: pd.DataFrame
    openaq_hours: pd.DataFrame
    metar_obs: pd.DataFrame
    fire_cells: pd.DataFrame
    weather_hours: pd.DataFrame
    smoke_hindcasts: pd.DataFrame


def connect() -> psycopg.Connection:
    env = os.environ
    return psycopg.connect(
        host=env.get("PG_HOST", "127.0.0.1"),
        port=int(env.get("PG_PORT", 5432)),
        dbname=env["PG_DATABASE"],
        user=env["PG_USER"],
        password=env["PG_PASSWORD"],
    )


def _utc(frame: pd.DataFrame) -> pd.DataFrame:
    for column in frame.columns:
        if column in TIME_COLUMNS:
            frame[column] = pd.to_datetime(frame[column], utc=True)
        if column == "day":
            frame[column] = pd.to_datetime(frame[column]).dt.normalize()
    return frame


def _read(conn, sql: str, params: tuple) -> pd.DataFrame:
    with conn.cursor() as cursor:
        cursor.execute(sql, params)
        columns = [desc.name for desc in cursor.description]
        frame = pd.DataFrame(cursor.fetchall(), columns=columns)
    for column in ("u_ms", "v_ms", "rain_mm"):
        if column in frame:
            frame[column] = frame[column].map(lambda values: np.asarray(values, dtype=np.float32))
    return _utc(frame)


def load_source_data(conn, start: pd.Timestamp, end: pd.Timestamp, hindcast_model: str | None = None) -> SourceData:
    span = (start.to_pydatetime(), end.to_pydatetime())
    first_day = (start - pd.Timedelta(days=8)).date()
    return SourceData(
        stations=_read(conn, "select id, name, lat, lon, network from stations order by id", ()),
        sensors=_read(conn, "select sensor_id, name, provider, reference, lat, lon from openaq_sensors order by sensor_id", ()),
        airports=_read(conn, "select icao, name, lat, lon from airports order by icao", ()),
        readings=_read(conn, "select station_id, observed_at, api from readings where observed_at >= %s and observed_at < %s", span),
        nea_hours=_read(conn, "select region, observed_at, pm25_hourly, pm25_24h, psi_24h from nea_hours where observed_at >= %s and observed_at < %s", span),
        openaq_hours=_read(conn, "select sensor_id, observed_at, pm25 from openaq_hours where observed_at >= %s and observed_at < %s", span),
        metar_obs=_read(conn, "select icao, observed_at, visibility_m, weather from metar_obs where observed_at >= %s and observed_at < %s", span),
        fire_cells=_read(conn, "select day, lat10, lon10, frp_mw, burning_mw from fire_cells where day >= %s and day < %s", (first_day, end.date())),
        weather_hours=_read(conn, "select valid_at, u_ms, v_ms, rain_mm from weather_hours where valid_at >= %s and valid_at < %s", span),
        smoke_hindcasts=_read(
            conn,
            "select as_of, instrument_id, smoke_now, smoke_24h, smoke_48h, model from smoke_hindcasts where model = %s and as_of >= %s and as_of < %s",
            (hindcast_model or "", *span),
        ),
    )


def load_source_data_from_csv(directory: pathlib.Path) -> SourceData:
    def read(name: str) -> pd.DataFrame:
        frame = pd.read_csv(directory / f"{name}.csv")
        for column in ("u_ms", "v_ms", "rain_mm"):
            if column in frame:
                frame[column] = frame[column].map(lambda text: np.array(str(text).split(), dtype=np.float32))
        return _utc(frame)

    return SourceData(
        stations=read("stations"),
        sensors=read("openaq_sensors"),
        airports=read("airports"),
        readings=read("readings"),
        nea_hours=read("nea_hours"),
        openaq_hours=read("openaq_hours"),
        metar_obs=read("metar_obs"),
        fire_cells=read("fire_cells"),
        weather_hours=read("weather_hours"),
        smoke_hindcasts=read("smoke_hindcasts"),
    )
```

Note: `smoke_hindcasts.csv` with only a header line loads as an empty frame; `_utc` must tolerate that (pandas does).

- [ ] **Step 4: Run the extraction, then the tests**

Run: `cd model && PG_HOST=127.0.0.1 PG_PORT=5433 PG_DATABASE=postgres PG_USER=postgres PG_PASSWORD=<from backend/.env> .venv/bin/python tests/fixtures/extract.py && du -sh tests/fixtures && .venv/bin/pytest -q tests/test_store.py && .venv/bin/ruff check .`
Expected: each table's row count printed, fixtures under 5 MB, `2 passed`

- [ ] **Step 5: Commit**

```bash
git add model/src/hazemodel/store.py model/tests/conftest.py model/tests/test_store.py model/tests/fixtures/
git commit -m "Add the read-only store and the recorded fixtures

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

### Task 5: Instruments

**Files:**
- Create: `model/src/hazemodel/instruments.py`, `model/tests/test_instruments.py`

**Interfaces:**
- Produces: `instruments(data: SourceData) -> pd.DataFrame` with columns `instrument_id, kind ("doe" | "nea" | "openaq" | "airport"), lat, lon, reference (bool)`, one row per instrument, sorted by id; `distance_km(lat1, lon1, lat2, lon2)` (haversine, vectorised); `bearing_deg(lat1, lon1, lat2, lon2)` (initial bearing from point 1 to point 2, 0 to 360).

- [ ] **Step 1: Write the failing tests**

```python
# model/tests/test_instruments.py
import numpy as np

from hazemodel.instruments import bearing_deg, distance_km, instruments


def test_instruments_union_and_ids(data):
    table = instruments(data)
    assert set(table["kind"]) == {"doe", "nea", "openaq", "airport"}
    assert table["instrument_id"].is_unique
    assert all(table[table["kind"] == "openaq"]["instrument_id"].str.startswith("openaq:"))
    assert set(table[table["kind"] == "nea"]["instrument_id"]) == {"SGCENTRAL", "SGEAST", "SGNORTH", "SGSOUTH", "SGWEST"}
    assert "WMKK" in set(table["instrument_id"])
    assert table[table["kind"].isin(["doe", "nea"])]["reference"].all()


def test_distance_and_bearing():
    # Kuala Lumpur to Singapore: about 316 km, bearing about 143 degrees.
    assert abs(distance_km(3.14, 101.69, 1.35, 103.82) - 316) < 5
    assert abs(bearing_deg(3.14, 101.69, 1.35, 103.82) - 143) < 3
    assert bearing_deg(0, 100, 1, 100) == 0
    assert abs(bearing_deg(0, 100, 0, 101) - 90) < 1e-6
    out = distance_km(np.array([0.0, 0.0]), np.array([100.0, 100.0]), 0.0, 101.0)
    assert out.shape == (2,)
```

- [ ] **Step 2: Run them to verify they fail**

Run: `cd model && .venv/bin/pytest -q tests/test_instruments.py`
Expected: FAIL, module not found

- [ ] **Step 3: Write instruments.py**

```python
# model/src/hazemodel/instruments.py
"""One table of every instrument: DOE stations, Singapore regions, OpenAQ sensors and airports.

The id rule is shared with backend/src/jobs/instruments.ts: a station id as stored, openaq:<sensor_id>,
the airport ICAO. Both sides build the list from the same tables, so the hindcast rows join.
"""
import numpy as np
import pandas as pd

from hazemodel.store import SourceData

EARTH_KM = 6371.0


def instruments(data: SourceData) -> pd.DataFrame:
    stations = pd.DataFrame(
        {
            "instrument_id": data.stations["id"],
            "kind": data.stations["network"],
            "lat": data.stations["lat"],
            "lon": data.stations["lon"],
            "reference": True,
        }
    )
    sensors = pd.DataFrame(
        {
            "instrument_id": "openaq:" + data.sensors["sensor_id"].astype(str),
            "kind": "openaq",
            "lat": data.sensors["lat"],
            "lon": data.sensors["lon"],
            "reference": data.sensors["reference"].astype(bool),
        }
    )
    airports = pd.DataFrame(
        {
            "instrument_id": data.airports["icao"],
            "kind": "airport",
            "lat": data.airports["lat"],
            "lon": data.airports["lon"],
            "reference": False,
        }
    )
    table = pd.concat([stations, sensors, airports], ignore_index=True)
    return table.sort_values("instrument_id").reset_index(drop=True)


def distance_km(lat1, lon1, lat2, lon2):
    p1, p2 = np.radians(lat1), np.radians(lat2)
    dphi = p2 - p1
    dlam = np.radians(np.asarray(lon2) - np.asarray(lon1))
    a = np.sin(dphi / 2) ** 2 + np.cos(p1) * np.cos(p2) * np.sin(dlam / 2) ** 2
    return 2 * EARTH_KM * np.arcsin(np.sqrt(a))


def bearing_deg(lat1, lon1, lat2, lon2):
    p1, p2 = np.radians(lat1), np.radians(lat2)
    dlam = np.radians(np.asarray(lon2) - np.asarray(lon1))
    x = np.sin(dlam) * np.cos(p2)
    y = np.cos(p1) * np.sin(p2) - np.sin(p1) * np.cos(p2) * np.cos(dlam)
    return np.mod(np.degrees(np.arctan2(x, y)), 360.0)
```

- [ ] **Step 4: Run the tests**

Run: `cd model && .venv/bin/pytest -q tests/test_instruments.py && .venv/bin/ruff check .`
Expected: `2 passed`

- [ ] **Step 5: Commit**

```bash
git add model/src/hazemodel/instruments.py model/tests/test_instruments.py
git commit -m "Build the instrument table with distance and bearing

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

### Task 6: Reference truth: hourly 24 h series and daily peaks

**Files:**
- Create: `model/src/hazemodel/truth/__init__.py`, `model/src/hazemodel/truth/reference.py`, `model/tests/test_truth_reference.py`

**Interfaces:**
- Produces: `reference_series(data: SourceData) -> pd.DataFrame` with columns `instrument_id, observed_at, pm25_24h` for DOE (via `api_to_pm25`), NEA (`pm25_24h`) and OpenAQ (rolling 24 h mean of `pm25`, needing 18 of 24 hours, else NaN dropped); `daily_peaks(series: pd.DataFrame) -> pd.DataFrame` with `instrument_id, day (Malaysian date), peak` where a day needs at least 12 hours present.
- Note: OpenAQ rows are the sensor's raw series here. `truth/sensors.py` (Task 7) corrects them; both are needed because the raw series is a feature for neighbours even when a sensor is not truth.

- [ ] **Step 1: Write the failing tests**

```python
# model/tests/test_truth_reference.py
from hazemodel.index import api_to_pm25
from hazemodel.truth.reference import daily_peaks, reference_series


def test_doe_rows_are_converted_and_nea_rows_taken_as_stored(data):
    series = reference_series(data)
    doe = series[series["instrument_id"] == data.readings["station_id"].iloc[0]]
    first = data.readings.iloc[0]
    row = doe[doe["observed_at"] == first["observed_at"]].iloc[0]
    assert abs(row["pm25_24h"] - api_to_pm25(first["api"])) < 1e-6
    nea = series[series["instrument_id"] == "SGCENTRAL"]
    stored = data.nea_hours[(data.nea_hours["region"] == "central") & data.nea_hours["pm25_24h"].notna()]
    assert len(nea) == len(stored)


def test_openaq_rolling_mean_needs_eighteen_hours(data):
    series = reference_series(data)
    sensor_id = data.openaq_hours["sensor_id"].iloc[0]
    rows = series[series["instrument_id"] == f"openaq:{sensor_id}"]
    hours = data.openaq_hours[data.openaq_hours["sensor_id"] == sensor_id]
    # The first 17 hours of a sensor's record can have no 24 h mean.
    assert rows["observed_at"].min() >= hours["observed_at"].min() + __import__("pandas").Timedelta(hours=17)


def test_daily_peaks_are_per_malaysian_day(data):
    peaks = daily_peaks(reference_series(data))
    assert {"instrument_id", "day", "peak"} <= set(peaks.columns)
    one = peaks[peaks["instrument_id"] == "SGCENTRAL"].sort_values("day")
    assert len(one) >= 6
    assert (one["peak"] > 0).all()
```

- [ ] **Step 2: Run them to verify they fail**

Run: `cd model && .venv/bin/pytest -q tests/test_truth_reference.py`
Expected: FAIL, module not found

- [ ] **Step 3: Write reference.py**

```python
# model/src/hazemodel/truth/__init__.py
"""Each instrument kind turned into 24 hour mean PM2.5, scored separately always."""
```

```python
# model/src/hazemodel/truth/reference.py
"""The 24 hour mean PM2.5 series of every instrument that measures concentration, and its daily peaks.

DOE publishes the index of the 24 h mean, converted back through the DOE table. Singapore
publishes the 24 h mean itself. OpenAQ publishes hourly values, averaged here over a trailing 24
hours when at least 18 of them exist, because a mean of fewer hours is a different quantity.
"""
import pandas as pd

from hazemodel.index import api_to_pm25
from hazemodel.region import MALAYSIA_OFFSET
from hazemodel.store import SourceData

MIN_HOURS_IN_MEAN = 18
MIN_HOURS_IN_DAY = 12
NEA_IDS = {"central": "SGCENTRAL", "east": "SGEAST", "north": "SGNORTH", "south": "SGSOUTH", "west": "SGWEST"}


def _doe(readings: pd.DataFrame) -> pd.DataFrame:
    return pd.DataFrame(
        {"instrument_id": readings["station_id"], "observed_at": readings["observed_at"], "pm25_24h": api_to_pm25(readings["api"].to_numpy())}
    )


def _nea(hours: pd.DataFrame) -> pd.DataFrame:
    rows = hours[hours["pm25_24h"].notna()]
    return pd.DataFrame(
        {"instrument_id": rows["region"].map(NEA_IDS), "observed_at": rows["observed_at"], "pm25_24h": rows["pm25_24h"].astype(float)}
    )


def _openaq(hours: pd.DataFrame) -> pd.DataFrame:
    out = []
    for sensor_id, group in hours.groupby("sensor_id"):
        hourly = group.set_index("observed_at")["pm25"].sort_index()
        hourly = hourly[~hourly.index.duplicated()].asfreq("h")
        rolling = hourly.rolling("24h", min_periods=MIN_HOURS_IN_MEAN).mean()
        # asfreq inserted the missing hours as NaN so the window counts real hours only.
        kept = rolling[hourly.notna() & rolling.notna()]
        out.append(pd.DataFrame({"instrument_id": f"openaq:{sensor_id}", "observed_at": kept.index, "pm25_24h": kept.to_numpy()}))
    return pd.concat(out, ignore_index=True) if out else pd.DataFrame(columns=["instrument_id", "observed_at", "pm25_24h"])


def reference_series(data: SourceData) -> pd.DataFrame:
    series = pd.concat([_doe(data.readings), _nea(data.nea_hours), _openaq(data.openaq_hours)], ignore_index=True)
    series = series.dropna(subset=["pm25_24h"])
    return series.sort_values(["instrument_id", "observed_at"]).reset_index(drop=True)


def daily_peaks(series: pd.DataFrame) -> pd.DataFrame:
    local = series.assign(day=(series["observed_at"] + MALAYSIA_OFFSET).dt.date)
    grouped = local.groupby(["instrument_id", "day"])["pm25_24h"]
    peaks = grouped.agg(peak="max", hours="count").reset_index()
    return peaks[peaks["hours"] >= MIN_HOURS_IN_DAY].drop(columns="hours").reset_index(drop=True)
```

- [ ] **Step 4: Run the tests**

Run: `cd model && .venv/bin/pytest -q tests/test_truth_reference.py && .venv/bin/ruff check .`
Expected: `3 passed`

- [ ] **Step 5: Commit**

```bash
git add model/src/hazemodel/truth/ model/tests/test_truth_reference.py
git commit -m "Build the reference 24 hour PM2.5 series and daily peaks

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

### Task 7: Sensor correction and the airport visibility proxy

**Files:**
- Create: `model/src/hazemodel/truth/sensors.py`, `model/src/hazemodel/truth/visibility.py`, `model/tests/test_truth_sensors.py`, `model/tests/test_truth_visibility.py`

**Interfaces:**
- Produces:
  - `correct_sensors(series, table) -> tuple[pd.DataFrame, pd.DataFrame]`: input the reference series (Task 6) and the instrument table (Task 5); output the series with each `openaq:` instrument's `pm25_24h` replaced by `a + b * value` fitted against its nearest reference instrument (kind doe or nea, or an OpenAQ sensor with `reference` true) on shared hours, and a decisions frame `instrument_id, reference_id, distance_km, hours, correlation, intercept, slope, accepted`. A sensor is accepted when `correlation >= 0.8` and `hours >= 200`; a sensor not accepted keeps its raw values and `accepted = False`, which the feature builder reads to give it weight zero as truth.
  - `airport_series(data, series, table) -> tuple[pd.DataFrame, pd.DataFrame]`: for each airport, dry reports only, extinction `3.912 / (visibility_m / 1000)` averaged over a trailing 24 h window (at least 12 reports), fitted `pm25 = a + b * extinction` against the nearest reference instrument's `pm25_24h` on shared hours; pooled fit across airports when an airport has under 100 shared hours. Output columns `instrument_id, observed_at, pm25_24h, censored (bool)` where `censored` is true when the 24 h mean extinction came only from reports at the 10 km cap, and a decisions frame `instrument_id, reference_id, hours, correlation, intercept, slope, pooled`.
  - Constants: `ACCEPT_CORRELATION = 0.8`, `ACCEPT_HOURS = 200`, `KOSCHMIEDER = 3.912`, `CAP_M = 10000`, `CENSOR_UGM3 = 35.0`, `WET = ("RA", "SH", "TS", "DZ", "BR", "FG")`.

- [ ] **Step 1: Write the failing tests**

```python
# model/tests/test_truth_sensors.py
from hazemodel.instruments import instruments
from hazemodel.truth.reference import reference_series
from hazemodel.truth.sensors import ACCEPT_CORRELATION, ACCEPT_HOURS, correct_sensors


def test_every_sensor_gets_a_decision_against_a_reference(data):
    series = reference_series(data)
    table = instruments(data)
    corrected, decisions = correct_sensors(series, table)
    sensors = table[table["kind"] == "openaq"]["instrument_id"]
    assert set(decisions["instrument_id"]) == set(sensors)
    assert decisions["reference_id"].notna().all()
    assert (decisions["distance_km"] >= 0).all()
    accepted = decisions[decisions["accepted"]]
    assert (accepted["correlation"] >= ACCEPT_CORRELATION).all()
    assert (accepted["hours"] >= ACCEPT_HOURS).all()
    assert set(corrected.columns) == set(series.columns)


def test_an_accepted_sensor_moves_toward_its_reference(data):
    series = reference_series(data)
    table = instruments(data)
    corrected, decisions = correct_sensors(series, table)
    for _, row in decisions[decisions["accepted"]].iterrows():
        raw = series[series["instrument_id"] == row["instrument_id"]].set_index("observed_at")["pm25_24h"]
        fixed = corrected[corrected["instrument_id"] == row["instrument_id"]].set_index("observed_at")["pm25_24h"]
        ref = series[series["instrument_id"] == row["reference_id"]].set_index("observed_at")["pm25_24h"]
        shared = raw.index.intersection(ref.index)
        before = (raw[shared] - ref[shared]).abs().mean()
        after = (fixed[shared] - ref[shared]).abs().mean()
        assert after <= before + 1e-6


def test_a_short_overlap_is_not_accepted(data):
    series = reference_series(data)
    table = instruments(data)
    sensor = table[table["kind"] == "openaq"]["instrument_id"].iloc[0]
    cut = series[(series["instrument_id"] != sensor) | (series.groupby("instrument_id").cumcount() < ACCEPT_HOURS - 1)]
    _, decisions = correct_sensors(cut, table)
    assert not decisions.set_index("instrument_id").loc[sensor, "accepted"]
```

```python
# model/tests/test_truth_visibility.py
import pandas as pd

from hazemodel.instruments import instruments
from hazemodel.truth.reference import reference_series
from hazemodel.truth.visibility import CAP_M, CENSOR_UGM3, KOSCHMIEDER, airport_series, extinction, is_dry


def test_wet_reports_are_dropped_and_dry_kept():
    assert is_dry(None)
    assert is_dry("HZ")
    assert is_dry("FU")
    assert not is_dry("-RA")
    assert not is_dry("BR")
    assert not is_dry("TSRA")


def test_extinction_is_koschmieder_over_km():
    assert abs(extinction(5000) - KOSCHMIEDER / 5) < 1e-9
    assert abs(extinction(CAP_M) - KOSCHMIEDER / 10) < 1e-9


def test_airports_get_a_series_and_a_fit(data):
    series = reference_series(data)
    table = instruments(data)
    proxy, decisions = airport_series(data, series, table)
    assert set(decisions["instrument_id"]) == set(table[table["kind"] == "airport"]["instrument_id"])
    assert {"instrument_id", "observed_at", "pm25_24h", "censored"} <= set(proxy.columns)
    assert (decisions["slope"] > 0).all()


def test_visibility_censors_at_cap(data):
    series = reference_series(data)
    table = instruments(data)
    # Every report at the cap: the proxy cannot say how clean the air is.
    capped = data.metar_obs.copy()
    capped["visibility_m"] = CAP_M
    capped["weather"] = None
    data_capped = type(data)(**{**data.__dict__, "metar_obs": capped})
    proxy, _ = airport_series(data_capped, series, table)
    assert proxy["censored"].all()
    assert (proxy["pm25_24h"] <= CENSOR_UGM3 + 1e-6).all()
```

- [ ] **Step 2: Run them to verify they fail**

Run: `cd model && .venv/bin/pytest -q tests/test_truth_sensors.py tests/test_truth_visibility.py`
Expected: FAIL, modules not found

- [ ] **Step 3: Write sensors.py and visibility.py**

```python
# model/src/hazemodel/truth/sensors.py
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
```

```python
# model/src/hazemodel/truth/visibility.py
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
    pooled = fit_line(pd.concat(pooled_x) if pooled_x else pd.Series(dtype=float), pd.concat(pooled_y) if pooled_y else pd.Series(dtype=float))
    rows, decisions = [], []
    for icao, (hourly, reference_id, ref) in per_airport.items():
        own = fit_line(hourly["extinction_24h"], ref)
        intercept, slope, correlation, hours = own if own[3] >= MIN_HOURS_FOR_OWN_FIT else pooled
        use_pooled = own[3] < MIN_HOURS_FOR_OWN_FIT
        pm25 = intercept + slope * hourly["extinction_24h"]
        pm25 = np.where(hourly["censored"], np.minimum(pm25, CENSOR_UGM3), pm25)
        rows.append(pd.DataFrame({"instrument_id": icao, "observed_at": hourly.index, "pm25_24h": pm25, "censored": hourly["censored"].to_numpy()}))
        decisions.append(
            {"instrument_id": icao, "reference_id": reference_id, "hours": own[3], "correlation": correlation, "intercept": intercept, "slope": slope, "pooled": use_pooled}
        )
    proxy = pd.concat(rows, ignore_index=True) if rows else pd.DataFrame(columns=["instrument_id", "observed_at", "pm25_24h", "censored"])
    return proxy, pd.DataFrame(decisions)
```

- [ ] **Step 4: Run the tests**

Run: `cd model && .venv/bin/pytest -q tests/test_truth_sensors.py tests/test_truth_visibility.py && .venv/bin/ruff check .`
Expected: `7 passed`. If `test_airports_get_a_series_and_a_fit` fails on `slope > 0` for the five fixture airports, print the decisions frame and check the pooled fit; a negative slope means wet reports leaked through `is_dry` (check the `weather` column's codes in the fixture) and is a bug to fix, not a test to loosen.

- [ ] **Step 5: Commit**

```bash
git add model/src/hazemodel/truth/sensors.py model/src/hazemodel/truth/visibility.py model/tests/test_truth_sensors.py model/tests/test_truth_visibility.py
git commit -m "Correct low-cost sensors and turn airport visibility into a PM2.5 proxy

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

### Task 8: Feature groups: air, fires, weather, calendar, physics

**Files:**
- Create: `model/src/hazemodel/features/__init__.py`, `features/air.py`, `features/fires.py`, `features/weather.py`, `features/calendar.py`, `features/physics.py`, `model/tests/test_features.py`

**Interfaces:**
- Consumes: `series` (the full 24 h series: reference, corrected sensors and airport proxy concatenated, columns `instrument_id, observed_at, pm25_24h`), `table` (Task 5), `data` (Task 4), `region` (Task 2).
- Produces, each a function `(…, issue_times: pd.DatetimeIndex) -> pd.DataFrame` indexed by `(instrument_id, issue_at)`:
  - `air_features(series, table, issue_times)`: `level, lag24, lag48, lag72, d24, d48, slope3h, peak24, peak_hour, near50, near150, hist_mean, hist_std`. `level` is the last value at or before issue time within 6 hours, else the row is absent. `hist_mean`/`hist_std` are over the instrument's series before the issue time (expanding, leak-free).
  - `fire_features(data, table, issue_times)`: `fire_s{0..7}_r{0..2}_d{1,3,7}` (72 columns, sum of `coalesce(burning_mw, frp_mw)` over complete UTC days before the issue time), `fire_total_d3`, `fire_total_change` (d3 now minus d3 three days earlier), `fire_heaviest_bearing` (centre bearing of the sector with the largest 7 day sum in rings 0 and 1).
  - `weather_features(data, table, region, issue_times)`: `u24, v24, u48, v48, steady24, steady48, rain24, rain48, along_fire24, hours_present, from_forecast (0 or 1)`. Uses `weather_hours` at the instrument's grid index for hours in `(issue, issue + 48h]`; `along_fire24` needs `fire_heaviest_bearing`, so it takes the fire frame as an argument.
  - `calendar_features(issue_times) -> DataFrame indexed by issue_at`: `doy_sin, doy_cos, month, sw_monsoon` (1 for May to September).
  - `physics_features(data, issue_times)`: `smoke_now, smoke_24h, smoke_48h, smoke_change` from `smoke_hindcasts`; absent rows are NaN (LightGBM handles NaN), and a `has_physics` column.
- Sector binning: sector index `int(bearing // 45) % 8`, so a bearing of exactly 45.0 is sector 1. Rings: `[0, 300)`, `[300, 800)`, `[800, 1500)` km; beyond 1500 km ignored.

- [ ] **Step 1: Write the failing tests**

```python
# model/tests/test_features.py
import numpy as np
import pandas as pd

from hazemodel.features.air import air_features
from hazemodel.features.calendar import calendar_features
from hazemodel.features.fires import fire_features, sector_of
from hazemodel.features.physics import physics_features
from hazemodel.features.weather import weather_features
from hazemodel.instruments import instruments
from hazemodel.region import region_from_env
from hazemodel.truth.reference import reference_series

ISSUES = pd.DatetimeIndex([pd.Timestamp("2026-10-08T00:00:00Z"), pd.Timestamp("2026-10-09T00:00:00Z")])


def test_air_features_are_leak_free_and_complete(data):
    series = reference_series(data)
    table = instruments(data)
    air = air_features(series, table, ISSUES)
    assert air.index.names == ["instrument_id", "issue_at"]
    row = air.loc[("SGCENTRAL", ISSUES[1])]
    stored = series[(series["instrument_id"] == "SGCENTRAL") & (series["observed_at"] <= ISSUES[1])]
    assert abs(row["level"] - stored["pm25_24h"].iloc[-1]) < 1e-6
    assert abs(row["d24"] - (row["level"] - row["lag24"])) < 1e-6
    assert 0 <= row["peak_hour"] <= 23
    assert row["hist_mean"] == pytest_approx(stored["pm25_24h"].iloc[:-1].mean()) if False else True


def test_sector_boundary_is_kept():
    assert sector_of(np.array([0.0, 44.99, 45.0, 359.9])).tolist() == [0, 0, 1, 7]


def test_fire_features_sum_only_complete_days_before_issue(data):
    table = instruments(data)
    fires = fire_features(data, table, ISSUES)
    columns = [c for c in fires.columns if c.startswith("fire_s")]
    assert len(columns) == 72
    kl = fires.loc[("WMKK", ISSUES[1])]
    # Sumatra is west to south-west of KL: sectors 5 and 6 of ring 0 or 1 hold the fixture's fires.
    west = sum(kl[f"fire_s{s}_r{r}_d7"] for s in (5, 6) for r in (0, 1))
    assert west > 0
    assert kl["fire_total_d3"] >= 0
    assert 0 <= kl["fire_heaviest_bearing"] < 360
    day_of_issue = data.fire_cells[data.fire_cells["day"] == pd.Timestamp("2026-10-09")]
    assert len(day_of_issue) > 0, "the fixture has fires on the issue day, which must not be counted"
    assert kl["fire_s5_r0_d1"] + kl["fire_s6_r0_d1"] <= data.fire_cells[data.fire_cells["day"] == pd.Timestamp("2026-10-08")]["frp_mw"].sum() + 1e-6


def test_weather_features_tolerate_missing_hours(data):
    table = instruments(data)
    region = region_from_env()
    fires = fire_features(data, table, ISSUES)
    cut = data.weather_hours[data.weather_hours["valid_at"] <= ISSUES[1] + pd.Timedelta(hours=30)]
    data_cut = type(data)(**{**data.__dict__, "weather_hours": cut})
    weather = weather_features(data_cut, table, region, fires, ISSUES)
    row = weather.loc[("WMKK", ISSUES[1])]
    assert row["hours_present"] == 30
    assert np.isfinite(row["u48"])
    assert 0 <= row["steady24"] <= 1 + 1e-6
    assert row["rain48"] >= 0
    assert row["from_forecast"] == 0


def test_calendar_features():
    cal = calendar_features(ISSUES)
    assert cal.loc[ISSUES[0], "month"] == 10
    assert cal.loc[ISSUES[0], "sw_monsoon"] == 0
    assert abs(cal.loc[ISSUES[0], "doy_sin"] ** 2 + cal.loc[ISSUES[0], "doy_cos"] ** 2 - 1) < 1e-9


def test_physics_features_are_nan_when_no_hindcast(data):
    physics = physics_features(data, ISSUES)
    assert "has_physics" in physics.columns
    if data.smoke_hindcasts.empty:
        assert physics.empty or (physics["has_physics"] == 0).all()
```

Replace the odd last assertion in `test_air_features_are_leak_free_and_complete` with a real one:

```python
    assert abs(row["hist_mean"] - stored["pm25_24h"].iloc[:-1].mean()) < 1e-6
```

- [ ] **Step 2: Run them to verify they fail**

Run: `cd model && .venv/bin/pytest -q tests/test_features.py`
Expected: FAIL, modules not found

- [ ] **Step 3: Write the five feature modules**

```python
# model/src/hazemodel/features/__init__.py
"""One module per feature group, each frames in, a frame indexed by (instrument_id, issue_at) out."""
```

```python
# model/src/hazemodel/features/air.py
"""Group 1: the state of the air at the issue time, from the instrument's own 24 h series and its neighbours."""
import numpy as np
import pandas as pd

from hazemodel.instruments import distance_km

STALE_HOURS = 6
NEAR_KM = (50, 150)


def _at(series: pd.Series, when: pd.Timestamp, tolerance_h: int) -> float:
    before = series[:when]
    if before.empty or (when - before.index[-1]) > pd.Timedelta(hours=tolerance_h):
        return np.nan
    return float(before.iloc[-1])


def _one(series: pd.Series, issue: pd.Timestamp) -> dict | None:
    level = _at(series, issue, STALE_HOURS)
    if np.isnan(level):
        return None
    last24 = series[issue - pd.Timedelta(hours=24) : issue]
    history = series[: issue - pd.Timedelta(hours=1)]
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
    by_id = {key: group.set_index("observed_at")["pm25_24h"].sort_index() for key, group in series.groupby("instrument_id")}
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
        for issue, group in frame.groupby(level="issue_at"):
            levels = group["level"].droplevel("issue_at")
            present = pd.Series(levels).reindex(ids)
            values = present.to_numpy(dtype=float)
            mask = (distances <= km) & ~np.eye(len(ids), dtype=bool) & ~np.isnan(values)[None, :]
            sums = np.where(mask, np.nan_to_num(values)[None, :], 0.0).sum(axis=1)
            counts = mask.sum(axis=1)
            means = pd.Series(np.where(counts > 0, sums / np.maximum(counts, 1), np.nan), index=ids)
            frame.loc[(group.index.get_level_values("instrument_id"), issue), column] = means[group.index.get_level_values("instrument_id")].to_numpy()
    return frame
```

```python
# model/src/hazemodel/features/fires.py
"""Group 2: screened fire power by sector and ring around each instrument, over complete UTC days before the issue time."""
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


def fire_features(data, table: pd.DataFrame, issue_times: pd.DatetimeIndex) -> pd.DataFrame:
    cells = data.fire_cells
    columns = {}
    for issue in issue_times:
        last_complete = (issue - pd.Timedelta(hours=1)).normalize() - pd.Timedelta(days=1)
        last_complete = last_complete.tz_localize(None) if last_complete.tzinfo else last_complete
        days = {w: cells[(cells["day"] > last_complete - pd.Timedelta(days=w)) & (cells["day"] <= last_complete)] for w in WINDOWS}
        earlier = cells[(cells["day"] > last_complete - pd.Timedelta(days=6)) & (cells["day"] <= last_complete - pd.Timedelta(days=3))]
        sums = {w: _sums_for_days(table, days[w]) for w in WINDOWS}
        earlier_sum = _sums_for_days(table, earlier)
        for i, instrument_id in enumerate(table["instrument_id"]):
            row = {}
            for w in WINDOWS:
                for s in range(SECTORS):
                    for r in range(len(RINGS_KM) - 1):
                        row[f"fire_s{s}_r{r}_d{w}"] = sums[w][i, s * 3 + r]
            row["fire_total_d3"] = float(sums[3][i].sum())
            row["fire_total_change"] = float(sums[3][i].sum() - earlier_sum[i].sum())
            near = sums[7][i].reshape(SECTORS, 3)[:, :2].sum(axis=1)
            row["fire_heaviest_bearing"] = float(int(np.argmax(near)) * 45 + 22.5) if near.sum() > 0 else np.nan
            columns[(instrument_id, issue)] = row
    frame = pd.DataFrame.from_dict(columns, orient="index")
    frame.index = pd.MultiIndex.from_tuples(frame.index, names=["instrument_id", "issue_at"])
    return frame
```

Note on `last_complete`: the issue time is 00:00 UTC, so the last complete UTC day is the day before the issue date. `fire_cells.day` is tz-naive midnight; the subtraction above lands on that. Keep the day column naive in `store._utc` as written.

```python
# model/src/hazemodel/features/weather.py
"""Group 4: the wind and rain over the next 48 hours at the instrument's grid point, as stored.

weather_hours holds the newest fetch: the analysis for past hours. A training row built from it
knows the real wind, which a live row never does; the from_forecast flag records which it was,
and track B's weather_forecasts table is what makes from_forecast = 1 rows possible later.
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


def weather_features(data, table: pd.DataFrame, region: Region, fires: pd.DataFrame, issue_times: pd.DatetimeIndex) -> pd.DataFrame:
    weather = data.weather_hours.sort_values("valid_at")
    rows = {}
    for issue in issue_times:
        windows = {h: _window(weather, issue, h) for h in HORIZONS}
        for _, instrument in table.iterrows():
            index = grid_index(region, instrument["lat"], instrument["lon"])
            row = {"hours_present": len(windows[48]), "from_forecast": 0}
            for h in HORIZONS:
                u, v, steady, rain = _stats(windows[h], index)
                row.update({f"u{h}": u, f"v{h}": v, f"steady{h}": steady, f"rain{h}": rain})
            key = (instrument["instrument_id"], issue)
            bearing = fires.loc[key, "fire_heaviest_bearing"] if key in fires.index else np.nan
            if np.isnan(bearing) or np.isnan(row["u24"]):
                row["along_fire24"] = np.nan
            else:
                # Wind blowing from the fires toward the instrument has a component along (bearing + 180).
                towards = np.radians(bearing + 180.0)
                row["along_fire24"] = float(row["u24"] * np.sin(towards) + row["v24"] * np.cos(towards))
            rows[key] = row
    frame = pd.DataFrame.from_dict(rows, orient="index")
    frame.index = pd.MultiIndex.from_tuples(frame.index, names=["instrument_id", "issue_at"])
    return frame
```

```python
# model/src/hazemodel/features/calendar.py
"""Group 5: where in the year the issue time falls. Trees cannot read a date."""
import numpy as np
import pandas as pd

SW_MONSOON_MONTHS = (5, 6, 7, 8, 9)


def calendar_features(issue_times: pd.DatetimeIndex) -> pd.DataFrame:
    doy = issue_times.dayofyear.to_numpy()
    angle = 2 * np.pi * doy / 365.25
    return pd.DataFrame(
        {
            "doy_sin": np.sin(angle),
            "doy_cos": np.cos(angle),
            "month": issue_times.month,
            "sw_monsoon": np.isin(issue_times.month, SW_MONSOON_MONTHS).astype(int),
        },
        index=pd.Index(issue_times, name="issue_at"),
    )
```

```python
# model/src/hazemodel/features/physics.py
"""Group 3: the transport model's own view, from smoke_hindcasts, when the hindcast job has run."""
import pandas as pd

COLUMNS = ["smoke_now", "smoke_24h", "smoke_48h", "smoke_change", "has_physics"]


def physics_features(data, issue_times: pd.DatetimeIndex) -> pd.DataFrame:
    hindcasts = data.smoke_hindcasts
    if hindcasts.empty:
        return pd.DataFrame(columns=COLUMNS, index=pd.MultiIndex.from_tuples([], names=["instrument_id", "issue_at"]))
    rows = hindcasts[hindcasts["as_of"].isin(issue_times)].copy()
    rows["smoke_change"] = rows["smoke_24h"] - rows["smoke_now"]
    rows["has_physics"] = 1
    rows = rows.rename(columns={"as_of": "issue_at"}).set_index(["instrument_id", "issue_at"])
    return rows[COLUMNS]
```

- [ ] **Step 4: Run the tests**

Run: `cd model && .venv/bin/pytest -q tests/test_features.py && .venv/bin/ruff check .`
Expected: `6 passed`

- [ ] **Step 5: Commit**

```bash
git add model/src/hazemodel/features/ model/tests/test_features.py
git commit -m "Build the air, fire, weather, calendar and physics feature groups

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

### Task 9: The row builder, targets, weights and parquet

**Files:**
- Create: `model/src/hazemodel/features/build.py`, `model/src/hazemodel/truth/assemble.py`, `model/tests/test_build.py`

**Interfaces:**
- Produces:
  - `assemble_truth(data, table) -> tuple[pd.DataFrame, dict]`: the full 24 h series (reference + corrected sensors + airport proxy, columns `instrument_id, observed_at, pm25_24h, censored`) and a `decisions` dict with the two decision frames.
  - `build_rows(data, region, issue_times, with_targets: bool) -> tuple[pd.DataFrame, dict]`: the feature frame joined across groups, indexed by `(instrument_id, issue_at)`, with columns `kind` (category), `kind_code` (its integer code, the model input), `reference_weight` (1.0 doe/nea, 0.6 accepted openaq, 0.4 airport, 0.0 unaccepted openaq), and when `with_targets`: `peak_d1`, `peak_d2`, `censored_d1`, `censored_d2`, `weight_d1`, `weight_d2` where `weight = reference_weight * (3 if peak > 55 else 1)`, and 0 when censored and `peak <= 35`. Rows without `level` are omitted (the feature frame's inner join on air). Rows with a missing target are kept with NaN target (track D drops them per target).
  - `write_parquet(frame, directory, start, end) -> pathlib.Path` named `features-<start>-<end>-<sha1 of the sorted column list and row count>[:8].parquet`.
  - `hazemodel features --from --to [--hindcast-model v2-analysis] [--out model/data]` in `cli.py` (Task 11 wires the CLI; this task adds the function `features_command(args)`).

- [ ] **Step 1: Write the failing tests**

```python
# model/tests/test_build.py
import pandas as pd

from hazemodel.features.build import build_rows, write_parquet
from hazemodel.region import region_from_env
from hazemodel.truth.assemble import assemble_truth
from hazemodel.instruments import instruments

ISSUES = pd.DatetimeIndex([pd.Timestamp("2026-10-07T00:00:00Z"), pd.Timestamp("2026-10-08T00:00:00Z")])


def test_assemble_truth_has_every_kind(data):
    series, decisions = assemble_truth(data, instruments(data))
    assert {"sensors", "airports"} == set(decisions)
    assert series["instrument_id"].str.startswith("openaq:").any()
    assert (series["instrument_id"] == "WMKK").any()
    assert (series["instrument_id"] == "SGCENTRAL").any()


def test_build_rows_joins_groups_and_targets(data):
    frame, decisions = build_rows(data, region_from_env(), ISSUES, with_targets=True)
    assert frame.index.names == ["instrument_id", "issue_at"]
    for column in ("level", "fire_s0_r0_d1", "u24", "doy_sin", "kind", "kind_code", "reference_weight", "peak_d1", "peak_d2", "weight_d1"):
        assert column in frame.columns, column
    sg = frame.loc[("SGCENTRAL", ISSUES[0])]
    assert sg["reference_weight"] == 1.0
    assert sg["peak_d1"] > 0
    assert sg["weight_d1"] in (1.0, 3.0)
    airport = frame.loc[("WMKK", ISSUES[0])]
    assert airport["reference_weight"] == 0.4


def test_build_skips_instrument_without_level(data):
    silent = data.nea_hours[data.nea_hours["region"] != "west"]
    data_silent = type(data)(**{**data.__dict__, "nea_hours": silent})
    frame, _ = build_rows(data_silent, region_from_env(), ISSUES, with_targets=False)
    assert "SGWEST" not in frame.index.get_level_values("instrument_id")
    assert frame["level"].notna().all()


def test_write_parquet_names_the_file_by_content(tmp_path, data):
    frame, _ = build_rows(data, region_from_env(), ISSUES, with_targets=True)
    path = write_parquet(frame, tmp_path, "2026-10-07", "2026-10-08")
    assert path.name.startswith("features-2026-10-07-2026-10-08-")
    back = pd.read_parquet(path)
    assert len(back) == len(frame)
```

- [ ] **Step 2: Run them to verify they fail**

Run: `cd model && .venv/bin/pytest -q tests/test_build.py`
Expected: FAIL, modules not found

- [ ] **Step 3: Write assemble.py and build.py**

```python
# model/src/hazemodel/truth/assemble.py
"""The one 24 h series every feature and target reads: reference monitors, corrected sensors, airport proxies."""
import pandas as pd

from hazemodel.store import SourceData
from hazemodel.truth.reference import reference_series
from hazemodel.truth.sensors import correct_sensors
from hazemodel.truth.visibility import airport_series


def assemble_truth(data: SourceData, table: pd.DataFrame) -> tuple[pd.DataFrame, dict]:
    reference = reference_series(data)
    corrected, sensor_decisions = correct_sensors(reference, table)
    airports, airport_decisions = airport_series(data, reference, table)
    corrected["censored"] = False
    series = pd.concat([corrected, airports], ignore_index=True)
    series = series.sort_values(["instrument_id", "observed_at"]).reset_index(drop=True)
    return series, {"sensors": sensor_decisions, "airports": airport_decisions}
```

```python
# model/src/hazemodel/features/build.py
"""Assemble one row per instrument and issue time: every feature group, the kind, the weights and the targets."""
import hashlib
import pathlib

import numpy as np
import pandas as pd

from hazemodel.features.air import air_features
from hazemodel.features.calendar import calendar_features
from hazemodel.features.fires import fire_features
from hazemodel.features.physics import physics_features
from hazemodel.features.weather import weather_features
from hazemodel.instruments import instruments
from hazemodel.region import MALAYSIA_OFFSET, Region
from hazemodel.store import SourceData
from hazemodel.truth.assemble import assemble_truth
from hazemodel.truth.reference import daily_peaks
from hazemodel.truth.visibility import CENSOR_UGM3

KIND_WEIGHT = {"doe": 1.0, "nea": 1.0, "openaq": 0.6, "airport": 0.4}
HAZY_UGM3 = 55.0
HAZY_WEIGHT = 3.0
TARGET_DAYS = (1, 2)


def _reference_weight(table: pd.DataFrame, sensor_decisions: pd.DataFrame) -> pd.Series:
    weight = table["kind"].map(KIND_WEIGHT)
    accepted = set(sensor_decisions[sensor_decisions["accepted"]]["instrument_id"])
    unaccepted = (table["kind"] == "openaq") & ~table["instrument_id"].isin(accepted)
    return pd.Series(np.where(unaccepted, 0.0, weight), index=table["instrument_id"])


def _targets(series: pd.DataFrame, frame: pd.DataFrame) -> pd.DataFrame:
    peaks = daily_peaks(series).set_index(["instrument_id", "day"])["peak"]
    censored = series.groupby(["instrument_id", (series["observed_at"] + MALAYSIA_OFFSET).dt.date])["censored"].all()
    censored.index.names = ["instrument_id", "day"]
    ids = frame.index.get_level_values("instrument_id")
    issue_days = (frame.index.get_level_values("issue_at") + MALAYSIA_OFFSET).date
    for d in TARGET_DAYS:
        keys = list(zip(ids, [day + pd.Timedelta(days=d) for day in issue_days]))
        keys = [(i, (pd.Timestamp(day)).date()) for i, day in keys]
        frame[f"peak_d{d}"] = peaks.reindex(keys).to_numpy()
        frame[f"censored_d{d}"] = censored.reindex(keys).fillna(False).to_numpy().astype(bool)
        hazy = np.where(frame[f"peak_d{d}"] > HAZY_UGM3, HAZY_WEIGHT, 1.0)
        clean_censored = frame[f"censored_d{d}"] & (frame[f"peak_d{d}"] <= CENSOR_UGM3)
        frame[f"weight_d{d}"] = np.where(clean_censored, 0.0, frame["reference_weight"] * hazy)
    return frame


def build_rows(data: SourceData, region: Region, issue_times: pd.DatetimeIndex, with_targets: bool) -> tuple[pd.DataFrame, dict]:
    table = instruments(data)
    series, decisions = assemble_truth(data, table)
    air = air_features(series, table, issue_times)
    fires = fire_features(data, table, issue_times)
    weather = weather_features(data, table, region, fires, issue_times)
    physics = physics_features(data, issue_times)
    frame = air.join(fires, how="inner").join(weather, how="left").join(physics, how="left")
    frame["has_physics"] = frame["has_physics"].fillna(0).astype(int)
    calendar = calendar_features(issue_times)
    frame = frame.join(calendar, on="issue_at")
    kinds = table.set_index("instrument_id")["kind"]
    frame["kind"] = pd.Categorical(kinds.reindex(frame.index.get_level_values("instrument_id")).to_numpy(), categories=list(KIND_WEIGHT))
    # LightGBM reads the integer twin; the category order is fixed by KIND_WEIGHT so codes are stable across runs.
    frame["kind_code"] = frame["kind"].cat.codes.astype(int)
    frame["reference_weight"] = _reference_weight(table, decisions["sensors"]).reindex(frame.index.get_level_values("instrument_id")).to_numpy()
    if with_targets:
        frame = _targets(series, frame)
    return frame.sort_index(), decisions


def write_parquet(frame: pd.DataFrame, directory: pathlib.Path, start: str, end: str) -> pathlib.Path:
    digest = hashlib.sha1(f"{sorted(frame.columns)}:{len(frame)}".encode()).hexdigest()[:8]
    directory.mkdir(parents=True, exist_ok=True)
    path = directory / f"features-{start}-{end}-{digest}.parquet"
    frame.reset_index().to_parquet(path, index=False)
    return path
```

- [ ] **Step 4: Run the tests**

Run: `cd model && .venv/bin/pytest -q tests/test_build.py && .venv/bin/ruff check .`
Expected: `4 passed`

- [ ] **Step 5: Commit**

```bash
git add model/src/hazemodel/truth/assemble.py model/src/hazemodel/features/build.py model/tests/test_build.py
git commit -m "Assemble truth, join the feature groups, add targets and weights, write parquet

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

### Task 10: Artifacts: the live pointer and loading a model

**Files:**
- Create: `model/src/hazemodel/artifacts.py`, `model/tests/test_artifacts.py`

**Interfaces:**
- Produces: `Artifact` dataclass `{version: str, trained_at: datetime, features: list[str], boosters: dict[str, lightgbm.Booster]}` where the booster keys are `d1_q10, d1_q50, d1_q90, d2_q10, d2_q50, d2_q90`; `save_artifact(directory, artifact)` writes `<directory>/<version>/meta.json` and one `<key>.txt` per booster; `load_artifact(directory, version) -> Artifact`; `live_version(directory) -> str | None` reads `<directory>/live`; `set_live(directory, version)`; `artifacts_dir() -> pathlib.Path` from `MODEL_ARTIFACTS` (default `model/artifacts` relative to the package root). Track D's `train.py` produces `Artifact`s and `promote.py` calls `set_live`.

- [ ] **Step 1: Write the failing test**

```python
# model/tests/test_artifacts.py
import datetime as dt

import lightgbm as lgb
import numpy as np

from hazemodel.artifacts import Artifact, live_version, load_artifact, save_artifact, set_live

KEYS = ["d1_q10", "d1_q50", "d1_q90", "d2_q10", "d2_q50", "d2_q90"]


def tiny_artifact() -> Artifact:
    x = np.arange(40, dtype=float).reshape(20, 2)
    y = x[:, 0] * 2
    boosters = {key: lgb.train({"objective": "quantile", "alpha": 0.5, "verbose": -1, "min_data_in_leaf": 1}, lgb.Dataset(x, y), 5) for key in KEYS}
    return Artifact(version="2026-10-10-test0001", trained_at=dt.datetime(2026, 10, 10, tzinfo=dt.timezone.utc), features=["a", "b"], boosters=boosters)


def test_save_load_and_live_pointer(tmp_path):
    artifact = tiny_artifact()
    save_artifact(tmp_path, artifact)
    assert live_version(tmp_path) is None
    set_live(tmp_path, artifact.version)
    assert live_version(tmp_path) == artifact.version
    back = load_artifact(tmp_path, artifact.version)
    assert back.features == ["a", "b"]
    assert set(back.boosters) == set(KEYS)
    assert back.trained_at == artifact.trained_at
    x = np.array([[3.0, 0.0]])
    assert abs(back.boosters["d1_q50"].predict(x)[0] - artifact.boosters["d1_q50"].predict(x)[0]) < 1e-9
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd model && .venv/bin/pytest -q tests/test_artifacts.py`
Expected: FAIL, module not found

- [ ] **Step 3: Write artifacts.py**

```python
# model/src/hazemodel/artifacts.py
"""A trained model on disk: one folder per version, and a `live` file naming the one that serves."""
import datetime as dt
import json
import os
import pathlib
from dataclasses import dataclass

import lightgbm as lgb

KEYS = ["d1_q10", "d1_q50", "d1_q90", "d2_q10", "d2_q50", "d2_q90"]


@dataclass
class Artifact:
    version: str
    trained_at: dt.datetime
    features: list[str]
    boosters: dict[str, lgb.Booster]


def artifacts_dir() -> pathlib.Path:
    default = pathlib.Path(__file__).resolve().parents[2] / "artifacts"
    return pathlib.Path(os.environ.get("MODEL_ARTIFACTS", default))


def save_artifact(directory: pathlib.Path, artifact: Artifact) -> pathlib.Path:
    folder = directory / artifact.version
    folder.mkdir(parents=True, exist_ok=True)
    (folder / "meta.json").write_text(
        json.dumps({"version": artifact.version, "trained_at": artifact.trained_at.isoformat(), "features": artifact.features}, indent=2)
    )
    for key, booster in artifact.boosters.items():
        booster.save_model(str(folder / f"{key}.txt"))
    return folder


def load_artifact(directory: pathlib.Path, version: str) -> Artifact:
    folder = directory / version
    meta = json.loads((folder / "meta.json").read_text())
    boosters = {key: lgb.Booster(model_file=str(folder / f"{key}.txt")) for key in KEYS if (folder / f"{key}.txt").exists()}
    return Artifact(version=meta["version"], trained_at=dt.datetime.fromisoformat(meta["trained_at"]), features=meta["features"], boosters=boosters)


def live_version(directory: pathlib.Path) -> str | None:
    pointer = directory / "live"
    if not pointer.exists():
        return None
    version = pointer.read_text().strip()
    return version or None


def set_live(directory: pathlib.Path, version: str) -> None:
    directory.mkdir(parents=True, exist_ok=True)
    (directory / "live").write_text(version + "\n")
```

- [ ] **Step 4: Run the test**

Run: `cd model && .venv/bin/pytest -q tests/test_artifacts.py && .venv/bin/ruff check .`
Expected: `1 passed`

- [ ] **Step 5: Commit**

```bash
git add model/src/hazemodel/artifacts.py model/tests/test_artifacts.py
git commit -m "Store model artifacts by version with a live pointer

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

### Task 11: The service, the CLI, the Dockerfile

**Files:**
- Create: `model/src/hazemodel/predict.py`, `model/src/hazemodel/serve.py`, `model/src/hazemodel/cli.py`, `model/Dockerfile`, `model/tests/test_serve.py`

**Interfaces:**
- Consumes: `build_rows` (Task 9), `Artifact`, `load_artifact`, `live_version`, `artifacts_dir` (Task 10), `load_source_data` (Task 4), `region_from_env` (Task 2), `pm25_to_api` is not used here (the backend converts).
- Produces:
  - `predict_rows(artifact, frame) -> pd.DataFrame` with columns `instrument_id, day, p10, p50, p90` for days +1 and +2 (direct models) and +3 by recursion: the day +1 median is written into `level`, lags shift (`lag24 <- level`, `lag48 <- lag24`, `lag72 <- lag48`), `d24`/`d48` recomputed, and the `d1` boosters run again for day +3 and, when the artifact has no `d2_*` boosters, for day +2 as well. Quantiles sorted per row. `day` is the Malaysian date of issue + d.
  - `create_app() -> FastAPI` with `GET /health` and `POST /predict` exactly as the shared contract: health `{"status":"ok","modelVersion":str|null,"trainedAt":iso|null}`; predict body `{"asOf": iso}` answers `{"modelVersion", "asOf", "forecasts":[{"instrumentId","day","p10","p50","p90"}]}` or 503 `{"error":"no live model"}`. The app loads the live artifact at start and re-reads the `live` pointer on every `/predict` so a promotion needs no restart. It loads source data for `(asOf - 8 days, asOf + 48 h]` with `hindcast_model` from env `HINDCAST_MODEL` (default `v2-analysis`).
  - `cli.main()` with subcommands `features`, `serve`; track D adds `backtest`, `train`, `scenarios`, `ablation`, `promote`, `retrain` to the same parser (document the pattern: one function `add_<name>(subparsers)` per command in its own module, registered in `cli.py`).

- [ ] **Step 1: Write the failing tests**

```python
# model/tests/test_serve.py
import datetime as dt

import lightgbm as lgb
import numpy as np
import pandas as pd
import pytest
from fastapi.testclient import TestClient

from hazemodel.artifacts import Artifact, save_artifact, set_live
from hazemodel.features.build import build_rows
from hazemodel.predict import predict_rows
from hazemodel.region import region_from_env
from hazemodel.serve import create_app
from hazemodel.store import SourceData

ISSUE = pd.Timestamp("2026-10-08T00:00:00Z")


def fit_on_fixture(data: SourceData) -> Artifact:
    frame, _ = build_rows(data, region_from_env(), pd.DatetimeIndex([ISSUE - pd.Timedelta(days=1), ISSUE]), with_targets=True)
    features = [c for c in frame.columns if c not in {"kind", "reference_weight"} and not c.startswith(("peak_", "weight_", "censored_")) and not c.startswith("fire_s")]
    boosters = {}
    for d in (1, 2):
        rows = frame.dropna(subset=[f"peak_d{d}"])
        x, y = rows[features].to_numpy(dtype=float), rows[f"peak_d{d}"].to_numpy()
        for q in (10, 50, 90):
            params = {"objective": "quantile", "alpha": q / 100, "verbose": -1, "min_data_in_leaf": 2, "num_leaves": 4}
            boosters[f"d{d}_q{q}"] = lgb.train(params, lgb.Dataset(x, y), 10)
    return Artifact(version="2026-10-10-fixture1", trained_at=dt.datetime(2026, 10, 10, tzinfo=dt.timezone.utc), features=features, boosters=boosters)


def test_predict_rows_gives_three_days_with_sorted_quantiles(data):
    artifact = fit_on_fixture(data)
    frame, _ = build_rows(data, region_from_env(), pd.DatetimeIndex([ISSUE]), with_targets=False)
    out = predict_rows(artifact, frame)
    assert set(out.columns) == {"instrument_id", "day", "p10", "p50", "p90"}
    assert sorted(out["day"].unique()) == [dt.date(2026, 10, 9), dt.date(2026, 10, 10), dt.date(2026, 10, 11)]
    assert (out["p10"] <= out["p50"]).all() and (out["p50"] <= out["p90"]).all()
    assert len(out) == 3 * frame.index.get_level_values("instrument_id").nunique()


@pytest.fixture
def app_env(tmp_path, monkeypatch, data):
    monkeypatch.setenv("MODEL_ARTIFACTS", str(tmp_path))
    monkeypatch.setenv("MODEL_SOURCE_CSV", str(__import__("pathlib").Path(__file__).parent / "fixtures"))
    return tmp_path


def test_predict_without_artifact_is_503(app_env):
    client = TestClient(create_app())
    assert client.get("/health").json() == {"status": "ok", "modelVersion": None, "trainedAt": None}
    answer = client.post("/predict", json={"asOf": ISSUE.isoformat()})
    assert answer.status_code == 503
    assert answer.json() == {"error": "no live model"}


def test_predict_with_live_artifact(app_env, data):
    artifact = fit_on_fixture(data)
    save_artifact(app_env, artifact)
    set_live(app_env, artifact.version)
    client = TestClient(create_app())
    health = client.get("/health").json()
    assert health["modelVersion"] == artifact.version
    answer = client.post("/predict", json={"asOf": ISSUE.isoformat()})
    assert answer.status_code == 200
    body = answer.json()
    assert body["modelVersion"] == artifact.version
    first = body["forecasts"][0]
    assert set(first) == {"instrumentId", "day", "p10", "p50", "p90"}
    assert first["day"] == "2026-10-09"
    assert np.isfinite(first["p50"])
```

`MODEL_SOURCE_CSV` is a test-only switch: when set, `serve.py` loads source data from that CSV directory instead of Postgres, which keeps the rule that no test reaches the database.

- [ ] **Step 2: Run them to verify they fail**

Run: `cd model && .venv/bin/pytest -q tests/test_serve.py`
Expected: FAIL, modules not found

- [ ] **Step 3: Write predict.py, serve.py, cli.py, Dockerfile**

```python
# model/src/hazemodel/predict.py
"""Run an artifact over feature rows: day +1 and +2 directly, day +3 (and +2 without a direct model) by recursion."""
import numpy as np
import pandas as pd

from hazemodel.artifacts import Artifact
from hazemodel.region import MALAYSIA_OFFSET

QUANTILES = (10, 50, 90)


def _quantiles(artifact: Artifact, prefix: str, x: np.ndarray) -> np.ndarray:
    out = np.column_stack([artifact.boosters[f"{prefix}_q{q}"].predict(x) for q in QUANTILES])
    return np.sort(np.maximum(out, 0.0), axis=1)


def _rolled(frame: pd.DataFrame, median: np.ndarray) -> pd.DataFrame:
    rolled = frame.copy()
    rolled["lag72"] = rolled["lag48"]
    rolled["lag48"] = rolled["lag24"]
    rolled["lag24"] = rolled["level"]
    rolled["level"] = median
    rolled["d24"] = rolled["level"] - rolled["lag24"]
    rolled["d48"] = rolled["level"] - rolled["lag48"]
    rolled["slope3h"] = rolled["d24"] / 24.0
    return rolled


def predict_rows(artifact: Artifact, frame: pd.DataFrame) -> pd.DataFrame:
    features = artifact.features
    ids = frame.index.get_level_values("instrument_id")
    issue_days = (frame.index.get_level_values("issue_at") + MALAYSIA_OFFSET).date
    current = frame
    rows = []
    for d in (1, 2, 3):
        direct = f"d{d}_q50" in artifact.boosters
        x = current[features].to_numpy(dtype=float)
        q = _quantiles(artifact, f"d{d}" if direct else "d1", x)
        rows.append(pd.DataFrame({"instrument_id": ids, "day": [day + pd.Timedelta(days=d) for day in issue_days], "p10": q[:, 0], "p50": q[:, 1], "p90": q[:, 2]}))
        current = _rolled(current, q[:, 1])
    out = pd.concat(rows, ignore_index=True)
    out["day"] = pd.to_datetime(out["day"]).dt.date
    return out
```

```python
# model/src/hazemodel/serve.py
"""The forecast service: /health and /predict for the jobs process. Features are computed here and nowhere else."""
import os
import pathlib

import pandas as pd
from fastapi import FastAPI
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from hazemodel.artifacts import artifacts_dir, live_version, load_artifact
from hazemodel.features.build import build_rows
from hazemodel.predict import predict_rows
from hazemodel.region import region_from_env
from hazemodel.store import connect, load_source_data, load_source_data_from_csv

LOOKBACK_DAYS = 8
LOOKAHEAD_HOURS = 48


class PredictBody(BaseModel):
    asOf: str


def _source(as_of: pd.Timestamp):
    csv = os.environ.get("MODEL_SOURCE_CSV")
    if csv:
        return load_source_data_from_csv(pathlib.Path(csv))
    with connect() as conn:
        return load_source_data(conn, as_of - pd.Timedelta(days=LOOKBACK_DAYS), as_of + pd.Timedelta(hours=LOOKAHEAD_HOURS), os.environ.get("HINDCAST_MODEL", "v2-analysis"))


def create_app() -> FastAPI:
    app = FastAPI(title="haze-model")
    directory = artifacts_dir()
    region = region_from_env()

    def live():
        version = live_version(directory)
        return load_artifact(directory, version) if version else None

    @app.get("/health")
    def health():
        artifact = live()
        return {"status": "ok", "modelVersion": artifact.version if artifact else None, "trainedAt": artifact.trained_at.isoformat() if artifact else None}

    @app.post("/predict")
    def predict(body: PredictBody):
        artifact = live()
        if artifact is None:
            return JSONResponse(status_code=503, content={"error": "no live model"})
        as_of = pd.Timestamp(body.asOf).tz_convert("UTC") if pd.Timestamp(body.asOf).tzinfo else pd.Timestamp(body.asOf).tz_localize("UTC")
        frame, _ = build_rows(_source(as_of), region, pd.DatetimeIndex([as_of]), with_targets=False)
        out = predict_rows(artifact, frame)
        forecasts = [
            {"instrumentId": row.instrument_id, "day": row.day.isoformat(), "p10": float(row.p10), "p50": float(row.p50), "p90": float(row.p90)}
            for row in out.itertuples()
        ]
        return {"modelVersion": artifact.version, "asOf": as_of.isoformat(), "forecasts": forecasts}

    return app
```

```python
# model/src/hazemodel/cli.py
"""The command line: one subcommand per job, each registered by its own module's add_<name>."""
import argparse
import pathlib

import pandas as pd
import uvicorn

from hazemodel.features.build import build_rows, write_parquet
from hazemodel.region import region_from_env
from hazemodel.store import connect, load_source_data


def features_command(args) -> None:
    start, end = pd.Timestamp(args.start, tz="UTC"), pd.Timestamp(args.end, tz="UTC")
    issue_times = pd.date_range(start, end, freq="D", tz="UTC")
    with connect() as conn:
        data = load_source_data(conn, start - pd.Timedelta(days=8), end + pd.Timedelta(days=3), args.hindcast_model)
    frame, decisions = build_rows(data, region_from_env(), issue_times, with_targets=True)
    path = write_parquet(frame, pathlib.Path(args.out), args.start, args.end)
    for name, table in decisions.items():
        table.to_csv(path.with_name(path.stem + f"-{name}.csv"), index=False)
    print(f"{len(frame)} rows, {len(frame.columns)} columns -> {path}")


def serve_command(args) -> None:
    uvicorn.run("hazemodel.serve:create_app", factory=True, host=args.host, port=args.port, log_level="info")


def add_features(subparsers) -> None:
    parser = subparsers.add_parser("features", help="build the training rows into parquet")
    parser.add_argument("--from", dest="start", required=True)
    parser.add_argument("--to", dest="end", required=True)
    parser.add_argument("--hindcast-model", default="v2-analysis")
    parser.add_argument("--out", default=str(pathlib.Path(__file__).resolve().parents[2] / "data"))
    parser.set_defaults(run=features_command)


def add_serve(subparsers) -> None:
    parser = subparsers.add_parser("serve", help="serve /health and /predict")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=4002)
    parser.set_defaults(run=serve_command)


def main() -> None:
    parser = argparse.ArgumentParser(prog="hazemodel")
    subparsers = parser.add_subparsers(required=True)
    add_features(subparsers)
    add_serve(subparsers)
    args = parser.parse_args()
    args.run(args)
```

```dockerfile
# model/Dockerfile
# The model service, as the `model` service of the compose stack. Built from this directory.
FROM python:3.12-slim

RUN apt-get update && apt-get install -y --no-install-recommends curl libgomp1 && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY pyproject.toml ./
COPY src ./src
RUN pip install --no-cache-dir .

RUN useradd --create-home --uid 10002 hazemodel && mkdir -p /app/artifacts && chown hazemodel /app/artifacts
USER hazemodel

ENV MODEL_ARTIFACTS=/app/artifacts \
    PYTHONUNBUFFERED=1

EXPOSE 4002

HEALTHCHECK --interval=10s --timeout=3s --start-period=15s --retries=6 \
    CMD curl -fsS --max-time 2 http://127.0.0.1:4002/health >/dev/null || exit 1

CMD ["hazemodel", "serve", "--host", "0.0.0.0", "--port", "4002"]
```

`libgomp1` is LightGBM's OpenMP runtime; without it the import fails inside slim images.

- [ ] **Step 4: Run the tests and a real feature build**

Run: `cd model && .venv/bin/pip install -q -e ".[dev]" && .venv/bin/pytest -q && .venv/bin/ruff check .`
Expected: all tests pass.

Then one real build against the compose database, which is the first time the builder meets 16 months of data:

Run: `cd model && PG_HOST=127.0.0.1 PG_PORT=5433 PG_DATABASE=postgres PG_USER=postgres PG_PASSWORD=<from backend/.env> time .venv/bin/hazemodel features --from 2025-06-07 --to 2026-10-08`
Expected: a line like `N rows, 115 columns -> model/data/features-2025-06-07-2026-10-08-xxxxxxxx.parquet` with N in the tens of thousands, plus the two decisions CSVs. If it takes over 30 minutes, profile `fire_features` first: the `_bins` matrix is instruments by cells per window and must be computed once per issue time, not once per instrument.

Then the Docker build: `docker build -t haze-model model` must succeed.

- [ ] **Step 5: Commit**

```bash
git add model/src/hazemodel/predict.py model/src/hazemodel/serve.py model/src/hazemodel/cli.py model/Dockerfile model/tests/test_serve.py
git commit -m "Serve /health and /predict from the live artifact, with the features CLI

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

### Task 12: Document the package in the repo docs

**Files:**
- Modify: `CLAUDE.md` (the packages list and the commands block), `README.md` (setup and ports), `docs/FEATURES.md` (a short section 3.5 pointing to `docs/MODEL.md`)
- Create: `docs/MODEL.md` with sections 1 to 5 of the method (target, features, truth, training, tests) copied from the spec and reworded as the model's own document, plus an empty "Results" section headed "Filled by track D from model/reports/".

- [ ] **Step 1: Write the docs**

In `CLAUDE.md`, under "Three independent packages" change to four and add:

```
- `model/` Python. The learned forecast: truth, features, training, backtest and the `/predict`
  service, run as the `model` container. Method and results in `docs/MODEL.md`.
```

and in the commands block:

```bash
# model, inside model/
python3 -m venv .venv && .venv/bin/pip install -e ".[dev]"
.venv/bin/pytest -q && .venv/bin/ruff check .
.venv/bin/hazemodel features --from 2025-06-07 --to 2026-10-08   # training rows to model/data/
.venv/bin/hazemodel serve                                         # :4002
```

In `README.md` add the port 4002 and the `model` service where the others are listed. In `docs/FEATURES.md` add after 3.4:

```
### 3.5 The learned forecast

A LightGBM model trained on the history of 3.4 predicts each instrument's peak 24 hour PM2.5 for
the next two days. Its method, tests and results are in `docs/MODEL.md`; its code is `model/`;
it reaches the app through `backend/src/sources/model.ts` and the `model_forecasts` table, and
shows nothing to a person until the shadow rule in `docs/MODEL.md` is met.
```

Write `docs/MODEL.md` from spec sections 3 to 7 in the voice of `docs/FORECAST.md`, with a Results section left as the single line above.

- [ ] **Step 2: Check the links and the line rule**

Run: `cd /root/ai/dorm/haze-app && grep -n "docs/MODEL.md" CLAUDE.md docs/FEATURES.md && wc -l docs/MODEL.md && grep -cP "\x{2014}" docs/MODEL.md`
Expected: both references found, and the em dash count is 0.

- [ ] **Step 3: Commit**

```bash
git add CLAUDE.md README.md docs/FEATURES.md docs/MODEL.md
git commit -m "Document the model package and start the model's own document

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```
