import datetime as dt

import lightgbm as lgb
import numpy as np

from hazemodel.artifacts import Artifact, live_version, load_artifact, save_artifact, set_live

KEYS = ["d1_q10", "d1_q50", "d1_q90", "d2_q10", "d2_q50", "d2_q90"]


def tiny_artifact() -> Artifact:
    x = np.arange(40, dtype=float).reshape(20, 2)
    y = x[:, 0] * 2
    boosters = {
        key: lgb.train(
            {"objective": "quantile", "alpha": 0.5, "verbose": -1, "min_data_in_leaf": 1}, lgb.Dataset(x, y), 5
        )
        for key in KEYS
    }
    return Artifact(
        version="2026-10-10-test0001",
        trained_at=dt.datetime(2026, 10, 10, tzinfo=dt.timezone.utc),
        features=["a", "b"],
        boosters=boosters,
    )


def test_save_load_and_live_pointer(tmp_path):
    artifact = tiny_artifact()
    save_artifact(tmp_path, artifact)
    assert live_version(tmp_path) is None
    set_live(tmp_path, artifact.version)
    assert live_version(tmp_path) == artifact.version
    back = load_artifact(tmp_path, artifact.version)
    assert back.features == ["a", "b"]
    assert set(back.boosters) == set(KEYS)
    assert back.trained_at == artifact.trained_at
    x = np.array([[3.0, 0.0]])
    assert abs(back.boosters["d1_q50"].predict(x)[0] - artifact.boosters["d1_q50"].predict(x)[0]) < 1e-9
