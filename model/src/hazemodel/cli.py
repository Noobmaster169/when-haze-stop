"""Command line entry points; the argument parser is wired in a later task."""
import pathlib

import pandas as pd

from hazemodel.features.build import build_rows, write_parquet
from hazemodel.region import region_from_env
from hazemodel.store import connect, load_source_data

HISTORY_DAYS = 30
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
    frame, _ = build_rows(data, region_from_env(), issues, with_targets=True)
    return write_parquet(frame, pathlib.Path(args.out), args.start, args.end)
