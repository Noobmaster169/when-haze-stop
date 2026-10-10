import numpy as np

from hazemodel.recursive import choose_day2, recursive_day2, run_recursive_comparison
from hazemodel.train import load_params, train_artifact

SMALL = {"num_leaves": 4, "min_data_in_leaf": 2, "num_boost_round": 20, "learning_rate": 0.1, "num_threads": 1}


def test_recursive_day2_has_sorted_quantiles(frame):
    artifact, _ = train_artifact(frame, {**load_params(), **SMALL}, days=(1,))
    out = recursive_day2(artifact, frame)
    assert set(out.columns) == {"p10_d2", "p50_d2", "p90_d2"}
    assert (out["p10_d2"] <= out["p50_d2"]).all() and (out["p50_d2"] <= out["p90_d2"]).all()


def test_choose_day2_rule():
    assert choose_day2({"hazy_mae": 10.0}, {"hazy_mae": 10.4})["serves_d2"] == "recursive"
    assert choose_day2({"hazy_mae": 10.0}, {"hazy_mae": 10.6})["serves_d2"] == "direct"


def test_direct_or_recursive_without_d2(frame):
    broken = frame.copy()
    broken["peak_d2"] = np.nan
    result = run_recursive_comparison(broken, {**load_params(), **SMALL}, freq="D", min_train_blocks=2)
    assert result["serves_d2"] == "recursive"
    assert np.isnan(result["direct_hazy_mae"])
