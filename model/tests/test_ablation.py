from hazemodel.ablation import GROUPS, run_ablation
from hazemodel.hyperparams import search
from hazemodel.train import feature_columns, load_params

SMALL = {"num_leaves": 4, "min_data_in_leaf": 2, "num_boost_round": 20, "learning_rate": 0.1, "num_threads": 1}


def test_groups_cover_every_feature(frame):
    columns = feature_columns(frame)
    covered = {c for c in columns if any(predicate(c) for predicate in GROUPS.values())}
    assert covered == set(columns), set(columns) - covered


def test_ablation_reports_each_group(frame):
    out = run_ablation(frame, {**load_params(), **SMALL}, freq="D", min_train_blocks=2)
    assert "full" in out
    for name in GROUPS:
        assert name in out["groups"]
        assert "keep" in out["groups"][name]


def test_search_runs_a_few_draws(frame):
    out = search(frame, freq="D", months=4, draws=2, seed=1)
    assert "params" in out and len(out["draws"]) == 2
    assert 15 <= out["params"]["num_leaves"] <= 63


def test_search_falls_back_to_all_day_mae_without_a_hazy_day(frame):
    clean = frame.copy()
    for target in ("peak_d1", "peak_d2"):
        clean[target] = clean[target].clip(upper=30.0)
    out = search(clean, freq="D", months=4, draws=3, seed=1)
    assert out["criterion"] == "mae"
    assert all(row["criterion"] == "mae" for row in out["draws"])
    assert not any(row["mae"] != row["mae"] for row in out["draws"])
    winner = min(out["draws"], key=lambda row: row["mae"])
    assert out["params"]["num_leaves"] == winner["num_leaves"]
    assert "mae" not in out["params"] and "criterion" not in out["params"]
