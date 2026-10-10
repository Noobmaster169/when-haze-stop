import datetime as dt
import pathlib

import lightgbm as lgb
import numpy as np
import pandas as pd
import pytest
from fastapi.testclient import TestClient

from hazemodel.artifacts import Artifact, load_artifact, save_artifact, set_live
from hazemodel.features.build import build_rows
from hazemodel.predict import predict_rows
from hazemodel.region import region_from_env
from hazemodel import serve
from hazemodel.features.air import STALE_HOURS
from hazemodel.serve import create_app, parse_as_of, serve_window
from hazemodel.store import SourceData

ISSUE = pd.Timestamp("2026-10-08T00:00:00Z")


def fit_on_fixture(data: SourceData) -> Artifact:
    frame, decisions = build_rows(
        data, region_from_env(), pd.DatetimeIndex([ISSUE - pd.Timedelta(days=1), ISSUE]), with_targets=True
    )
    features = [
        c
        for c in frame.columns
        if c not in {"kind", "reference_weight"}
        and not c.startswith(("peak_", "weight_", "censored_"))
        and not c.startswith("fire_s")
    ]
    boosters = {}
    for d in (1, 2):
        rows = frame.dropna(subset=[f"peak_d{d}"])
        x, y = rows[features].to_numpy(dtype=float), rows[f"peak_d{d}"].to_numpy()
        for q in (10, 50, 90):
            params = {"objective": "quantile", "alpha": q / 100, "verbose": -1, "min_data_in_leaf": 2, "num_leaves": 4}
            boosters[f"d{d}_q{q}"] = lgb.train(params, lgb.Dataset(x, y), 10)
    return Artifact(
        version="2026-10-10-fixture1",
        trained_at=dt.datetime(2026, 10, 10, tzinfo=dt.timezone.utc),
        features=features,
        boosters=boosters,
        decisions=decisions,
    )


def test_predict_rows_gives_three_days_with_sorted_quantiles(data):
    artifact = fit_on_fixture(data)
    frame, _ = build_rows(data, region_from_env(), pd.DatetimeIndex([ISSUE]), with_targets=False)
    out = predict_rows(artifact, frame)
    assert set(out.columns) == {"instrument_id", "day", "p10", "p50", "p90"}
    assert sorted(out["day"].unique()) == [dt.date(2026, 10, 9), dt.date(2026, 10, 10), dt.date(2026, 10, 11)]
    assert (out["p10"] <= out["p50"]).all() and (out["p50"] <= out["p90"]).all()
    assert len(out) == 3 * frame.index.get_level_values("instrument_id").nunique()


@pytest.fixture
def app_env(tmp_path, monkeypatch, data):
    monkeypatch.setenv("MODEL_ARTIFACTS", str(tmp_path))
    monkeypatch.setenv("MODEL_SOURCE_CSV", str(pathlib.Path(__file__).parent / "fixtures"))
    return tmp_path


def test_predict_without_artifact_is_503(app_env):
    client = TestClient(create_app())
    assert client.get("/health").json() == {"status": "ok", "modelVersion": None, "trainedAt": None}
    answer = client.post("/predict", json={"asOf": ISSUE.isoformat()})
    assert answer.status_code == 503
    assert answer.json() == {"error": "no live model"}


def test_predict_with_live_artifact(app_env, data):
    artifact = fit_on_fixture(data)
    save_artifact(app_env, artifact)
    set_live(app_env, artifact.version)
    assert set(load_artifact(app_env, artifact.version).decisions) == {"sensors", "airports"}
    client = TestClient(create_app())
    health = client.get("/health").json()
    assert health["modelVersion"] == artifact.version
    answer = client.post("/predict", json={"asOf": ISSUE.isoformat()})
    assert answer.status_code == 200
    body = answer.json()
    assert body["modelVersion"] == artifact.version
    first = body["forecasts"][0]
    assert set(first) == {"instrumentId", "day", "p10", "p50", "p90"}
    assert first["day"] == "2026-10-09"
    assert np.isfinite(first["p50"])


@pytest.mark.parametrize("as_of", ["not-a-date", "", "now", "today"])
def test_malformed_as_of_is_422(app_env, data, as_of):
    artifact = fit_on_fixture(data)
    save_artifact(app_env, artifact)
    set_live(app_env, artifact.version)
    answer = TestClient(create_app()).post("/predict", json={"asOf": as_of})
    assert answer.status_code == 422
    assert answer.json() == {"error": "asOf must be an ISO 8601 timestamp"}


def test_live_pointer_is_re_read_per_request(app_env, data):
    client = TestClient(create_app())
    assert client.post("/predict", json={"asOf": ISSUE.isoformat()}).status_code == 503
    artifact = fit_on_fixture(data)
    save_artifact(app_env, artifact)
    set_live(app_env, artifact.version)
    assert client.get("/health").json()["modelVersion"] == artifact.version
    assert client.post("/predict", json={"asOf": ISSUE.isoformat()}).status_code == 200


def test_blank_live_file_is_no_live_model(app_env):
    (app_env / "live").write_text("\n")
    client = TestClient(create_app())
    assert client.get("/health").json()["modelVersion"] is None
    assert client.post("/predict", json={"asOf": ISSUE.isoformat()}).status_code == 503


def _within(frame: pd.DataFrame, column: str, start: pd.Timestamp, end: pd.Timestamp) -> pd.DataFrame:
    # The store's SQL keeps start <= t < end; the CSV source is cut the same way here.
    return frame[(frame[column] >= start) & (frame[column] < end)]


def test_the_serve_window_keeps_all_48_weather_hours(data):
    start, end = serve_window(ISSUE)
    windowed = type(data)(**{**data.__dict__, "weather_hours": _within(data.weather_hours, "valid_at", start, end)})
    frame, _ = build_rows(windowed, region_from_env(), pd.DatetimeIndex([ISSUE]), with_targets=False)
    assert (frame["hours_present"] == 48).all()
    short = _within(data.weather_hours, "valid_at", start, ISSUE + pd.Timedelta(hours=48))
    cut = type(data)(**{**data.__dict__, "weather_hours": short})
    frame_short, _ = build_rows(cut, region_from_env(), pd.DatetimeIndex([ISSUE]), with_targets=False)
    assert (frame_short["hours_present"] == 47).all()


def test_as_of_accepts_z_and_offsets_and_naive_as_utc():
    assert parse_as_of("2026-10-08T00:00:00Z") == ISSUE
    assert parse_as_of("2026-10-08T08:00:00+08:00") == ISSUE
    assert parse_as_of("2026-10-08T00:00:00") == ISSUE
    assert parse_as_of("now") is None


def test_health_reads_only_the_meta(app_env, data):
    artifact = fit_on_fixture(data)
    folder = save_artifact(app_env, artifact)
    set_live(app_env, artifact.version)
    # Test vector: a booster file that cannot be parsed, which /health must never open.
    (folder / "d1_q10.txt").write_text("not a model")
    health = TestClient(create_app()).get("/health").json()
    assert health == {"status": "ok", "modelVersion": artifact.version, "trainedAt": artifact.trained_at.isoformat()}


def test_no_fresh_level_answers_an_empty_list(app_env, data, monkeypatch):
    artifact = fit_on_fixture(data)
    save_artifact(app_env, artifact)
    set_live(app_env, artifact.version)
    # Test vector: every observation cut to before the issue by more than the staleness limit.
    before = ISSUE - pd.Timedelta(hours=STALE_HOURS + 6)
    names = ("readings", "nea_hours", "openaq_hours", "metar_obs")
    cut = {name: getattr(data, name)[getattr(data, name)["observed_at"] < before] for name in names}
    monkeypatch.setattr(serve, "_source", lambda as_of: type(data)(**{**data.__dict__, **cut}))
    answer = TestClient(create_app()).post("/predict", json={"asOf": ISSUE.isoformat()})
    assert answer.status_code == 200
    assert answer.json() == {"modelVersion": artifact.version, "asOf": ISSUE.isoformat(), "forecasts": []}
