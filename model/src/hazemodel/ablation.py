"""Retrain without each feature group in turn. A group that moves hazy-day MAE by under 1% is not earning its place."""

import pandas as pd

from hazemodel.backtest import embargo
from hazemodel.scores import score
from hazemodel.splits import walk_forward
from hazemodel.train import predict_frame, train_artifact

AIR = {
    "level", "lag24", "lag48", "lag72", "d24", "d48", "slope3h",
    "peak24", "peak_hour", "near50", "near150", "hist_mean", "hist_std",
}  # fmt: skip
WEATHER = {
    "u24", "v24", "u48", "v48", "steady24", "steady48", "rain24", "rain48",
    "along_fire24", "hours_present", "from_forecast",
}  # fmt: skip
CALENDAR = {"doy_sin", "doy_cos", "month", "sw_monsoon"}
GROUPS = {
    "air": lambda c: c in AIR,
    "fires": lambda c: c.startswith("fire_"),
    "physics": lambda c: c.startswith("smoke_") or c == "has_physics",
    "weather": lambda c: c in WEATHER,
    "calendar": lambda c: c in CALENDAR,
    "identity": lambda c: c == "kind_code",
}
THRESHOLD = 0.01


def _hazy_mae(frame: pd.DataFrame, params: dict, freq: str, min_train_blocks: int) -> float:
    tests, forecasts = [], []
    for _, train, test in walk_forward(frame, freq=freq, min_train_blocks=min_train_blocks):
        artifact, _ = train_artifact(embargo(train, test, (1,)), params, days=(1,))
        tests.append(test)
        forecasts.append(predict_frame(artifact, test))
    return score(pd.concat(tests), pd.concat(forecasts), 1)["reference"]["hazy_mae"]


def run_ablation(frame: pd.DataFrame, params: dict, freq: str = "M", min_train_blocks: int = 1) -> dict:
    full = _hazy_mae(frame, params, freq, min_train_blocks)
    groups = {}
    for name, predicate in GROUPS.items():
        dropped = [c for c in frame.columns if predicate(c)]
        without = _hazy_mae(frame.drop(columns=dropped), params, freq, min_train_blocks)
        change = (without - full) / full if full else float("nan")
        groups[name] = {
            "columns": len(dropped),
            "hazy_mae_without": without,
            "change": change,
            "keep": bool(change >= THRESHOLD),
        }
    return {"full": full, "groups": groups}
