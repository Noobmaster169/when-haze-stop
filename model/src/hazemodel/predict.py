"""Run an artifact over feature rows: day +1 and +2 directly, day +3 (and +2 without a direct model) by recursion."""

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


def predict_rows(artifact: Artifact, frame: pd.DataFrame) -> pd.DataFrame:
    features = artifact.features
    ids = frame.index.get_level_values("instrument_id")
    issue_days = (frame.index.get_level_values("issue_at") + MALAYSIA_OFFSET).date
    current = frame
    rows = []
    for d in (1, 2, 3):
        direct = f"d{d}_q50" in artifact.boosters
        x = current[features].to_numpy(dtype=float)
        q = _quantiles(artifact, f"d{d}" if direct else "d1", x)
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
        current = _rolled(current, q[:, 1])
    out = pd.concat(rows, ignore_index=True)
    out["day"] = pd.to_datetime(out["day"]).dt.date
    return out
