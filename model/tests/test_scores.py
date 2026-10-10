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


def test_lead_to_onset_finds_a_crossing(frame):
    crafted = frame.copy()
    ids = crafted.index.get_level_values("instrument_id")
    issue = crafted.index.get_level_values("issue_at")
    one = ids == "SGCENTRAL"
    crafted.loc[one, "peak_d1"] = api_to_pm25(60)
    last = issue[one].max()
    crafted.loc[one & (issue == last), "peak_d1"] = api_to_pm25(120)
    forecast = pd.DataFrame({"p50_d1": crafted["peak_d1"], "p50_d2": crafted["peak_d1"]}, index=crafted.index)
    leads = lead_to_onset(crafted, {1: forecast, 2: forecast})
    row = leads[leads["instrument_id"] == "SGCENTRAL"]
    assert len(row) == 1
    assert row["lead_days"].iloc[0] >= 1


def test_bootstrap_interval_contains_zero_for_identical_forecasts(frame):
    a = persistence(frame)
    low, high = bootstrap_difference(frame, a, a, day=1, draws=50)
    assert low == 0 and high == 0
