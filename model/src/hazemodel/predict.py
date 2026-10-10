"""Run an artifact over feature rows.

Day +1 and day +2 are scored on the original frame whenever their direct boosters exist, since those are the
features they were trained on. Recursion is used only where no direct model exists: day +2 without `d2_*` is the
`d1` boosters on the frame rolled once with the day +1 median; day +3 is always the `d1` boosters on the frame
rolled twice, first with the day +1 median, then with the day +2 median (direct if present, else the recursive one).
"""

import numpy as np
import pandas as pd

from hazemodel.artifacts import Artifact
from hazemodel.region import MALAYSIA_OFFSET

QUANTILES = (10, 50, 90)


def _quantiles(artifact: Artifact, prefix: str, x: np.ndarray) -> np.ndarray:
    out = np.column_stack([artifact.boosters[f"{prefix}_q{q}"].predict(x) for q in QUANTILES])
    return np.sort(np.maximum(out, 0.0), axis=1)


def _rolled(frame: pd.DataFrame, median: np.ndarray) -> pd.DataFrame:
    rolled = frame.copy()
    rolled["lag72"] = rolled["lag48"]
    rolled["lag48"] = rolled["lag24"]
    rolled["lag24"] = rolled["level"]
    rolled["level"] = median
    rolled["d24"] = rolled["level"] - rolled["lag24"]
    rolled["d48"] = rolled["level"] - rolled["lag48"]
    rolled["slope3h"] = rolled["d24"] / 24.0
    return rolled


def _score(artifact: Artifact, prefix: str, frame: pd.DataFrame) -> np.ndarray:
    return _quantiles(artifact, prefix, frame[artifact.features].to_numpy(dtype=float))


def predict_rows(artifact: Artifact, frame: pd.DataFrame) -> pd.DataFrame:
    ids = frame.index.get_level_values("instrument_id")
    issue_days = (frame.index.get_level_values("issue_at") + MALAYSIA_OFFSET).date
    q1 = _score(artifact, "d1", frame)
    rolled_once = _rolled(frame, q1[:, 1])
    q2 = _score(artifact, "d2", frame) if "d2_q50" in artifact.boosters else _score(artifact, "d1", rolled_once)
    q3 = _score(artifact, "d1", _rolled(rolled_once, q2[:, 1]))
    rows = []
    for d, q in ((1, q1), (2, q2), (3, q3)):
        rows.append(
            pd.DataFrame(
                {
                    "instrument_id": ids,
                    "day": [day + pd.Timedelta(days=d) for day in issue_days],
                    "p10": q[:, 0],
                    "p50": q[:, 1],
                    "p90": q[:, 2],
                }
            )
        )
    out = pd.concat(rows, ignore_index=True)
    out["day"] = pd.to_datetime(out["day"]).dt.date
    return out
