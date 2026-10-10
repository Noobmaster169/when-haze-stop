import numpy as np
import pandas as pd

from hazemodel.store import SourceData, load_source_data, read_frame


def test_csv_fixtures_load_with_utc_timestamps(data: SourceData):
    assert data.readings["observed_at"].dt.tz is not None
    assert str(data.readings["observed_at"].dt.tz) == "UTC"
    assert data.weather_hours["u_ms"].iloc[0].shape == (375,)
    assert pd.api.types.is_datetime64_any_dtype(data.fire_cells["day"])
    assert set(data.stations["network"]) == {"doe", "nea"}
    assert len(data.airports) == 5


def test_store_has_no_writes():
    import pathlib

    import hazemodel

    for path in pathlib.Path(hazemodel.__file__).parent.rglob("*.py"):
        text = path.read_text().lower()
        for word in ("insert ", "update ", "delete ", "truncate ", "drop "):
            assert word not in text, f"{word!r} in {path.name}"


def test_every_timestamp_column_is_utc(data: SourceData):
    for name in ("readings", "nea_hours", "openaq_hours", "metar_obs", "weather_hours", "smoke_hindcasts"):
        frame = getattr(data, name)
        columns = [c for c in frame.columns if c in {"observed_at", "valid_at", "as_of"}]
        assert columns, name
        for column in columns:
            assert str(frame[column].dtype) == "datetime64[ns, UTC]", (name, column)


def test_empty_hindcasts_keep_columns_and_dtype(data: SourceData):
    frame = data.smoke_hindcasts
    assert len(frame) == 0
    assert list(frame.columns) == ["as_of", "instrument_id", "smoke_now", "smoke_24h", "smoke_48h", "model"]
    assert str(frame["as_of"].dtype) == "datetime64[ns, UTC]"


def test_fire_day_is_naive_midnight(data: SourceData):
    day = data.fire_cells["day"]
    assert day.dt.tz is None
    assert (day == day.dt.normalize()).all()


class FakeCursor:
    """Records the sql and params and returns one canned row shaped by the table named in the sql."""

    def __init__(self, log: list):
        self.log = log
        self.description: list = []
        self.rows: list = []

    def __enter__(self):
        return self

    def __exit__(self, *exc):
        return False

    def execute(self, sql, params):
        self.log.append((sql, params))
        if "weather_hours" in sql:
            names = ("valid_at", "u_ms", "v_ms", "rain_mm")
            self.rows = [(pd.Timestamp("2026-10-03T00:00:00Z"), [1.0, 2.0], [3.0, 4.0], [0.0, 0.5])]
        else:
            names = ("x",)
            self.rows = [(1,)]
        self.description = [type("Col", (), {"name": n})() for n in names]

    def fetchall(self):
        return self.rows


class FakeConn:
    def __init__(self):
        self.log: list = []

    def cursor(self):
        return FakeCursor(self.log)


def test_read_frame_converts_arrays_to_float32():
    conn = FakeConn()
    sql = "select valid_at, u_ms, v_ms, rain_mm from weather_hours"
    frame = read_frame(conn, sql)
    assert conn.log == [(sql, ())]
    assert frame["u_ms"].iloc[0].dtype == np.float32
    assert frame["rain_mm"].iloc[0].tolist() == [0.0, 0.5]
    assert str(frame["valid_at"].dtype) == "datetime64[ns, UTC]"


def test_load_source_data_passes_span_and_hindcast_model():
    conn = FakeConn()
    start, end = pd.Timestamp("2026-10-03T00:00:00Z"), pd.Timestamp("2026-10-10T00:00:00Z")
    load_source_data(conn, start, end, None)
    by_table = {sql.split(" from ")[1].split()[0]: params for sql, params in conn.log}
    span = (start.to_pydatetime(), end.to_pydatetime())
    assert by_table["readings"] == span
    assert by_table["smoke_hindcasts"] == ("", *span)
    assert by_table["stations"] == ()
    assert str(by_table["fire_cells"][0]) == "2026-09-25"
    assert str(by_table["fire_cells"][1]) == "2026-10-10"
    load_source_data(conn, start, end, "m1")
    assert conn.log[-1][1][0] == "m1"
