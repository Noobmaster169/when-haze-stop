"""Two mechanical leak tests, each proving the harness can or cannot be fooled.

shift: features moved one day forward carry the target's own level, so a sound harness lets the model beat
persistence by more than the margin; if it cannot, the harness is broken. shuffle: with targets permuted the model
must not beat climatology by more than the margin; if it does, a feature encodes the target.
"""

import numpy as np
import pandas as pd

from hazemodel.backtest import embargo
from hazemodel.baselines import climatology, persistence
from hazemodel.scores import score
from hazemodel.splits import walk_forward
from hazemodel.train import feature_columns, predict_frame, train_artifact

MARGIN = 1.05
DAYS = (1,)


def shifted_forward(frame: pd.DataFrame) -> pd.DataFrame:
    features = feature_columns(frame)
    ids = frame.index.get_level_values("instrument_id")
    issue = frame.index.get_level_values("issue_at")
    later = pd.MultiIndex.from_arrays([ids, issue + pd.Timedelta(days=1)], names=frame.index.names)
    shifted = frame.copy()
    shifted[features] = frame[features].reindex(later).to_numpy()
    return shifted.dropna(subset=["level"])


def shuffled_targets(frame: pd.DataFrame, seed: int = 1) -> pd.DataFrame:
    rng = np.random.default_rng(seed)
    shuffled = frame.copy()
    for target in ("peak_d1", "peak_d2"):
        shuffled[target] = shuffled.groupby(level="instrument_id")[target].transform(
            lambda s: s.to_numpy()[rng.permutation(len(s))]
        )
    return shuffled


def _pooled(frame: pd.DataFrame, params: dict, freq: str, min_train_blocks: int, baseline) -> dict:
    tests, models, bases = [], [], []
    for _, full_train, test in walk_forward(frame, freq=freq, min_train_blocks=min_train_blocks):
        train = embargo(full_train, test, DAYS)
        artifact, _ = train_artifact(train, params, days=DAYS)
        tests.append(test)
        models.append(predict_frame(artifact, test))
        bases.append(baseline(train, test))
    all_test = pd.concat(tests)
    return {
        "model": score(all_test, pd.concat(models), 1)["reference"],
        "baseline": score(all_test, pd.concat(bases), 1)["reference"],
    }


def _beats(result: dict) -> bool:
    return bool(result["model"]["mae"] * MARGIN < result["baseline"]["mae"])


def run_leak_tests(frame: pd.DataFrame, params: dict, freq: str = "M", min_train_blocks: int = 1) -> dict:
    """shift passes when the model beats persistence by more than the margin (the harness sees the future when
    given it); shuffle passes when the model does not beat climatology by more than the margin."""
    shift = _pooled(shifted_forward(frame), params, freq, min_train_blocks, lambda train, test: persistence(test))
    shuffle = _pooled(shuffled_targets(frame), params, freq, min_train_blocks, climatology)
    return {"shift": {**shift, "passed": _beats(shift)}, "shuffle": {**shuffle, "passed": not _beats(shuffle)}}
