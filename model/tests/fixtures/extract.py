"""Extract the test fixtures from a database that holds the week of 3 to 10 October 2026.

Run from model/ with the PG_* env of the compose postgres:
    PG_HOST=127.0.0.1 PG_PORT=5433 PG_DATABASE=postgres PG_USER=postgres PG_PASSWORD=postgres \
      .venv/bin/python tests/fixtures/extract.py
lat10 and lon10 are tenths of a degree. Every row written is a real stored value. Rerun only to refresh; commit the result.
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
    "fire_cells": "select day, lat10, lon10, frp_mw, burning_mw from fire_cells where day >= '2026-09-25' and day < '2026-10-11' "
    "and lat10 between 0 and 30 and lon10 between 1000 and 1040 order by 1, 2, 3",
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
