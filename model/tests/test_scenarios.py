import numpy as np

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
