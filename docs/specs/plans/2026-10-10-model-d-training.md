# Training and testing (track D) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Train the quantile LightGBM models on the parquet track A writes, backtest them walk-forward against four baselines, run the scenario suite, the leak tests and the ablation, write a committed report per version, promote by rule, and fill `docs/MODEL.md` with the first results.

**Architecture:** Pure functions over the feature frame: `splits` cuts it, `baselines` and `train` make forecasts, `scores` measures them, `backtest` loops, `scenarios`, `leaks` and `ablation` reuse the loop, `report` writes what happened, `promote` compares. The CLI from track A gains one subcommand per job.

**Tech Stack:** Python 3.10, pandas, numpy, lightgbm, pytest. Reads `model/data/*.parquet` (track A) and `smoke_hindcasts` through it (track C).

**Spec:** `docs/specs/2026-10-10-predictive-model-design.md`, sections 6, 7, 8.1, 10, 12.

## Global Constraints

- Everything from track A's Global Constraints applies: no SQL outside `store.py`, no writes to the database, fixtures only in tests, files under 200 lines, no emoji or em dashes, commit trailer `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`.
- Never a random split. Every score in a report comes from rows whose issue time is after every row the model was trained on.
- Scores are reported by instrument kind and never pooled across kinds, except the walk-forward promotion score, which is defined below as the reference-kind hazy-day MAE at day +1.
- A hazy day is a row whose truth is 35 ug/m3 or more. The target weight triples above 55 ug/m3 (set in track A's `build.py`).
- Every score carries `wind_source`: `analysis` when the parquet's `from_forecast` column is all 0, `forecast` when all 1, `mixed` otherwise.
- Hyperparameters live in `model/params.json`, committed, and are searched only on the first six months of a parquet.
- Reports under `model/reports/<version>/` are committed. Artifacts and data are not.
- The tests build their frame from track A's CSV fixtures (one week), so the harness is tested with `freq="D"` splits; `freq="M"` is what runs on the real parquet.
- Run tests as `cd model && .venv/bin/pytest -q`, lint as `.venv/bin/ruff check .`.

## Review Focus

1. A test month with no hazy rows for a kind (January for Singapore): hazy MAE must be `NaN` with `cases = 0`, never a division error or a silent 0. Pinned in Task 2 (`test_scores_with_no_hazy_rows`).
2. A target that is NaN (the instrument went silent the next day): that row must be dropped for that target and counted, never trained on. Pinned in Task 3 (`test_train_drops_rows_without_target`).
3. A test month in which every row is before the first training month (a mis-sorted parquet): the walk-forward must refuse with a clear error, not train on nothing. Pinned in Task 1 (`test_walk_forward_refuses_a_test_block_before_training`).
4. Promotion when there is no live model: the first artifact must be promoted, and promotion must refuse an artifact whose report lacks the promotion score. Pinned in Task 8 (`test_promote_first_and_refuse_without_score`).
5. The recursive day +2 selection when the direct model has no rows (a parquet whose `peak_d2` is all NaN): recursive must serve day +2 and the report must say so. Pinned in Task 5 (`test_direct_or_recursive_without_d2`).

---

### Task 1: Walk-forward splits and the four baselines

**Files:**
- Create: `model/src/hazemodel/splits.py`, `model/src/hazemodel/baselines.py`, `model/tests/conftest.py` (extend), `model/tests/test_splits.py`, `model/tests/test_baselines.py`

**Interfaces:**
- Consumes: the feature frame from `build_rows(..., with_targets=True)` (track A), indexed by `(instrument_id, issue_at)`, columns including `level, peak24, slope3h, lag24, kind, month, smoke_change, has_physics, peak_d1, peak_d2, weight_d1, weight_d2`.
- Produces:
  - `walk_forward(frame, freq: str, min_train_blocks: int = 1) -> Iterator[tuple[str, pd.DataFrame, pd.DataFrame]]`: yields `(block_label, train, test)` for each period block after the first `min_train_blocks`; `freq` is `"M"` or `"D"`; raises `ValueError` when a test block's issue times are not all after the train block's.
  - `persistence(test) -> pd.DataFrame` with columns `p50_d1, p50_d2` equal to `peak24`.
  - `climatology(train, test) -> pd.DataFrame`: the instrument's mean `peak_d1` by month in `train`; falls back to the kind's mean by month, then the kind's overall mean.
  - `v2_forecast(test) -> pd.DataFrame`: the port of `backend/src/haze/station-forecast.ts`: `pm25(h) = level + slope3h * sum(0.9^k, k = 1..h)`; day +1 covers hours 16 to 39 after an 08:00 Malaysian issue and day +2 hours 40 to 63; the peak of a monotone series is at one end, so `p50_d1 = max(pm25(16), pm25(39))`, `p50_d2 = max(pm25(40), pm25(63))`.
  - `physics_gain(train) -> float | None`: least squares gain of `peak_d1 - level` on `smoke_change` over rows with `has_physics == 1`, `None` when fewer than 100 such rows.
  - `physics(test, gain) -> pd.DataFrame`: `p50_d1 = p50_d2 = level + gain * smoke_change`, NaN where `has_physics == 0` or gain is None.

- [ ] **Step 1: Extend conftest with the fixture frame, then write the failing tests**

```python
# model/tests/conftest.py  (add below the existing fixture)
import pandas as pd

from hazemodel.features.build import build_rows
from hazemodel.region import region_from_env

FIXTURE_ISSUES = pd.date_range("2026-10-04", "2026-10-09", freq="D", tz="UTC")


@pytest.fixture(scope="session")
def frame(data) -> pd.DataFrame:
    rows, _ = build_rows(data, region_from_env(), FIXTURE_ISSUES, with_targets=True)
    return rows
```

```python
# model/tests/test_splits.py
import pandas as pd
import pytest

from hazemodel.splits import walk_forward


def test_walk_forward_by_day_keeps_time_order(frame):
    blocks = list(walk_forward(frame, freq="D", min_train_blocks=2))
    assert len(blocks) == 4
    for label, train, test in blocks:
        assert train.index.get_level_values("issue_at").max() < test.index.get_level_values("issue_at").min()
        assert label == test.index.get_level_values("issue_at")[0].strftime("%Y-%m-%d")


def test_walk_forward_refuses_a_test_block_before_training(frame):
    shuffled = frame.copy()
    issue = shuffled.index.get_level_values("issue_at")
    swapped = issue.where(issue != issue.min(), issue.max() + pd.Timedelta(days=1))
    shuffled.index = pd.MultiIndex.from_arrays([shuffled.index.get_level_values("instrument_id"), swapped], names=shuffled.index.names)
    with pytest.raises(ValueError):
        list(walk_forward(shuffled.sort_index(ascending=[True, False]), freq="D", strict_order=True))
```

```python
# model/tests/test_baselines.py
import numpy as np

from hazemodel.baselines import climatology, persistence, physics, physics_gain, v2_forecast


def test_persistence_is_the_last_days_peak(frame):
    out = persistence(frame)
    assert (out["p50_d1"] == frame["peak24"]).all()
    assert (out["p50_d2"] == frame["peak24"]).all()


def test_climatology_falls_back_to_kind(frame):
    train = frame.iloc[: len(frame) // 2]
    test = frame.iloc[len(frame) // 2 :]
    out = climatology(train, test)
    assert out["p50_d1"].notna().all()
    assert len(out) == len(test)


def test_v2_rises_with_a_positive_slope(frame):
    out = v2_forecast(frame)
    rising = frame["slope3h"] > 0
    assert (out.loc[rising, "p50_d1"] >= frame.loc[rising, "level"] - 1e-9).all()
    falling = frame["slope3h"] < 0
    assert (out.loc[falling, "p50_d1"] <= frame.loc[falling, "level"] + 1e-9).all()
    # The fade sums to 9 at most, so the forecast never moves more than 9 times the slope.
    assert ((out["p50_d2"] - frame["level"]).abs() <= 9.0 * frame["slope3h"].abs() + 1e-6).all()


def test_physics_is_nan_without_hindcasts(frame):
    gain = physics_gain(frame)
    out = physics(frame, gain)
    if (frame["has_physics"] == 0).all():
        assert gain is None
        assert out["p50_d1"].isna().all()
    else:
        assert np.isfinite(out.loc[frame["has_physics"] == 1, "p50_d1"]).all()
```

- [ ] **Step 2: Run them to verify they fail**

Run: `cd model && .venv/bin/pytest -q tests/test_splits.py tests/test_baselines.py`
Expected: FAIL, modules not found

- [ ] **Step 3: Write splits.py and baselines.py**

```python
# model/src/hazemodel/splits.py
"""Walk-forward blocks: train on everything up to a period, test on the next. Never a random split.

A random split leaks tomorrow into today through autocorrelation and makes every model look
brilliant. Time order is checked on every block.
"""
from collections.abc import Iterator

import pandas as pd


def _period_labels(frame: pd.DataFrame, freq: str) -> pd.Series:
    issue = frame.index.get_level_values("issue_at")
    return pd.Series(issue.tz_convert(None).to_period(freq).astype(str), index=frame.index)


def walk_forward(frame: pd.DataFrame, freq: str, min_train_blocks: int = 1, strict_order: bool = True) -> Iterator[tuple[str, pd.DataFrame, pd.DataFrame]]:
    labels = _period_labels(frame, freq)
    periods = sorted(labels.unique())
    for position in range(min_train_blocks, len(periods)):
        test_label = periods[position]
        train = frame[labels.isin(periods[:position])]
        test = frame[labels == test_label]
        if strict_order and not train.empty and train.index.get_level_values("issue_at").max() >= test.index.get_level_values("issue_at").min():
            raise ValueError(f"test block {test_label} is not after every training row")
        yield test.index.get_level_values("issue_at")[0].strftime("%Y-%m-%d" if freq == "D" else "%Y-%m"), train, test
```

```python
# model/src/hazemodel/baselines.py
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
    first = by_instrument.reindex(list(zip(ids, test["month"]))).to_numpy()
    second = by_kind.reindex(list(zip(test["kind"], test["month"]))).to_numpy()
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
```

- [ ] **Step 4: Run the tests**

Run: `cd model && .venv/bin/pytest -q tests/test_splits.py tests/test_baselines.py && .venv/bin/ruff check .`
Expected: `6 passed`

- [ ] **Step 5: Commit**

```bash
git add model/src/hazemodel/splits.py model/src/hazemodel/baselines.py model/tests/conftest.py model/tests/test_splits.py model/tests/test_baselines.py
git commit -m "Add walk-forward splits and the four baseline forecasts

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

### Task 2: Scores

**Files:**
- Create: `model/src/hazemodel/scores.py`, `model/tests/test_scores.py`

**Interfaces:**
- Produces:
  - `score(test, forecast, day: int) -> dict`: for one target day, given `forecast` with `p50_d{day}` and optionally `p10_d{day}`, `p90_d{day}`, returns, per kind and pooled over reference kinds (`doe` and `nea`, key `"reference"`), `{cases, mae, bias, hazy_cases, hazy_mae, hazy_bias, hit_150, far_150, hit_200, far_200, below_p10, above_p90}`. Hit rate and false alarm ratio use `pm25_to_api` on truth and `p50`; `hit_L = hits / events`, `far_L = false_alarms / forecast_events`, NaN when the denominator is 0. `below_p10` and `above_p90` are the shares of truths outside the band, NaN without quantile columns. Rows with NaN truth or NaN forecast are excluded and counted in `dropped`.
  - `lead_to_onset(test, forecasts_by_day: dict[int, pd.DataFrame]) -> pd.DataFrame`: one row per onset `(instrument_id, onset_day, lead_days)`; an onset is a target day whose truth API is 100 or more after three days below 100; `lead_days` is the largest `d` in `{1, 2}` for which the forecast issued `d` days before the onset had `p50` API of 100 or more, else 0.
  - `bootstrap_difference(test, a, b, day, draws=500, seed=1) -> tuple[float, float]`: the 5th and 95th percentile of `mae(a) - mae(b)` over resamples of whole issue days.
  - `HAZY_UGM3 = 35.0`, `LINES = (150, 200)`, `ONSET_API = 100`.

- [ ] **Step 1: Write the failing tests**

```python
# model/tests/test_scores.py
import numpy as np
import pandas as pd

from hazemodel.baselines import persistence
from hazemodel.index import api_to_pm25
from hazemodel.scores import bootstrap_difference, lead_to_onset, score


def test_score_persistence_by_kind(frame):
    out = score(frame, persistence(frame), day=1)
    assert "reference" in out and "airport" in out
    ref = out["reference"]
    assert ref["cases"] > 0
    assert ref["mae"] >= 0
    assert np.isnan(ref["below_p10"])
    assert "dropped" in out


def test_perfect_forecast_scores_zero(frame):
    perfect = pd.DataFrame({"p50_d1": frame["peak_d1"], "p10_d1": frame["peak_d1"] - 1, "p90_d1": frame["peak_d1"] + 1}, index=frame.index)
    out = score(frame, perfect, day=1)
    assert out["reference"]["mae"] == 0
    assert out["reference"]["below_p10"] == 0 and out["reference"]["above_p90"] == 0
    if out["reference"]["hazy_cases"] > 0:
        assert out["reference"]["hit_150"] in (1.0,) or np.isnan(out["reference"]["hit_150"])


def test_scores_with_no_hazy_rows(frame):
    clean = frame.copy()
    clean["peak_d1"] = 5.0
    out = score(clean, persistence(clean), day=1)
    assert out["reference"]["hazy_cases"] == 0
    assert np.isnan(out["reference"]["hazy_mae"])
    assert np.isnan(out["reference"]["hit_150"])


def test_lead_to_onset_finds_a_crossing(frame):
    crafted = frame.copy()
    ids = crafted.index.get_level_values("instrument_id")
    issue = crafted.index.get_level_values("issue_at")
    one = ids == "SGCENTRAL"
    crafted.loc[one, "peak_d1"] = api_to_pm25(60)
    last = issue[one].max()
    crafted.loc[one & (issue == last), "peak_d1"] = api_to_pm25(120)
    forecast = pd.DataFrame({"p50_d1": crafted["peak_d1"], "p50_d2": crafted["peak_d1"]}, index=crafted.index)
    leads = lead_to_onset(crafted, {1: forecast, 2: forecast})
    row = leads[leads["instrument_id"] == "SGCENTRAL"]
    assert len(row) == 1
    assert row["lead_days"].iloc[0] >= 1


def test_bootstrap_interval_contains_zero_for_identical_forecasts(frame):
    a = persistence(frame)
    low, high = bootstrap_difference(frame, a, a, day=1, draws=50)
    assert low == 0 and high == 0
```

- [ ] **Step 2: Run them to verify they fail**

Run: `cd model && .venv/bin/pytest -q tests/test_scores.py`
Expected: FAIL, module not found

- [ ] **Step 3: Write scores.py**

```python
# model/src/hazemodel/scores.py
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
        out[name] = _one(truth_all[rows], p50_all[rows], p10_all[rows] if has_band else None, p90_all[rows] if has_band else None)
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
                rows.append({"instrument_id": instrument_id, "onset_day": days[position] + pd.Timedelta(days=1), "lead_days": lead})
    return pd.DataFrame(rows, columns=["instrument_id", "onset_day", "lead_days"])


def bootstrap_difference(test: pd.DataFrame, a: pd.DataFrame, b: pd.DataFrame, day: int, draws: int = 500, seed: int = 1) -> tuple[float, float]:
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
        mask = np.concatenate([np.flatnonzero(issue == day) for day in chosen]) if len(chosen) else np.array([], dtype=int)
        diffs.append(ea[mask].mean() - eb[mask].mean() if len(mask) else np.nan)
    return float(np.nanpercentile(diffs, 5)), float(np.nanpercentile(diffs, 95))
```

- [ ] **Step 4: Run the tests**

Run: `cd model && .venv/bin/pytest -q tests/test_scores.py && .venv/bin/ruff check .`
Expected: `5 passed`

- [ ] **Step 5: Commit**

```bash
git add model/src/hazemodel/scores.py model/tests/test_scores.py
git commit -m "Score day-ahead peak forecasts by kind, decision line, band and lead time

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

### Task 3: Training

**Files:**
- Create: `model/src/hazemodel/train.py`, `model/params.json`, `model/tests/test_train.py`

**Interfaces:**
- Consumes: `Artifact`, `save_artifact` (track A `artifacts.py`), the feature frame.
- Produces:
  - `feature_columns(frame) -> list[str]`: every column except `kind`, `reference_weight`, and those starting with `peak_`, `weight_`, `censored_`. (`kind_code` is in; `from_forecast` is in, so a live row can say it came from a forecast.)
  - `load_params(path=None) -> dict` reading `model/params.json`.
  - `fit_quantiles(frame, day: int, features, params) -> tuple[dict[str, lgb.Booster], int]`: three boosters keyed `d{day}_q10/q50/q90`, trained on rows with a finite target and `weight_d{day} > 0`, with `weight` as the sample weight and `kind_code` as a categorical feature; returns the boosters and the number of rows used.
  - `train_artifact(frame, params, version: str | None = None, days=(1, 2)) -> tuple[Artifact, dict]`: fits both days; the version is `<today>-<sha1 of sorted feature list + params json + len(frame)>[:8]` when None; returns the artifact and `{"rows": {"d1": n, "d2": n}, "dropped": {...}}`.
  - `predict_frame(artifact, frame) -> pd.DataFrame` with `p10_d1, p50_d1, p90_d1, p10_d2, p50_d2, p90_d2` (direct models only; the recursive path is `predict.py` from track A and Task 5 here), quantiles sorted, floored at 0.

```json
// model/params.json
{
  "objective": "quantile",
  "num_leaves": 31,
  "learning_rate": 0.05,
  "min_data_in_leaf": 100,
  "feature_fraction": 0.8,
  "bagging_fraction": 0.8,
  "bagging_freq": 1,
  "lambda_l2": 1.0,
  "num_boost_round": 600,
  "verbose": -1,
  "seed": 7
}
```

- [ ] **Step 1: Write the failing tests**

```python
# model/tests/test_train.py
import numpy as np

from hazemodel.train import feature_columns, fit_quantiles, load_params, predict_frame, train_artifact

SMALL = {"num_leaves": 4, "min_data_in_leaf": 2, "num_boost_round": 20, "learning_rate": 0.1}


def test_feature_columns_exclude_targets_and_weights(frame):
    columns = feature_columns(frame)
    assert "kind_code" in columns and "level" in columns and "from_forecast" in columns
    assert not any(c.startswith(("peak_", "weight_", "censored_")) or c in ("kind", "reference_weight") for c in columns)


def test_fit_quantiles_uses_weighted_rows_only(frame):
    params = {**load_params(), **SMALL}
    boosters, used = fit_quantiles(frame, 1, feature_columns(frame), params)
    assert set(boosters) == {"d1_q10", "d1_q50", "d1_q90"}
    eligible = frame["peak_d1"].notna() & (frame["weight_d1"] > 0)
    assert used == int(eligible.sum())


def test_train_drops_rows_without_target(frame):
    broken = frame.copy()
    broken["peak_d2"] = np.nan
    params = {**load_params(), **SMALL}
    artifact, info = train_artifact(broken, params, days=(1, 2))
    assert info["rows"]["d2"] == 0
    assert "d2_q50" not in artifact.boosters
    assert "d1_q50" in artifact.boosters


def test_predict_frame_sorted_quantiles_and_version(frame):
    params = {**load_params(), **SMALL}
    artifact, _ = train_artifact(frame, params)
    out = predict_frame(artifact, frame)
    assert (out["p10_d1"] <= out["p50_d1"]).all() and (out["p50_d1"] <= out["p90_d1"]).all()
    assert (out["p10_d1"] >= 0).all()
    assert len(artifact.version.split("-")) == 4
    again, _ = train_artifact(frame, params)
    assert again.version == artifact.version
```

- [ ] **Step 2: Run them to verify they fail**

Run: `cd model && .venv/bin/pytest -q tests/test_train.py`
Expected: FAIL, module not found

- [ ] **Step 3: Write train.py and params.json**

```python
# model/src/hazemodel/train.py
"""Fit the quantile models. Three LightGBM boosters per target day, weighted toward hazy days."""
import datetime as dt
import hashlib
import json
import pathlib

import lightgbm as lgb
import numpy as np
import pandas as pd

from hazemodel.artifacts import Artifact

QUANTILES = (10, 50, 90)
EXCLUDED = ("kind", "reference_weight")
EXCLUDED_PREFIXES = ("peak_", "weight_", "censored_")
PARAMS_PATH = pathlib.Path(__file__).resolve().parents[2] / "params.json"


def feature_columns(frame: pd.DataFrame) -> list[str]:
    return [c for c in frame.columns if c not in EXCLUDED and not c.startswith(EXCLUDED_PREFIXES)]


def load_params(path: pathlib.Path | None = None) -> dict:
    return json.loads((path or PARAMS_PATH).read_text())


def _eligible(frame: pd.DataFrame, day: int) -> pd.DataFrame:
    return frame[frame[f"peak_d{day}"].notna() & (frame[f"weight_d{day}"] > 0)]


def fit_quantiles(frame: pd.DataFrame, day: int, features: list[str], params: dict) -> tuple[dict[str, lgb.Booster], int]:
    rows = _eligible(frame, day)
    if rows.empty:
        return {}, 0
    x = rows[features].to_numpy(dtype=float)
    y = rows[f"peak_d{day}"].to_numpy(dtype=float)
    w = rows[f"weight_d{day}"].to_numpy(dtype=float)
    categorical = [features.index("kind_code")] if "kind_code" in features else []
    rounds = int(params.get("num_boost_round", 600))
    settings = {k: v for k, v in params.items() if k != "num_boost_round"}
    boosters = {}
    for q in QUANTILES:
        dataset = lgb.Dataset(x, y, weight=w, feature_name=features, categorical_feature=categorical, free_raw_data=False)
        boosters[f"d{day}_q{q}"] = lgb.train({**settings, "objective": "quantile", "alpha": q / 100, "verbose": -1}, dataset, rounds)
    return boosters, int(len(rows))


def _version(features: list[str], params: dict, rows: int) -> str:
    digest = hashlib.sha1(f"{sorted(features)}|{json.dumps(params, sort_keys=True)}|{rows}".encode()).hexdigest()[:8]
    return f"{dt.date.today().isoformat()}-{digest}"


def train_artifact(frame: pd.DataFrame, params: dict, version: str | None = None, days=(1, 2)) -> tuple[Artifact, dict]:
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
```

Write `model/params.json` with the JSON above (without the comment line).

- [ ] **Step 4: Run the tests**

Run: `cd model && .venv/bin/pytest -q tests/test_train.py && .venv/bin/ruff check .`
Expected: `4 passed`

- [ ] **Step 5: Commit**

```bash
git add model/src/hazemodel/train.py model/params.json model/tests/test_train.py
git commit -m "Train the weighted quantile models and predict a frame

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

### Task 4: The walk-forward backtest

**Files:**
- Create: `model/src/hazemodel/backtest.py`, `model/tests/test_backtest.py`

**Interfaces:**
- Consumes: Tasks 1 to 3.
- Produces:
  - `wind_source(frame) -> str`: `analysis`, `forecast` or `mixed` from `from_forecast`.
  - `run_backtest(frame, params, freq="M", min_train_blocks=1, days=(1, 2)) -> dict`:
    ```
    {
      "wind_source": str, "freq": str, "blocks": int, "rows": int,
      "by_block": [{"block": label, "train_rows": n, "test_rows": n, "model": {d1: score, d2: score}, "persistence": {...}, "climatology": {...}, "v2": {...}, "physics": {...}}],
      "pooled": {"model": {d1: score, d2: score}, "persistence": ..., "climatology": ..., "v2": ..., "physics": ...},
      "interval": {d1: {"model_minus_persistence": [low, high], "model_minus_v2": [low, high]}, d2: {...}},
      "onset": {"model": mean lead days, "persistence": ..., "v2": ..., "cases": n},
      "promotion_score": pooled model d1 reference hazy_mae
    }
    ```
    Pooled scores concatenate every block's test rows and forecasts, then call `score` once, so a block with few rows does not count as much as a block with many.

- [ ] **Step 1: Write the failing test**

```python
# model/tests/test_backtest.py
import numpy as np

from hazemodel.backtest import run_backtest, wind_source
from hazemodel.train import load_params

SMALL = {"num_leaves": 4, "min_data_in_leaf": 2, "num_boost_round": 20, "learning_rate": 0.1}


def test_backtest_by_day_on_the_fixture(frame):
    result = run_backtest(frame, {**load_params(), **SMALL}, freq="D", min_train_blocks=2)
    assert result["wind_source"] == "analysis"
    assert result["blocks"] == 4
    assert len(result["by_block"]) == 4
    pooled = result["pooled"]
    for name in ("model", "persistence", "climatology", "v2", "physics"):
        assert name in pooled
    assert pooled["model"]["d1"]["reference"]["cases"] > 0
    assert pooled["persistence"]["d1"]["reference"]["mae"] >= 0
    low, high = result["interval"]["d1"]["model_minus_persistence"]
    assert low <= high
    assert np.isfinite(result["promotion_score"]) or pooled["model"]["d1"]["reference"]["hazy_cases"] == 0
    assert result["onset"]["cases"] >= 0


def test_wind_source_labels(frame):
    assert wind_source(frame) == "analysis"
    mixed = frame.copy()
    mixed.iloc[0, mixed.columns.get_loc("from_forecast")] = 1
    assert wind_source(mixed) == "mixed"
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd model && .venv/bin/pytest -q tests/test_backtest.py`
Expected: FAIL, module not found

- [ ] **Step 3: Write backtest.py**

```python
# model/src/hazemodel/backtest.py
"""Walk-forward backtest: train up to each block, forecast the next, score the model and every baseline on the same rows."""
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
    return {name: {f"d{d}": score(test, frame, d) for d in days if f"p50_d{d}" in frame} for name, frame in forecasts.items()}


def run_backtest(frame: pd.DataFrame, params: dict, freq: str = "M", min_train_blocks: int = 1, days=(1, 2)) -> dict:
    by_block, tests, pooled_forecasts = [], [], {name: [] for name in ("model", *BASELINES)}
    for label, train, test in walk_forward(frame, freq=freq, min_train_blocks=min_train_blocks):
        forecasts = _forecasts(train, test, params, days)
        by_block.append({"block": label, "train_rows": len(train), "test_rows": len(test), **_scores(test, forecasts, days)})
        tests.append(test)
        for name, forecast in forecasts.items():
            pooled_forecasts[name].append(forecast)
    all_test = pd.concat(tests)
    all_forecasts = {name: pd.concat(frames) for name, frames in pooled_forecasts.items()}
    pooled = _scores(all_test, all_forecasts, days)
    interval = {
        f"d{d}": {
            "model_minus_persistence": list(bootstrap_difference(all_test, all_forecasts["model"], all_forecasts["persistence"], d)),
            "model_minus_v2": list(bootstrap_difference(all_test, all_forecasts["model"], all_forecasts["v2"], d)),
        }
        for d in days
        if f"p50_d{d}" in all_forecasts["model"]
    }
    onset = {}
    for name in ("model", "persistence", "v2"):
        leads = lead_to_onset(all_test, {d: all_forecasts[name] for d in days if f"p50_d{d}" in all_forecasts[name]})
        onset[name] = float(leads["lead_days"].mean()) if len(leads) else float("nan")
        onset["cases"] = int(len(leads))
    return {
        "wind_source": wind_source(frame),
        "freq": freq,
        "blocks": len(by_block),
        "rows": int(len(frame)),
        "by_block": by_block,
        "pooled": pooled,
        "interval": interval,
        "onset": onset,
        "promotion_score": pooled["model"]["d1"]["reference"]["hazy_mae"] if "d1" in pooled["model"] else float("nan"),
    }
```

- [ ] **Step 4: Run the tests**

Run: `cd model && .venv/bin/pytest -q tests/test_backtest.py && .venv/bin/ruff check .`
Expected: `2 passed`

- [ ] **Step 5: Commit**

```bash
git add model/src/hazemodel/backtest.py model/tests/test_backtest.py
git commit -m "Run the walk-forward backtest against every baseline

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

### Task 5: Direct against recursive for day +2

**Files:**
- Create: `model/src/hazemodel/recursive.py`, `model/tests/test_recursive.py`

**Interfaces:**
- Consumes: `predict_rows` and `_rolled` from track A's `predict.py` (import `_rolled` as `rolled`; rename it in `predict.py` to a public `rolled` in this task), `train_artifact`, `score`.
- Produces:
  - `recursive_day2(artifact, test) -> pd.DataFrame` with `p10_d2, p50_d2, p90_d2`: the `d1` boosters applied to `rolled(test, p50_d1)`.
  - `choose_day2(result_direct: dict, result_recursive: dict) -> dict`: `{"serves_d2": "direct" | "recursive", "direct_hazy_mae": x, "recursive_hazy_mae": y, "rule": "recursive within 5% of direct"}`; recursive when `y <= 1.05 * x` or when `x` is NaN (no direct model).
  - `run_recursive_comparison(frame, params, freq, min_train_blocks) -> dict`: walk-forward, both forecasts per block, pooled reference hazy MAE at day +2 for each, and the choice.

- [ ] **Step 1: Write the failing tests**

```python
# model/tests/test_recursive.py
import numpy as np

from hazemodel.recursive import choose_day2, recursive_day2, run_recursive_comparison
from hazemodel.train import load_params, train_artifact

SMALL = {"num_leaves": 4, "min_data_in_leaf": 2, "num_boost_round": 20, "learning_rate": 0.1}


def test_recursive_day2_has_sorted_quantiles(frame):
    artifact, _ = train_artifact(frame, {**load_params(), **SMALL}, days=(1,))
    out = recursive_day2(artifact, frame)
    assert set(out.columns) == {"p10_d2", "p50_d2", "p90_d2"}
    assert (out["p10_d2"] <= out["p50_d2"]).all() and (out["p50_d2"] <= out["p90_d2"]).all()


def test_choose_day2_rule():
    assert choose_day2({"hazy_mae": 10.0}, {"hazy_mae": 10.4})["serves_d2"] == "recursive"
    assert choose_day2({"hazy_mae": 10.0}, {"hazy_mae": 10.6})["serves_d2"] == "direct"


def test_direct_or_recursive_without_d2(frame):
    broken = frame.copy()
    broken["peak_d2"] = np.nan
    result = run_recursive_comparison(broken, {**load_params(), **SMALL}, freq="D", min_train_blocks=2)
    assert result["serves_d2"] == "recursive"
    assert np.isnan(result["direct_hazy_mae"])
```

- [ ] **Step 2: Run them to verify they fail**

Run: `cd model && .venv/bin/pytest -q tests/test_recursive.py`
Expected: FAIL, module not found

- [ ] **Step 3: Rename `_rolled` to `rolled` in `predict.py`, then write recursive.py**

In `model/src/hazemodel/predict.py` rename `_rolled` to `rolled` (definition and its one call).

```python
# model/src/hazemodel/recursive.py
"""Day +2 two ways: a direct model, or the day +1 model fed its own median. The backtest picks one."""
import numpy as np
import pandas as pd

from hazemodel.artifacts import Artifact
from hazemodel.predict import rolled
from hazemodel.scores import score
from hazemodel.splits import walk_forward
from hazemodel.train import QUANTILES, predict_frame, train_artifact

TOLERANCE = 1.05
RULE = "recursive within 5% of direct"


def recursive_day2(artifact: Artifact, test: pd.DataFrame) -> pd.DataFrame:
    first = predict_frame(artifact, test)
    again = rolled(test, first["p50_d1"].to_numpy())
    x = again[artifact.features].to_numpy(dtype=float)
    stack = np.sort(np.maximum(np.column_stack([artifact.boosters[f"d1_q{q}"].predict(x) for q in QUANTILES]), 0.0), axis=1)
    return pd.DataFrame({f"p{q}_d2": stack[:, i] for i, q in enumerate(QUANTILES)}, index=test.index)


def choose_day2(direct: dict, recursive: dict) -> dict:
    x, y = direct.get("hazy_mae", np.nan), recursive.get("hazy_mae", np.nan)
    serves = "recursive" if (np.isnan(x) or y <= TOLERANCE * x) else "direct"
    return {"serves_d2": serves, "direct_hazy_mae": x, "recursive_hazy_mae": y, "rule": RULE}


def run_recursive_comparison(frame: pd.DataFrame, params: dict, freq: str = "M", min_train_blocks: int = 1) -> dict:
    tests, directs, recursives = [], [], []
    for _, train, test in walk_forward(frame, freq=freq, min_train_blocks=min_train_blocks):
        artifact, _ = train_artifact(train, params, days=(1, 2))
        directs.append(predict_frame(artifact, test))
        recursives.append(recursive_day2(artifact, test))
        tests.append(test)
    all_test = pd.concat(tests)
    direct = pd.concat(directs)
    direct_score = score(all_test, direct, 2)["reference"] if "p50_d2" in direct else {"hazy_mae": np.nan}
    recursive_score = score(all_test, pd.concat(recursives), 2)["reference"]
    return choose_day2(direct_score, recursive_score)
```

- [ ] **Step 4: Run the tests**

Run: `cd model && .venv/bin/pytest -q tests/test_recursive.py tests/test_serve.py && .venv/bin/ruff check .`
Expected: all pass (the serve tests confirm the rename broke nothing)

- [ ] **Step 5: Commit**

```bash
git add model/src/hazemodel/recursive.py model/src/hazemodel/predict.py model/tests/test_recursive.py
git commit -m "Compare the direct and recursive day two forecasts and choose by rule

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

### Task 6: Scenarios and leak tests

**Files:**
- Create: `model/src/hazemodel/scenarios.py`, `model/src/hazemodel/leaks.py`, `model/tests/test_scenarios.py`, `model/tests/test_leaks.py`

**Interfaces:**
- Produces:
  - `scenario_masks(test) -> dict[str, pd.Series]` of boolean masks over the pooled test frame, one per named scenario:
    - `onset`: issue days in the three days before a season start, where a season start is the first Malaysian day of a year on which the median reference truth `peak_d1` is 35 or more for three consecutive days.
    - `end`: rows with `rain48 >= 20` and `level >= 35`.
    - `fire_dropout`: rows with `level >= 35` and `fire_total_change <= -0.4 * (fire_total_d3 - fire_total_change)` (detected fire fell by 40% or more over three days).
    - `wind_reversal`: angle between `(u24, v24)` and the mean of hours 24 to 48, `(2 * u48 - u24, 2 * v48 - v24)`, over 90 degrees.
    - `clean_season`: issue month in January to April.
    - (The sixth scenario, unseen instruments, is a retrain, not a mask: `unseen_instruments(frame, params, freq) -> dict` below.)
  - `run_scenarios(all_test, forecasts: dict[str, pd.DataFrame]) -> dict`: for each mask, the day +1 reference scores of `model` and `persistence` on the masked rows, the row count, and `passed` by these lines: `onset`: model `hit_100` (computed here with `ONSET_API`, as the share of masked rows whose truth API crosses 100 that the model also put at 100 or more) at least 0.5; `end`: model `bias` under +10; `fire_dropout`: model `mae` at most persistence `mae`; `wind_reversal`: the model's mean `p90 - p10` on masked rows at least its mean on unmasked rows; `clean_season`: model `far_150`-style false alarm share of all masked rows (forecasts at 150 or above over masked rows) at most 0.02. A scenario with under 20 rows reports `passed: null` and `reason: "too few rows"`.
  - `unseen_instruments(frame, params, freq, min_train_blocks) -> dict`: hold out every 37th instrument in sorted id order (at least 5), walk-forward on the rest, score the held-out rows with each block's model; `passed` when the held-out reference `hazy_mae` is at most 1.3 times the seen one.
  - `leaks.py`: `shifted_forward(frame) -> pd.DataFrame` moves every feature column one issue day forward within each instrument (the row at issue T gets the features of T + 1 day), `shuffled_targets(frame, seed=1) -> pd.DataFrame` permutes `peak_d1`/`peak_d2` within instrument; `run_leak_tests(frame, params, freq, min_train_blocks) -> dict` with, for each, the pooled reference `mae` of the model against persistence (shift) and against climatology (shuffle), and `passed` when the model is no better than that baseline by more than 5%. (A shifted model that still beats persistence is reading the future; a shuffled one that beats climatology has a feature that encodes the target.)

- [ ] **Step 1: Write the failing tests**

```python
# model/tests/test_scenarios.py
import numpy as np

from hazemodel.baselines import persistence
from hazemodel.scenarios import run_scenarios, scenario_masks, unseen_instruments
from hazemodel.train import load_params, predict_frame, train_artifact

SMALL = {"num_leaves": 4, "min_data_in_leaf": 2, "num_boost_round": 20, "learning_rate": 0.1}


def test_masks_cover_the_named_scenarios(frame):
    masks = scenario_masks(frame)
    assert set(masks) == {"onset", "end", "fire_dropout", "wind_reversal", "clean_season"}
    for mask in masks.values():
        assert mask.dtype == bool and len(mask) == len(frame)
    assert not masks["clean_season"].any()


def test_run_scenarios_reports_each_with_a_pass_or_reason(frame):
    artifact, _ = train_artifact(frame, {**load_params(), **SMALL})
    forecasts = {"model": predict_frame(artifact, frame), "persistence": persistence(frame)}
    out = run_scenarios(frame, forecasts)
    for name, result in out.items():
        assert "rows" in result
        assert result["passed"] in (True, False, None)
        if result["passed"] is None:
            assert result["reason"] == "too few rows"


def test_unseen_instruments_holds_out_at_least_five(frame):
    out = unseen_instruments(frame, {**load_params(), **SMALL}, freq="D", min_train_blocks=2)
    assert len(out["held_out"]) >= 5
    assert out["passed"] in (True, False, None)
    assert np.isnan(out["held_out_hazy_mae"]) or out["held_out_hazy_mae"] >= 0
```

```python
# model/tests/test_leaks.py
from hazemodel.leaks import run_leak_tests, shifted_forward, shuffled_targets
from hazemodel.train import load_params

SMALL = {"num_leaves": 4, "min_data_in_leaf": 2, "num_boost_round": 20, "learning_rate": 0.1}


def test_shift_moves_features_one_day_forward(frame):
    shifted = shifted_forward(frame)
    ids = frame.index.get_level_values("instrument_id")
    issue = frame.index.get_level_values("issue_at")
    first_day = issue.min()
    one = (ids == "SGCENTRAL") & (issue == first_day)
    next_day = (ids == "SGCENTRAL") & (issue == first_day + __import__("pandas").Timedelta(days=1))
    assert shifted.loc[one, "level"].iloc[0] == frame.loc[next_day, "level"].iloc[0]
    assert shifted.loc[one, "peak_d1"].iloc[0] == frame.loc[one, "peak_d1"].iloc[0]


def test_shuffle_keeps_the_multiset_of_targets(frame):
    shuffled = shuffled_targets(frame)
    assert sorted(shuffled["peak_d1"].dropna()) == sorted(frame["peak_d1"].dropna())


def test_leak_tests_run_and_report(frame):
    out = run_leak_tests(frame, {**load_params(), **SMALL}, freq="D", min_train_blocks=2)
    assert set(out) == {"shift", "shuffle"}
    for result in out.values():
        assert result["passed"] in (True, False)
```

- [ ] **Step 2: Run them to verify they fail**

Run: `cd model && .venv/bin/pytest -q tests/test_scenarios.py tests/test_leaks.py`
Expected: FAIL, modules not found

- [ ] **Step 3: Write scenarios.py and leaks.py**

```python
# model/src/hazemodel/scenarios.py
"""Named replays with pass lines, run on every model version: onset, end, fire dropout, wind reversal, clean season, unseen instruments."""
import numpy as np
import pandas as pd

from hazemodel.index import pm25_to_api
from hazemodel.region import MALAYSIA_OFFSET
from hazemodel.scores import HAZY_UGM3, ONSET_API, REFERENCE_KINDS, score
from hazemodel.splits import walk_forward
from hazemodel.train import predict_frame, train_artifact

MIN_ROWS = 20
HOLD_OUT_EVERY = 37
MIN_HELD_OUT = 5


def _season_starts(test: pd.DataFrame) -> list:
    reference = test[test["kind"].astype(str).isin(REFERENCE_KINDS)]
    days = (reference.index.get_level_values("issue_at") + MALAYSIA_OFFSET).date
    median = reference["peak_d1"].groupby(days).median().sort_index()
    hazy = (median >= HAZY_UGM3).to_numpy()
    starts = []
    for position in range(2, len(hazy)):
        day = median.index[position]
        if hazy[position - 2 : position + 1].all() and not any(s.year == day.year for s in starts):
            starts.append(day)
    return starts


def scenario_masks(test: pd.DataFrame) -> dict[str, pd.Series]:
    days = pd.Series((test.index.get_level_values("issue_at") + MALAYSIA_OFFSET).date, index=test.index)
    starts = _season_starts(test)
    onset = pd.Series(False, index=test.index)
    for start in starts:
        onset |= (days >= start - pd.Timedelta(days=3)) & (days < start)
    before = test["fire_total_d3"] - test["fire_total_change"]
    u_later, v_later = 2 * test["u48"] - test["u24"], 2 * test["v48"] - test["v24"]
    dot = test["u24"] * u_later + test["v24"] * v_later
    norm = np.hypot(test["u24"], test["v24"]) * np.hypot(u_later, v_later)
    angle = np.degrees(np.arccos(np.clip(dot / norm.replace(0, np.nan), -1, 1)))
    return {
        "onset": onset.astype(bool),
        "end": ((test["rain48"] >= 20) & (test["level"] >= HAZY_UGM3)).fillna(False).astype(bool),
        "fire_dropout": ((test["level"] >= HAZY_UGM3) & (test["fire_total_change"] <= -0.4 * before)).fillna(False).astype(bool),
        "wind_reversal": (angle > 90).fillna(False).astype(bool),
        "clean_season": test["month"].isin([1, 2, 3, 4]).astype(bool),
    }


def _reference_rows(test: pd.DataFrame, mask: pd.Series) -> pd.Series:
    return mask & test["kind"].astype(str).isin(REFERENCE_KINDS) & test["peak_d1"].notna()


def run_scenarios(test: pd.DataFrame, forecasts: dict[str, pd.DataFrame]) -> dict:
    model, persistence = forecasts["model"], forecasts["persistence"]
    out = {}
    for name, mask in scenario_masks(test).items():
        rows = _reference_rows(test, mask)
        result = {"rows": int(rows.sum())}
        if rows.sum() < MIN_ROWS:
            out[name] = {**result, "passed": None, "reason": "too few rows"}
            continue
        masked, m, p = test[rows], model[rows], persistence[rows]
        result["model"] = score(masked, m, 1)["reference"]
        result["persistence"] = score(masked, p, 1)["reference"]
        truth_api, said_api = pm25_to_api(masked["peak_d1"].to_numpy()), pm25_to_api(m["p50_d1"].to_numpy())
        if name == "onset":
            crossing = truth_api >= ONSET_API
            result["hit_100"] = float((said_api[crossing] >= ONSET_API).mean()) if crossing.any() else np.nan
            result["passed"] = bool(result["hit_100"] >= 0.5) if crossing.any() else None
        elif name == "end":
            result["passed"] = bool(result["model"]["bias"] < 10)
        elif name == "fire_dropout":
            result["passed"] = bool(result["model"]["mae"] <= result["persistence"]["mae"])
        elif name == "wind_reversal":
            band = (model["p90_d1"] - model["p10_d1"])
            result["band_masked"], result["band_other"] = float(band[rows].mean()), float(band[~rows].mean())
            result["passed"] = bool(result["band_masked"] >= result["band_other"])
        elif name == "clean_season":
            result["false_alarm_share"] = float((said_api >= 150).mean())
            result["passed"] = bool(result["false_alarm_share"] <= 0.02)
        out[name] = result
    return out


def unseen_instruments(frame: pd.DataFrame, params: dict, freq: str = "M", min_train_blocks: int = 1) -> dict:
    ids = sorted(frame.index.get_level_values("instrument_id").unique())
    held = ids[::HOLD_OUT_EVERY]
    if len(held) < MIN_HELD_OUT:
        held = ids[:MIN_HELD_OUT]
    is_held = frame.index.get_level_values("instrument_id").isin(held)
    seen_tests, seen_forecasts, held_tests, held_forecasts = [], [], [], []
    for _, train, test in walk_forward(frame[~is_held], freq=freq, min_train_blocks=min_train_blocks):
        artifact, _ = train_artifact(train, params, days=(1,))
        seen_tests.append(test)
        seen_forecasts.append(predict_frame(artifact, test))
        block_issues = test.index.get_level_values("issue_at").unique()
        held_block = frame[is_held & frame.index.get_level_values("issue_at").isin(block_issues)]
        if not held_block.empty:
            held_tests.append(held_block)
            held_forecasts.append(predict_frame(artifact, held_block))
    seen = score(pd.concat(seen_tests), pd.concat(seen_forecasts), 1)["reference"]
    held_score = score(pd.concat(held_tests), pd.concat(held_forecasts), 1)["reference"] if held_tests else {"hazy_mae": np.nan}
    passed = None if np.isnan(held_score["hazy_mae"]) or np.isnan(seen["hazy_mae"]) else bool(held_score["hazy_mae"] <= 1.3 * seen["hazy_mae"])
    return {"held_out": list(held), "seen_hazy_mae": seen["hazy_mae"], "held_out_hazy_mae": held_score["hazy_mae"], "passed": passed}
```

```python
# model/src/hazemodel/leaks.py
"""Two mechanical leak tests: a model fed tomorrow's features must beat persistence; one fed shuffled targets must not beat climatology."""
import numpy as np
import pandas as pd

from hazemodel.baselines import climatology, persistence
from hazemodel.scores import score
from hazemodel.splits import walk_forward
from hazemodel.train import feature_columns, predict_frame, train_artifact

MARGIN = 1.05


def shifted_forward(frame: pd.DataFrame) -> pd.DataFrame:
    shifted = frame.copy()
    features = feature_columns(frame)
    ids = frame.index.get_level_values("instrument_id")
    issue = frame.index.get_level_values("issue_at")
    next_index = pd.MultiIndex.from_arrays([ids, issue + pd.Timedelta(days=1)], names=frame.index.names)
    shifted[features] = frame[features].reindex(next_index).to_numpy()
    return shifted.dropna(subset=["level"])


def shuffled_targets(frame: pd.DataFrame, seed: int = 1) -> pd.DataFrame:
    rng = np.random.default_rng(seed)
    shuffled = frame.copy()
    for target in ("peak_d1", "peak_d2"):
        shuffled[target] = shuffled.groupby(level="instrument_id")[target].transform(lambda s: s.to_numpy()[rng.permutation(len(s))])
    return shuffled


def _pooled(frame: pd.DataFrame, params: dict, freq: str, min_train_blocks: int, baseline) -> dict:
    tests, models, bases = [], [], []
    for _, train, test in walk_forward(frame, freq=freq, min_train_blocks=min_train_blocks):
        artifact, _ = train_artifact(train, params, days=(1,))
        tests.append(test)
        models.append(predict_frame(artifact, test))
        bases.append(baseline(train, test))
    all_test = pd.concat(tests)
    return {"model": score(all_test, pd.concat(models), 1)["reference"], "baseline": score(all_test, pd.concat(bases), 1)["reference"]}


def run_leak_tests(frame: pd.DataFrame, params: dict, freq: str = "M", min_train_blocks: int = 1) -> dict:
    shift = _pooled(shifted_forward(frame), params, freq, min_train_blocks, lambda train, test: persistence(test))
    shuffle = _pooled(shuffled_targets(frame), params, freq, min_train_blocks, climatology)
    return {
        "shift": {**shift, "passed": bool(not (shift["model"]["mae"] * MARGIN < shift["baseline"]["mae"]))},
        "shuffle": {**shuffle, "passed": bool(not (shuffle["model"]["mae"] * MARGIN < shuffle["baseline"]["mae"]))},
    }
```

Read the `shift` test carefully: features shifted forward one day means the row at T carries T+1's features, including T+1's `level`, which is nearly T's target. A model on those rows should beat persistence easily. If it does not, the harness is broken, not the model. So `passed` for `shift` is defined as the model beating persistence by more than the margin, the opposite of `shuffle`. Fix the `shift` line accordingly:

```python
        "shift": {**shift, "passed": bool(shift["model"]["mae"] * MARGIN < shift["baseline"]["mae"])},
```

and record in the report: `shift` passes when the leak is detectable (the harness can see the future when given it), `shuffle` passes when nothing leaks (the model cannot beat climatology on noise).

- [ ] **Step 4: Run the tests**

Run: `cd model && .venv/bin/pytest -q tests/test_scenarios.py tests/test_leaks.py && .venv/bin/ruff check .`
Expected: `6 passed`

- [ ] **Step 5: Commit**

```bash
git add model/src/hazemodel/scenarios.py model/src/hazemodel/leaks.py model/tests/test_scenarios.py model/tests/test_leaks.py
git commit -m "Add the scenario suite and the two leak tests

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

### Task 7: Ablation and the hyperparameter search

**Files:**
- Create: `model/src/hazemodel/ablation.py`, `model/src/hazemodel/hyperparams.py`, `model/tests/test_ablation.py`

**Interfaces:**
- Produces:
  - `GROUPS: dict[str, callable]` mapping group name to a predicate on a column name: `air` (`level, lag*, d24, d48, slope3h, peak24, peak_hour, near50, near150, hist_mean, hist_std`), `fires` (`fire_*`), `physics` (`smoke_*, has_physics`), `weather` (`u24, v24, u48, v48, steady*, rain*, along_fire24, hours_present, from_forecast`), `calendar` (`doy_*, month, sw_monsoon`), `identity` (`kind_code`).
  - `run_ablation(frame, params, freq, min_train_blocks) -> dict`: the full model's pooled reference `hazy_mae` at day +1, then for each group the same with that group's columns dropped, the relative change, and `keep: bool` (`True` when dropping the group worsens `hazy_mae` by 1% or more).
  - `search(frame, freq="M", months=6, seed=7) -> dict`: on the first `months` period blocks only, 20 random draws from `num_leaves in [15, 63]`, `learning_rate in [0.02, 0.1]` (log-uniform), `min_data_in_leaf in [50, 200]`, `feature_fraction in [0.6, 0.9]`, each scored walk-forward within those months with early stopping on the following block (`lgb.early_stopping(50)`), picks the lowest reference `hazy_mae`, and returns the params plus the table of draws. `hazemodel search` writes the winner to `model/params.json` only when `--write` is passed.

- [ ] **Step 1: Write the failing test**

```python
# model/tests/test_ablation.py
from hazemodel.ablation import GROUPS, run_ablation
from hazemodel.hyperparams import search
from hazemodel.train import feature_columns, load_params

SMALL = {"num_leaves": 4, "min_data_in_leaf": 2, "num_boost_round": 20, "learning_rate": 0.1}


def test_groups_cover_every_feature(frame):
    columns = feature_columns(frame)
    covered = {c for c in columns if any(predicate(c) for predicate in GROUPS.values())}
    assert covered == set(columns), set(columns) - covered


def test_ablation_reports_each_group(frame):
    out = run_ablation(frame, {**load_params(), **SMALL}, freq="D", min_train_blocks=2)
    assert "full" in out
    for name in GROUPS:
        assert name in out["groups"]
        assert "keep" in out["groups"][name]


def test_search_runs_a_few_draws(frame):
    out = search(frame, freq="D", months=4, draws=2, seed=1)
    assert "params" in out and len(out["draws"]) == 2
    assert 15 <= out["params"]["num_leaves"] <= 63
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd model && .venv/bin/pytest -q tests/test_ablation.py`
Expected: FAIL, modules not found

- [ ] **Step 3: Write ablation.py and hyperparams.py**

```python
# model/src/hazemodel/ablation.py
"""Drop each feature group in turn and retrain. A group that moves hazy-day MAE by under 1% is not earning its place."""
import pandas as pd

from hazemodel.scores import score
from hazemodel.splits import walk_forward
from hazemodel.train import predict_frame, train_artifact

AIR = {"level", "lag24", "lag48", "lag72", "d24", "d48", "slope3h", "peak24", "peak_hour", "near50", "near150", "hist_mean", "hist_std"}
WEATHER = {"u24", "v24", "u48", "v48", "steady24", "steady48", "rain24", "rain48", "along_fire24", "hours_present", "from_forecast"}
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
        artifact, _ = train_artifact(train, params, days=(1,))
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
        groups[name] = {"columns": len(dropped), "hazy_mae_without": without, "change": change, "keep": bool(change >= THRESHOLD)}
    return {"full": full, "groups": groups}
```

```python
# model/src/hazemodel/hyperparams.py
"""A once-only random search on the first months of a parquet, never on test months. The winner is committed as params.json."""
import json
import pathlib

import lightgbm as lgb
import numpy as np
import pandas as pd

from hazemodel.scores import score
from hazemodel.splits import walk_forward
from hazemodel.train import PARAMS_PATH, feature_columns, load_params

SPACE = {"num_leaves": (15, 63), "learning_rate": (0.02, 0.1), "min_data_in_leaf": (50, 200), "feature_fraction": (0.6, 0.9)}


def _draw(rng: np.random.Generator) -> dict:
    return {
        "num_leaves": int(rng.integers(*SPACE["num_leaves"], endpoint=True)),
        "learning_rate": float(np.exp(rng.uniform(np.log(SPACE["learning_rate"][0]), np.log(SPACE["learning_rate"][1])))),
        "min_data_in_leaf": int(rng.integers(*SPACE["min_data_in_leaf"], endpoint=True)),
        "feature_fraction": float(rng.uniform(*SPACE["feature_fraction"])),
    }


def _fit_with_stopping(train: pd.DataFrame, valid: pd.DataFrame, features: list[str], params: dict) -> tuple[lgb.Booster, int]:
    def dataset(rows):
        rows = rows[rows["peak_d1"].notna() & (rows["weight_d1"] > 0)]
        return lgb.Dataset(rows[features].to_numpy(dtype=float), rows["peak_d1"].to_numpy(), weight=rows["weight_d1"].to_numpy(), feature_name=features)

    settings = {**params, "objective": "quantile", "alpha": 0.5, "verbose": -1}
    settings.pop("num_boost_round", None)
    booster = lgb.train(settings, dataset(train), 2000, valid_sets=[dataset(valid)], callbacks=[lgb.early_stopping(50, verbose=False)])
    return booster, booster.best_iteration


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
            booster, best = _fit_with_stopping(train, test, features, candidate)
            rounds.append(best)
            tests.append(test)
            forecasts.append(pd.DataFrame({"p50_d1": np.maximum(booster.predict(test[features].to_numpy(dtype=float)), 0)}, index=test.index))
        hazy_mae = score(pd.concat(tests), pd.concat(forecasts), 1)["reference"]["hazy_mae"]
        table.append({**candidate, "num_boost_round": int(np.median(rounds)), "hazy_mae": hazy_mae})
    best = min(table, key=lambda row: row["hazy_mae"] if not np.isnan(row["hazy_mae"]) else np.inf)
    params = {k: v for k, v in best.items() if k != "hazy_mae"}
    return {"params": params, "draws": table}


def write_params(params: dict, path: pathlib.Path = PARAMS_PATH) -> None:
    path.write_text(json.dumps(params, indent=2) + "\n")
```

- [ ] **Step 4: Run the tests**

Run: `cd model && .venv/bin/pytest -q tests/test_ablation.py && .venv/bin/ruff check .`
Expected: `3 passed`

- [ ] **Step 5: Commit**

```bash
git add model/src/hazemodel/ablation.py model/src/hazemodel/hyperparams.py model/tests/test_ablation.py
git commit -m "Add the feature group ablation and the once-only hyperparameter search

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

### Task 8: Report, promote, and the CLI commands

**Files:**
- Create: `model/src/hazemodel/report.py`, `model/src/hazemodel/promote.py`, `model/src/hazemodel/commands.py`, `model/tests/test_report.py`, `model/tests/test_promote.py`
- Modify: `model/src/hazemodel/cli.py` (register the new subcommands)

**Interfaces:**
- Produces:
  - `write_report(directory, version, payload: dict) -> pathlib.Path`: writes `<directory>/<version>/scores.json` (the payload, with NaN as null) and `report.md` rendered from it: a header with version, parquet name, wind source, rows, trained_at; a per-block table of reference `mae` and `hazy_mae` for model, persistence, v2 at d1 and d2; a pooled table by kind; the bootstrap intervals; the onset leads; the day +2 choice; the scenarios with pass or fail; the leak tests; the ablation table; the top 20 feature importances (`gain`), when present.
  - `reports_dir() -> pathlib.Path` = `model/reports`.
  - `promote(artifacts_directory, reports_directory, version) -> dict`: reads the candidate's `scores.json` `promotion_score`; refuses (`{"promoted": False, "reason": "no promotion score"}`) when missing or NaN; promotes when there is no live version, or when `candidate <= live` (reads the live version's `scores.json`); otherwise refuses with both numbers.
  - `commands.py`: `backtest_command(args)` (loads the parquet, runs `run_backtest`, `run_recursive_comparison`, `run_scenarios` on the pooled test rows and forecasts, `run_leak_tests`, `run_ablation` when `--ablation`, feature importances from a final fit on everything, writes the report under the version `train_artifact` would give, and prints the promotion score), `train_command(args)` (fits on the whole parquet, saves the artifact, writes a report containing the backtest payload if `--with-backtest` or the pooled scores only otherwise), `promote_command(args)`, `retrain_command(args)` (features for `--from` to yesterday, train with backtest, promote, and with `--loop` repeat every 7 days), `search_command(args)`.
  - CLI: `hazemodel backtest <parquet> [--freq M] [--min-train-blocks 1] [--ablation]`, `hazemodel train <parquet> [--with-backtest]`, `hazemodel promote <version>`, `hazemodel search <parquet> [--months 6] [--draws 20] [--write]`, `hazemodel retrain --from 2025-06-07 [--loop]`.

- [ ] **Step 1: Write the failing tests**

```python
# model/tests/test_report.py
import json

import numpy as np

from hazemodel.report import write_report


def test_write_report_renders_json_and_markdown(tmp_path):
    payload = {
        "version": "2026-10-10-abcd1234",
        "parquet": "features-x.parquet",
        "wind_source": "analysis",
        "rows": 10,
        "trained_at": "2026-10-10T00:00:00+00:00",
        "backtest": {
            "by_block": [{"block": "2026-10", "train_rows": 5, "test_rows": 5, "model": {"d1": {"reference": {"mae": 1.0, "hazy_mae": np.nan}}}, "persistence": {"d1": {"reference": {"mae": 2.0, "hazy_mae": 3.0}}}, "v2": {"d1": {"reference": {"mae": 2.5, "hazy_mae": 3.5}}}}],
            "pooled": {"model": {"d1": {"reference": {"mae": 1.0, "hazy_mae": 1.5, "cases": 5}}}},
            "interval": {"d1": {"model_minus_persistence": [-1.0, -0.5], "model_minus_v2": [-1.0, 0.0]}},
            "onset": {"model": 1.0, "persistence": 0.0, "v2": 0.5, "cases": 2},
            "promotion_score": 1.5,
        },
        "day2": {"serves_d2": "direct", "direct_hazy_mae": 2.0, "recursive_hazy_mae": 2.5, "rule": "recursive within 5% of direct"},
        "scenarios": {"onset": {"rows": 30, "passed": True}, "end": {"rows": 3, "passed": None, "reason": "too few rows"}},
        "leaks": {"shift": {"passed": True}, "shuffle": {"passed": True}},
        "ablation": {"full": 1.5, "groups": {"fires": {"columns": 72, "hazy_mae_without": 1.6, "change": 0.066, "keep": True}}},
        "importance": [["level", 100.0], ["fire_s5_r1_d3", 40.0]],
    }
    path = write_report(tmp_path, payload["version"], payload)
    assert path.name == "report.md"
    saved = json.loads((path.parent / "scores.json").read_text())
    assert saved["backtest"]["by_block"][0]["model"]["d1"]["reference"]["hazy_mae"] is None
    text = path.read_text()
    for needle in ("2026-10-10-abcd1234", "analysis", "persistence", "too few rows", "fires", "level"):
        assert needle in text
    assert "\u2014" not in text
```

```python
# model/tests/test_promote.py
import json

from hazemodel.artifacts import live_version
from hazemodel.promote import promote


def _report(reports, version, score):
    folder = reports / version
    folder.mkdir(parents=True)
    (folder / "scores.json").write_text(json.dumps({"version": version, "backtest": {"promotion_score": score}}))


def test_promote_first_and_refuse_without_score(tmp_path):
    artifacts, reports = tmp_path / "artifacts", tmp_path / "reports"
    _report(reports, "v1", 10.0)
    assert promote(artifacts, reports, "v1")["promoted"] is True
    assert live_version(artifacts) == "v1"
    (reports / "v2").mkdir()
    (reports / "v2" / "scores.json").write_text(json.dumps({"version": "v2", "backtest": {}}))
    out = promote(artifacts, reports, "v2")
    assert out["promoted"] is False and out["reason"] == "no promotion score"
    assert live_version(artifacts) == "v1"


def test_promote_only_when_not_worse(tmp_path):
    artifacts, reports = tmp_path / "artifacts", tmp_path / "reports"
    _report(reports, "v1", 10.0)
    _report(reports, "v2", 10.5)
    _report(reports, "v3", 10.0)
    promote(artifacts, reports, "v1")
    assert promote(artifacts, reports, "v2")["promoted"] is False
    assert promote(artifacts, reports, "v3")["promoted"] is True
    assert live_version(artifacts) == "v3"
```

- [ ] **Step 2: Run them to verify they fail**

Run: `cd model && .venv/bin/pytest -q tests/test_report.py tests/test_promote.py`
Expected: FAIL, modules not found

- [ ] **Step 3: Write report.py, promote.py, commands.py, and register the CLI**

```python
# model/src/hazemodel/report.py
"""What a training run found, as scores.json and a report.md a person can read. Reports are committed."""
import json
import math
import pathlib

REPORTS_PATH = pathlib.Path(__file__).resolve().parents[2] / "reports"


def reports_dir() -> pathlib.Path:
    return REPORTS_PATH


def _clean(value):
    if isinstance(value, float) and (math.isnan(value) or math.isinf(value)):
        return None
    if isinstance(value, dict):
        return {str(k): _clean(v) for k, v in value.items()}
    if isinstance(value, (list, tuple)):
        return [_clean(v) for v in value]
    return value


def _num(value, digits: int = 2) -> str:
    return "n/a" if value is None or (isinstance(value, float) and math.isnan(value)) else f"{value:.{digits}f}"


def _reference(block: dict, name: str, day: str, key: str):
    return block.get(name, {}).get(day, {}).get("reference", {}).get(key)


def _render(payload: dict) -> str:
    lines = [f"# Model {payload['version']}", ""]
    lines += [f"Parquet `{payload.get('parquet')}`, wind source **{payload.get('wind_source')}**, {payload.get('rows')} rows, trained {payload.get('trained_at')}.", ""]
    backtest = payload.get("backtest", {})
    lines += ["## Walk-forward by block (reference instruments, MAE and hazy-day MAE, ug/m3)", "", "| Block | Train | Test | Model d1 | Persistence d1 | v2 d1 | Model d2 | Persistence d2 | v2 d2 |", "| --- | --- | --- | --- | --- | --- | --- | --- | --- |"]
    for block in backtest.get("by_block", []):
        cells = [block["block"], str(block["train_rows"]), str(block["test_rows"])]
        for day in ("d1", "d2"):
            for name in ("model", "persistence", "v2"):
                cells.append(f"{_num(_reference(block, name, day, 'mae'))} / {_num(_reference(block, name, day, 'hazy_mae'))}")
        lines.append("| " + " | ".join(cells) + " |")
    lines += ["", "## Pooled", ""]
    for name, days in backtest.get("pooled", {}).items():
        for day, kinds in days.items():
            for kind, values in kinds.items():
                if kind == "dropped":
                    continue
                lines.append(f"- {name} {day} {kind}: cases {values.get('cases')}, MAE {_num(values.get('mae'))}, hazy MAE {_num(values.get('hazy_mae'))}, hit150 {_num(values.get('hit_150'))}, far150 {_num(values.get('far_150'))}, below p10 {_num(values.get('below_p10'))}, above p90 {_num(values.get('above_p90'))}")
    lines += ["", "## Intervals (90%, day blocks)", ""]
    for day, pairs in backtest.get("interval", {}).items():
        for name, (low, high) in pairs.items():
            lines.append(f"- {day} {name}: {_num(low)} to {_num(high)}")
    onset = backtest.get("onset", {})
    lines += ["", f"Onset lead days over {onset.get('cases')} onsets: model {_num(onset.get('model'))}, persistence {_num(onset.get('persistence'))}, v2 {_num(onset.get('v2'))}.", ""]
    day2 = payload.get("day2", {})
    lines += [f"Day +2 served by **{day2.get('serves_d2')}** (direct {_num(day2.get('direct_hazy_mae'))}, recursive {_num(day2.get('recursive_hazy_mae'))}; rule: {day2.get('rule')}).", ""]
    lines += ["## Scenarios", ""]
    for name, result in payload.get("scenarios", {}).items():
        verdict = "pass" if result.get("passed") else ("fail" if result.get("passed") is False else f"not judged ({result.get('reason')})")
        lines.append(f"- {name}: {result.get('rows')} rows, {verdict}")
    lines += ["", "## Leak tests", ""]
    for name, result in payload.get("leaks", {}).items():
        lines.append(f"- {name}: {'pass' if result.get('passed') else 'fail'}")
    ablation = payload.get("ablation")
    if ablation:
        lines += ["", f"## Ablation (full hazy MAE {_num(ablation.get('full'))})", "", "| Group | Columns | Without | Change | Keep |", "| --- | --- | --- | --- | --- |"]
        for name, row in ablation.get("groups", {}).items():
            lines.append(f"| {name} | {row.get('columns')} | {_num(row.get('hazy_mae_without'))} | {_num(row.get('change'), 3)} | {'yes' if row.get('keep') else 'no'} |")
    importance = payload.get("importance")
    if importance:
        lines += ["", "## Feature importance (gain, top 20)", ""]
        lines += [f"- {name}: {_num(gain, 1)}" for name, gain in importance[:20]]
    return "\n".join(lines) + "\n"


def write_report(directory: pathlib.Path, version: str, payload: dict) -> pathlib.Path:
    folder = directory / version
    folder.mkdir(parents=True, exist_ok=True)
    (folder / "scores.json").write_text(json.dumps(_clean(payload), indent=2) + "\n")
    path = folder / "report.md"
    path.write_text(_render(payload))
    return path
```

```python
# model/src/hazemodel/promote.py
"""Move the live pointer only when the candidate's walk-forward score is not worse than the live one's. The rule is code."""
import json
import math
import pathlib

from hazemodel.artifacts import live_version, set_live


def _score(reports: pathlib.Path, version: str) -> float | None:
    path = reports / version / "scores.json"
    if not path.exists():
        return None
    value = json.loads(path.read_text()).get("backtest", {}).get("promotion_score")
    return None if value is None or (isinstance(value, float) and math.isnan(value)) else float(value)


def promote(artifacts: pathlib.Path, reports: pathlib.Path, version: str) -> dict:
    candidate = _score(reports, version)
    if candidate is None:
        return {"promoted": False, "reason": "no promotion score", "version": version}
    current = live_version(artifacts)
    live = _score(reports, current) if current else None
    if live is not None and candidate > live:
        return {"promoted": False, "reason": "worse than live", "version": version, "candidate": candidate, "live": live, "live_version": current}
    set_live(artifacts, version)
    return {"promoted": True, "version": version, "candidate": candidate, "live": live, "replaced": current}
```

```python
# model/src/hazemodel/commands.py
"""The training-side subcommands. Each reads a parquet, runs the method, writes a report."""
import datetime as dt
import pathlib
import time

import pandas as pd

from hazemodel.ablation import run_ablation
from hazemodel.artifacts import artifacts_dir, save_artifact
from hazemodel.backtest import run_backtest, wind_source
from hazemodel.baselines import persistence
from hazemodel.hyperparams import search, write_params
from hazemodel.leaks import run_leak_tests
from hazemodel.promote import promote
from hazemodel.recursive import run_recursive_comparison
from hazemodel.report import reports_dir, write_report
from hazemodel.scenarios import run_scenarios, unseen_instruments
from hazemodel.splits import walk_forward
from hazemodel.train import load_params, predict_frame, train_artifact

WEEK_SECONDS = 7 * 24 * 3600


def _load(path: str) -> pd.DataFrame:
    frame = pd.read_parquet(path)
    frame["issue_at"] = pd.to_datetime(frame["issue_at"], utc=True)
    frame["kind"] = pd.Categorical(frame["kind"], categories=["doe", "nea", "openaq", "airport"])
    return frame.set_index(["instrument_id", "issue_at"]).sort_index()


def _pooled_test_and_model(frame: pd.DataFrame, params: dict, freq: str, min_train_blocks: int):
    tests, forecasts = [], []
    for _, train, test in walk_forward(frame, freq=freq, min_train_blocks=min_train_blocks):
        artifact, _ = train_artifact(train, params)
        tests.append(test)
        forecasts.append(predict_frame(artifact, test))
    all_test = pd.concat(tests)
    return all_test, {"model": pd.concat(forecasts), "persistence": persistence(all_test)}


def evaluate(frame: pd.DataFrame, params: dict, parquet: str, freq: str, min_train_blocks: int, ablation: bool) -> tuple[dict, object]:
    backtest = run_backtest(frame, params, freq=freq, min_train_blocks=min_train_blocks)
    day2 = run_recursive_comparison(frame, params, freq=freq, min_train_blocks=min_train_blocks)
    all_test, forecasts = _pooled_test_and_model(frame, params, freq, min_train_blocks)
    scenarios = run_scenarios(all_test, forecasts)
    scenarios["unseen_instruments"] = unseen_instruments(frame, params, freq=freq, min_train_blocks=min_train_blocks)
    leaks = run_leak_tests(frame, params, freq=freq, min_train_blocks=min_train_blocks)
    artifact, info = train_artifact(frame, params)
    booster = artifact.boosters.get("d1_q50")
    importance = sorted(zip(artifact.features, booster.feature_importance("gain").tolist()), key=lambda pair: -pair[1]) if booster else []
    payload = {
        "version": artifact.version,
        "parquet": pathlib.Path(parquet).name,
        "wind_source": wind_source(frame),
        "rows": int(len(frame)),
        "trained_at": artifact.trained_at.isoformat(),
        "params": params,
        "training": info,
        "backtest": backtest,
        "day2": day2,
        "scenarios": scenarios,
        "leaks": leaks,
        "ablation": run_ablation(frame, params, freq=freq, min_train_blocks=min_train_blocks) if ablation else None,
        "importance": importance,
    }
    return payload, artifact


def backtest_command(args) -> None:
    frame = _load(args.parquet)
    payload, _ = evaluate(frame, load_params(), args.parquet, args.freq, args.min_train_blocks, args.ablation)
    path = write_report(reports_dir(), payload["version"], payload)
    print(f"{payload['version']}: promotion score {payload['backtest']['promotion_score']:.2f} -> {path}")


def train_command(args) -> None:
    frame = _load(args.parquet)
    params = load_params()
    if args.with_backtest:
        payload, artifact = evaluate(frame, params, args.parquet, args.freq, args.min_train_blocks, False)
    else:
        artifact, info = train_artifact(frame, params)
        payload = {"version": artifact.version, "parquet": pathlib.Path(args.parquet).name, "wind_source": wind_source(frame), "rows": int(len(frame)), "trained_at": artifact.trained_at.isoformat(), "params": params, "training": info, "backtest": {}}
    save_artifact(artifacts_dir(), artifact)
    write_report(reports_dir(), artifact.version, payload)
    print(artifact.version)


def promote_command(args) -> None:
    print(promote(artifacts_dir(), reports_dir(), args.version))


def search_command(args) -> None:
    out = search(_load(args.parquet), freq=args.freq, months=args.months, draws=args.draws)
    print(pd.DataFrame(out["draws"]).sort_values("hazy_mae").to_string())
    if args.write:
        write_params(out["params"])
        print("written to params.json")


def retrain_command(args) -> None:
    from hazemodel.cli import features_command

    while True:
        end = (dt.date.today() - dt.timedelta(days=1)).isoformat()
        built = type("Args", (), {"start": args.start, "end": end, "hindcast_model": args.hindcast_model, "out": args.out})()
        parquet = features_command(built)
        frame = _load(str(parquet))
        payload, artifact = evaluate(frame, load_params(), str(parquet), "M", 1, False)
        save_artifact(artifacts_dir(), artifact)
        write_report(reports_dir(), artifact.version, payload)
        print(promote(artifacts_dir(), reports_dir(), artifact.version))
        if not args.loop:
            return
        time.sleep(WEEK_SECONDS)
```

`features_command` in track A's `cli.py` prints the path; change it to also `return path` so `retrain_command` can use it (one line).

Register in `model/src/hazemodel/cli.py`:

```python
from hazemodel.commands import backtest_command, promote_command, retrain_command, search_command, train_command


def add_training(subparsers) -> None:
    backtest = subparsers.add_parser("backtest", help="walk-forward backtest, scenarios, leaks, report")
    backtest.add_argument("parquet")
    backtest.add_argument("--freq", default="M")
    backtest.add_argument("--min-train-blocks", type=int, default=1)
    backtest.add_argument("--ablation", action="store_true")
    backtest.set_defaults(run=backtest_command)
    train = subparsers.add_parser("train", help="fit on the whole parquet and save the artifact")
    train.add_argument("parquet")
    train.add_argument("--with-backtest", action="store_true")
    train.add_argument("--freq", default="M")
    train.add_argument("--min-train-blocks", type=int, default=1)
    train.set_defaults(run=train_command)
    promote = subparsers.add_parser("promote", help="make a version live if its score is not worse")
    promote.add_argument("version")
    promote.set_defaults(run=promote_command)
    search = subparsers.add_parser("search", help="hyperparameter search on the first months")
    search.add_argument("parquet")
    search.add_argument("--freq", default="M")
    search.add_argument("--months", type=int, default=6)
    search.add_argument("--draws", type=int, default=20)
    search.add_argument("--write", action="store_true")
    search.set_defaults(run=search_command)
    retrain = subparsers.add_parser("retrain", help="features, train with backtest, promote; --loop repeats weekly")
    retrain.add_argument("--from", dest="start", default="2025-06-07")
    retrain.add_argument("--hindcast-model", default="v2-analysis")
    retrain.add_argument("--out", default=str(pathlib.Path(__file__).resolve().parents[2] / "data"))
    retrain.add_argument("--loop", action="store_true")
    retrain.set_defaults(run=retrain_command)
```

and call `add_training(subparsers)` in `main()`.

- [ ] **Step 4: Run the tests**

Run: `cd model && .venv/bin/pytest -q && .venv/bin/ruff check . && .venv/bin/hazemodel --help`
Expected: all pass; the help lists features, serve, backtest, train, promote, search, retrain.

- [ ] **Step 5: Commit**

```bash
git add model/src/hazemodel/report.py model/src/hazemodel/promote.py model/src/hazemodel/commands.py model/src/hazemodel/cli.py model/tests/test_report.py model/tests/test_promote.py
git commit -m "Write reports, promote by rule, and wire the training commands

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

### Task 9: Phase 1 on the real history, and the first results in docs/MODEL.md

**Files:**
- Create: `model/reports/<version>/scores.json`, `model/reports/<version>/report.md`
- Modify: `docs/MODEL.md` (Results section), `docs/HANDOVER.md` (the model's commands and state), `compose.yaml` (a `model-train` service)

This task runs the method on the stored history without the physics group (`smoke_hindcasts` is empty until track C has run) and records what it found. It is the first measurement, and the numbers go in the document whatever they say.

- [ ] **Step 1: Build the parquet and search the hyperparameters once**

Run, with the compose database env (`PG_PASSWORD` from `backend/.env`):

```bash
cd model
export PG_HOST=127.0.0.1 PG_PORT=5433 PG_DATABASE=postgres PG_USER=postgres PG_PASSWORD=...
.venv/bin/hazemodel features --from 2025-06-07 --to 2026-10-08
.venv/bin/hazemodel search data/features-2025-06-07-2026-10-08-*.parquet --months 6 --draws 20 --write
```

Expected: the parquet (tens of thousands of rows), its two decisions CSVs, and a draws table; `params.json` updated. Commit `params.json` with the message `Choose the hyperparameters on the first six months`.

- [ ] **Step 2: Run the backtest with ablation**

```bash
.venv/bin/hazemodel backtest data/features-2025-06-07-2026-10-08-*.parquet --freq M --min-train-blocks 1 --ablation
```

Expected: under an hour; a line with the version and the promotion score; `model/reports/<version>/` written. Read `report.md` end to end. The leak test `shift` must pass (the harness sees the future when given it) and `shuffle` must pass (nothing encodes the target). If `shuffle` fails, a feature leaks; find it by ablation on the shuffled frame before going on. Do not tune anything on these results: the test months are the test.

- [ ] **Step 3: Train, save and promote the first artifact**

```bash
.venv/bin/hazemodel train data/features-2025-06-07-2026-10-08-*.parquet --with-backtest
.venv/bin/hazemodel promote <version>
curl -s localhost:4002/health   # if the model service is running: it now answers with the version
```

- [ ] **Step 4: Write the results into docs/MODEL.md and the handover**

In `docs/MODEL.md`, replace the Results placeholder with a section per version. For this version, write:

- A table by block (month): reference MAE and hazy MAE for model, persistence, v2 at day +1 and day +2, copied from `report.md`.
- The pooled numbers by kind, and the two bootstrap intervals.
- The hit and false alarm rates at 150 and 200, by kind.
- Band calibration (below p10, above p90) against the 7% to 14% line.
- The onset leads.
- Which served day +2 and why.
- The scenario table with pass or fail and the reason for any "not judged".
- The leak tests.
- The ablation table, and the list of groups to drop under the 1% rule.
- The wind source (analysis) and the sentence: "Every number here was scored on the analysis wind; the live model forecasts on forecast wind, and `weather_forecasts` will allow a forecast-wind score from <first date it holds>."
- A plain statement of whether the 24 h target (15% below the best baseline on hazy days, reference kinds) was met, with the numbers.

In `docs/HANDOVER.md` add a block under "Then, in order": the model commands, the version that is live, the shadow rule, and the two next steps: run `pnpm haze:hindcast` (track C) then rebuild the parquet with `--hindcast-model v2-analysis` and repeat Steps 2 to 4 as phase 2; and after 14 days of shadow data, read the Simulation page's model block before considering `MODEL_MODE=live`.

In `compose.yaml` add beside the `model` service (track B adds that one):

```yaml
  # Weekly retraining: features, train with backtest, promote by rule. Shares
  # the artifacts volume with the model service, which re-reads `live` on
  # every /predict, so a promotion needs no restart.
  model-train:
    build: ./model
    environment:
      PG_HOST: postgres
      PG_PORT: 5432
      PG_DATABASE: ${PG_DATABASE:-postgres}
      PG_USER: ${PG_USER:-postgres}
      PG_PASSWORD: ${PG_PASSWORD:-postgres}
      MODEL_ARTIFACTS: /app/artifacts
    volumes:
      - model-artifacts:/app/artifacts
      - ./model/reports:/app/reports
    command: ["hazemodel", "retrain", "--from", "2025-06-07", "--loop"]
    depends_on:
      postgres:
        condition: service_healthy
    restart: unless-stopped
```

Check the PG variable names against what `compose.yaml` already uses for the `api` service and copy those exactly.

- [ ] **Step 5: Commit**

```bash
git add model/reports/ docs/MODEL.md docs/HANDOVER.md compose.yaml
git commit -m "Record the first walk-forward results of the learned forecast

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

### Task 10: Phase 2, with the physics group

Runs only after track C has filled `smoke_hindcasts` for the span.

- [ ] **Step 1: Rebuild and re-evaluate**

```bash
cd model
.venv/bin/hazemodel features --from 2025-06-07 --to 2026-10-08 --hindcast-model v2-analysis
.venv/bin/hazemodel backtest data/features-2025-06-07-2026-10-08-<new hash>.parquet --ablation
```

Expected: `has_physics` is 1 on most rows; the ablation row `physics` says whether the transport model's view earns its place.

- [ ] **Step 2: Train and promote by rule, then document**

```bash
.venv/bin/hazemodel train data/features-...-<new hash>.parquet --with-backtest
.venv/bin/hazemodel promote <version>
```

Add the version's section to `docs/MODEL.md` with the same tables, and one paragraph comparing phase 1 and phase 2 by the promotion score and the ablation.

- [ ] **Step 3: Commit**

```bash
git add model/reports/ docs/MODEL.md
git commit -m "Record the results with the transport model's smoke as a feature

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```
