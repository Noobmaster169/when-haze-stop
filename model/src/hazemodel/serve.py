"""The forecast service: /health and /predict for the jobs process. Features are computed here and nowhere else."""

import datetime as dt
import json
import math
import os
import pathlib

import pandas as pd
from fastapi import FastAPI
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from hazemodel.artifacts import artifacts_dir, live_version, load_artifact, read_meta
from hazemodel.features.air import HISTORY_DAYS
from hazemodel.features.build import build_rows
from hazemodel.predict import predict_rows
from hazemodel.region import region_from_env
from hazemodel.report import reports_dir
from hazemodel.store import connect, load_source_data, load_source_data_from_csv

LOOKBACK_DAYS = HISTORY_DAYS
# The store keeps valid_at < end, and the weather features read the hour at issue + 48 h, so the window
# runs through issue + 3 days as the CLI's does; a 48 h end would lose that last hour on every on-the-hour ask.
LOOKAHEAD_DAYS = 3


class PredictBody(BaseModel):
    asOf: str


def _hazy_mae(pooled: dict, day: str) -> dict | None:
    """The reference kind's hazy-day MAE for the model and its two baselines; None where the report lacks a row."""
    out = {}
    for name, key in (("model", "model"), ("persistence", "persistence"), ("v2", "v2")):
        by_kind = pooled.get(key, {}).get(day, {})
        kind = by_kind.get("reference") or by_kind.get("nea") or {}
        value = kind.get("hazy_mae")
        if value is None or (isinstance(value, float) and math.isnan(value)):
            return None
        out[name] = float(value)
    return out


def report_summary(scores: dict) -> dict:
    """What the app states beside a forecast: the version, its promotion score and the hazy-day MAE at each lead."""
    backtest = scores.get("backtest", {})
    pooled = backtest.get("pooled", {})
    score = backtest.get("promotion_score")
    return {
        "version": scores["version"],
        "trainedAt": scores["trained_at"],
        "promotionScore": None if score is None or (isinstance(score, float) and math.isnan(score)) else float(score),
        "hazyMae": {"d1": _hazy_mae(pooled, "d1"), "d2": _hazy_mae(pooled, "d2")},
    }


def serve_window(as_of: pd.Timestamp) -> tuple[pd.Timestamp, pd.Timestamp]:
    """The [start, end) span the service loads for one ask."""
    return as_of - pd.Timedelta(days=LOOKBACK_DAYS), as_of + pd.Timedelta(days=LOOKAHEAD_DAYS)


def _source(as_of: pd.Timestamp):
    csv = os.environ.get("MODEL_SOURCE_CSV")
    if csv:
        return load_source_data_from_csv(pathlib.Path(csv))
    start, end = serve_window(as_of)
    with connect() as conn:
        return load_source_data(conn, start, end, os.environ.get("HINDCAST_MODEL", "v2-analysis"))


def parse_as_of(text: str) -> pd.Timestamp | None:
    """A strict ISO 8601 timestamp in UTC, or None; pandas alone would also take words such as "now"."""
    try:
        parsed = dt.datetime.fromisoformat(text[:-1] + "+00:00" if text.endswith("Z") else text)
    except ValueError:
        return None
    as_of = pd.Timestamp(parsed)
    return as_of.tz_convert("UTC") if as_of.tzinfo else as_of.tz_localize("UTC")


def create_app() -> FastAPI:
    app = FastAPI(title="haze-model")
    directory = artifacts_dir()
    region = region_from_env()

    def live():
        version = live_version(directory)
        return load_artifact(directory, version) if version else None

    @app.get("/health")
    def health():
        version = live_version(directory)
        meta = read_meta(directory, version) if version else None
        return {
            "status": "ok",
            "modelVersion": meta["version"] if meta else None,
            "trainedAt": meta["trained_at"] if meta else None,
        }

    @app.get("/report")
    def report():
        version = live_version(directory)
        path = reports_dir() / version / "scores.json" if version else None
        if path is None or not path.exists():
            return JSONResponse(status_code=404, content={"error": "no report for the live model"})
        return report_summary(json.loads(path.read_text()))

    @app.post("/predict")
    def predict(body: PredictBody):
        as_of = parse_as_of(body.asOf)
        if as_of is None:
            return JSONResponse(status_code=422, content={"error": "asOf must be an ISO 8601 timestamp"})
        artifact = live()
        if artifact is None:
            return JSONResponse(status_code=503, content={"error": "no live model"})
        # The hours ahead of the ask are the newest fetch's forecast, never the analysis training mostly saw.
        frame, _ = build_rows(
            _source(as_of),
            region,
            pd.DatetimeIndex([as_of]),
            with_targets=False,
            from_forecast=1,
            decisions=artifact.decisions,
        )
        if "level" not in frame.columns:
            # No instrument had a fresh level at the ask, so there is nothing to forecast from: an answer, not a fault.
            return {"modelVersion": artifact.version, "asOf": as_of.isoformat(), "forecasts": []}
        out = predict_rows(artifact, frame)
        forecasts = [
            {
                "instrumentId": row.instrument_id,
                "day": row.day.isoformat(),
                "p10": float(row.p10),
                "p50": float(row.p50),
                "p90": float(row.p90),
            }
            for row in out.itertuples()
        ]
        return {"modelVersion": artifact.version, "asOf": as_of.isoformat(), "forecasts": forecasts}

    return app
