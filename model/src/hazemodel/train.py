"""Fit the quantile models. Three LightGBM boosters per target day, weighted toward hazy days."""

import datetime as dt
import hashlib
import json
import os
import pathlib

import lightgbm as lgb
import numpy as np
import pandas as pd

from hazemodel.artifacts import Artifact

QUANTILES = (10, 50, 90)
EXCLUDED = ("kind", "reference_weight")
EXCLUDED_PREFIXES = ("peak_", "weight_", "censored_")
PARAMS_PATH = pathlib.Path(__file__).resolve().parents[2] / "params.json"


def params_path() -> pathlib.Path:
    """MODEL_PARAMS overrides the source-tree file, which an installed package (the image) does not have."""
    return pathlib.Path(os.environ.get("MODEL_PARAMS", PARAMS_PATH))


def feature_columns(frame: pd.DataFrame) -> list[str]:
    return [c for c in frame.columns if c not in EXCLUDED and not c.startswith(EXCLUDED_PREFIXES)]


def load_params(path: pathlib.Path | None = None) -> dict:
    return json.loads((path or params_path()).read_text())


def _eligible(frame: pd.DataFrame, day: int) -> pd.DataFrame:
    return frame[frame[f"peak_d{day}"].notna() & (frame[f"weight_d{day}"] > 0)]


def fit_quantiles(
    frame: pd.DataFrame, day: int, features: list[str], params: dict
) -> tuple[dict[str, lgb.Booster], int]:
    rows = _eligible(frame, day)
    if rows.empty:
        return {}, 0
    x = rows[features].to_numpy(dtype=float)
    y = rows[f"peak_d{day}"].to_numpy(dtype=float)
    w = rows[f"weight_d{day}"].to_numpy(dtype=float)
    categorical = [features.index("kind_code")] if "kind_code" in features else []
    rounds = int(params.get("num_boost_round", 600))
    settings = {k: v for k, v in params.items() if k != "num_boost_round"}
    dataset = lgb.Dataset(x, y, weight=w, feature_name=features, categorical_feature=categorical, free_raw_data=False)
    boosters = {}
    for q in QUANTILES:
        quantile = {**settings, "objective": "quantile", "alpha": q / 100, "verbose": -1}
        boosters[f"d{day}_q{q}"] = lgb.train(quantile, dataset, rounds)
    return boosters, int(len(rows))


def _version(features: list[str], params: dict, rows: int) -> str:
    text = f"{sorted(features)}|{json.dumps(params, sort_keys=True)}|{rows}"
    return f"{dt.date.today().isoformat()}-{hashlib.sha1(text.encode()).hexdigest()[:8]}"


def train_artifact(
    frame: pd.DataFrame, params: dict, version: str | None = None, days=(1, 2)
) -> tuple[Artifact, dict]:
    features = feature_columns(frame)
    boosters, info = {}, {"rows": {}, "dropped": {}}
    for day in days:
        fitted, used = fit_quantiles(frame, day, features, params)
        boosters.update(fitted)
        info["rows"][f"d{day}"] = used
        info["dropped"][f"d{day}"] = int(len(frame) - used)
    artifact = Artifact(
        version=version or _version(features, params, len(frame)),
        trained_at=dt.datetime.now(dt.timezone.utc),
        features=features,
        boosters=boosters,
    )
    return artifact, info


def predict_frame(artifact: Artifact, frame: pd.DataFrame) -> pd.DataFrame:
    x = frame[artifact.features].to_numpy(dtype=float)
    out = {}
    for day in (1, 2):
        if f"d{day}_q50" not in artifact.boosters:
            continue
        stack = np.column_stack([artifact.boosters[f"d{day}_q{q}"].predict(x) for q in QUANTILES])
        stack = np.sort(np.maximum(stack, 0.0), axis=1)
        for position, q in enumerate(QUANTILES):
            out[f"p{q}_d{day}"] = stack[:, position]
    return pd.DataFrame(out, index=frame.index)
