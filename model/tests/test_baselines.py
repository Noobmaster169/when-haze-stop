import numpy as np
import pandas as pd

from hazemodel.baselines import climatology, persistence, physics, physics_gain, v2_forecast


def test_persistence_is_the_last_days_peak(frame):
    out = persistence(frame)
    assert (out["p50_d1"] == frame["peak24"]).all()
    assert (out["p50_d2"] == frame["peak24"]).all()


def test_climatology_falls_back_to_kind(frame):
    # Split by time: the frame is sorted by instrument, so iloc halves would leave whole kinds out of train.
    issue = frame.index.get_level_values("issue_at")
    cut = pd.Timestamp("2026-10-07", tz="UTC")
    train, test = frame[issue < cut], frame[issue >= cut]
    out = climatology(train, test)
    assert out["p50_d1"].notna().all()
    assert len(out) == len(test)


def test_v2_rises_with_a_positive_slope(frame):
    frame = frame[frame["slope3h"].notna()]
    out = v2_forecast(frame)
    rising = frame["slope3h"] > 0
    assert (out.loc[rising, "p50_d1"] >= frame.loc[rising, "level"] - 1e-9).all()
    falling = frame["slope3h"] < 0
    assert (out.loc[falling, "p50_d1"] <= frame.loc[falling, "level"] + 1e-9).all()
    # The fade sums to 9 at most, so the forecast never moves more than 9 times the slope.
    assert ((out["p50_d2"] - frame["level"]).abs() <= 9.0 * frame["slope3h"].abs() + 1e-6).all()


def test_physics_is_nan_without_hindcasts(frame):
    gain = physics_gain(frame)
    out = physics(frame, gain)
    if (frame["has_physics"] == 0).all():
        assert gain is None
        assert out["p50_d1"].isna().all()
    else:
        assert np.isfinite(out.loc[frame["has_physics"] == 1, "p50_d1"]).all()
