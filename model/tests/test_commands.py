import argparse
import datetime as dt
import json
import sys

import pytest

from hazemodel import cli, commands
from hazemodel.artifacts import Artifact
from hazemodel.features.build import build_rows
from hazemodel.region import region_from_env
from tests.conftest import FIXTURE_ISSUES


@pytest.fixture
def parquet(tmp_path, data):
    rows, decisions = build_rows(data, region_from_env(), FIXTURE_ISSUES, with_targets=True)
    path = tmp_path / "features-x.parquet"
    rows.reset_index().to_parquet(path, index=False)
    return path, decisions


def _args(path):
    return argparse.Namespace(parquet=str(path), with_backtest=False, freq="M", min_train_blocks=1)


def test_train_command_freezes_the_decisions_beside_the_parquet(tmp_path, monkeypatch, parquet):
    path, decisions = parquet
    for name in ("sensors", "airports"):
        decisions[name].to_csv(path.with_name(f"{path.stem}-{name}.csv"), index=False)
    monkeypatch.setenv("MODEL_ARTIFACTS", str(tmp_path / "artifacts"))
    monkeypatch.setattr(commands, "reports_dir", lambda: tmp_path / "reports")
    commands.train_command(_args(path))
    (folder,) = (tmp_path / "artifacts").iterdir()
    assert (folder / "decisions-sensors.csv").exists() and (folder / "decisions-airports.csv").exists()
    assert (tmp_path / "reports" / folder.name / "scores.json").exists()


def test_train_command_without_decision_files_saves_no_decisions(tmp_path, monkeypatch, parquet):
    path, _ = parquet
    monkeypatch.setenv("MODEL_ARTIFACTS", str(tmp_path / "artifacts"))
    monkeypatch.setattr(commands, "reports_dir", lambda: tmp_path / "reports")
    commands.train_command(_args(path))
    (folder,) = (tmp_path / "artifacts").iterdir()
    assert not (folder / "decisions-sensors.csv").exists()


def test_help_lists_every_subcommand(monkeypatch, capsys):
    monkeypatch.setattr(sys, "argv", ["hazemodel", "--help"])
    with pytest.raises(SystemExit):
        cli.main()
    text = capsys.readouterr().out
    for name in ("features", "serve", "backtest", "train", "promote", "search", "retrain"):
        assert name in text


def test_train_command_keeps_an_existing_scored_report(tmp_path, monkeypatch, parquet, capsys):
    path, _ = parquet
    monkeypatch.setenv("MODEL_ARTIFACTS", str(tmp_path / "artifacts"))
    monkeypatch.setattr(commands, "reports_dir", lambda: tmp_path / "reports")
    commands.train_command(_args(path))
    (folder,) = (tmp_path / "artifacts").iterdir()
    scores = tmp_path / "reports" / folder.name / "scores.json"
    scores.write_text('{"backtest": {"promotion_score": 1.0}}')
    commands.train_command(_args(path))
    assert scores.read_text() == '{"backtest": {"promotion_score": 1.0}}'
    assert "kept the existing scored report" in capsys.readouterr().out


def test_features_out_follows_model_data(monkeypatch, tmp_path):
    from hazemodel import cli

    monkeypatch.setenv("MODEL_DATA", str(tmp_path))
    assert cli._data_dir() == str(tmp_path)


def test_train_without_a_backtest_serves_day_two_direct(tmp_path, monkeypatch, parquet, capsys):
    path, _ = parquet
    monkeypatch.setenv("MODEL_ARTIFACTS", str(tmp_path / "artifacts"))
    monkeypatch.setattr(commands, "reports_dir", lambda: tmp_path / "reports")
    commands.train_command(_args(path))
    (folder,) = (tmp_path / "artifacts").iterdir()
    assert json.loads((folder / "meta.json").read_text())["serves_d2"] == "direct"
    assert "day +2 served direct" in capsys.readouterr().out


def test_carry_day2_takes_only_an_explicit_recursive():
    art = Artifact("v", dt.datetime(2026, 10, 10, tzinfo=dt.timezone.utc), [], {})
    commands.carry_day2(art, {"serves_d2": "recursive"})
    assert art.serves_d2 == "recursive"
    for day2 in ({"serves_d2": "direct"}, {}):
        commands.carry_day2(art, day2)
        assert art.serves_d2 == "direct"


def _report(reports, version, trained_at):
    (reports / version).mkdir(parents=True)
    (reports / version / "scores.json").write_text(json.dumps({"trained_at": trained_at.isoformat()}))


class Built(Exception):
    pass


def _refuse_features(_args):
    raise Built


@pytest.mark.parametrize(
    ("age_days", "force", "runs"), [(2, False, False), (2, True, True), (8, False, True), (None, False, True)]
)
def test_retrain_skips_when_a_report_is_under_a_week_old(tmp_path, monkeypatch, age_days, force, runs):
    reports = tmp_path / "reports"
    reports.mkdir()
    now = dt.datetime.now(dt.timezone.utc)
    if age_days is not None:
        _report(reports, "old", now - dt.timedelta(days=30))
        _report(reports, "new", now - dt.timedelta(days=age_days))
    monkeypatch.setattr(commands, "reports_dir", lambda: reports)
    monkeypatch.setattr(cli, "features_command", _refuse_features)
    args = argparse.Namespace(
        start="2025-06-07", hindcast_model="v2-analysis", out=str(tmp_path), loop=False, force=force
    )
    if runs:
        with pytest.raises(Built):
            commands.retrain_command(args)
    else:
        commands.retrain_command(args)


def test_search_command_keeps_its_draws(tmp_path, monkeypatch):
    out = {
        "criterion": "mae",
        "params": {"num_leaves": 20},
        "draws": [{"num_leaves": 20, "hazy_mae": float("nan"), "mae": 3.0}],
    }
    monkeypatch.setattr(commands, "search", lambda *a, **k: out)
    monkeypatch.setattr(commands, "_load", lambda path: None)
    monkeypatch.setattr(commands, "reports_dir", lambda: tmp_path)
    commands.search_command(argparse.Namespace(parquet="x", freq="M", months=6, draws=1, write=False))
    (path,) = tmp_path.glob("search-*.json")
    kept = json.loads(path.read_text())
    assert kept["criterion"] == "mae" and kept["draws"][0]["hazy_mae"] is None and kept["draws"][0]["mae"] == 3.0
