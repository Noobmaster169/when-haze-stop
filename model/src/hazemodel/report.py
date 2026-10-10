"""What a training run found, as scores.json and a report.md a person can read. Reports are committed."""

import json
import math
import pathlib

import numpy as np

REPORTS_PATH = pathlib.Path(__file__).resolve().parents[2] / "reports"


def reports_dir() -> pathlib.Path:
    return REPORTS_PATH


def _clean(value):
    if isinstance(value, np.generic):
        value = value.item()
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


def _by_block(backtest: dict) -> list[str]:
    header = "| Block | Train | Test | Model d1 | Persistence d1 | v2 d1 | Model d2 | Persistence d2 | v2 d2 |"
    lines = ["## Walk-forward by block (reference instruments, MAE / hazy-day MAE, ug/m3)", "", header]
    lines.append("| " + " | ".join(["---"] * 9) + " |")
    for block in backtest.get("by_block", []):
        cells = [block["block"], str(block["train_rows"]), str(block["test_rows"])]
        for day in ("d1", "d2"):
            for name in ("model", "persistence", "v2"):
                mae, hazy = _reference(block, name, day, "mae"), _reference(block, name, day, "hazy_mae")
                cells.append(f"{_num(mae)} / {_num(hazy)}")
        lines.append("| " + " | ".join(cells) + " |")
    return lines


def _pooled(backtest: dict) -> list[str]:
    lines = ["", "## Pooled", ""]
    pooled = backtest.get("pooled", {})
    for day, cases in pooled.get("common_cases", {}).items():
        lines.append(f"- {day}: {cases} rows scored in common by model, persistence, climatology and v2")
    for name, days in pooled.items():
        if name == "common_cases":
            continue
        for day, kinds in days.items():
            for kind, values in kinds.items():
                if kind == "dropped":
                    continue
                lines.append(
                    f"- {name} {day} {kind}: cases {values.get('cases')}, MAE {_num(values.get('mae'))}, "
                    f"hazy MAE {_num(values.get('hazy_mae'))}, hit150 {_num(values.get('hit_150'))}, "
                    f"far150 {_num(values.get('far_150'))}, below p10 {_num(values.get('below_p10'))}, "
                    f"above p90 {_num(values.get('above_p90'))}"
                )
    return lines


def _intervals_and_onsets(backtest: dict) -> list[str]:
    lines = ["", "## Intervals (90%, day blocks)", ""]
    for day, kinds in backtest.get("interval", {}).items():
        for kind, pairs in kinds.items():
            for name, (low, high) in pairs.items():
                lines.append(f"- {day} {kind} {name}: {_num(low)} to {_num(high)}")
    lines += ["", "## Onset lead days", ""]
    for kind, entry in backtest.get("onset", {}).items():
        lines.append(
            f"- {kind}, {entry.get('cases')} onsets: model {_num(entry.get('model'))}, "
            f"persistence {_num(entry.get('persistence'))}, v2 {_num(entry.get('v2'))}"
        )
    return lines


def _verdicts(payload: dict) -> list[str]:
    day2 = payload.get("day2", {})
    lines = [
        "",
        f"Day +2 served by **{day2.get('serves_d2')}** (direct {_num(day2.get('direct_hazy_mae'))}, "
        f"recursive {_num(day2.get('recursive_hazy_mae'))}; rule: {day2.get('rule')}).",
        "",
        "## Scenarios",
        "",
    ]
    for name, result in payload.get("scenarios", {}).items():
        passed = result.get("passed")
        verdict = "pass" if passed else ("fail" if passed is False else f"not judged ({result.get('reason')})")
        lines.append(f"- {name}: {result.get('rows')} rows, {verdict}")
    lines += ["", "## Leak tests", ""]
    for name, result in payload.get("leaks", {}).items():
        lines.append(f"- {name}: {'pass' if result.get('passed') else 'fail'}")
    return lines


def _ablation(ablation: dict) -> list[str]:
    lines = ["", f"## Ablation (full hazy MAE {_num(ablation.get('full'))})", ""]
    lines += ["| Group | Columns | Without | Change | Keep |", "| --- | --- | --- | --- | --- |"]
    for name, row in ablation.get("groups", {}).items():
        lines.append(
            f"| {name} | {row.get('columns')} | {_num(row.get('hazy_mae_without'))} | "
            f"{_num(row.get('change'), 3)} | {'yes' if row.get('keep') else 'no'} |"
        )
    return lines


def _render(payload: dict) -> str:
    backtest = payload.get("backtest", {})
    lines = [f"# Model {payload['version']}", ""]
    lines.append(
        f"Parquet `{payload.get('parquet')}`, wind source **{payload.get('wind_source')}**, "
        f"{payload.get('rows')} rows, trained {payload.get('trained_at')}."
    )
    lines.append("")
    lines += _by_block(backtest) + _pooled(backtest) + _intervals_and_onsets(backtest) + _verdicts(payload)
    if payload.get("ablation"):
        lines += _ablation(payload["ablation"])
    if payload.get("importance"):
        lines += ["", "## Feature importance (gain, top 20)", ""]
        lines += [f"- {name}: {_num(gain, 1)}" for name, gain in payload["importance"][:20]]
    return "\n".join(lines) + "\n"


def write_report(directory: pathlib.Path, version: str, payload: dict) -> pathlib.Path:
    folder = directory / version
    folder.mkdir(parents=True, exist_ok=True)
    (folder / "scores.json").write_text(json.dumps(_clean(payload), indent=2) + "\n")
    path = folder / "report.md"
    path.write_text(_render(payload))
    return path
