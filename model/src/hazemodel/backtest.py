"""Walk-forward backtest: train up to each block, forecast the next, score the model and every baseline."""

import pandas as pd

from hazemodel.backtest_scores import intervals, onset, scores
from hazemodel.baselines import climatology, persistence, physics, physics_gain, v2_forecast
from hazemodel.splits import walk_forward
from hazemodel.train import predict_frame, train_artifact

BASELINES = ("persistence", "climatology", "v2", "physics")
# A row issued at T carries truth from T+1 and T+2, so rows issued within the longest horizon before a test
# block would teach the model the block's first days. Training stops this many days before the first test issue.
EMBARGO_PER_DAY = pd.Timedelta(days=1)


def wind_source(frame: pd.DataFrame) -> str:
    flags = frame["from_forecast"]
    if flags.isna().any():
        return "mixed"
    seen = set(flags.astype(int).unique())
    if seen <= {0}:
        return "analysis"
    if seen == {1}:
        return "forecast"
    return "mixed"


def embargo(train: pd.DataFrame, test: pd.DataFrame, days) -> pd.DataFrame:
    first = test.index.get_level_values("issue_at").min()
    cutoff = first - EMBARGO_PER_DAY * max(days)
    return train[train.index.get_level_values("issue_at") <= cutoff]


def _forecasts(train: pd.DataFrame, test: pd.DataFrame, params: dict, days) -> dict[str, pd.DataFrame]:
    artifact, _ = train_artifact(train, params, days=days)
    return {
        "model": predict_frame(artifact, test),
        "persistence": persistence(test),
        "climatology": climatology(train, test),
        "v2": v2_forecast(test),
        "physics": physics(test, physics_gain(train)),
    }


def run_backtest(frame: pd.DataFrame, params: dict, freq: str = "M", min_train_blocks: int = 1, days=(1, 2)) -> dict:
    by_block, tests = [], []
    collected: dict[str, list[pd.DataFrame]] = {name: [] for name in ("model", *BASELINES)}
    for label, full_train, test in walk_forward(frame, freq=freq, min_train_blocks=min_train_blocks):
        train = embargo(full_train, test, days)
        forecasts = _forecasts(train, test, params, days)
        by_block.append(
            {"block": label, "train_rows": len(train), "test_rows": len(test), **scores(test, forecasts, days)}
        )
        tests.append(test)
        for name, forecast in forecasts.items():
            collected[name].append(forecast)
    all_test = pd.concat(tests)
    pooled_forecasts = {name: pd.concat(parts) for name, parts in collected.items()}
    pooled = scores(all_test, pooled_forecasts, days)
    model_d1 = pooled["model"].get("d1")
    return {
        "wind_source": wind_source(frame),
        "freq": freq,
        "blocks": len(by_block),
        "rows": int(len(frame)),
        "by_block": by_block,
        "pooled": pooled,
        "interval": intervals(all_test, pooled_forecasts, days),
        "onset": onset(all_test, pooled_forecasts, days),
        "promotion_score": model_d1["reference"]["hazy_mae"] if model_d1 else float("nan"),
    }
