"""The one 24 h series every feature and target reads: reference monitors, corrected sensors, airport proxies."""
import pandas as pd

from hazemodel.store import SourceData
from hazemodel.truth.reference import reference_series
from hazemodel.truth.sensors import correct_sensors
from hazemodel.truth.visibility import airport_series


def assemble_truth(data: SourceData, table: pd.DataFrame) -> tuple[pd.DataFrame, dict]:
    reference = reference_series(data)
    corrected, sensor_decisions = correct_sensors(reference, table)
    airports, airport_decisions = airport_series(data, reference, table)
    corrected["censored"] = False
    series = pd.concat([corrected, airports], ignore_index=True)
    series = series.sort_values(["instrument_id", "observed_at"]).reset_index(drop=True)
    return series, {"sensors": sensor_decisions, "airports": airport_decisions}
