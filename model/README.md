# model

The learned haze forecast. Reads the stored history from Postgres, builds truth and features,
trains and backtests (track D), and serves `/predict` to the jobs process. The method and its
results are in `docs/MODEL.md`; the design in `docs/specs/2026-10-10-predictive-model-design.md`.

    python3 -m venv .venv && .venv/bin/pip install -e ".[dev]"
    .venv/bin/pytest -q && .venv/bin/ruff check .
    PG_HOST=127.0.0.1 PG_PORT=5433 PG_DATABASE=postgres PG_USER=postgres PG_PASSWORD=postgres \
      .venv/bin/hazemodel features --from 2025-01-01 --to 2026-10-09   # writes model/data/features-*.parquet
    .venv/bin/hazemodel serve                                              # :4002

This package never writes to the database.
