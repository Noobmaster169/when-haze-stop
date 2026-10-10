import pandas as pd

from hazemodel.leaks import run_leak_tests, shifted_forward, shuffled_targets
from hazemodel.train import load_params

SMALL = {"num_leaves": 4, "min_data_in_leaf": 2, "num_boost_round": 20, "learning_rate": 0.1, "num_threads": 1}


def test_shift_moves_features_one_day_forward(frame):
    shifted = shifted_forward(frame)
    ids = frame.index.get_level_values("instrument_id")
    issue = frame.index.get_level_values("issue_at")
    first_day = issue.min()
    instrument = ids[issue == first_day][0]
    one = (ids == instrument) & (issue == first_day)
    next_day = (ids == instrument) & (issue == first_day + pd.Timedelta(days=1))
    sids = shifted.index.get_level_values("instrument_id")
    sissue = shifted.index.get_level_values("issue_at")
    row = shifted[(sids == instrument) & (sissue == first_day)]
    assert row["level"].iloc[0] == frame.loc[next_day, "level"].iloc[0]
    assert row["peak_d1"].iloc[0] == frame.loc[one, "peak_d1"].iloc[0]


def test_shuffle_keeps_the_multiset_of_targets(frame):
    shuffled = shuffled_targets(frame)
    assert sorted(shuffled["peak_d1"].dropna()) == sorted(frame["peak_d1"].dropna())


def test_leak_tests_run_and_report(frame):
    out = run_leak_tests(frame, {**load_params(), **SMALL}, freq="D", min_train_blocks=2)
    assert set(out) == {"shift", "shuffle"}
    for result in out.values():
        assert result["passed"] in (True, False)
