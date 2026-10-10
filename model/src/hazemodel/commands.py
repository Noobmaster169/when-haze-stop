"""The training-side subcommands. Each reads a parquet, runs the method, writes a report."""

import datetime as dt
import logging
import pathlib
import time
from types import SimpleNamespace

import pandas as pd

from hazemodel.ablation import run_ablation
from hazemodel.artifacts import DECISIONS, Artifact, artifacts_dir, save_artifact
from hazemodel.backtest import embargo, run_backtest, wind_source
from hazemodel.baselines import persistence
from hazemodel.hyperparams import search, write_params
from hazemodel.leaks import run_leak_tests
from hazemodel.promote import promote
from hazemodel.recursive import run_recursive_comparison
from hazemodel.report import newest_report_age, reports_dir, write_report, write_search
from hazemodel.scenarios import run_scenarios, unseen_instruments
from hazemodel.splits import walk_forward
from hazemodel.train import load_params, predict_frame, train_artifact

log = logging.getLogger(__name__)
WEEK_SECONDS = 7 * 24 * 3600
FRESH = dt.timedelta(days=7)
DAYS = (1, 2)


def _load(path: str) -> pd.DataFrame:
    frame = pd.read_parquet(path)
    frame["issue_at"] = pd.to_datetime(frame["issue_at"], utc=True)
    frame["kind"] = pd.Categorical(frame["kind"], categories=["doe", "nea", "openaq", "airport"])
    return frame.set_index(["instrument_id", "issue_at"]).sort_index()


def _attach_decisions(artifact: Artifact, parquet: str) -> None:
    """Freeze the truth decisions the rows were built with, so serving never refits them."""
    path = pathlib.Path(parquet)
    paths = {name: path.with_name(f"{path.stem}-{name}.csv") for name in DECISIONS}
    if not all(p.exists() for p in paths.values()):
        log.warning("no decision files beside %s: the artifact carries no decisions", path.name)
        return
    ids = {"instrument_id": str, "reference_id": str}
    artifact.decisions = {name: pd.read_csv(p, dtype=ids) for name, p in paths.items()}


def _pooled_test_and_model(frame: pd.DataFrame, params: dict, freq: str, min_train_blocks: int):
    tests, forecasts = [], []
    for _, full_train, test in walk_forward(frame, freq=freq, min_train_blocks=min_train_blocks):
        artifact, _ = train_artifact(embargo(full_train, test, DAYS), params, days=DAYS)
        tests.append(test)
        forecasts.append(predict_frame(artifact, test))
    all_test = pd.concat(tests)
    return all_test, {"model": pd.concat(forecasts), "persistence": persistence(all_test)}


def _header(artifact: Artifact, info: dict, frame: pd.DataFrame, params: dict, parquet: str) -> dict:
    return {
        "version": artifact.version,
        "parquet": pathlib.Path(parquet).name,
        "wind_source": wind_source(frame),
        "rows": int(len(frame)),
        "trained_at": artifact.trained_at.isoformat(),
        "params": params,
        "training": info,
    }


def evaluate(
    frame: pd.DataFrame, params: dict, parquet: str, freq: str, min_train_blocks: int, ablation: bool
) -> tuple[dict, Artifact]:
    backtest = run_backtest(frame, params, freq=freq, min_train_blocks=min_train_blocks)
    day2 = run_recursive_comparison(frame, params, freq=freq, min_train_blocks=min_train_blocks)
    all_test, forecasts = _pooled_test_and_model(frame, params, freq, min_train_blocks)
    scenarios = run_scenarios(all_test, forecasts)
    scenarios["unseen_instruments"] = unseen_instruments(frame, params, freq=freq, min_train_blocks=min_train_blocks)
    leaks = run_leak_tests(frame, params, freq=freq, min_train_blocks=min_train_blocks)
    artifact, info = train_artifact(frame, params)
    booster = artifact.boosters.get("d1_q50")
    gains = booster.feature_importance("gain").tolist() if booster else []
    payload = {
        **_header(artifact, info, frame, params, parquet),
        "backtest": backtest,
        "day2": day2,
        "scenarios": scenarios,
        "leaks": leaks,
        "ablation": run_ablation(frame, params, freq=freq, min_train_blocks=min_train_blocks) if ablation else None,
        "importance": sorted(zip(artifact.features, gains, strict=True), key=lambda pair: -pair[1]),
    }
    return payload, artifact


def carry_day2(artifact: Artifact, day2: dict) -> None:
    """The artifact serves day +2 the way the backtest chose; anything but an explicit "recursive" stays direct."""
    artifact.serves_d2 = "recursive" if day2.get("serves_d2") == "recursive" else "direct"
    print(f"{artifact.version}: day +2 served {artifact.serves_d2}")


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
        carry_day2(artifact, payload["day2"])
    else:
        artifact, info = train_artifact(frame, params)
        payload = {**_header(artifact, info, frame, params, args.parquet), "backtest": {}}
        print(f"{artifact.version}: no backtest, so no day +2 choice; day +2 served direct")
    _attach_decisions(artifact, args.parquet)
    save_artifact(artifacts_dir(), artifact)
    scored = reports_dir() / artifact.version / "scores.json"
    if args.with_backtest or not scored.exists():
        write_report(reports_dir(), artifact.version, payload)
        print(f"{artifact.version}: report written")
    else:
        print(f"{artifact.version}: kept the existing scored report")


def promote_command(args) -> None:
    print(promote(artifacts_dir(), reports_dir(), args.version))


def search_command(args) -> None:
    out = search(_load(args.parquet), freq=args.freq, months=args.months, draws=args.draws)
    print(f"criterion: {out['criterion']}")
    print(pd.DataFrame(out["draws"]).sort_values(out["criterion"]).to_string())
    print(f"draws written to {write_search(reports_dir(), out, dt.date.today())}")
    if args.write:
        write_params(out["params"])
        print("written to params.json")


def retrain_command(args) -> None:
    from hazemodel.cli import features_command  # cli imports this module

    age = newest_report_age(reports_dir(), dt.datetime.now(dt.timezone.utc))
    if age is not None and age < FRESH and not args.force:
        print(f"skipped: the newest report is {age} old, under {FRESH.days} days; pass --force to retrain anyway")
        return
    while True:
        end = (dt.date.today() - dt.timedelta(days=1)).isoformat()
        built = SimpleNamespace(start=args.start, end=end, hindcast_model=args.hindcast_model, out=args.out)
        parquet = str(features_command(built))
        payload, artifact = evaluate(_load(parquet), load_params(), parquet, "M", 1, False)
        carry_day2(artifact, payload["day2"])
        _attach_decisions(artifact, parquet)
        save_artifact(artifacts_dir(), artifact)
        write_report(reports_dir(), artifact.version, payload)
        print(promote(artifacts_dir(), reports_dir(), artifact.version))
        if not args.loop:
            return
        time.sleep(WEEK_SECONDS)
