"""Every SQL read the package makes, and the same frames from CSV for tests and offline runs. Read-only."""

import os
import pathlib
from dataclasses import dataclass

import numpy as np
import pandas as pd
import psycopg

TIME_COLUMNS = {"observed_at", "valid_at", "as_of"}
# The air features need lags to 72 h plus a 24 h mean, and the fires need 7 days, so 8 days cover both.
LOOKBACK_DAYS = 8


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


def read_frame(conn, sql: str, params: tuple = ()) -> pd.DataFrame:
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
    first_day = (start - pd.Timedelta(days=LOOKBACK_DAYS)).date()
    return SourceData(
        stations=read_frame(conn, "select id, name, lat, lon, network from stations order by id", ()),
        sensors=read_frame(
            conn, "select sensor_id, name, provider, reference, lat, lon from openaq_sensors order by sensor_id", ()
        ),
        airports=read_frame(conn, "select icao, name, lat, lon from airports order by icao", ()),
        readings=read_frame(
            conn, "select station_id, observed_at, api from readings where observed_at >= %s and observed_at < %s", span
        ),
        nea_hours=read_frame(
            conn,
            "select region, observed_at, pm25_hourly, pm25_24h, psi_24h from nea_hours where observed_at >= %s and observed_at < %s",
            span,
        ),
        openaq_hours=read_frame(
            conn,
            "select sensor_id, observed_at, pm25 from openaq_hours where observed_at >= %s and observed_at < %s",
            span,
        ),
        metar_obs=read_frame(
            conn,
            "select icao, observed_at, visibility_m, weather from metar_obs where observed_at >= %s and observed_at < %s",
            span,
        ),
        fire_cells=read_frame(
            conn,
            "select day, lat10, lon10, frp_mw, burning_mw from fire_cells where day >= %s and day < %s",
            (first_day, end.date()),
        ),
        weather_hours=read_frame(
            conn, "select valid_at, u_ms, v_ms, rain_mm from weather_hours where valid_at >= %s and valid_at < %s", span
        ),
        smoke_hindcasts=read_frame(
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
