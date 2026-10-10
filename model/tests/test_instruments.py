import numpy as np

from hazemodel.instruments import bearing_deg, distance_km, instruments


def test_instruments_union_and_ids(data):
    table = instruments(data)
    assert set(table["kind"]) == {"doe", "nea", "openaq", "airport"}
    assert table["instrument_id"].is_unique
    assert all(table[table["kind"] == "openaq"]["instrument_id"].str.startswith("openaq:"))
    nea_ids = set(table[table["kind"] == "nea"]["instrument_id"])
    assert nea_ids == {"SGCENTRAL", "SGEAST", "SGNORTH", "SGSOUTH", "SGWEST"}
    assert "WMKK" in set(table["instrument_id"])
    assert table[table["kind"].isin(["doe", "nea"])]["reference"].all()


def test_distance_and_bearing():
    # Kuala Lumpur to Singapore: about 309 km between these coordinates, bearing about 130 degrees.
    assert abs(distance_km(3.14, 101.69, 1.35, 103.82) - 309) < 5
    assert abs(bearing_deg(3.14, 101.69, 1.35, 103.82) - 130) < 3
    assert bearing_deg(0, 100, 1, 100) == 0
    assert abs(bearing_deg(0, 100, 0, 101) - 90) < 1e-6
    out = distance_km(np.array([0.0, 0.0]), np.array([100.0, 100.0]), 0.0, 101.0)
    assert out.shape == (2,)
