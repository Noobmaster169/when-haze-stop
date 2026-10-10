import pandas as pd

from hazemodel.features.build import build_rows, write_parquet
from hazemodel.instruments import instruments
from hazemodel.region import region_from_env
from hazemodel.truth.assemble import assemble_truth

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
