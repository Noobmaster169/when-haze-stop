import json

from hazemodel.artifacts import live_version
from hazemodel.promote import promote


def _report(reports, version, score):
    folder = reports / version
    folder.mkdir(parents=True)
    (folder / "scores.json").write_text(json.dumps({"version": version, "backtest": {"promotion_score": score}}))


def test_promote_first_and_refuse_without_score(tmp_path):
    artifacts, reports = tmp_path / "artifacts", tmp_path / "reports"
    _report(reports, "v1", 10.0)
    assert promote(artifacts, reports, "v1")["promoted"] is True
    assert live_version(artifacts) == "v1"
    (reports / "v2").mkdir()
    (reports / "v2" / "scores.json").write_text(json.dumps({"version": "v2", "backtest": {}}))
    out = promote(artifacts, reports, "v2")
    assert out["promoted"] is False and out["reason"] == "no promotion score"
    assert live_version(artifacts) == "v1"


def test_promote_only_when_not_worse(tmp_path):
    artifacts, reports = tmp_path / "artifacts", tmp_path / "reports"
    _report(reports, "v1", 10.0)
    _report(reports, "v2", 10.5)
    _report(reports, "v3", 10.0)
    promote(artifacts, reports, "v1")
    assert promote(artifacts, reports, "v2")["promoted"] is False
    assert promote(artifacts, reports, "v3")["promoted"] is True
    assert live_version(artifacts) == "v3"
