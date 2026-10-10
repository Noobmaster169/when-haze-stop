import pathlib

import pytest

from hazemodel.store import SourceData, load_source_data_from_csv

FIXTURES = pathlib.Path(__file__).parent / "fixtures"


@pytest.fixture(scope="session")
def data() -> SourceData:
    return load_source_data_from_csv(FIXTURES)
