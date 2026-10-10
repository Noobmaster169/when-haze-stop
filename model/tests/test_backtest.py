import numpy as np

from hazemodel.backtest import run_backtest, wind_source
from hazemodel.train import load_params

SMALL = {"num_leaves": 4, "min_data_in_leaf": 2, "num_boost_round": 20, "learning_rate": 0.1}


def test_backtest_by_day_on_the_fixture(frame):
    result = run_backtest(frame, {**load_params(), **SMALL}, freq="D", min_train_blocks=2)
    assert result["wind_source"] == "analysis"
    assert result["blocks"] == 4
    assert len(result["by_block"]) == 4
    pooled = result["pooled"]
    for name in ("model", "persistence", "climatology", "v2", "physics"):
        assert name in pooled
    assert pooled["model"]["d1"]["reference"]["cases"] > 0
    assert pooled["persistence"]["d1"]["reference"]["mae"] >= 0
    low, high = result["interval"]["d1"]["model_minus_persistence"]
    assert low <= high
    assert np.isfinite(result["promotion_score"]) or pooled["model"]["d1"]["reference"]["hazy_cases"] == 0
    assert result["onset"]["cases"] >= 0


def test_wind_source_labels(frame):
    assert wind_source(frame) == "analysis"
    mixed = frame.copy()
    mixed.iloc[0, mixed.columns.get_loc("from_forecast")] = 1
    assert wind_source(mixed) == "mixed"
