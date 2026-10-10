import json

import numpy as np

from hazemodel.report import write_report


def _cell(mae, hazy):
    return {"d1": {"reference": {"mae": mae, "hazy_mae": hazy}}}


def test_write_report_renders_json_and_markdown(tmp_path):
    pair = {"model_minus_persistence": [-1.0, -0.5], "model_minus_v2": [-1.0, 0.0]}
    payload = {
        "version": "2026-10-10-abcd1234",
        "parquet": "features-x.parquet",
        "wind_source": "analysis",
        "rows": 10,
        "trained_at": "2026-10-10T00:00:00+00:00",
        "backtest": {
            "by_block": [
                {
                    "block": "2026-10",
                    "train_rows": 5,
                    "test_rows": 5,
                    "model": _cell(1.0, np.nan),
                    "persistence": _cell(2.0, 3.0),
                    "v2": _cell(2.5, 3.5),
                }
            ],
            "pooled": {
                "model": {"d1": {"dropped": 0, "reference": {"mae": 1.0, "hazy_mae": 1.5, "cases": 5}}},
                "common_cases": {"d1": 5},
                "model_on_physics_rows": {"d1": {"dropped": 0, "reference": {"mae": 1.0, "hazy_mae": 1.5}}},
            },
            "interval": {"d1": {"reference": pair, "doe": pair}},
            "onset": {
                "reference": {"model": 1.0, "persistence": 0.0, "v2": 0.5, "cases": 2},
                "doe": {"model": np.nan, "persistence": np.nan, "v2": np.nan, "cases": 0},
            },
            "promotion_score": 1.5,
        },
        "day2": {
            "serves_d2": "direct",
            "direct_hazy_mae": 2.0,
            "recursive_hazy_mae": 2.5,
            "rule": "recursive within 5% of direct",
        },
        "scenarios": {
            "onset": {"rows": 30, "passed": True},
            "end": {"rows": 3, "passed": None, "reason": "too few rows"},
        },
        "leaks": {"shift": {"passed": True}, "shuffle": {"passed": True}},
        "ablation": {
            "full": 1.5,
            "groups": {"fires": {"columns": 72, "hazy_mae_without": 1.6, "change": 0.066, "keep": True}},
        },
        "importance": [["level", 100.0], ["fire_s5_r1_d3", 40.0]],
    }
    path = write_report(tmp_path, payload["version"], payload)
    assert path.name == "report.md"
    saved = json.loads((path.parent / "scores.json").read_text())
    assert saved["backtest"]["by_block"][0]["model"]["d1"]["reference"]["hazy_mae"] is None
    text = path.read_text()
    for needle in ("2026-10-10-abcd1234", "analysis", "persistence", "too few rows", "fires", "level", "doe"):
        assert needle in text
    assert "—" not in text


def test_write_report_accepts_numpy_scalars(tmp_path):
    payload = {"version": "v", "backtest": {"promotion_score": np.float64(np.nan), "rows": np.int64(3)}}
    path = write_report(tmp_path, "v", payload)
    saved = json.loads((path.parent / "scores.json").read_text())
    assert saved["backtest"] == {"promotion_score": None, "rows": 3}
