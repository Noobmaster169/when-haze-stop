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
