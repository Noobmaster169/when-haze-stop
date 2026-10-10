"""Group 3: the transport model's own view, from smoke_hindcasts, when the hindcast job has run."""

import pandas as pd

COLUMNS = ["smoke_now", "smoke_24h", "smoke_48h", "smoke_change", "has_physics"]


def physics_features(data, issue_times: pd.DatetimeIndex) -> pd.DataFrame:
    hindcasts = data.smoke_hindcasts
    if hindcasts.empty:
        empty = pd.MultiIndex.from_tuples([], names=["instrument_id", "issue_at"])
        return pd.DataFrame(columns=COLUMNS, index=empty)
    rows = hindcasts[hindcasts["as_of"].isin(issue_times)].copy()
    rows["smoke_change"] = rows["smoke_24h"] - rows["smoke_now"]
    rows["has_physics"] = 1
    rows = rows.rename(columns={"as_of": "issue_at"}).set_index(["instrument_id", "issue_at"])
    return rows[COLUMNS]
