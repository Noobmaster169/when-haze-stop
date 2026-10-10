"""A once-only random search on the first months of a parquet, never on test months. Winner goes to params.json."""

import json
import pathlib

import lightgbm as lgb
import numpy as np
import pandas as pd

from hazemodel.backtest import embargo
from hazemodel.scores import score
from hazemodel.splits import walk_forward
from hazemodel.train import feature_columns, load_params, params_path

SPACE = {
    "num_leaves": (15, 63),
    "learning_rate": (0.02, 0.1),
    "min_data_in_leaf": (50, 200),
    "feature_fraction": (0.6, 0.9),
}
MAX_ROUNDS = 2000
SCORE_COLUMNS = ("hazy_mae", "mae", "criterion")


def _draw(rng: np.random.Generator) -> dict:
    low, high = np.log(SPACE["learning_rate"][0]), np.log(SPACE["learning_rate"][1])
    return {
        "num_leaves": int(rng.integers(*SPACE["num_leaves"], endpoint=True)),
        "learning_rate": float(np.exp(rng.uniform(low, high))),
        "min_data_in_leaf": int(rng.integers(*SPACE["min_data_in_leaf"], endpoint=True)),
        "feature_fraction": float(rng.uniform(*SPACE["feature_fraction"])),
    }


def _eligible(rows: pd.DataFrame) -> pd.DataFrame:
    return rows[rows["peak_d1"].notna() & (rows["weight_d1"] > 0)]


def _fit_with_stopping(
    train: pd.DataFrame, valid: pd.DataFrame, features: list[str], params: dict
) -> tuple[lgb.Booster, int] | None:
    train, valid = _eligible(train), _eligible(valid)
    if train.empty:
        return None
    categorical = [features.index("kind_code")] if "kind_code" in features else []

    def dataset(rows: pd.DataFrame) -> lgb.Dataset:
        return lgb.Dataset(
            rows[features].to_numpy(dtype=float),
            rows["peak_d1"].to_numpy(dtype=float),
            weight=rows["weight_d1"].to_numpy(dtype=float),
            feature_name=features,
            categorical_feature=categorical,
            free_raw_data=False,
        )

    settings = {**params, "objective": "quantile", "alpha": 0.5, "verbose": -1}
    settings.pop("num_boost_round", None)
    if valid.empty:
        # early stopping needs a validation row; without one, fall back to the configured rounds
        rounds = int(params.get("num_boost_round", 600))
        return lgb.train(settings, dataset(train), rounds), rounds
    booster = lgb.train(
        settings, dataset(train), MAX_ROUNDS,
        valid_sets=[dataset(valid)], callbacks=[lgb.early_stopping(50, verbose=False)],
    )  # fmt: skip
    return booster, max(int(booster.best_iteration), 1)


def _criterion(table: list[dict]) -> str:
    """Hazy-day MAE when any draw has one; otherwise the search months held no hazy reference day, and every draw
    is judged on all-day MAE, so the winner is never picked by a NaN tie."""
    return "hazy_mae" if any(not np.isnan(row["hazy_mae"]) for row in table) else "mae"


def search(frame: pd.DataFrame, freq: str = "M", months: int = 6, draws: int = 20, seed: int = 7) -> dict:
    blocks = list(walk_forward(frame, freq=freq, min_train_blocks=1))[: months - 1]
    features = feature_columns(frame)
    rng = np.random.default_rng(seed)
    base = load_params()
    table = []
    for _ in range(draws):
        candidate = {**base, **_draw(rng)}
        tests, forecasts, rounds = [], [], []
        for _, train, test in blocks:
            fitted = _fit_with_stopping(embargo(train, test, (1,)), test, features, candidate)
            if fitted is None:
                continue
            booster, best = fitted
            rounds.append(best)
            tests.append(test)
            predicted = np.maximum(booster.predict(test[features].to_numpy(dtype=float)), 0)
            forecasts.append(pd.DataFrame({"p50_d1": predicted}, index=test.index))
        if not tests:
            table.append({**candidate, "hazy_mae": float("nan"), "mae": float("nan")})
            continue
        reference = score(pd.concat(tests), pd.concat(forecasts), 1)["reference"]
        scored = {"hazy_mae": reference["hazy_mae"], "mae": reference["mae"]}
        table.append({**candidate, "num_boost_round": int(np.median(rounds)), **scored})
    criterion = _criterion(table)
    for row in table:
        row["criterion"] = criterion
    best = min(table, key=lambda row: np.inf if np.isnan(row[criterion]) else row[criterion])
    params = {k: v for k, v in best.items() if k not in SCORE_COLUMNS}
    return {"params": params, "draws": table, "criterion": criterion}


def write_params(params: dict, path: pathlib.Path | None = None) -> None:
    (path or params_path()).write_text(json.dumps(params, indent=2) + "\n")
