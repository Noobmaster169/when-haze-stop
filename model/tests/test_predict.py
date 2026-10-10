import datetime as dt

import numpy as np
import pandas as pd

from hazemodel.artifacts import Artifact
from hazemodel.predict import rolled, predict_rows

FEATURES = ["level", "lag24", "lag48", "lag72", "d24", "d48", "slope3h", "peak24"]


class RecordingBooster:
    """Test double: returns a constant and remembers the feature matrix it was given."""

    def __init__(self, value: float):
        self.value = value
        self.calls: list[np.ndarray] = []

    def predict(self, x):
        self.calls.append(np.array(x))
        return np.full(len(x), self.value)


def frame() -> pd.DataFrame:
    index = pd.MultiIndex.from_tuples(
        [("a", pd.Timestamp("2026-10-08T00:00:00Z"))], names=["instrument_id", "issue_at"]
    )
    return pd.DataFrame(
        {
            "level": [10.0],
            "lag24": [20.0],
            "lag48": [30.0],
            "lag72": [40.0],
            "d24": [-10.0],
            "d48": [-20.0],
            "slope3h": [0.0],
            "peak24": [25.0],
        },
        index=index,
    )


def artifact(keys: dict[str, float]) -> Artifact:
    boosters = {key: RecordingBooster(value) for key, value in keys.items()}
    return Artifact("v", dt.datetime(2026, 10, 10, tzinfo=dt.timezone.utc), FEATURES, boosters)


def col(booster: RecordingBooster, call: int, name: str) -> float:
    return float(booster.calls[call][0, FEATURES.index(name)])


def test_direct_days_see_original_features_and_day3_sees_both_medians():
    values = {f"d{d}_q{q}": 100.0 * d + q for d in (1, 2) for q in (10, 50, 90)}
    art = artifact(values)
    out = predict_rows(art, frame())
    d1, d2 = art.boosters["d1_q50"], art.boosters["d2_q50"]
    assert len(d1.calls) == 2 and len(d2.calls) == 1
    assert col(d1, 0, "level") == 10.0
    assert col(d2, 0, "level") == 10.0 and col(d2, 0, "lag24") == 20.0
    # day +3 is the d1 booster on the frame rolled twice: level is the day +2 median, lag24 the day +1 median
    assert col(d1, 1, "level") == 250.0
    assert col(d1, 1, "lag24") == 150.0
    assert col(d1, 1, "peak24") == 250.0
    assert list(out["p50"]) == [150.0, 250.0, 150.0]


def test_d1_only_artifact_rolls_once_for_day_two_and_twice_for_day_three():
    art = artifact({f"d1_q{q}": 5.0 + q for q in (10, 50, 90)})
    predict_rows(art, frame())
    d1 = art.boosters["d1_q50"]
    assert len(d1.calls) == 3
    assert (col(d1, 0, "level"), col(d1, 0, "lag24"), col(d1, 0, "peak24")) == (10.0, 20.0, 25.0)
    assert (col(d1, 1, "level"), col(d1, 1, "lag24"), col(d1, 1, "peak24")) == (55.0, 10.0, 55.0)
    assert (col(d1, 2, "level"), col(d1, 2, "lag24"), col(d1, 2, "peak24")) == (55.0, 55.0, 55.0)


def test_roll_shifts_the_lag_chain():
    shifted = rolled(frame(), np.array([7.0]))
    row = shifted.iloc[0]
    assert (row["level"], row["lag24"], row["lag48"], row["lag72"]) == (7.0, 10.0, 20.0, 30.0)
    assert row["d24"] == -3.0 and row["d48"] == -13.0
    assert row["peak24"] == 7.0 and row["peak24"] >= row["level"]


def test_quantiles_are_floored_at_zero_and_sorted():
    art = artifact({"d1_q10": -5.0, "d1_q50": -1.0, "d1_q90": 2.0})
    out = predict_rows(art, frame())
    assert (out[["p10", "p50", "p90"]] >= 0).all().all()
    assert list(out["p10"]) == [0.0, 0.0, 0.0] and list(out["p90"])[0] == 2.0
