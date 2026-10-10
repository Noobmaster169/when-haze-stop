"""Move the live pointer only when the candidate's walk-forward score is not worse than the live one's."""

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
        return {
            "promoted": False,
            "reason": "worse than live",
            "version": version,
            "candidate": candidate,
            "live": live,
            "live_version": current,
        }
    set_live(artifacts, version)
    return {"promoted": True, "version": version, "candidate": candidate, "live": live, "replaced": current}
