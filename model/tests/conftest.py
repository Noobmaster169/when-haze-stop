import pathlib

import pandas as pd
import pytest

from hazemodel.features.build import build_rows
from hazemodel.region import region_from_env
from hazemodel.store import SourceData, load_source_data_from_csv

FIXTURES = pathlib.Path(__file__).parent / "fixtures"


@pytest.fixture(scope="session")
def data() -> SourceData:
    return load_source_data_from_csv(FIXTURES)

FIXTURE_ISSUES = pd.date_range("2026-10-04", "2026-10-09", freq="D", tz="UTC")


@pytest.fixture(scope="session")
def frame(data) -> pd.DataFrame:
    rows, _ = build_rows(data, region_from_env(), FIXTURE_ISSUES, with_targets=True)
    return rows
