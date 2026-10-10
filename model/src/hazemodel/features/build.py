"""Assemble one row per instrument and issue time: every feature group, the kind, the weights and the targets."""

import hashlib
import pathlib

import numpy as np
import pandas as pd

from hazemodel.features.air import air_features
from hazemodel.features.calendar import calendar_features
from hazemodel.features.fires import fire_features
from hazemodel.features.physics import physics_features
from hazemodel.features.weather import weather_features
from hazemodel.instruments import instruments
from hazemodel.region import MALAYSIA_OFFSET, Region
from hazemodel.store import SourceData
from hazemodel.truth.assemble import assemble_truth
from hazemodel.truth.reference import daily_peaks
from hazemodel.truth.visibility import CENSOR_UGM3

KIND_WEIGHT = {"doe": 1.0, "nea": 1.0, "openaq": 0.6, "airport": 0.4}
HAZY_UGM3 = 55.0
HAZY_WEIGHT = 3.0
TARGET_DAYS = (1, 2)


def _reference_weight(table: pd.DataFrame, sensor_decisions: pd.DataFrame) -> pd.Series:
    weight = table["kind"].map(KIND_WEIGHT)
    accepted = set(sensor_decisions[sensor_decisions["accepted"]]["instrument_id"])
    unaccepted = (table["kind"] == "openaq") & ~table["instrument_id"].isin(accepted)
    return pd.Series(np.where(unaccepted, 0.0, weight), index=table["instrument_id"])


def _targets(series: pd.DataFrame, frame: pd.DataFrame) -> pd.DataFrame:
    peaks = daily_peaks(series).set_index(["instrument_id", "day"])["peak"]
    censored = series.groupby(["instrument_id", (series["observed_at"] + MALAYSIA_OFFSET).dt.date])["censored"].all()
    censored.index.names = ["instrument_id", "day"]
    ids = frame.index.get_level_values("instrument_id")
    issue_days = (frame.index.get_level_values("issue_at") + MALAYSIA_OFFSET).date
    for d in TARGET_DAYS:
        keys = [(i, day + pd.Timedelta(days=d).to_pytimedelta()) for i, day in zip(ids, issue_days, strict=True)]
        frame[f"peak_d{d}"] = peaks.reindex(keys).to_numpy()
        frame[f"censored_d{d}"] = censored.reindex(keys).eq(True).to_numpy()
        hazy = np.where(frame[f"peak_d{d}"] > HAZY_UGM3, HAZY_WEIGHT, 1.0)
        clean_censored = frame[f"censored_d{d}"] & (frame[f"peak_d{d}"] <= CENSOR_UGM3)
        frame[f"weight_d{d}"] = np.where(clean_censored, 0.0, frame["reference_weight"] * hazy)
    return frame


def build_rows(
    data: SourceData,
    region: Region,
    issue_times: pd.DatetimeIndex,
    with_targets: bool,
    from_forecast: int = 0,
    decisions: dict[str, pd.DataFrame] | None = None,
) -> tuple[pd.DataFrame, dict]:
    """`decisions` freezes the sensor and airport corrections to a trained artifact's; None fits them here."""
    table = instruments(data)
    series, decisions = assemble_truth(data, table, decisions)
    air = air_features(series, table, issue_times)
    fires = fire_features(data, table, issue_times)
    weather = weather_features(data, table, region, fires, issue_times, from_forecast)
    physics = physics_features(data, issue_times)
    frame = air.join(fires, how="inner").join(weather, how="left").join(physics, how="left")
    frame["has_physics"] = pd.to_numeric(frame["has_physics"]).fillna(0).astype(int)
    frame = frame.join(calendar_features(issue_times), on="issue_at")
    ids = frame.index.get_level_values("instrument_id")
    kinds = table.set_index("instrument_id")["kind"]
    frame["kind"] = pd.Categorical(kinds.reindex(ids).to_numpy(), categories=list(KIND_WEIGHT))
    # LightGBM reads the integer twin; the category order is fixed by KIND_WEIGHT so codes are stable across runs.
    frame["kind_code"] = frame["kind"].cat.codes.astype(int)
    frame["reference_weight"] = _reference_weight(table, decisions["sensors"]).reindex(ids).to_numpy()
    if with_targets:
        frame = _targets(series, frame)
    return frame.sort_index(), decisions


def write_parquet(frame: pd.DataFrame, directory: pathlib.Path, start: str, end: str) -> pathlib.Path:
    digest = hashlib.sha1(f"{sorted(frame.columns)}:{len(frame)}".encode()).hexdigest()[:8]
    directory.mkdir(parents=True, exist_ok=True)
    path = directory / f"features-{start}-{end}-{digest}.parquet"
    frame.reset_index().to_parquet(path, index=False)
    return path
