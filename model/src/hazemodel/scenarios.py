"""Named replays with pass lines: onset, end, fire loss, wind reversal, clean season, unseen instruments."""

import numpy as np
import pandas as pd

from hazemodel.index import pm25_to_api
from hazemodel.region import MALAYSIA_OFFSET
from hazemodel.backtest import embargo
from hazemodel.scores import HAZY_UGM3, ONSET_API, REFERENCE_KINDS, score
from hazemodel.splits import walk_forward
from hazemodel.train import predict_frame, train_artifact

MIN_ROWS = 20
ONSET_WINDOW = pd.Timedelta(days=3)
FIRE_LOSS_SHARE = 0.4
CLEAN_MONTHS = (1, 2, 3, 4)
CLEAN_LINE_API = 150
CLEAN_FALSE_ALARM_MAX = 0.02
END_BIAS_MAX = 10.0
ONSET_HIT_MIN = 0.5
HOLD_OUT_EVERY = 37
MIN_HELD_OUT = 5
TOLERANCE = 1.3
DAYS = (1,)


def _malaysian_days(test: pd.DataFrame) -> pd.Series:
    local = test.index.get_level_values("issue_at") + MALAYSIA_OFFSET
    return pd.Series(pd.DatetimeIndex(local.date), index=test.index)


def _season_starts(test: pd.DataFrame, days: pd.Series) -> list[pd.Timestamp]:
    """First Malaysian day of a year on which the median reference truth is hazy for three days running."""
    reference = test["kind"].astype(str).isin(REFERENCE_KINDS) & test["peak_d1"].notna()
    median = test.loc[reference, "peak_d1"].groupby(days[reference]).median().sort_index()
    hazy = (median >= HAZY_UGM3).to_numpy()
    starts: list[pd.Timestamp] = []
    for position in range(2, len(hazy)):
        day = median.index[position - 2]
        if hazy[position - 2 : position + 1].all() and all(s.year != day.year for s in starts):
            starts.append(day)
    return starts


def _wind_angle(test: pd.DataFrame) -> pd.Series:
    u_later, v_later = 2 * test["u48"] - test["u24"], 2 * test["v48"] - test["v24"]
    dot = test["u24"] * u_later + test["v24"] * v_later
    norm = np.hypot(test["u24"], test["v24"]) * np.hypot(u_later, v_later)
    return pd.Series(np.degrees(np.arccos(np.clip(dot / norm.replace(0, np.nan), -1, 1))), index=test.index)


def scenario_masks(test: pd.DataFrame) -> dict[str, pd.Series]:
    days = _malaysian_days(test)
    onset = pd.Series(False, index=test.index)
    for start in _season_starts(test, days):
        onset |= (days >= start - ONSET_WINDOW) & (days < start)
    hazy = test["level"] >= HAZY_UGM3
    before = test["fire_total_d3"] - test["fire_total_change"]
    masks = {
        "onset": onset,
        "end": (test["rain48"] >= 20) & hazy,
        "fire_dropout": hazy & (test["fire_total_change"] <= -FIRE_LOSS_SHARE * before),
        "wind_reversal": _wind_angle(test) > 90,
        "clean_season": test["month"].isin(CLEAN_MONTHS),
    }
    return {name: mask.fillna(False).astype(bool) for name, mask in masks.items()}


def _judge(name: str, test: pd.DataFrame, rows: pd.Series, model: pd.DataFrame, result: dict) -> bool | None:
    masked, said = test[rows], pm25_to_api(model.loc[rows, "p50_d1"].to_numpy(dtype=float))
    if name == "onset":
        crossing = pm25_to_api(masked["peak_d1"].to_numpy(dtype=float)) >= ONSET_API
        if not crossing.any():
            result["reason"] = "no crossings"
            return None
        result["hit_100"] = float((said[crossing] >= ONSET_API).mean())
        return bool(result["hit_100"] >= ONSET_HIT_MIN)
    if name == "end":
        return bool(result["model"]["bias"] < END_BIAS_MAX)
    if name == "fire_dropout":
        return bool(result["model"]["mae"] <= result["persistence"]["mae"])
    if name == "wind_reversal":
        band = model["p90_d1"] - model["p10_d1"]
        result["band_masked"], result["band_other"] = float(band[rows].mean()), float(band[~rows].mean())
        return bool(result["band_masked"] >= result["band_other"])
    result["false_alarm_share"] = float((said >= CLEAN_LINE_API).mean())
    return bool(result["false_alarm_share"] <= CLEAN_FALSE_ALARM_MAX)


def run_scenarios(all_test: pd.DataFrame, forecasts: dict[str, pd.DataFrame]) -> dict:
    model, persistence = forecasts["model"], forecasts["persistence"]
    usable = all_test["kind"].astype(str).isin(REFERENCE_KINDS) & all_test["peak_d1"].notna()
    usable &= model["p50_d1"].reindex(all_test.index).notna()
    out = {}
    for name, mask in scenario_masks(all_test).items():
        rows = mask & usable
        result: dict = {"rows": int(rows.sum())}
        if rows.sum() < MIN_ROWS:
            out[name] = {**result, "passed": None, "reason": "too few rows"}
            continue
        result["model"] = score(all_test[rows], model, 1)["reference"]
        result["persistence"] = score(all_test[rows], persistence, 1)["reference"]
        result["passed"] = _judge(name, all_test, rows, model, result)
        out[name] = result
    return out




def _reference_hazy_mae(tests: list[pd.DataFrame], forecasts: list[pd.DataFrame]) -> float:
    if not tests:
        return float("nan")
    return score(pd.concat(tests), pd.concat(forecasts), 1)["reference"]["hazy_mae"]


def unseen_instruments(frame: pd.DataFrame, params: dict, freq: str = "M", min_train_blocks: int = 1) -> dict:
    ids = sorted(frame.index.get_level_values("instrument_id").unique())
    held = ids[::HOLD_OUT_EVERY]
    if len(held) < MIN_HELD_OUT:
        held = ids[:MIN_HELD_OUT]
    is_held = frame.index.get_level_values("instrument_id").isin(held)
    seen_tests, seen_forecasts, held_tests, held_forecasts = [], [], [], []
    for _, full_train, test in walk_forward(frame[~is_held], freq=freq, min_train_blocks=min_train_blocks):
        artifact, _ = train_artifact(embargo(full_train, test, DAYS), params, days=DAYS)
        seen_tests.append(test)
        seen_forecasts.append(predict_frame(artifact, test))
        issues = test.index.get_level_values("issue_at")
        held_block = frame[is_held & frame.index.get_level_values("issue_at").isin(issues.unique())]
        if not held_block.empty:
            held_tests.append(held_block)
            held_forecasts.append(predict_frame(artifact, held_block))
    seen = _reference_hazy_mae(seen_tests, seen_forecasts)
    held_mae = _reference_hazy_mae(held_tests, held_forecasts)
    unknown = np.isnan(seen) or np.isnan(held_mae)
    return {
        "held_out": list(held),
        "seen_hazy_mae": seen,
        "held_out_hazy_mae": held_mae,
        "passed": None if unknown else bool(held_mae <= TOLERANCE * seen),
    }
