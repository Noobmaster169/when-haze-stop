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
