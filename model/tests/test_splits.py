import pandas as pd
import pytest

from hazemodel.splits import walk_forward


def test_walk_forward_by_day_keeps_time_order(frame):
    blocks = list(walk_forward(frame, freq="D", min_train_blocks=2))
    assert len(blocks) == 4
    for label, train, test in blocks:
        assert train.index.get_level_values("issue_at").max() < test.index.get_level_values("issue_at").min()
        assert label == test.index.get_level_values("issue_at")[0].strftime("%Y-%m-%d")


def test_walk_forward_refuses_a_test_block_before_training(frame, monkeypatch):
    # Labels are derived from issue_at, so real data cannot disagree with them; a labelling bug can.
    # Reverse the labels to stand in for one and check that the guard catches it.
    def reversed_labels(rows, freq):
        issue = rows.index.get_level_values("issue_at")
        return pd.Series(1_000_000 - issue.view("int64") // 86_400_000_000_000, index=rows.index).astype(str)

    monkeypatch.setattr("hazemodel.splits._period_labels", reversed_labels)
    with pytest.raises(ValueError):
        list(walk_forward(frame, freq="D"))
