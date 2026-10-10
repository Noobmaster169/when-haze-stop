"""Day +2 two ways: a direct model, or the day +1 model fed its own median. The backtest picks one."""

import numpy as np
import pandas as pd

from hazemodel.artifacts import Artifact
from hazemodel.backtest import embargo
from hazemodel.predict import rolled
from hazemodel.scores import score
from hazemodel.splits import walk_forward
from hazemodel.train import QUANTILES, predict_frame, train_artifact

TOLERANCE = 1.05
RULE = "recursive within 5% of direct"
DAYS = (1, 2)


def recursive_day2(artifact: Artifact, test: pd.DataFrame) -> pd.DataFrame:
    first = predict_frame(artifact, test)
    again = rolled(test, first["p50_d1"].to_numpy())
    x = again[artifact.features].to_numpy(dtype=float)
    raw = np.column_stack([artifact.boosters[f"d1_q{q}"].predict(x) for q in QUANTILES])
    stack = np.sort(np.maximum(raw, 0.0), axis=1)
    return pd.DataFrame({f"p{q}_d2": stack[:, i] for i, q in enumerate(QUANTILES)}, index=test.index)


def choose_day2(direct: dict, recursive: dict) -> dict:
    x, y = direct.get("hazy_mae", np.nan), recursive.get("hazy_mae", np.nan)
    serves = "recursive" if (np.isnan(x) or y <= TOLERANCE * x) else "direct"
    return {"serves_d2": serves, "direct_hazy_mae": x, "recursive_hazy_mae": y, "rule": RULE}


def run_recursive_comparison(frame: pd.DataFrame, params: dict, freq: str = "M", min_train_blocks: int = 1) -> dict:
    tests, directs, recursives = [], [], []
    for _, full_train, test in walk_forward(frame, freq=freq, min_train_blocks=min_train_blocks):
        artifact, _ = train_artifact(embargo(full_train, test, DAYS), params, days=DAYS)
        directs.append(predict_frame(artifact, test))
        recursives.append(recursive_day2(artifact, test))
        tests.append(test)
    all_test = pd.concat(tests)
    direct = pd.concat(directs)
    direct_score = score(all_test, direct, 2)["reference"] if "p50_d2" in direct else {"hazy_mae": np.nan}
    recursive_score = score(all_test, pd.concat(recursives), 2)["reference"]
    return choose_day2(direct_score, recursive_score)
