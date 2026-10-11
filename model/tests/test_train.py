import numpy as np

from hazemodel.train import feature_columns, fit_quantiles, load_params, predict_frame, train_artifact

SMALL = {"num_leaves": 4, "min_data_in_leaf": 2, "num_boost_round": 20, "learning_rate": 0.1, "num_threads": 1}


def test_feature_columns_exclude_targets_and_weights(frame):
    columns = feature_columns(frame)
    assert "kind_code" in columns and "level" in columns and "from_forecast" in columns
    banned = ("kind", "reference_weight")
    assert not any(c.startswith(("peak_", "weight_", "censored_")) or c in banned for c in columns)


def test_fit_quantiles_uses_weighted_rows_only(frame):
    params = {**load_params(), **SMALL}
    boosters, used = fit_quantiles(frame, 1, feature_columns(frame), params)
    assert set(boosters) == {"d1_q10", "d1_q50", "d1_q90"}
    eligible = frame["peak_d1"].notna() & (frame["weight_d1"] > 0)
    assert used == int(eligible.sum())


def test_train_drops_rows_without_target(frame):
    broken = frame.copy()
    broken["peak_d2"] = np.nan
    params = {**load_params(), **SMALL}
    artifact, info = train_artifact(broken, params, days=(1, 2))
    assert info["rows"]["d2"] == 0
    assert "d2_q50" not in artifact.boosters
    assert "d1_q50" in artifact.boosters


def test_predict_frame_sorted_quantiles_and_version(frame):
    params = {**load_params(), **SMALL}
    artifact, _ = train_artifact(frame, params)
    out = predict_frame(artifact, frame)
    assert (out["p10_d1"] <= out["p50_d1"]).all() and (out["p50_d1"] <= out["p90_d1"]).all()
    assert (out["p10_d1"] >= 0).all()
    assert (out["p10_d2"] <= out["p50_d2"]).all() and (out["p50_d2"] <= out["p90_d2"]).all()
    assert (out["p10_d2"] >= 0).all()
    assert len(artifact.version.split("-")) == 4
    again, _ = train_artifact(frame, params)
    assert again.version == artifact.version


def test_kind_code_is_categorical_in_the_booster(frame):
    params = {**load_params(), **SMALL}
    boosters, _ = fit_quantiles(frame, 1, feature_columns(frame), params)
    model = boosters["d1_q50"].dump_model()
    assert model["feature_infos"]["kind_code"]["values"]
    assert model["feature_infos"]["level"]["values"] == []


def test_zero_weights_leave_the_row_count(frame):
    params = {**load_params(), **SMALL}
    features = feature_columns(frame)
    _, used = fit_quantiles(frame, 1, features, params)
    lighter = frame.copy()
    eligible = lighter.index[lighter["peak_d1"].notna() & (lighter["weight_d1"] > 0)]
    lighter.loc[eligible[:5], "weight_d1"] = 0.0
    _, fewer = fit_quantiles(lighter, 1, features, params)
    assert fewer == used - 5


def test_load_params_follows_model_params(monkeypatch, tmp_path):
    path = tmp_path / "params.json"
    path.write_text('{"num_leaves": 9}')
    monkeypatch.setenv("MODEL_PARAMS", str(path))
    assert load_params() == {"num_leaves": 9}
