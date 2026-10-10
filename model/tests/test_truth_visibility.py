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
