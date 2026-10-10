"""Walk-forward backtest: train up to each block, forecast the next, score the model and every baseline."""

import pandas as pd

from hazemodel.baselines import climatology, persistence, physics, physics_gain, v2_forecast
from hazemodel.scores import bootstrap_difference, lead_to_onset, score
from hazemodel.splits import walk_forward
from hazemodel.train import predict_frame, train_artifact

BASELINES = ("persistence", "climatology", "v2", "physics")


def wind_source(frame: pd.DataFrame) -> str:
    flags = set(frame["from_forecast"].dropna().astype(int).unique())
    if flags <= {0}:
        return "analysis"
    if flags == {1}:
        return "forecast"
    return "mixed"


def _forecasts(train: pd.DataFrame, test: pd.DataFrame, params: dict, days) -> dict[str, pd.DataFrame]:
    artifact, _ = train_artifact(train, params, days=days)
    return {
        "model": predict_frame(artifact, test),
        "persistence": persistence(test),
        "climatology": climatology(train, test),
        "v2": v2_forecast(test),
        "physics": physics(test, physics_gain(train)),
    }


def _scores(test: pd.DataFrame, forecasts: dict[str, pd.DataFrame], days) -> dict:
    return {
        name: {f"d{d}": score(test, forecast, d) for d in days if f"p50_d{d}" in forecast}
        for name, forecast in forecasts.items()
    }


def _intervals(test: pd.DataFrame, forecasts: dict[str, pd.DataFrame], days) -> dict:
    model = forecasts["model"]
    return {
        f"d{d}": {
            "model_minus_persistence": list(bootstrap_difference(test, model, forecasts["persistence"], d)),
            "model_minus_v2": list(bootstrap_difference(test, model, forecasts["v2"], d)),
        }
        for d in days
        if f"p50_d{d}" in model
    }


def _onset(test: pd.DataFrame, forecasts: dict[str, pd.DataFrame], days) -> dict:
    onset = {}
    for name in ("model", "persistence", "v2"):
        usable = {d: forecasts[name] for d in days if f"p50_d{d}" in forecasts[name]}
        leads = lead_to_onset(test, usable)
        onset[name] = float(leads["lead_days"].mean()) if len(leads) else float("nan")
        onset["cases"] = int(len(leads))
    return onset


def run_backtest(frame: pd.DataFrame, params: dict, freq: str = "M", min_train_blocks: int = 1, days=(1, 2)) -> dict:
    by_block, tests = [], []
    collected: dict[str, list[pd.DataFrame]] = {name: [] for name in ("model", *BASELINES)}
    for label, train, test in walk_forward(frame, freq=freq, min_train_blocks=min_train_blocks):
        forecasts = _forecasts(train, test, params, days)
        scores = _scores(test, forecasts, days)
        by_block.append({"block": label, "train_rows": len(train), "test_rows": len(test), **scores})
        tests.append(test)
        for name, forecast in forecasts.items():
            collected[name].append(forecast)
    all_test = pd.concat(tests)
    pooled_forecasts = {name: pd.concat(parts) for name, parts in collected.items()}
    pooled = _scores(all_test, pooled_forecasts, days)
    model_d1 = pooled["model"].get("d1")
    return {
        "wind_source": wind_source(frame),
        "freq": freq,
        "blocks": len(by_block),
        "rows": int(len(frame)),
        "by_block": by_block,
        "pooled": pooled,
        "interval": _intervals(all_test, pooled_forecasts, days),
        "onset": _onset(all_test, pooled_forecasts, days),
        "promotion_score": model_d1["reference"]["hazy_mae"] if model_d1 else float("nan"),
    }
