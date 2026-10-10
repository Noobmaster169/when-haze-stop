"""The command line: one subcommand per job, each registered by its own module's add_<name>(subparsers)."""

import argparse
import pathlib

import pandas as pd
import uvicorn

from hazemodel.features.air import HISTORY_DAYS
from hazemodel.features.build import build_rows, write_parquet
from hazemodel.region import region_from_env
from hazemodel.store import connect, load_source_data

TARGET_LOOKAHEAD_DAYS = 3


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
    parser.add_argument("--out", default=str(pathlib.Path(__file__).resolve().parents[2] / "data"))
    parser.set_defaults(run=features_command)


def add_serve(subparsers) -> None:
    parser = subparsers.add_parser("serve", help="serve /health and /predict")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=4002)
    parser.set_defaults(run=serve_command)


def main() -> None:
    parser = argparse.ArgumentParser(prog="hazemodel")
    subparsers = parser.add_subparsers(required=True)
    add_features(subparsers)
    add_serve(subparsers)
    args = parser.parse_args()
    args.run(args)
