from hazemodel.instruments import instruments
from hazemodel.truth.reference import reference_series
from hazemodel.truth.visibility import (
    CAP_M,
    CENSOR_UGM3,
    KOSCHMIEDER,
    MIN_REPORTS_IN_MEAN,
    MIN_VISIBILITY_M,
    airport_series,
    extinction,
    is_dry,
)


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


def test_a_proxy_hour_never_precedes_the_report_that_fed_it(data):
    series = reference_series(data)
    table = instruments(data)
    proxy, _ = airport_series(data, series, table)
    icao = "WMKK"
    reports = data.metar_obs[data.metar_obs["icao"] == icao]
    usable = reports["visibility_m"].notna() & (reports["visibility_m"] >= MIN_VISIBILITY_M)
    dry = reports[usable & reports["weather"].map(is_dry)].sort_values("observed_at")
    first = proxy[proxy["instrument_id"] == icao]["observed_at"].min()
    # The first 24 h mean needs MIN_REPORTS_IN_MEAN dry reports, so it cannot be stamped before the 12th one.
    assert first >= dry["observed_at"].iloc[MIN_REPORTS_IN_MEAN - 1]


def test_visibility_censors_at_cap(data):
    series = reference_series(data)
    table = instruments(data)
    icao = "WMSA"
    reports = data.metar_obs[data.metar_obs["icao"] == icao].sort_values("observed_at")
    # Test vector, not data: the last 40 reports are set to the cap so the 24 h windows
    # that lie wholly inside the block are censored.
    block_start = reports["observed_at"].iloc[-40]
    edited = data.metar_obs.copy()
    in_block = (edited["icao"] == icao) & (edited["observed_at"] >= block_start)
    edited.loc[in_block, "visibility_m"] = CAP_M
    edited.loc[in_block, "weather"] = None
    data_capped = type(data)(**{**data.__dict__, "metar_obs": edited})
    # Lift the reference by 30 so the fitted line puts a capped hour well above the clamp.
    lifted = series.copy()
    reference_id = decisions_reference(data, series, table, icao)
    lifted.loc[lifted["instrument_id"] == reference_id, "pm25_24h"] += 30.0
    proxy, decisions = airport_series(data_capped, lifted, table)
    mine = proxy[proxy["instrument_id"] == icao]
    fit = decisions.set_index("instrument_id").loc[icao]
    unclamped_cap = fit["intercept"] + fit["slope"] * extinction(CAP_M)
    assert unclamped_cap > CENSOR_UGM3  # the clamp has something to do
    censored = mine[mine["censored"]]
    assert len(censored) > 0
    assert (censored["observed_at"] >= block_start).all()
    assert not mine[mine["observed_at"] < block_start]["censored"].any()
    assert (censored["pm25_24h"] <= CENSOR_UGM3 + 1e-6).all()
    free = mine[~mine["censored"]]
    assert (free["pm25_24h"] > CENSOR_UGM3).any()


def decisions_reference(data, series, table, icao):
    _, decisions = airport_series(data, series, table)
    return decisions.set_index("instrument_id").loc[icao, "reference_id"]
