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
