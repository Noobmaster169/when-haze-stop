"""A trained model on disk: one folder per version, and a `live` file naming the one that serves."""

import datetime as dt
import json
import os
import pathlib
from dataclasses import dataclass

import lightgbm as lgb

KEYS = ["d1_q10", "d1_q50", "d1_q90", "d2_q10", "d2_q50", "d2_q90"]


@dataclass
class Artifact:
    version: str
    trained_at: dt.datetime
    features: list[str]
    boosters: dict[str, lgb.Booster]


def artifacts_dir() -> pathlib.Path:
    default = pathlib.Path(__file__).resolve().parents[2] / "artifacts"
    return pathlib.Path(os.environ.get("MODEL_ARTIFACTS", default))


def save_artifact(directory: pathlib.Path, artifact: Artifact) -> pathlib.Path:
    folder = directory / artifact.version
    folder.mkdir(parents=True, exist_ok=True)
    (folder / "meta.json").write_text(
        json.dumps(
            {"version": artifact.version, "trained_at": artifact.trained_at.isoformat(), "features": artifact.features},
            indent=2,
        )
    )
    for key, booster in artifact.boosters.items():
        booster.save_model(str(folder / f"{key}.txt"))
    return folder


def load_artifact(directory: pathlib.Path, version: str) -> Artifact:
    folder = directory / version
    meta = json.loads((folder / "meta.json").read_text())
    boosters = {
        key: lgb.Booster(model_file=str(folder / f"{key}.txt")) for key in KEYS if (folder / f"{key}.txt").exists()
    }
    return Artifact(
        version=meta["version"],
        trained_at=dt.datetime.fromisoformat(meta["trained_at"]),
        features=meta["features"],
        boosters=boosters,
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
