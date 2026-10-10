"""A trained model on disk: one folder per version, and a `live` file naming the one that serves."""

import datetime as dt
import json
import os
import pathlib
from dataclasses import dataclass
from typing import Literal

import lightgbm as lgb
import pandas as pd

KEYS = ["d1_q10", "d1_q50", "d1_q90", "d2_q10", "d2_q50", "d2_q90"]
# The sensor and airport corrections the artifact was trained on, frozen so serving never refits them.
DECISIONS = ("sensors", "airports")
Day2 = Literal["direct", "recursive"]


@dataclass
class Artifact:
    version: str
    trained_at: dt.datetime
    features: list[str]
    boosters: dict[str, lgb.Booster]
    decisions: dict[str, pd.DataFrame] | None = None
    # How day +2 is served, chosen by the backtest. Direct is what a version saved before the choice was carried does.
    serves_d2: Day2 = "direct"


def artifacts_dir() -> pathlib.Path:
    default = pathlib.Path(__file__).resolve().parents[2] / "artifacts"
    return pathlib.Path(os.environ.get("MODEL_ARTIFACTS", default))


def save_artifact(directory: pathlib.Path, artifact: Artifact) -> pathlib.Path:
    folder = directory / artifact.version
    folder.mkdir(parents=True, exist_ok=True)
    (folder / "meta.json").write_text(
        json.dumps(
            {
                "version": artifact.version,
                "trained_at": artifact.trained_at.isoformat(),
                "features": artifact.features,
                "serves_d2": artifact.serves_d2,
            },
            indent=2,
        )
    )
    for key, booster in artifact.boosters.items():
        booster.save_model(str(folder / f"{key}.txt"))
    for name, frame in (artifact.decisions or {}).items():
        frame.to_csv(folder / f"decisions-{name}.csv", index=False)
    return folder


def _read_decisions(folder: pathlib.Path) -> dict[str, pd.DataFrame] | None:
    paths = {name: folder / f"decisions-{name}.csv" for name in DECISIONS}
    ids = {"instrument_id": str, "reference_id": str}
    found = {name: pd.read_csv(path, dtype=ids) for name, path in paths.items() if path.exists()}
    return found or None


def read_meta(directory: pathlib.Path, version: str) -> dict:
    """A version's meta.json alone, for callers that must not pay for deserialising the boosters."""
    return json.loads((directory / version / "meta.json").read_text())


def load_artifact(directory: pathlib.Path, version: str) -> Artifact:
    folder = directory / version
    meta = read_meta(directory, version)
    boosters = {
        key: lgb.Booster(model_file=str(folder / f"{key}.txt")) for key in KEYS if (folder / f"{key}.txt").exists()
    }
    return Artifact(
        version=meta["version"],
        trained_at=dt.datetime.fromisoformat(meta["trained_at"]),
        features=meta["features"],
        boosters=boosters,
        decisions=_read_decisions(folder),
        serves_d2="recursive" if meta.get("serves_d2") == "recursive" else "direct",
    )


def live_version(directory: pathlib.Path) -> str | None:
    pointer = directory / "live"
    if not pointer.exists():
        return None
    version = pointer.read_text().strip()
    return version or None


def set_live(directory: pathlib.Path, version: str) -> None:
    directory.mkdir(parents=True, exist_ok=True)
    staging = directory / "live.tmp"
    staging.write_text(version + "\n")
    os.replace(staging, directory / "live")
