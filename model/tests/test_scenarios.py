import numpy as np
import pandas as pd

from hazemodel.baselines import persistence
from hazemodel.scenarios import run_scenarios, scenario_masks, unseen_instruments
from hazemodel.train import load_params, predict_frame, train_artifact

SMALL = {"num_leaves": 4, "min_data_in_leaf": 2, "num_boost_round": 20, "learning_rate": 0.1, "num_threads": 1}


def test_masks_cover_the_named_scenarios(frame):
    masks = scenario_masks(frame)
    assert set(masks) == {"onset", "end", "fire_dropout", "wind_reversal", "clean_season"}
    for mask in masks.values():
        assert mask.dtype == bool and len(mask) == len(frame)
        assert mask.index.equals(frame.index)
    assert not masks["clean_season"].any()


def test_run_scenarios_reports_each_with_a_pass_or_reason(frame):
    artifact, _ = train_artifact(frame, {**load_params(), **SMALL})
    forecasts = {"model": predict_frame(artifact, frame), "persistence": persistence(frame)}
    out = run_scenarios(frame, forecasts)
    assert set(out) == set(scenario_masks(frame))
    for result in out.values():
        assert "rows" in result
        assert result["passed"] in (True, False, None)
        if result["passed"] is None:
            assert result["reason"] == "too few rows"


def test_unseen_instruments_holds_out_at_least_five(frame):
    out = unseen_instruments(frame, {**load_params(), **SMALL}, freq="D", min_train_blocks=2)
    assert len(out["held_out"]) >= 5
    assert out["passed"] in (True, False, None)
    assert np.isnan(out["held_out_hazy_mae"]) or out["held_out_hazy_mae"] >= 0


# Hand-labelled test vectors: each row is built to be inside or outside one scenario.
def _vector(rows: list[dict], start="2026-06-01") -> pd.DataFrame:
    base = {
        "kind": "doe", "peak_d1": 20.0, "peak24": 20.0, "level": 20.0, "rain48": 0.0, "fire_total_d3": 0.0,
        "fire_total_change": 0.0, "u24": 1.0, "v24": 0.0, "u48": 1.0, "v48": 0.0, "month": 6,
    }
    issues = pd.date_range(start, periods=len(rows), freq="D", tz="UTC")
    index = pd.MultiIndex.from_arrays([["A"] * len(rows), issues], names=["instrument_id", "issue_at"])
    frame = pd.DataFrame([{**base, **row} for row in rows], index=index)
    frame["kind"] = pd.Categorical(frame["kind"], categories=["doe", "nea", "openaq", "airport"])
    return frame


def test_wind_reversal_mask():
    # Hours 0-24 blow east (u24 +2); hours 24-48 average west (2*u48 - u24 = -2).
    frame = _vector([{"u24": 2.0, "u48": 0.0}, {"u24": 2.0, "u48": 2.0}])
    assert scenario_masks(frame)["wind_reversal"].tolist() == [True, False]


def test_end_mask():
    frame = _vector([{"rain48": 25.0, "level": 40.0}, {"rain48": 0.0, "level": 40.0}, {"rain48": 25.0, "level": 10.0}])
    assert scenario_masks(frame)["end"].tolist() == [True, False, False]


def test_fire_dropout_mask():
    frame = _vector(
        [
            {"level": 40.0, "fire_total_d3": 50.0, "fire_total_change": -50.0},
            {"level": 40.0, "fire_total_d3": 0.0, "fire_total_change": 0.0},
            {"level": 40.0, "fire_total_d3": 90.0, "fire_total_change": -10.0},
        ]
    )
    assert scenario_masks(frame)["fire_dropout"].tolist() == [True, False, False]


def test_onset_mask_covers_the_three_days_before_a_season_start():
    peaks = [10.0] * 5 + [40.0] * 3 + [10.0] * 2
    frame = _vector([{"peak_d1": value} for value in peaks])
    assert scenario_masks(frame)["onset"].tolist() == [False, False, True, True, True] + [False] * 5


def _end_vector(rows: int, said: float) -> tuple[pd.DataFrame, dict]:
    frame = _vector([{"rain48": 25.0, "level": 40.0, "peak_d1": 40.0}] * rows)
    forecast = pd.DataFrame({"p50_d1": said, "p10_d1": said - 5, "p90_d1": said + 5}, index=frame.index)
    return frame, {"model": forecast, "persistence": forecast}


def test_too_few_rows_reports_a_reason():
    frame, forecasts = _end_vector(10, 40.0)
    result = run_scenarios(frame, forecasts)["end"]
    assert result["rows"] == 10 and result["passed"] is None and result["reason"] == "too few rows"


def test_end_scenario_passes_and_fails_on_the_bias_line():
    frame, forecasts = _end_vector(25, 40.0)
    assert run_scenarios(frame, forecasts)["end"]["passed"] is True
    frame, forecasts = _end_vector(25, 60.0)
    assert run_scenarios(frame, forecasts)["end"]["passed"] is False
