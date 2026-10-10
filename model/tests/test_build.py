import pandas as pd

from hazemodel.features.build import (
    HAZY_WEIGHT,
    KIND_WEIGHT,
    _reference_weight,
    _targets,
    build_rows,
    write_parquet,
)
from hazemodel.instruments import instruments
from hazemodel.region import region_from_env
from hazemodel.truth.assemble import assemble_truth
from hazemodel.truth.visibility import CENSOR_UGM3

ISSUES = pd.DatetimeIndex([pd.Timestamp("2026-10-07T00:00:00Z"), pd.Timestamp("2026-10-08T00:00:00Z")])
COLUMNS = (
    "level", "fire_s0_r0_d1", "u24", "doy_sin", "kind", "kind_code",
    "reference_weight", "peak_d1", "peak_d2", "weight_d1",
)


def test_assemble_truth_has_every_kind(data):
    series, decisions = assemble_truth(data, instruments(data))
    assert {"sensors", "airports"} == set(decisions)
    assert series["instrument_id"].str.startswith("openaq:").any()
    assert (series["instrument_id"] == "WMKK").any()
    assert (series["instrument_id"] == "SGCENTRAL").any()


def test_build_rows_joins_groups_and_targets(data):
    frame, decisions = build_rows(data, region_from_env(), ISSUES, with_targets=True)
    assert frame.index.names == ["instrument_id", "issue_at"]
    for column in COLUMNS:
        assert column in frame.columns, column
    sg = frame.loc[("SGCENTRAL", ISSUES[0])]
    assert sg["reference_weight"] == 1.0
    assert sg["peak_d1"] > 0
    assert sg["weight_d1"] in (1.0, 3.0)
    airport = frame.loc[("WMKK", ISSUES[0])]
    assert airport["reference_weight"] == 0.4


def test_build_skips_instrument_without_level(data):
    silent = data.nea_hours[data.nea_hours["region"] != "west"]
    data_silent = type(data)(**{**data.__dict__, "nea_hours": silent})
    frame, _ = build_rows(data_silent, region_from_env(), ISSUES, with_targets=False)
    assert "SGWEST" not in frame.index.get_level_values("instrument_id")
    assert frame["level"].notna().all()


def test_write_parquet_names_the_file_by_content(tmp_path, data):
    frame, _ = build_rows(data, region_from_env(), ISSUES, with_targets=True)
    path = write_parquet(frame, tmp_path, "2026-10-07", "2026-10-08")
    assert path.name.startswith("features-2026-10-07-2026-10-08-")
    back = pd.read_parquet(path)
    assert len(back) == len(frame)


def _day_series(instrument: str, day: str, level: float, censored: bool = False) -> pd.DataFrame:
    # Test vector: 24 hourly rows of one constant level for the Malaysian day starting at 00:00 +08.
    hours = pd.date_range(pd.Timestamp(day) - pd.Timedelta(hours=8), periods=24, freq="1h", tz="UTC")
    return pd.DataFrame(
        {"instrument_id": instrument, "observed_at": hours, "pm25_24h": level, "censored": censored}
    )


def _target_frame(issue: str, reference_weight: float) -> pd.DataFrame:
    index = pd.MultiIndex.from_tuples([("A", pd.Timestamp(issue, tz="UTC"))], names=["instrument_id", "issue_at"])
    return pd.DataFrame({"reference_weight": [reference_weight]}, index=index)


def test_targets_use_the_next_two_malaysian_days_and_the_hazy_weight():
    # Test vectors: issue 2026-10-07 00:00Z is 08:00 MYT on the 7th, so d1 is the 8th and d2 the 9th.
    series = pd.concat(
        [
            _day_series("A", "2026-10-07", 99.0),
            _day_series("A", "2026-10-08", 60.0),
            _day_series("A", "2026-10-09", 55.0),
        ],
        ignore_index=True,
    )
    row = _targets(series, _target_frame("2026-10-07T00:00:00", 0.6)).iloc[0]
    assert row["peak_d1"] == 60.0
    assert row["peak_d2"] == 55.0
    assert abs(row["weight_d1"] - 0.6 * HAZY_WEIGHT) < 1e-9
    assert abs(row["weight_d2"] - 0.6) < 1e-9


def test_a_censored_day_at_or_below_the_floor_has_no_weight():
    series = pd.concat(
        [
            _day_series("A", "2026-10-08", CENSOR_UGM3, censored=True),
            _day_series("A", "2026-10-09", 80.0, censored=True),
        ],
        ignore_index=True,
    )
    row = _targets(series, _target_frame("2026-10-07T00:00:00", 1.0)).iloc[0]
    assert row["weight_d1"] == 0.0
    assert row["weight_d2"] == HAZY_WEIGHT


def test_reference_weight_zeroes_unaccepted_openaq():
    table = pd.DataFrame({"instrument_id": ["openaq:1", "openaq:2", "SGCENTRAL"], "kind": ["openaq", "openaq", "nea"]})
    decisions = pd.DataFrame({"instrument_id": ["openaq:1", "openaq:2"], "accepted": [True, False]})
    weight = _reference_weight(table, decisions)
    assert weight["openaq:1"] == 0.6
    assert weight["openaq:2"] == 0.0
    assert weight["SGCENTRAL"] == 1.0


def test_kind_code_follows_the_kind_order(data):
    frame, _ = build_rows(data, region_from_env(), ISSUES, with_targets=False)
    order = list(KIND_WEIGHT)
    assert order == ["doe", "nea", "openaq", "airport"]
    assert (frame["kind_code"] == frame["kind"].map(order.index).astype(int)).all()


def test_parquet_keeps_the_index_as_columns(tmp_path, data):
    frame, _ = build_rows(data, region_from_env(), ISSUES, with_targets=False)
    back = pd.read_parquet(write_parquet(frame, tmp_path, "a", "b"))
    assert {"instrument_id", "issue_at"} <= set(back.columns)
