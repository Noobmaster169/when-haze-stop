"""The forecast service: /health and /predict for the jobs process. Features are computed here and nowhere else."""

import os
import pathlib

import pandas as pd
from fastapi import FastAPI
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from hazemodel.artifacts import artifacts_dir, live_version, load_artifact
from hazemodel.features.air import HISTORY_DAYS
from hazemodel.features.build import build_rows
from hazemodel.predict import predict_rows
from hazemodel.region import region_from_env
from hazemodel.store import connect, load_source_data, load_source_data_from_csv

LOOKBACK_DAYS = HISTORY_DAYS
LOOKAHEAD_HOURS = 48


class PredictBody(BaseModel):
    asOf: str


def _source(as_of: pd.Timestamp):
    csv = os.environ.get("MODEL_SOURCE_CSV")
    if csv:
        return load_source_data_from_csv(pathlib.Path(csv))
    with connect() as conn:
        return load_source_data(
            conn,
            as_of - pd.Timedelta(days=LOOKBACK_DAYS),
            as_of + pd.Timedelta(hours=LOOKAHEAD_HOURS),
            os.environ.get("HINDCAST_MODEL", "v2-analysis"),
        )


def create_app() -> FastAPI:
    app = FastAPI(title="haze-model")
    directory = artifacts_dir()
    region = region_from_env()

    def live():
        version = live_version(directory)
        return load_artifact(directory, version) if version else None

    @app.get("/health")
    def health():
        artifact = live()
        return {
            "status": "ok",
            "modelVersion": artifact.version if artifact else None,
            "trainedAt": artifact.trained_at.isoformat() if artifact else None,
        }

    @app.post("/predict")
    def predict(body: PredictBody):
        artifact = live()
        if artifact is None:
            return JSONResponse(status_code=503, content={"error": "no live model"})
        as_of = (
            pd.Timestamp(body.asOf).tz_convert("UTC")
            if pd.Timestamp(body.asOf).tzinfo
            else pd.Timestamp(body.asOf).tz_localize("UTC")
        )
        frame, _ = build_rows(_source(as_of), region, pd.DatetimeIndex([as_of]), with_targets=False)
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
