import numpy as np
import pandas as pd

from hazemodel.features.air import HISTORY_DAYS, air_features
from hazemodel.features.calendar import calendar_features
from hazemodel.features.fires import fire_features, sector_of
from hazemodel.features.physics import physics_features
from hazemodel.features.weather import weather_features
from hazemodel.instruments import distance_km, instruments
from hazemodel.region import region_from_env
from hazemodel.truth.reference import reference_series

ISSUES = pd.DatetimeIndex([pd.Timestamp("2026-10-08T00:00:00Z"), pd.Timestamp("2026-10-09T00:00:00Z")])


def test_air_features_are_leak_free_and_complete(data):
    series = reference_series(data)
    table = instruments(data)
    air = air_features(series, table, ISSUES)
    assert air.index.names == ["instrument_id", "issue_at"]
    row = air.loc[("SGCENTRAL", ISSUES[1])]
    stored = series[(series["instrument_id"] == "SGCENTRAL") & (series["observed_at"] <= ISSUES[1])]
    assert abs(row["level"] - stored["pm25_24h"].iloc[-1]) < 1e-6
    assert abs(row["d24"] - (row["level"] - row["lag24"])) < 1e-6
    assert 0 <= row["peak_hour"] <= 23
    window = series[
        (series["instrument_id"] == "SGCENTRAL")
        & (series["observed_at"] < ISSUES[1])
        & (series["observed_at"] >= ISSUES[1] - pd.Timedelta(days=HISTORY_DAYS))
    ]
    assert abs(row["hist_mean"] - window["pm25_24h"].mean()) < 1e-6
    cut = series[series["observed_at"] <= ISSUES[-1]]
    pd.testing.assert_frame_equal(air, air_features(cut, table, ISSUES))


def test_sector_boundary_is_kept():
    assert sector_of(np.array([0.0, 44.99, 45.0, 359.9])).tolist() == [0, 0, 1, 7]


def test_fire_features_sum_only_complete_days_before_issue(data):
    table = instruments(data)
    fires = fire_features(data, table, ISSUES)
    columns = [c for c in fires.columns if c.startswith("fire_s")]
    assert len(columns) == 72
    kl = fires.loc[("WMKK", ISSUES[1])]
    # The fixture's cells (2.5 N and below, 100 to 104 E) lie south-east to south-west of KL, sectors 2 to 4.
    south = sum(kl[f"fire_s{s}_r{r}_d7"] for s in (2, 3, 4) for r in (0, 1))
    assert south > 0
    assert kl["fire_total_d3"] >= 0
    assert 0 <= kl["fire_heaviest_bearing"] < 360
    day_of_issue = data.fire_cells[data.fire_cells["day"] == pd.Timestamp("2026-10-09")]
    assert len(day_of_issue) > 0, "the fixture has fires on the issue day, which must not be counted"
    previous_day = data.fire_cells[data.fire_cells["day"] == pd.Timestamp("2026-10-08")]
    assert sum(kl[f"fire_s{s}_r0_d1"] for s in (2, 3, 4)) <= previous_day["frp_mw"].sum() + 1e-6


def test_weather_features_tolerate_missing_hours(data):
    table = instruments(data)
    region = region_from_env()
    fires = fire_features(data, table, ISSUES)
    cut = data.weather_hours[data.weather_hours["valid_at"] <= ISSUES[1] + pd.Timedelta(hours=30)]
    data_cut = type(data)(**{**data.__dict__, "weather_hours": cut})
    weather = weather_features(data_cut, table, region, fires, ISSUES)
    row = weather.loc[("WMKK", ISSUES[1])]
    assert row["hours_present"] == 30
    assert np.isfinite(row["u48"])
    assert 0 <= row["steady24"] <= 1 + 1e-6
    assert row["rain48"] >= 0
    assert row["from_forecast"] == 0


def test_calendar_features():
    cal = calendar_features(ISSUES)
    assert cal.loc[ISSUES[0], "month"] == 10
    assert cal.loc[ISSUES[0], "sw_monsoon"] == 0
    assert abs(cal.loc[ISSUES[0], "doy_sin"] ** 2 + cal.loc[ISSUES[0], "doy_cos"] ** 2 - 1) < 1e-9


def test_physics_features_are_nan_when_no_hindcast(data):
    physics = physics_features(data, ISSUES)
    assert "has_physics" in physics.columns
    if data.smoke_hindcasts.empty:
        assert physics.empty or (physics["has_physics"] == 0).all()


def _without_days(data, days):
    keep = ~data.fire_cells["day"].isin([pd.Timestamp(d) for d in days])
    return type(data)(**{**data.__dict__, "fire_cells": data.fire_cells[keep]})


def test_fire_features_ignore_issue_day_and_count_last_complete_day(data):
    table = instruments(data)
    issue = ISSUES[1:]
    base = fire_features(data, table, issue)
    pd.testing.assert_frame_equal(base, fire_features(_without_days(data, ["2026-10-09"]), table, issue))
    assert not base.equals(fire_features(_without_days(data, ["2026-10-08"]), table, issue))


def test_fire_total_d3_matches_an_independent_sum(data):
    table = instruments(data)
    fires = fire_features(data, table, ISSUES[1:])
    cells = data.fire_cells
    cells = cells[cells["day"].isin([pd.Timestamp(d) for d in ("2026-10-06", "2026-10-07", "2026-10-08")])]
    kl = table[table["instrument_id"] == "WMKK"].iloc[0]
    km = distance_km(kl["lat"], kl["lon"], cells["lat10"] / 10.0 + 0.05, cells["lon10"] / 10.0 + 0.05)
    power = cells["burning_mw"].fillna(cells["frp_mw"])
    expected = power[km.to_numpy() < 1500.0].sum()
    assert expected > 0
    assert abs(fires.loc[("WMKK", ISSUES[1]), "fire_total_d3"] - expected) < 1e-6
