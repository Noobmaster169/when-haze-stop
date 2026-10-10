"""How a day-ahead peak forecast is judged: error, decision lines, band calibration, lead time."""
import numpy as np
import pandas as pd

from hazemodel.index import pm25_to_api
from hazemodel.region import MALAYSIA_OFFSET

HAZY_UGM3 = 35.0
LINES = (150, 200)
ONSET_API = 100
REFERENCE_KINDS = ("doe", "nea")


def _rate(numerator: int, denominator: int) -> float:
    return numerator / denominator if denominator else np.nan


def _one(truth: np.ndarray, p50: np.ndarray, p10, p90) -> dict:
    error = p50 - truth
    hazy = truth >= HAZY_UGM3
    out = {
        "cases": int(len(truth)),
        "mae": float(np.abs(error).mean()) if len(truth) else np.nan,
        "bias": float(error.mean()) if len(truth) else np.nan,
        "hazy_cases": int(hazy.sum()),
        "hazy_mae": float(np.abs(error[hazy]).mean()) if hazy.any() else np.nan,
        "hazy_bias": float(error[hazy].mean()) if hazy.any() else np.nan,
    }
    truth_api, p50_api = pm25_to_api(truth), pm25_to_api(p50)
    for line in LINES:
        event, said = truth_api >= line, p50_api >= line
        out[f"hit_{line}"] = _rate(int((event & said).sum()), int(event.sum()))
        out[f"far_{line}"] = _rate(int((~event & said).sum()), int(said.sum()))
    out["below_p10"] = float((truth < p10).mean()) if p10 is not None and len(truth) else np.nan
    out["above_p90"] = float((truth > p90).mean()) if p90 is not None and len(truth) else np.nan
    return out


def score(test: pd.DataFrame, forecast: pd.DataFrame, day: int) -> dict:
    truth_all = test[f"peak_d{day}"].to_numpy(dtype=float)
    p50_all = forecast[f"p50_d{day}"].reindex(test.index).to_numpy(dtype=float)
    has_band = f"p10_d{day}" in forecast and f"p90_d{day}" in forecast
    p10_all = forecast[f"p10_d{day}"].reindex(test.index).to_numpy(dtype=float) if has_band else None
    p90_all = forecast[f"p90_d{day}"].reindex(test.index).to_numpy(dtype=float) if has_band else None
    keep = ~np.isnan(truth_all) & ~np.isnan(p50_all)
    kinds = test["kind"].astype(str).to_numpy()
    out = {"dropped": int((~keep).sum())}
    groups = {kind: kinds == kind for kind in sorted(set(kinds))}
    groups["reference"] = np.isin(kinds, REFERENCE_KINDS)
    for name, mask in groups.items():
        rows = mask & keep
        out[name] = _one(
            truth_all[rows],
            p50_all[rows],
            p10_all[rows] if has_band else None,
            p90_all[rows] if has_band else None,
        )
    return out


def lead_to_onset(test: pd.DataFrame, forecasts_by_day: dict[int, pd.DataFrame]) -> pd.DataFrame:
    rows = []
    ids = test.index.get_level_values("instrument_id")
    for instrument_id in ids.unique():
        own = test[ids == instrument_id].sort_index(level="issue_at")
        days = (own.index.get_level_values("issue_at") + MALAYSIA_OFFSET).date
        truth = pm25_to_api(own["peak_d1"].to_numpy(dtype=float))
        for position in range(3, len(own)):
            if truth[position] >= ONSET_API and np.all(truth[position - 3 : position] < ONSET_API):
                lead = 0
                for d in (2, 1):
                    earlier = position - (d - 1)
                    if earlier < 0 or d not in forecasts_by_day:
                        continue
                    said = forecasts_by_day[d][f"p50_d{d}"].reindex(own.index).to_numpy(dtype=float)[earlier]
                    if not np.isnan(said) and pm25_to_api(said) >= ONSET_API:
                        lead = max(lead, d)
                onset_day = days[position] + pd.Timedelta(days=1)
                rows.append({"instrument_id": instrument_id, "onset_day": onset_day, "lead_days": lead})
    return pd.DataFrame(rows, columns=["instrument_id", "onset_day", "lead_days"])


def bootstrap_difference(
    test: pd.DataFrame, a: pd.DataFrame, b: pd.DataFrame, day: int, draws: int = 500, seed: int = 1
) -> tuple[float, float]:
    truth = test[f"peak_d{day}"].to_numpy(dtype=float)
    ea = np.abs(a[f"p50_d{day}"].reindex(test.index).to_numpy(dtype=float) - truth)
    eb = np.abs(b[f"p50_d{day}"].reindex(test.index).to_numpy(dtype=float) - truth)
    keep = ~np.isnan(ea) & ~np.isnan(eb)
    issue = test.index.get_level_values("issue_at").to_numpy()[keep]
    ea, eb = ea[keep], eb[keep]
    days = np.unique(issue)
    rng = np.random.default_rng(seed)
    diffs = []
    for _ in range(draws):
        chosen = rng.choice(days, size=len(days), replace=True)
        picked = np.concatenate([np.flatnonzero(issue == one) for one in chosen]) if len(chosen) else np.array([], int)
        diffs.append(ea[picked].mean() - eb[picked].mean() if len(picked) else np.nan)
    return float(np.nanpercentile(diffs, 5)), float(np.nanpercentile(diffs, 95))
