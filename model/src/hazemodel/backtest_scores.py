"""The numbers a backtest reports: scores on common rows, intervals and onset leads, each by kind."""

import numpy as np
import pandas as pd

from hazemodel.scores import REFERENCE_KINDS, bootstrap_difference, lead_to_onset, score

COMMON = ("model", "persistence", "climatology", "v2")


def _finite(forecasts: dict[str, pd.DataFrame], name: str, day: int, index: pd.Index) -> np.ndarray:
    column = f"p50_d{day}"
    if column not in forecasts[name]:
        return np.zeros(len(index), dtype=bool)
    return np.isfinite(forecasts[name][column].reindex(index).to_numpy(dtype=float))


def scores(test: pd.DataFrame, forecasts: dict[str, pd.DataFrame], days) -> dict:
    """The model, persistence, climatology and v2 are scored on the rows where all four (and the truth) exist, so
    their errors are comparable. Physics covers fewer rows by nature: it is scored on its own rows, and the model
    is scored again on exactly those rows beside it."""
    out: dict = {name: {} for name in forecasts}
    out["common_cases"], out["model_on_physics_rows"] = {}, {}
    for d in days:
        if f"p50_d{d}" not in forecasts["model"]:
            continue
        key = f"d{d}"
        truth = np.isfinite(test[f"peak_d{d}"].to_numpy(dtype=float))
        common = truth.copy()
        for name in COMMON:
            common &= _finite(forecasts, name, d, test.index)
        out["common_cases"][key] = int(common.sum())
        for name in COMMON:
            out[name][key] = score(test[common], forecasts[name], d)
        out["physics"][key] = score(test, forecasts["physics"], d)
        on_physics = truth & _finite(forecasts, "physics", d, test.index)
        out["model_on_physics_rows"][key] = score(test[on_physics], forecasts["model"], d)
    return out


def _groups(test: pd.DataFrame) -> dict[str, np.ndarray]:
    kinds = test["kind"].astype(str).to_numpy()
    groups = {kind: kinds == kind for kind in sorted(set(kinds))}
    groups["reference"] = np.isin(kinds, REFERENCE_KINDS)
    return groups


def intervals(test: pd.DataFrame, forecasts: dict[str, pd.DataFrame], days) -> dict:
    model = forecasts["model"]
    out: dict = {}
    for d in days:
        if f"p50_d{d}" not in model:
            continue
        out[f"d{d}"] = {
            kind: {
                "model_minus_persistence": list(bootstrap_difference(test[mask], model, forecasts["persistence"], d)),
                "model_minus_v2": list(bootstrap_difference(test[mask], model, forecasts["v2"], d)),
            }
            for kind, mask in _groups(test).items()
        }
    return out


def onset(test: pd.DataFrame, forecasts: dict[str, pd.DataFrame], days) -> dict:
    out: dict = {}
    for kind, mask in _groups(test).items():
        part = test[mask]
        entry: dict = {}
        for name in ("model", "persistence", "v2"):
            usable = {d: forecasts[name] for d in days if f"p50_d{d}" in forecasts[name]}
            leads = lead_to_onset(part, usable) if len(part) else pd.DataFrame({"lead_days": []})
            entry[name] = float(leads["lead_days"].mean()) if len(leads) else float("nan")
            entry["cases"] = int(len(leads))
        out[kind] = entry
    return out
