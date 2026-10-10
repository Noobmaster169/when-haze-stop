"""The 24 hour mean PM2.5 series of every instrument that measures concentration, and its daily peaks.

DOE publishes the index of the 24 h mean, converted back through the DOE table. Singapore
publishes the 24 h mean itself. OpenAQ publishes hourly values, averaged here over a trailing 24
hours when at least 18 of them exist, because a mean of fewer hours is a different quantity.
"""
import pandas as pd

from hazemodel.index import api_to_pm25
from hazemodel.region import MALAYSIA_OFFSET
from hazemodel.store import SourceData

MIN_HOURS_IN_MEAN = 18
MIN_HOURS_IN_DAY = 12
NEA_IDS = {"central": "SGCENTRAL", "east": "SGEAST", "north": "SGNORTH", "south": "SGSOUTH", "west": "SGWEST"}


def _doe(readings: pd.DataFrame, stations: pd.DataFrame) -> pd.DataFrame:
    # Readings also hold the Singapore regions as PSI; nea_hours supplies those as the mean itself.
    doe_ids = set(stations.loc[stations["network"] == "doe", "id"])
    readings = readings[readings["station_id"].isin(doe_ids)]
    return pd.DataFrame(
        {
            "instrument_id": readings["station_id"],
            "observed_at": readings["observed_at"],
            "pm25_24h": api_to_pm25(readings["api"].to_numpy()),
        }
    )


def _nea(hours: pd.DataFrame) -> pd.DataFrame:
    rows = hours[hours["pm25_24h"].notna()]
    return pd.DataFrame(
        {
            "instrument_id": rows["region"].map(NEA_IDS),
            "observed_at": rows["observed_at"],
            "pm25_24h": rows["pm25_24h"].astype(float),
        }
    )


def _openaq(hours: pd.DataFrame) -> pd.DataFrame:
    out = []
    for sensor_id, group in hours.groupby("sensor_id"):
        hourly = group.set_index("observed_at")["pm25"].sort_index()
        hourly = hourly[~hourly.index.duplicated()].asfreq("h")
        rolling = hourly.rolling("24h", min_periods=MIN_HOURS_IN_MEAN).mean()
        # asfreq inserted the missing hours as NaN so the window counts real hours only.
        kept = rolling[hourly.notna() & rolling.notna()]
        out.append(
            pd.DataFrame(
                {"instrument_id": f"openaq:{sensor_id}", "observed_at": kept.index, "pm25_24h": kept.to_numpy()}
            )
        )
    if not out:
        return pd.DataFrame(columns=["instrument_id", "observed_at", "pm25_24h"])
    return pd.concat(out, ignore_index=True)


def reference_series(data: SourceData) -> pd.DataFrame:
    parts = [_doe(data.readings, data.stations), _nea(data.nea_hours), _openaq(data.openaq_hours)]
    series = pd.concat(parts, ignore_index=True)
    series = series.dropna(subset=["pm25_24h"])
    return series.sort_values(["instrument_id", "observed_at"]).reset_index(drop=True)


def daily_peaks(series: pd.DataFrame) -> pd.DataFrame:
    local = series.assign(day=(series["observed_at"] + MALAYSIA_OFFSET).dt.date)
    grouped = local.groupby(["instrument_id", "day"])["pm25_24h"]
    peaks = grouped.agg(peak="max", hours="count").reset_index()
    return peaks[peaks["hours"] >= MIN_HOURS_IN_DAY].drop(columns="hours").reset_index(drop=True)
