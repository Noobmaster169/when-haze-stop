import numpy as np
import pandas as pd

from hazemodel.baselines import persistence
from hazemodel.index import api_to_pm25
from hazemodel.scores import bootstrap_difference, lead_to_onset, score


def test_score_persistence_by_kind(frame):
    out = score(frame, persistence(frame), day=1)
    assert "reference" in out and "airport" in out
    ref = out["reference"]
    assert ref["cases"] > 0
    assert ref["mae"] >= 0
    assert np.isnan(ref["below_p10"])
    assert "dropped" in out


def test_perfect_forecast_scores_zero(frame):
    perfect = pd.DataFrame(
        {"p50_d1": frame["peak_d1"], "p10_d1": frame["peak_d1"] - 1, "p90_d1": frame["peak_d1"] + 1}, index=frame.index
    )
    out = score(frame, perfect, day=1)
    assert out["reference"]["mae"] == 0
    assert out["reference"]["below_p10"] == 0 and out["reference"]["above_p90"] == 0
    if out["reference"]["hazy_cases"] > 0:
        assert out["reference"]["hit_150"] in (1.0,) or np.isnan(out["reference"]["hit_150"])


def test_scores_with_no_hazy_rows(frame):
    clean = frame.copy()
    clean["peak_d1"] = 5.0
    out = score(clean, persistence(clean), day=1)
    assert out["reference"]["hazy_cases"] == 0
    assert np.isnan(out["reference"]["hazy_mae"])
    assert np.isnan(out["reference"]["hit_150"])


def _sg_series(frame, truth_api, d1_api, d2_api, drop_day=None):
    """One instrument, a crafted truth and forecasts in API, optionally with one issue day missing."""
    own = frame[frame.index.get_level_values("instrument_id") == "SGCENTRAL"].copy()
    own["peak_d1"] = api_to_pm25(np.array(truth_api, dtype=float))
    forecasts = {
        1: pd.DataFrame({"p50_d1": api_to_pm25(np.array(d1_api, dtype=float))}, index=own.index),
        2: pd.DataFrame({"p50_d2": api_to_pm25(np.array(d2_api, dtype=float))}, index=own.index),
    }
    if drop_day is not None:
        keep = np.arange(len(own)) != drop_day
        own, forecasts = own[keep], {d: f[keep] for d, f in forecasts.items()}
    return own, forecasts


def test_lead_to_onset_finds_a_crossing_two_days_ahead(frame):
    n = len(frame[frame.index.get_level_values("instrument_id") == "SGCENTRAL"])
    truth = [60] * (n - 1) + [120]
    early = [60] * (n - 2) + [120, 60]  # the day-2 forecast for the onset is issued one row earlier
    own, forecasts = _sg_series(frame, truth, truth, early)
    leads = lead_to_onset(own, forecasts)
    assert len(leads) == 1
    assert leads["lead_days"].iloc[0] == 2


def test_lead_to_onset_day_one_only_and_none(frame):
    n = len(frame[frame.index.get_level_values("instrument_id") == "SGCENTRAL"])
    truth = [60] * (n - 1) + [120]
    low = [60] * n
    own, forecasts = _sg_series(frame, truth, truth, low)
    assert lead_to_onset(own, forecasts)["lead_days"].iloc[0] == 1
    own, forecasts = _sg_series(frame, truth, low, low)
    assert lead_to_onset(own, forecasts)["lead_days"].iloc[0] == 0


def test_lead_to_onset_does_not_bridge_a_missing_day(frame):
    n = len(frame[frame.index.get_level_values("instrument_id") == "SGCENTRAL"])
    truth = [60] * (n - 1) + [120]
    early = [60] * (n - 2) + [120, 60]
    own, forecasts = _sg_series(frame, truth, truth, early, drop_day=n - 3)
    assert lead_to_onset(own, forecasts).empty


def test_score_against_a_hand_labelled_vector():
    # Test vector, not recorded data: values chosen so every rate is checkable by hand.
    kinds = ["doe", "doe", "doe", "doe", "doe", "nea", "airport"]
    kind = pd.Categorical(kinds, categories=["doe", "nea", "openaq", "airport"])
    index = pd.MultiIndex.from_product(
        [[f"i{n}" for n in range(7)], [pd.Timestamp("2026-10-04", tz="UTC")]], names=["instrument_id", "issue_at"]
    )
    truth_api = [160, 160, 100, 100, 100, 210, 160]
    said_api = [160, 100, 160, 100, 100, 210, 160]
    truth = api_to_pm25(np.array(truth_api, dtype=float))
    truth[4] = np.nan
    test = pd.DataFrame({"peak_d1": truth, "kind": kind}, index=index)
    forecast = pd.DataFrame({"p50_d1": api_to_pm25(np.array(said_api, dtype=float))}, index=index)
    out = score(test, forecast, day=1)
    ref = out["reference"]
    assert out["dropped"] == 1
    assert ref["cases"] == 5
    # events at 150: rows 0, 1, 5; forecast events: rows 0, 2, 5; hits: rows 0, 5; false alarm: row 2.
    assert ref["hit_150"] == 2 / 3
    assert ref["far_150"] == 1 / 3
    assert ref["hit_200"] == 1.0 and ref["far_200"] == 0.0
    assert out["airport"]["cases"] == 1 and out["airport"]["hit_150"] == 1.0
    assert out["doe"]["cases"] == 4 and out["nea"]["cases"] == 1


def test_band_shares_ignore_rows_without_a_band(frame):
    one = frame.iloc[:4]
    p10 = pd.Series([np.nan, 0.0, 0.0, 0.0], index=one.index)
    forecast = pd.DataFrame({"p50_d1": one["peak_d1"], "p10_d1": p10, "p90_d1": one["peak_d1"] + 1})
    kind = str(one["kind"].iloc[1])
    assert score(one, forecast, day=1)[kind]["below_p10"] == 0.0


def test_bootstrap_interval_contains_zero_for_identical_forecasts(frame):
    a = persistence(frame)
    low, high = bootstrap_difference(frame, a, a, day=1, draws=50)
    assert low == 0 and high == 0
