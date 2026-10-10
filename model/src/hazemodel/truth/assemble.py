"""The one 24 h series every feature and target reads: reference monitors, corrected sensors, airport proxies."""

import pandas as pd

from hazemodel.store import SourceData
from hazemodel.truth.reference import reference_series
from hazemodel.truth.sensors import correct_sensors
from hazemodel.truth.visibility import airport_series


def assemble_truth(
    data: SourceData, table: pd.DataFrame, decisions: dict[str, pd.DataFrame] | None = None
) -> tuple[pd.DataFrame, dict]:
    """With `decisions` (keys "sensors" and "airports") the corrections are applied as frozen, not fitted."""
    frozen = decisions or {}
    reference = reference_series(data)
    corrected, sensor_decisions = correct_sensors(reference, table, frozen.get("sensors"))
    airports, airport_decisions = airport_series(data, reference, table, frozen.get("airports"))
    corrected["censored"] = False
    series = pd.concat([corrected, airports], ignore_index=True)
    series = series.sort_values(["instrument_id", "observed_at"]).reset_index(drop=True)
    return series, {"sensors": sensor_decisions, "airports": airport_decisions}
