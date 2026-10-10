"""Walk-forward blocks: train on everything up to a period, test on the next. Never a random split.

A random split leaks tomorrow into today through autocorrelation and makes every model look
brilliant. Time order is checked on every block.
"""
from collections.abc import Iterator

import pandas as pd


def _period_labels(frame: pd.DataFrame, freq: str) -> pd.Series:
    issue = frame.index.get_level_values("issue_at")
    return pd.Series(issue.tz_convert(None).to_period(freq).astype(str), index=frame.index)


def walk_forward(
    frame: pd.DataFrame, freq: str, min_train_blocks: int = 1, strict_order: bool = True
) -> Iterator[tuple[str, pd.DataFrame, pd.DataFrame]]:
    labels = _period_labels(frame, freq)
    periods = sorted(labels.unique())
    for position in range(min_train_blocks, len(periods)):
        test_label = periods[position]
        train = frame[labels.isin(periods[:position])]
        test = frame[labels == test_label]
        train_last = train.index.get_level_values("issue_at").max()
        test_first = test.index.get_level_values("issue_at").min()
        if strict_order and not train.empty and train_last >= test_first:
            raise ValueError(f"test block {test_label} is not after every training row")
        yield test.index.get_level_values("issue_at")[0].strftime("%Y-%m-%d" if freq == "D" else "%Y-%m"), train, test
