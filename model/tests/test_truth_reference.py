import pandas as pd

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
    assert rows["observed_at"].min() >= hours["observed_at"].min() + pd.Timedelta(hours=17)


def test_daily_peaks_are_per_malaysian_day(data):
    peaks = daily_peaks(reference_series(data))
    assert {"instrument_id", "day", "peak"} <= set(peaks.columns)
    one = peaks[peaks["instrument_id"] == "SGCENTRAL"].sort_values("day")
    assert len(one) >= 6
    assert (one["peak"] > 0).all()
