"""The command line: one subcommand per job, each registered by its own module's add_<name>(subparsers)."""

import argparse
import os
import pathlib

import pandas as pd
import uvicorn

from hazemodel.commands import backtest_command, promote_command, retrain_command, search_command, train_command
from hazemodel.features.air import HISTORY_DAYS
from hazemodel.features.build import build_rows, write_parquet
from hazemodel.region import region_from_env
from hazemodel.store import connect, load_source_data

TARGET_LOOKAHEAD_DAYS = 3


def _data_dir() -> str:
    """MODEL_DATA overrides the source-tree folder, which an installed package (the image) does not have."""
    return os.environ.get("MODEL_DATA", str(pathlib.Path(__file__).resolve().parents[2] / "data"))


def features_command(args) -> pathlib.Path:
    """Build the feature frame for one issue per day (00:00 UTC) from args.start to args.end and write parquet."""
    start = pd.Timestamp(args.start, tz="UTC")
    end = pd.Timestamp(args.end, tz="UTC")
    issues = pd.date_range(start, end, freq="1D")
    with connect() as conn:
        data = load_source_data(
            conn,
            start - pd.Timedelta(days=HISTORY_DAYS),
            end + pd.Timedelta(days=TARGET_LOOKAHEAD_DAYS),
            args.hindcast_model,
        )
    frame, decisions = build_rows(data, region_from_env(), issues, with_targets=True, from_forecast=0)
    path = write_parquet(frame, pathlib.Path(args.out), args.start, args.end)
    for name in ("sensors", "airports"):
        target = path.with_name(f"{path.stem}-{name}.csv")
        decisions[name].to_csv(target, index=False)
        print(target)
    return path


def serve_command(args) -> None:
    uvicorn.run("hazemodel.serve:create_app", factory=True, host=args.host, port=args.port, log_level="info")


def add_features(subparsers) -> None:
    parser = subparsers.add_parser("features", help="build the training rows into parquet")
    parser.add_argument("--from", dest="start", required=True)
    parser.add_argument("--to", dest="end", required=True)
    parser.add_argument("--hindcast-model", default="v2-analysis")
    parser.add_argument("--out", default=_data_dir())
    parser.set_defaults(run=features_command)


def add_serve(subparsers) -> None:
    parser = subparsers.add_parser("serve", help="serve /health and /predict")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=4002)
    parser.set_defaults(run=serve_command)


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
    retrain.add_argument("--out", default=_data_dir())
    retrain.add_argument("--loop", action="store_true")
    retrain.set_defaults(run=retrain_command)


def main() -> None:
    parser = argparse.ArgumentParser(prog="hazemodel")
    subparsers = parser.add_subparsers(required=True)
    add_features(subparsers)
    add_serve(subparsers)
    add_training(subparsers)
    args = parser.parse_args()
    args.run(args)
