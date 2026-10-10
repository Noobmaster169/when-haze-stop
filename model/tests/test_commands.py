import argparse
import sys

import pytest

from hazemodel import cli, commands
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
