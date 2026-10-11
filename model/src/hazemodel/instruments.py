"""One table of every instrument: DOE stations, Singapore regions, OpenAQ sensors and airports.

The id rule is shared with backend/src/jobs/instruments.ts: a station id as stored, openaq:<sensor_id>,
the airport ICAO. Both sides build the list from the same tables, so the hindcast rows join.
"""

import numpy as np
import pandas as pd

from hazemodel.store import SourceData

EARTH_KM = 6371.0


def instruments(data: SourceData) -> pd.DataFrame:
    stations = pd.DataFrame(
        {
            "instrument_id": data.stations["id"],
            "kind": data.stations["network"],
            "lat": data.stations["lat"],
            "lon": data.stations["lon"],
            "reference": True,
        }
    )
    sensors = pd.DataFrame(
        {
            "instrument_id": "openaq:" + data.sensors["sensor_id"].astype(str),
            "kind": "openaq",
            "lat": data.sensors["lat"],
            "lon": data.sensors["lon"],
            "reference": data.sensors["reference"].astype(bool),
        }
    )
    airports = pd.DataFrame(
        {
            "instrument_id": data.airports["icao"],
            "kind": "airport",
            "lat": data.airports["lat"],
            "lon": data.airports["lon"],
            "reference": False,
        }
    )
    table = pd.concat([stations, sensors, airports], ignore_index=True)
    return table.sort_values("instrument_id").reset_index(drop=True)


def distance_km(lat1, lon1, lat2, lon2):
    p1, p2 = np.radians(lat1), np.radians(lat2)
    dphi = p2 - p1
    dlam = np.radians(np.asarray(lon2) - np.asarray(lon1))
    a = np.sin(dphi / 2) ** 2 + np.cos(p1) * np.cos(p2) * np.sin(dlam / 2) ** 2
    return 2 * EARTH_KM * np.arcsin(np.sqrt(a))


def bearing_deg(lat1, lon1, lat2, lon2):
    p1, p2 = np.radians(lat1), np.radians(lat2)
    dlam = np.radians(np.asarray(lon2) - np.asarray(lon1))
    x = np.sin(dlam) * np.cos(p2)
    y = np.cos(p1) * np.sin(p2) - np.sin(p1) * np.cos(p2) * np.cos(dlam)
    return np.mod(np.degrees(np.arctan2(x, y)), 360.0)
