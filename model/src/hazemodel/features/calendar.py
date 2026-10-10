"""Group 5: where in the year the issue time falls. Trees cannot read a date."""
import numpy as np
import pandas as pd

SW_MONSOON_MONTHS = (5, 6, 7, 8, 9)


def calendar_features(issue_times: pd.DatetimeIndex) -> pd.DataFrame:
    doy = issue_times.dayofyear.to_numpy()
    angle = 2 * np.pi * doy / 365.25
    return pd.DataFrame(
        {
            "doy_sin": np.sin(angle),
            "doy_cos": np.cos(angle),
            "month": issue_times.month,
            "sw_monsoon": np.isin(issue_times.month, SW_MONSOON_MONTHS).astype(int),
        },
        index=pd.Index(issue_times, name="issue_at"),
    )
