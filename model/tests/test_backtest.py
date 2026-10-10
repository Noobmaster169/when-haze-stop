import numpy as np
import pandas as pd

from hazemodel.backtest import embargo, run_backtest, wind_source
from hazemodel.splits import walk_forward
from hazemodel.train import load_params

SMALL = {"num_leaves": 4, "min_data_in_leaf": 2, "num_boost_round": 20, "learning_rate": 0.1, "num_threads": 1}


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
    for kind in ("reference", *[k for k in result["interval"]["d1"] if k != "reference"]):
        low, high = result["interval"]["d1"][kind]["model_minus_persistence"]
        assert low <= high or np.isnan(low)
    assert set(result["interval"]["d1"]) == set(result["onset"])
    assert result["onset"]["reference"]["cases"] >= 0
    hazy = pooled["model"]["d1"]["reference"]["hazy_mae"]
    assert result["promotion_score"] == hazy or (np.isnan(hazy) and np.isnan(result["promotion_score"]))
    assert pooled["common_cases"]["d1"] > 0
    assert "reference" in pooled["model_on_physics_rows"]["d1"]


def test_blocks_grow_and_cases_add_up(frame):
    result = run_backtest(frame, {**load_params(), **SMALL}, freq="D", min_train_blocks=2)
    trains = [b["train_rows"] for b in result["by_block"]]
    assert trains == sorted(trains) and trains[0] < trains[-1]
    for name in ("model", "persistence"):
        total = sum(b[name]["d1"]["reference"]["cases"] for b in result["by_block"])
        assert result["pooled"][name]["d1"]["reference"]["cases"] == total


def test_embargo_keeps_labels_out_of_training(frame):
    result = run_backtest(frame, {**load_params(), **SMALL}, freq="D", min_train_blocks=2)
    splits = list(walk_forward(frame, freq="D", min_train_blocks=2))
    for (_, full, test), block in zip(splits, result["by_block"], strict=True):
        train = embargo(full, test, (1, 2))
        first = test.index.get_level_values("issue_at").min()
        assert train.index.get_level_values("issue_at").max() <= first - pd.Timedelta(days=2)
        assert block["train_rows"] == len(train) < len(full)


def test_wind_source_labels(frame):
    assert wind_source(frame) == "analysis"
    mixed = frame.copy()
    mixed.iloc[0, mixed.columns.get_loc("from_forecast")] = 1
    assert wind_source(mixed) == "mixed"
    assert wind_source(frame.assign(from_forecast=1)) == "forecast"
    assert wind_source(frame.assign(from_forecast=np.nan)) == "mixed"
