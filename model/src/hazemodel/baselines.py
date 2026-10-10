"""The four forecasts a learned model must beat on identical rows."""
import numpy as np
import pandas as pd

FADE = 0.9
DAY1_HOURS = (16, 39)
DAY2_HOURS = (40, 63)
MIN_PHYSICS_ROWS = 100


def persistence(test: pd.DataFrame) -> pd.DataFrame:
    return pd.DataFrame({"p50_d1": test["peak24"], "p50_d2": test["peak24"]}, index=test.index)


def climatology(train: pd.DataFrame, test: pd.DataFrame) -> pd.DataFrame:
    ids = test.index.get_level_values("instrument_id")
    by_instrument = train.groupby([train.index.get_level_values("instrument_id"), train["month"]])["peak_d1"].mean()
    by_kind = train.groupby([train["kind"], train["month"]], observed=True)["peak_d1"].mean()
    kind_mean = train.groupby("kind", observed=True)["peak_d1"].mean()
    first = by_instrument.reindex(list(zip(ids, test["month"], strict=True))).to_numpy()
    second = by_kind.reindex(list(zip(test["kind"], test["month"], strict=True))).to_numpy()
    third = kind_mean.reindex(test["kind"]).to_numpy()
    value = np.where(np.isnan(first), np.where(np.isnan(second), third, second), first)
    return pd.DataFrame({"p50_d1": value, "p50_d2": value}, index=test.index)


def _fade_sum(hours: int) -> float:
    return FADE * (1 - FADE**hours) / (1 - FADE)


def v2_forecast(test: pd.DataFrame) -> pd.DataFrame:
    level, slope = test["level"].to_numpy(), test["slope3h"].fillna(0).to_numpy()

    def at(h: int):
        return level + slope * _fade_sum(h)

    d1 = np.maximum(at(DAY1_HOURS[0]), at(DAY1_HOURS[1]))
    d2 = np.maximum(at(DAY2_HOURS[0]), at(DAY2_HOURS[1]))
    return pd.DataFrame({"p50_d1": np.maximum(d1, 0), "p50_d2": np.maximum(d2, 0)}, index=test.index)


def physics_gain(train: pd.DataFrame) -> float | None:
    rows = train[(train["has_physics"] == 1) & train["peak_d1"].notna() & train["smoke_change"].notna()]
    if len(rows) < MIN_PHYSICS_ROWS or rows["smoke_change"].std() == 0:
        return None
    x, y = rows["smoke_change"].to_numpy(), (rows["peak_d1"] - rows["level"]).to_numpy()
    return float((x * y).sum() / (x * x).sum())


def physics(test: pd.DataFrame, gain: float | None) -> pd.DataFrame:
    if gain is None:
        empty = np.full(len(test), np.nan)
        return pd.DataFrame({"p50_d1": empty, "p50_d2": empty}, index=test.index)
    value = np.where(test["has_physics"] == 1, test["level"] + gain * test["smoke_change"], np.nan)
    return pd.DataFrame({"p50_d1": value, "p50_d2": value}, index=test.index)
