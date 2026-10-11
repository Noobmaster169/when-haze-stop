# Model track B: backend seam, tables and scoring, implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the backend everything it needs to ask a learned model service for a forecast each cycle, store it beside the physical forecast, score it live on the Simulation page, and switch the outlook to it by one config value, with the weather stored by fetch time so the score is honest.

**Architecture:** One migration adds three append-only tables. A `ModelClient` seam in `sources/` with a fake hides the HTTP service; a new jobs step calls it after the physical forecast and stores the rows through a repository. The pure `dayOutlooks` function gains an optional learned forecast per day; the outlook service passes it only in `live` mode. A new scoring service compares stored model forecasts with the readings that came in, beside persistence and the v2 forecast, and the Simulation contract and page show it with the shadow rule's state.

**Tech Stack:** TypeScript strict, Express, pg, zod 4, pino, vitest against the compose Postgres (`haze_test`); Next 16 and zod on the frontend.

**Spec:** `docs/specs/2026-10-10-predictive-model-design.md`, sections 8.2, 8.3, 8.5, 9 and acceptance 3 and 4. Tracks A (the `model/` package), C (the hindcast job) and D (training) are separate plans; this plan creates the tables they share and the repository C writes through.

## Global Constraints

- TypeScript strict. No `any`. `unknown` at boundaries, narrowed with zod. Named exports only.
- Every file under 200 lines. Split before crossing it.
- Files kebab-case. Database columns snake_case, mapped to camelCase in the repository and nowhere else.
- `repositories/` owns all SQL. `config.ts` is the only reader of `process.env`.
- Errors: a dependency that answered with a failure is one `UpstreamError`; never `catch {}`; never swallow.
- Comments say why, never what. No banner comments. No emoji, no em dashes anywhere, including commit messages and UI text.
- Logging: pino through `childLogger({ module })`, one per module.
- Never delete, truncate or overwrite anything in any database. Migrations are forward-only SQL in `backend/db/migrations/NNN_name.sql`; never edit an applied one.
- No test may reach the network or the model service. Tests add to `haze_test` and must pass when rerun on a database that already holds their rows.
- Real data only in fixtures. The one exception in this plan, the service's contract example, is labelled as such in its file because the service did not exist when it was written.
- Contracts in `backend/src/contracts*.ts` and their zod mirrors in `frontend/lib/api/*-schemas.ts` change in the same commit.
- Frontend: Next 16. Read `frontend/AGENTS.md` and `frontend/node_modules/next/dist/docs/` before writing Next code.
- Run backend commands inside `backend/`, frontend commands inside `frontend/`. Postgres must be up: `docker compose up -d postgres` from the root.
- Commit messages: imperative, one line, then a blank line, then exactly `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`.

## Review Focus

1. The service answers quantiles that cross (p90 below p50). Expected: the stored band is sorted so the outlook's low never exceeds its high. Pinned in Task 4 (`parsePrediction` sorts).
2. The service names an instrument the database does not know. Expected: the row is dropped and counted in the fetch detail, the rest are stored, nothing throws. Pinned in Task 5.
3. The service answers 503 because no artifact is promoted. Expected: `predict` throws `UpstreamError` with status 503, the cycle logs "a step of the cycle failed" and still raises alerts. Pinned in Task 4 (client) and Task 5 (cycle continues).
4. `MODEL_MODE=live` but the newest stored forecast for a station is older than the run by more than a day, or absent. Expected: that station's outlook falls back to the hourly v2 forecast, silently. Pinned in Task 7.
5. A fetch whose grid holds no hour after the fetch time, or the same fetch stored twice. Expected: zero forecast rows, no error, no duplicate. Pinned in Task 1.

---

### Task 1: Migration 008 and the weather stored by fetch time

**Files:**
- Create: `backend/db/migrations/008_model.sql`
- Create: `backend/src/repositories/weather-forecasts.repo.ts`
- Modify: `backend/src/repositories/index.ts`
- Modify: `backend/src/jobs/ingest.ts` (`ingestWeather`)
- Modify: `backend/src/jobs/cycle.ts:39`
- Test: `backend/test/jobs/weather-forecasts.test.ts`

**Interfaces:**
- Consumes: `WeatherGrid` from `haze/transport.ts` (`start: Date; hours: number; u, v, rain: Float32Array` of `hours * WEATHER_POINTS`), `addHours` and `WEATHER_POINTS` from `haze/grid.ts`, `FakeWeatherClient` and `steadyWind` from the tests.
- Produces: tables `weather_forecasts`, `smoke_hindcasts`, `model_forecasts` (plan C creates the identical migration file if it is absent in its worktree; the text must match byte for byte). `weatherForecasts.insertForecastHours(db, grid, fetchedAt): Promise<number>` and `weatherForecasts.fetchesFor(db, validAt)`. `ingestWeather(deps, now = new Date())`.

- [ ] **Step 1: Write the migration**

Create `backend/db/migrations/008_model.sql` with exactly this content:

```sql
-- Weather as it was forecast at each fetch, so the model's skill can be scored
-- on the wind it really had. weather_hours keeps only the newest analysis.
create table weather_forecasts (
  fetched_at timestamptz not null,
  valid_at   timestamptz not null,
  u_ms       real[] not null,
  v_ms       real[] not null,
  rain_mm    real[] not null,
  primary key (fetched_at, valid_at)
);
create index on weather_forecasts (valid_at);

-- The transport model's smoke near an instrument, run with fires and wind as
-- known at as_of. Filled by pnpm haze:hindcast; read by the model package.
create table smoke_hindcasts (
  as_of         timestamptz not null,
  instrument_id text not null,
  smoke_now     real not null,
  smoke_24h     real not null,
  smoke_48h     real not null,
  model         text not null,
  primary key (as_of, instrument_id, model)
);

-- A learned forecast of an instrument's peak 24 h PM2.5 (ug/m3) for a
-- Malaysian day, with its 0.1 and 0.9 quantiles. Append-only.
create table model_forecasts (
  as_of         timestamptz not null,
  instrument_id text not null,
  day           date not null,
  p10           real not null,
  p50           real not null,
  p90           real not null,
  model_version text not null,
  made_at       timestamptz not null default now(),
  primary key (as_of, instrument_id, day, model_version)
);
create index on model_forecasts (made_at desc);
```

- [ ] **Step 2: Write the failing test**

Create `backend/test/jobs/weather-forecasts.test.ts`:

```ts
import { afterAll, describe, expect, it } from "vitest";

import { closePool, getPool } from "../../src/db";
import { ingestWeather } from "../../src/jobs/ingest";
import { weatherForecasts } from "../../src/repositories";
import { FakeDoeClient, FakeFiresClient, FakeMetarClient, FakeNeaClient, FakeWeatherClient } from "../../src/sources/__fakes__/fake.sources";
import { steadyWind } from "../fixtures/steady-wind";

afterAll(closePool);

/** Two days of uniform wind, fetched a quarter past six on the second day: the hours still ahead are 07:00 to 23:00, seventeen of them. */
const START = new Date("2026-10-06T00:00:00Z");
const FETCHED_AT = new Date("2026-10-07T06:15:00Z");
const AHEAD = new Date("2026-10-07T07:00:00Z");
const BEHIND = new Date("2026-10-07T06:00:00Z");

describe("weather kept as it was forecast", () => {
  const pool = getPool();
  const grid = steadyWind(START, 48, 3, 3);

  it("stores the hours after the fetch and none before, once", async () => {
    // A rerun of this file finds the rows already there, so only the second call's answer is fixed.
    expect(await weatherForecasts.insertForecastHours(pool, grid, FETCHED_AT)).toBeLessThanOrEqual(17);
    expect(await weatherForecasts.insertForecastHours(pool, grid, FETCHED_AT)).toBe(0);
    const ahead = await weatherForecasts.fetchesFor(pool, AHEAD);
    expect(ahead.filter((fetch) => fetch.fetchedAt.getTime() === FETCHED_AT.getTime())).toHaveLength(1);
    expect(ahead[0].u).toHaveLength(375);
    expect(await weatherForecasts.fetchesFor(pool, BEHIND)).toEqual([]);
  });

  it("stores nothing for a fetch made after its last hour", async () => {
    expect(await weatherForecasts.insertForecastHours(pool, grid, new Date("2026-10-09T00:00:00Z"))).toBe(0);
  });

  it("is written by the weather ingest beside the analysis", async () => {
    const later = new Date("2026-10-07T08:15:00Z");
    const deps = { pool, doe: new FakeDoeClient([], []), fires: new FakeFiresClient([]), weather: new FakeWeatherClient(grid), metar: new FakeMetarClient([]), nea: new FakeNeaClient([]) };
    expect(await ingestWeather(deps, later)).toBe(48);
    const nine = await weatherForecasts.fetchesFor(pool, new Date("2026-10-07T09:00:00Z"));
    expect(nine.some((fetch) => fetch.fetchedAt.getTime() === later.getTime())).toBe(true);
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `cd backend && pnpm test -- test/jobs/weather-forecasts.test.ts`
Expected: FAIL, `weatherForecasts` is not exported from `../../src/repositories`.

- [ ] **Step 4: Write the repository**

Create `backend/src/repositories/weather-forecasts.repo.ts`:

```ts
import type { Queryable } from "../db";
import { addHours, WEATHER_POINTS } from "../haze/grid";
import type { WeatherGrid } from "../haze/transport";

/**
 * The weather as it was forecast at each fetch. weather_hours keeps only the
 * newest value of an hour, which for a past hour is the analysis, so a replay
 * that reads it knows the real wind. This table keeps what the forecast said
 * before the hour came, so a forecast can be scored on what it really had.
 */

interface FetchRow {
  fetched_at: Date;
  u_ms: number[];
  v_ms: number[];
  rain_mm: number[];
}

export interface StoredFetch {
  fetchedAt: Date;
  u: number[];
  v: number[];
  rain: number[];
}

/** Stores the hours of `grid` after `fetchedAt`, the forecast part. Returns how many were new. */
export async function insertForecastHours(db: Queryable, grid: WeatherGrid, fetchedAt: Date): Promise<number> {
  let added = 0;
  for (let hour = 0; hour < grid.hours; hour++) {
    const validAt = addHours(grid.start, hour);
    if (validAt <= fetchedAt) continue;
    const slice = (field: Float32Array): number[] => Array.from(field.subarray(hour * WEATHER_POINTS, (hour + 1) * WEATHER_POINTS));
    const { rowCount } = await db.query(
      "insert into weather_forecasts (fetched_at, valid_at, u_ms, v_ms, rain_mm) values ($1, $2, $3, $4, $5) on conflict do nothing",
      [fetchedAt, validAt, slice(grid.u), slice(grid.v), slice(grid.rain)],
    );
    added += rowCount ?? 0;
  }
  return added;
}

/** Every fetch that forecast an hour, newest first: how the forecast for it changed as the hour came nearer. */
export async function fetchesFor(db: Queryable, validAt: Date): Promise<StoredFetch[]> {
  const { rows } = await db.query<FetchRow>("select fetched_at, u_ms, v_ms, rain_mm from weather_forecasts where valid_at = $1 order by fetched_at desc", [validAt]);
  return rows.map((row) => ({ fetchedAt: row.fetched_at, u: row.u_ms, v: row.v_ms, rain: row.rain_mm }));
}
```

In `backend/src/repositories/index.ts` add, keeping the list alphabetical:

```ts
export * as weatherForecasts from "./weather-forecasts.repo";
```

- [ ] **Step 5: Write the forecast hours in the weather ingest**

In `backend/src/jobs/ingest.ts`, change the import line to include the new repository:

```ts
import { fires, fixedSources, readings, stations, weather, weatherForecasts } from "../repositories";
```

Replace `ingestWeather` with:

```ts
export async function ingestWeather(deps: IngestDeps, now: Date = new Date()): Promise<number> {
  const detail = await recordFetch(deps.pool, "open-meteo", async () => {
    const grid = await deps.weather.grid(WEATHER_PAST_DAYS, WEATHER_FORECAST_DAYS);
    await weather.upsertGrid(deps.pool, grid);
    // The hours still ahead are kept under this fetch, so a later score knows what the forecast said before the hour came.
    const forecastHours = await weatherForecasts.insertForecastHours(deps.pool, grid, now);
    return {
      points: WEATHER_POINTS,
      hours: grid.hours,
      forecastHours,
      from: grid.start.toISOString(),
      to: addHours(grid.start, grid.hours - 1).toISOString(),
    };
  });
  log.info(detail, "weather stored");
  return detail.hours;
}
```

In `backend/src/jobs/cycle.ts` change the weather step to pass the cycle's time:

```ts
  await attempt("weather", () => ingestWeather(deps, now));
```

- [ ] **Step 6: Run the test and the type check**

Run: `cd backend && pnpm test -- test/jobs/weather-forecasts.test.ts && pnpm type-check`
Expected: 3 tests pass, type check clean. The global setup applies migration 008 to `haze_test` on the first run.

- [ ] **Step 7: Commit**

```bash
git add backend/db/migrations/008_model.sql backend/src/repositories/weather-forecasts.repo.ts backend/src/repositories/index.ts backend/src/jobs/ingest.ts backend/src/jobs/cycle.ts backend/test/jobs/weather-forecasts.test.ts
git commit -m "Store the weather as forecast at each fetch, and add the model tables

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 2: The smoke hindcast repository

**Shared with plan C.** Plan C creates the same file with identical content. If `backend/src/repositories/smoke-hindcasts.repo.ts` already exists in your worktree, do nothing in this task beyond running its test. At merge, plan C's version of this file wins. The file holds only the two functions below; add nothing else to it. A read of `smoke_hindcasts` that plan B needs goes in another file, and this plan needs none.

**Files:**
- Create: `backend/src/repositories/smoke-hindcasts.repo.ts`
- Modify: `backend/src/repositories/index.ts`
- Test: `backend/test/repositories/smoke-hindcasts.test.ts`

**Interfaces:**
- Consumes: table `smoke_hindcasts` from Task 1.
- Produces: `SmokeHindcast { asOf: Date; instrumentId: string; smokeNow: number; smoke24h: number; smoke48h: number; model: string }`, `smokeHindcasts.insertMany(pool, rows: SmokeHindcast[]): Promise<number>`, `smokeHindcasts.storedDays(pool, model): Promise<Set<string>>` keyed by `asOf.toISOString()`. Plan C's job writes through `insertMany` and skips with `storedDays`.

- [ ] **Step 1: Write the failing test**

Create `backend/test/repositories/smoke-hindcasts.test.ts`:

```ts
import { afterAll, describe, expect, it } from "vitest";

import { closePool, getPool } from "../../src/db";
import { smokeHindcasts } from "../../src/repositories";

afterAll(closePool);

/** Two issue days for one instrument under a method name no job uses, so a rerun of this file meets only its own rows. */
const MODEL = "test-hindcast";
const DAY_ONE = new Date("2026-10-08T00:00:00Z");
const DAY_TWO = new Date("2026-10-09T00:00:00Z");
const ROWS = [
  { asOf: DAY_ONE, instrumentId: "CA24N", smokeNow: 12.5, smoke24h: 20.25, smoke48h: 8, model: MODEL },
  { asOf: DAY_TWO, instrumentId: "CA24N", smokeNow: 20.25, smoke24h: 8, smoke48h: 4, model: MODEL },
];

describe("the smoke hindcast repository", () => {
  const pool = getPool();

  it("adds rows once and says which issue times a method already has", async () => {
    expect(await smokeHindcasts.insertMany(pool, ROWS)).toBeLessThanOrEqual(2);
    expect(await smokeHindcasts.insertMany(pool, ROWS)).toBe(0);
    expect(await smokeHindcasts.insertMany(pool, [])).toBe(0);
    const stored = await smokeHindcasts.storedDays(pool, MODEL);
    expect(stored.has(DAY_ONE.toISOString())).toBe(true);
    expect(stored.has(DAY_TWO.toISOString())).toBe(true);
    expect((await smokeHindcasts.storedDays(pool, "no-such-method")).size).toBe(0);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd backend && pnpm test -- test/repositories/smoke-hindcasts.test.ts`
Expected: FAIL, `smokeHindcasts` is not exported. (If plan C is already merged, it passes: skip to Step 5 and commit only the test if it is new.)

- [ ] **Step 3: Write the repository**

Create `backend/src/repositories/smoke-hindcasts.repo.ts`:

```ts
import type { Queryable } from "../db";

/**
 * The transport model's smoke near an instrument, run with the fires and wind
 * known at an issue time. `pnpm haze:hindcast` writes it over the stored
 * history; the model package reads it as a feature. Append-only: a method
 * change is a new `model` name, never a rewrite.
 */

export interface SmokeHindcast {
  asOf: Date;
  instrumentId: string;
  smokeNow: number;
  smoke24h: number;
  smoke48h: number;
  model: string;
}

/** Returns how many were new. A row already stored is left as it was. */
export async function insertMany(pool: Queryable, rows: SmokeHindcast[]): Promise<number> {
  if (rows.length === 0) return 0;
  const { rowCount } = await pool.query(
    `insert into smoke_hindcasts (as_of, instrument_id, smoke_now, smoke_24h, smoke_48h, model)
     select * from unnest($1::timestamptz[], $2::text[], $3::real[], $4::real[], $5::real[], $6::text[])
     on conflict do nothing`,
    [rows.map((row) => row.asOf), rows.map((row) => row.instrumentId), rows.map((row) => row.smokeNow), rows.map((row) => row.smoke24h), rows.map((row) => row.smoke48h), rows.map((row) => row.model)],
  );
  return rowCount ?? 0;
}

/** The issue times a method already has, as ISO strings, so a rerun of the job skips them. */
export async function storedDays(pool: Queryable, model: string): Promise<Set<string>> {
  const { rows } = await pool.query<{ as_of: Date }>("select distinct as_of from smoke_hindcasts where model = $1", [model]);
  return new Set(rows.map((row) => row.as_of.toISOString()));
}
```

In `backend/src/repositories/index.ts` add, alphabetically:

```ts
export * as smokeHindcasts from "./smoke-hindcasts.repo";
```

- [ ] **Step 4: Run the test and the type check**

Run: `cd backend && pnpm test -- test/repositories/smoke-hindcasts.test.ts && pnpm type-check`
Expected: 1 test passes, clean.

- [ ] **Step 5: Commit**

```bash
git add backend/src/repositories/smoke-hindcasts.repo.ts backend/src/repositories/index.ts backend/test/repositories/smoke-hindcasts.test.ts
git commit -m "Add the repository the hindcast job writes through

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 3: The model forecasts repository

**Files:**
- Create: `backend/src/repositories/model-forecasts.repo.ts`
- Modify: `backend/src/repositories/index.ts`
- Test: `backend/test/repositories/model-forecasts.test.ts`

**Interfaces:**
- Consumes: table `model_forecasts` from Task 1; `readings` and `stations` rows that `recordedCycle()` stores (Seremban `CA24N` reads up to 189 on 10 October 2026, last hour `LAST_HOUR` = 2026-10-10T03:00Z); `forecast_runs` and `station_forecasts` the cycle's run writes; `MODEL_VERSION` from `haze/run.ts`.
- Produces: `ModelForecastRow { asOf: Date; instrumentId: string; day: string; p10: number; p50: number; p90: number; modelVersion: string }`; `ModelDay { p10: number; p50: number; p90: number }`; `InstrumentForecast { asOf: Date; modelVersion: string; days: Map<string, ModelDay> }`; `modelForecasts.insertMany(db, rows): Promise<number>`; `modelForecasts.latestFor(db, instrumentId): Promise<InstrumentForecast | null>`; `modelForecasts.newestVersion(db): Promise<{ modelVersion: string; since: Date } | null>`; `ScoreRow` and `modelForecasts.scorable(db, runModel: string): Promise<ScoreRow[]>`.

- [ ] **Step 1: Write the failing test**

Create `backend/test/repositories/model-forecasts.test.ts`:

```ts
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { closePool, getPool } from "../../src/db";
import { MODEL_VERSION } from "../../src/haze/run";
import { modelForecasts, readings } from "../../src/repositories";
import { recordedCycle } from "../fixtures/cycle";
import { LAST_HOUR } from "../fixtures/recorded";

afterAll(closePool);

/** A forecast made at the recorded week's last hour for Seremban, under a version only this file writes. */
const VERSION = "test-repo";
const band = (day: string, p10: number, p50: number, p90: number) => ({ asOf: LAST_HOUR, instrumentId: "CA24N", day, p10, p50, p90, modelVersion: VERSION });
const ROWS = [band("2026-10-11", 40, 52, 80), band("2026-10-12", 30, 45, 70), band("2026-10-13", 20, 30, 50)];

describe("the model forecasts repository", () => {
  const pool = getPool();

  beforeAll(async () => {
    await recordedCycle();
  }, 120_000);

  it("adds rows once and reads an instrument's newest forecast by day", async () => {
    expect(await modelForecasts.insertMany(pool, ROWS)).toBeLessThanOrEqual(3);
    expect(await modelForecasts.insertMany(pool, ROWS)).toBe(0);
    const stored = await modelForecasts.latestFor(pool, "CA24N");
    expect(stored?.asOf.toISOString()).toBe(LAST_HOUR.toISOString());
    expect([...(stored?.days.keys() ?? [])]).toEqual(["2026-10-11", "2026-10-12", "2026-10-13"]);
    expect(stored?.days.get("2026-10-11")).toEqual({ p10: 40, p50: 52, p90: 80 });
    expect(await modelForecasts.latestFor(pool, "NOPE")).toBeNull();
    expect(await modelForecasts.newestVersion(pool)).not.toBeNull();
  });

  it("offers a forecast for scoring only once its day's readings are all in", async () => {
    // The recorded readings end at 11:00 on 10 October, Malaysian time, so neither the 10th nor any later day is scoreable yet.
    const rows = (await modelForecasts.scorable(pool, MODEL_VERSION)).filter((row) => row.modelVersion === VERSION && row.day >= "2026-10-10");
    expect(rows).toEqual([]);
  });

  it("scores a day that has passed against its readings and the hourly run", async () => {
    // The recorded week runs from 00:00 on 9 October to 11:00 on the 10th, Malaysian time, so the 9th is the one whole day in it.
    // A forecast for it made on the 8th is one day ahead; nothing was read before that hour, so "no change" has no value there.
    const madeAt = new Date("2026-10-08T03:00:00Z");
    await modelForecasts.insertMany(pool, [{ ...band("2026-10-09", 60, 90, 120), asOf: madeAt }]);
    const ninth = await readings.forStation(pool, "CA24N", new Date("2026-10-08T16:00:00Z"), new Date("2026-10-09T15:00:00Z"));
    const peak = Math.max(...ninth.map((reading) => reading.api));
    const [row] = (await modelForecasts.scorable(pool, MODEL_VERSION)).filter((item) => item.modelVersion === VERSION && item.day === "2026-10-09");
    expect(row).toMatchObject({ instrumentId: "CA24N", network: "doe", leadDays: 1, p50: 90, observed: peak, persistence: null });
    expect(peak).toBeGreaterThan(100);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd backend && pnpm test -- test/repositories/model-forecasts.test.ts`
Expected: FAIL, `modelForecasts` is not exported.

- [ ] **Step 3: Write the repository**

Create `backend/src/repositories/model-forecasts.repo.ts`:

```ts
import type { Network } from "../contracts";
import type { Queryable } from "../db";

/**
 * The learned model's forecasts: one row per instrument, Malaysian day and
 * issue time, with the band it gave. Append-only, so every version's record
 * stays and the Simulation page can score each as its days come in.
 */

export interface ModelDay {
  p10: number;
  p50: number;
  p90: number;
}

export interface ModelForecastRow extends ModelDay {
  asOf: Date;
  instrumentId: string;
  /** A Malaysian calendar day, `YYYY-MM-DD`. */
  day: string;
  modelVersion: string;
}

export interface InstrumentForecast {
  asOf: Date;
  modelVersion: string;
  days: Map<string, ModelDay>;
}

/** Returns how many were new. A row already stored is left as it was. */
export async function insertMany(db: Queryable, rows: ModelForecastRow[]): Promise<number> {
  if (rows.length === 0) return 0;
  const { rowCount } = await db.query(
    `insert into model_forecasts (as_of, instrument_id, day, p10, p50, p90, model_version)
     select * from unnest($1::timestamptz[], $2::text[], $3::date[], $4::real[], $5::real[], $6::real[], $7::text[])
     on conflict do nothing`,
    [rows.map((row) => row.asOf), rows.map((row) => row.instrumentId), rows.map((row) => row.day), rows.map((row) => row.p10), rows.map((row) => row.p50), rows.map((row) => row.p90), rows.map((row) => row.modelVersion)],
  );
  return rowCount ?? 0;
}

interface LatestRow {
  as_of: Date;
  model_version: string;
  day: string;
  p10: number;
  p50: number;
  p90: number;
}

/** The instrument's newest forecast: the rows of its newest issue time, from the version stored most recently. */
export async function latestFor(db: Queryable, instrumentId: string): Promise<InstrumentForecast | null> {
  const { rows } = await db.query<LatestRow>(
    `with newest as (
       select as_of, model_version from model_forecasts where instrument_id = $1 order by as_of desc, made_at desc limit 1
     )
     select m.as_of, m.model_version, to_char(m.day, 'YYYY-MM-DD') as day, m.p10, m.p50, m.p90
       from model_forecasts m join newest n on n.as_of = m.as_of and n.model_version = m.model_version
      where m.instrument_id = $1 order by m.day`,
    [instrumentId],
  );
  if (rows.length === 0) return null;
  return { asOf: rows[0].as_of, modelVersion: rows[0].model_version, days: new Map(rows.map((row) => [row.day, { p10: row.p10, p50: row.p50, p90: row.p90 }])) };
}

/** The version stored most recently and when its first forecast was made, or null before any. */
export async function newestVersion(db: Queryable): Promise<{ modelVersion: string; since: Date } | null> {
  const { rows } = await db.query<{ model_version: string; since: Date }>(
    `select model_version, min(made_at) as since from model_forecasts
      where model_version = (select model_version from model_forecasts order by made_at desc limit 1)
      group by model_version`,
  );
  return rows[0] ? { modelVersion: rows[0].model_version, since: rows[0].since } : null;
}

export interface ScoreRow {
  asOf: Date;
  instrumentId: string;
  network: Network;
  day: string;
  /** 1 for the day after the issue time's Malaysian day, 2 for the day after that. */
  leadDays: number;
  p50: number;
  modelVersion: string;
  /** The day's peak reading, null where the station posted nothing that day. */
  observed: number | null;
  /** The newest reading at the issue time, carried forward: "no change". */
  persistence: number | null;
  /** The peak of the hourly run made at the same issue time over that day, null where there was no run. */
  v2: number | null;
}

interface ScoreRowRaw {
  as_of: Date;
  instrument_id: string;
  network: Network;
  day: string;
  lead_days: number;
  p50: number;
  model_version: string;
  observed: number | null;
  persistence: number | null;
  v2: number | null;
}

/**
 * Every stored forecast for a station whose day has passed, at one and two
 * days ahead, with what happened. A day has passed once the newest reading
 * anywhere is on a later Malaysian day. `runModel` names the hourly run's
 * method to compare with.
 */
export async function scorable(db: Queryable, runModel: string): Promise<ScoreRow[]> {
  const { rows } = await db.query<ScoreRowRaw>(
    `with newest as (select max(observed_at) as at from readings),
     f as (
       select m.as_of, m.instrument_id, m.day, m.p50, m.model_version, s.network,
              m.day - ((m.as_of at time zone 'UTC') + interval '8 hours')::date as lead_days
         from model_forecasts m
         join stations s on s.id = m.instrument_id
         cross join newest n
        where m.day < ((n.at at time zone 'UTC') + interval '8 hours')::date
     )
     select f.as_of, f.instrument_id, f.network, to_char(f.day, 'YYYY-MM-DD') as day, f.lead_days, f.p50, f.model_version,
            (select max(r.api) from readings r
              where r.station_id = f.instrument_id and ((r.observed_at at time zone 'UTC') + interval '8 hours')::date = f.day) as observed,
            (select r.api from readings r
              where r.station_id = f.instrument_id and r.observed_at <= f.as_of order by r.observed_at desc limit 1) as persistence,
            (select max(x.api) from forecast_runs fr
               join station_forecasts sf on sf.run_id = fr.id
               cross join lateral unnest(sf.api) with ordinality as x(api, h)
              where fr.as_of = f.as_of and fr.kind = 'live' and fr.model = $1 and sf.station_id = f.instrument_id
                and ((fr.as_of at time zone 'UTC') + make_interval(hours => x.h::int) + interval '8 hours')::date = f.day) as v2
       from f
      where f.lead_days between 1 and 2
      order by f.as_of, f.instrument_id, f.day`,
    [runModel],
  );
  return rows.map((row) => ({
    asOf: row.as_of,
    instrumentId: row.instrument_id,
    network: row.network,
    day: row.day,
    leadDays: Number(row.lead_days),
    p50: row.p50,
    modelVersion: row.model_version,
    observed: row.observed,
    persistence: row.persistence,
    v2: row.v2,
  }));
}
```

In `backend/src/repositories/index.ts` add, alphabetically:

```ts
export * as modelForecasts from "./model-forecasts.repo";
```

- [ ] **Step 4: Run the test and the type check**

Run: `cd backend && pnpm test -- test/repositories/model-forecasts.test.ts && pnpm type-check`
Expected: 3 tests pass, clean. If the third test's `row` is undefined, check that `lead_days` came back as a number, not a string; `Number()` in the mapper guards the integer type pg returns for a date difference.

- [ ] **Step 5: Commit**

```bash
git add backend/src/repositories/model-forecasts.repo.ts backend/src/repositories/index.ts backend/test/repositories/model-forecasts.test.ts
git commit -m "Store and score the learned model's forecasts

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 4: The model client seam and its fake

**Files:**
- Modify: `backend/src/sources/http.ts` (add `postJson`)
- Create: `backend/src/sources/model.ts`
- Create: `backend/src/sources/__fakes__/fake.model.ts`
- Create: `backend/test/fixtures/model-contract.ts`
- Modify: `backend/src/sources/index.ts`
- Test: `backend/test/sources/model.test.ts`

**Interfaces:**
- Consumes: `fetchText`, `RetryableError`, `UpstreamError`, `TerminalError` as the other clients do.
- Produces: `ModelForecast { instrumentId: string; day: string; p10: number; p50: number; p90: number; modelVersion: string }`, `ModelHealth { modelVersion: string | null; trainedAt: Date | null }`, `ModelClient { health(): Promise<ModelHealth>; predict(asOf: Date): Promise<ModelForecast[]> }`, `modelClient(baseUrl)`, `parsePrediction(text)`, `parseHealth(text)`, `FakeModelClient`, and the fixture `CONTRACT_FORECASTS`, `PREDICT_JSON`, `HEALTH_JSON`.

The service's wire contract, from the spec and plan A: `GET /health` answers `{"status":"ok","modelVersion":<string|null>,"trainedAt":<iso|null>}`; `POST /predict` with `{"asOf":<iso>}` answers `{"modelVersion":<string>,"asOf":<iso>,"forecasts":[{"instrumentId","day","p10","p50","p90"}...]}` in ug/m3 for Malaysian days +1, +2, +3, or 503 `{"error":"no live model"}` when nothing is promoted.

- [ ] **Step 1: Write the fixture**

Create `backend/test/fixtures/model-contract.ts`:

```ts
import type { ModelForecast } from "../../src/sources/model";

/**
 * The model service's answer as its contract defines it, not a recorded one:
 * the service (model/) did not exist when this seam was written, so nothing
 * could be recorded. The ids are the recorded week's stations, the days the
 * three after its last hour (10 October 2026, 11:00 Malaysian time). Replace
 * this file with a recorded answer once the service runs; the shape must not
 * change, the numbers may.
 */

export const CONTRACT_VERSION = "2026-10-11-contract";

const forecast = (instrumentId: string, day: string, p10: number, p50: number, p90: number): ModelForecast => ({ instrumentId, day, p10, p50, p90, modelVersion: CONTRACT_VERSION });

/** Nine rows for three known instruments, plus one for a sensor the database does not hold. */
export const CONTRACT_FORECASTS: ModelForecast[] = [
  forecast("CA24N", "2026-10-11", 40, 52, 80),
  forecast("CA24N", "2026-10-12", 30, 45, 70),
  forecast("CA24N", "2026-10-13", 20, 30, 50),
  forecast("CA19B", "2026-10-11", 35, 48, 72),
  forecast("CA19B", "2026-10-12", 28, 40, 64),
  forecast("CA19B", "2026-10-13", 18, 28, 46),
  forecast("SGCENTRAL", "2026-10-11", 30, 44, 66),
  forecast("SGCENTRAL", "2026-10-12", 24, 36, 58),
  forecast("SGCENTRAL", "2026-10-13", 15, 24, 40),
  forecast("openaq:999999", "2026-10-11", 10, 15, 20),
];

/** The same answer as the service would write it, with one band deliberately out of order. */
export const PREDICT_JSON = JSON.stringify({
  modelVersion: CONTRACT_VERSION,
  asOf: "2026-10-10T03:00:00Z",
  forecasts: [
    { instrumentId: "CA24N", day: "2026-10-11", p10: 40, p50: 52, p90: 80 },
    { instrumentId: "CA24N", day: "2026-10-12", p10: 45, p50: 30, p90: 70 },
  ],
});

export const HEALTH_JSON = JSON.stringify({ status: "ok", modelVersion: CONTRACT_VERSION, trainedAt: "2026-10-11T02:00:00Z" });
export const HEALTH_EMPTY_JSON = JSON.stringify({ status: "ok", modelVersion: null, trainedAt: null });
```

- [ ] **Step 2: Write the failing test**

Create `backend/test/sources/model.test.ts`:

```ts
import { afterEach, describe, expect, it, vi } from "vitest";

import { TerminalError, UpstreamError } from "../../src/lib/errors";
import { FakeModelClient } from "../../src/sources/__fakes__/fake.model";
import { modelClient, parseHealth, parsePrediction } from "../../src/sources/model";
import { CONTRACT_FORECASTS, CONTRACT_VERSION, HEALTH_EMPTY_JSON, HEALTH_JSON, PREDICT_JSON } from "../fixtures/model-contract";

afterEach(() => {
  vi.unstubAllGlobals();
});

/** Stands in for the service without a socket: the client's one fetch is answered as given. */
function answering(status: number, body: string): { calls: { url: string; method: string; body: string | null }[] } {
  const calls: { url: string; method: string; body: string | null }[] = [];
  vi.stubGlobal("fetch", async (url: string, init?: RequestInit) => {
    calls.push({ url, method: init?.method ?? "GET", body: typeof init?.body === "string" ? init.body : null });
    return new Response(body, { status, headers: { "content-type": "application/json" } });
  });
  return { calls };
}

describe("the model service client", () => {
  it("reads a prediction and sorts a band the service wrote out of order", () => {
    const rows = parsePrediction(PREDICT_JSON);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toEqual({ instrumentId: "CA24N", day: "2026-10-11", p10: 40, p50: 52, p90: 80, modelVersion: CONTRACT_VERSION });
    expect(rows[1]).toMatchObject({ p10: 30, p50: 45, p90: 70 });
  });

  it("refuses a shape it does not know, and text that is not JSON", () => {
    expect(() => parsePrediction(JSON.stringify({ forecasts: [] }))).toThrow(TerminalError);
    expect(() => parsePrediction("<html>")).toThrow(TerminalError);
    expect(() => parseHealth(JSON.stringify({ status: "down" }))).toThrow(TerminalError);
  });

  it("reads health with and without a live model", () => {
    expect(parseHealth(HEALTH_JSON)).toEqual({ modelVersion: CONTRACT_VERSION, trainedAt: new Date("2026-10-11T02:00:00Z") });
    expect(parseHealth(HEALTH_EMPTY_JSON)).toEqual({ modelVersion: null, trainedAt: null });
  });

  it("posts the hour asked for and parses the answer", async () => {
    const { calls } = answering(200, PREDICT_JSON);
    const rows = await modelClient("http://model.test:4002/").predict(new Date("2026-10-10T03:00:00Z"));
    expect(rows).toHaveLength(2);
    expect(calls).toEqual([{ url: "http://model.test:4002/predict", method: "POST", body: JSON.stringify({ asOf: "2026-10-10T03:00:00.000Z" }) }]);
  });

  it("reports a service with no promoted model as an upstream failure with its status", async () => {
    answering(503, JSON.stringify({ error: "no live model" }));
    await expect(modelClient("http://model.test:4002").predict(new Date())).rejects.toMatchObject({ name: "UpstreamError", status: 503 });
    await expect(modelClient("http://model.test:4002").predict(new Date())).rejects.toBeInstanceOf(UpstreamError);
  });

  it("has a fake that answers what it was handed and remembers each ask", async () => {
    const fake = new FakeModelClient(CONTRACT_FORECASTS);
    const asOf = new Date("2026-10-10T03:00:00Z");
    expect(await fake.predict(asOf)).toBe(CONTRACT_FORECASTS);
    expect(fake.asked).toEqual([asOf]);
    expect((await fake.health()).modelVersion).toBe(CONTRACT_VERSION);
    expect((await new FakeModelClient([]).health()).modelVersion).toBeNull();
  });
});
```

Check the `UpstreamError` constructor and its `status` field name in `backend/src/lib/errors.ts:59` before relying on `status` in the matcher; the http helper calls `new UpstreamError(response.status, message)`.

- [ ] **Step 3: Run the test to verify it fails**

Run: `cd backend && pnpm test -- test/sources/model.test.ts`
Expected: FAIL, cannot find module `../../src/sources/model`.

- [ ] **Step 4: Add a POST to the http helper**

In `backend/src/sources/http.ts`, after `fetchBytes`, add:

```ts
/**
 * One POST of a JSON body, with the same rules as a GET: a failure answered
 * is an UpstreamError, no answer is retryable.
 */
export async function postJson(url: string, what: string, timeoutMs: number, body: unknown): Promise<string> {
  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      signal: AbortSignal.timeout(timeoutMs),
      headers: { accept: "application/json", "content-type": "application/json", "user-agent": "Mozilla/5.0 (compatible; WhenHazeStop/1.0)" },
      body: JSON.stringify(body),
    });
  } catch (error) {
    throw new RetryableError(`${what} did not answer`, { cause: error });
  }
  if (!response.ok) throw new UpstreamError(response.status, `${what} answered ${response.status}`);
  try {
    return await response.text();
  } catch (error) {
    throw new RetryableError(`${what} stopped answering part way`, { cause: error });
  }
}
```

- [ ] **Step 5: Write the client**

Create `backend/src/sources/model.ts`:

```ts
import { z } from "zod";

import { TerminalError } from "../lib/errors";
import { fetchText, postJson } from "./http";

/**
 * The model service of the compose stack (model/): the learned forecast of
 * each instrument's peak 24 hour PM2.5 for the next three Malaysian days.
 * It builds its own features from the database, so this client only names an
 * hour and parses the answer. No feature is computed on this side.
 */

export interface ModelForecast {
  instrumentId: string;
  /** A Malaysian calendar day, `YYYY-MM-DD`. */
  day: string;
  /** The 10th, 50th and 90th percentile of the day's peak 24 h PM2.5, ug/m3, sorted. */
  p10: number;
  p50: number;
  p90: number;
  modelVersion: string;
}

export interface ModelHealth {
  /** Null while no artifact is promoted. */
  modelVersion: string | null;
  trainedAt: Date | null;
}

export interface ModelClient {
  health(): Promise<ModelHealth>;
  predict(asOf: Date): Promise<ModelForecast[]>;
}

/** Features for 189 instruments are read from the database on each ask, which can take a while on a cold service. */
const TIMEOUT_MS = 120_000;

const Day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const Forecast = z.object({ instrumentId: z.string().min(1), day: Day, p10: z.number(), p50: z.number(), p90: z.number() });
const Prediction = z.object({ modelVersion: z.string().min(1), asOf: z.string(), forecasts: z.array(Forecast) });
const Health = z.object({ status: z.literal("ok"), modelVersion: z.string().nullable(), trainedAt: z.string().nullable() });

function parse<T extends z.ZodType>(schema: T, text: string, what: string): z.output<T> {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch (error) {
    throw new TerminalError(`${what} did not answer with JSON`, { cause: error });
  }
  const parsed = schema.safeParse(json);
  if (!parsed.success) throw new TerminalError(`${what} answered in a shape this client does not know`, { cause: parsed.error });
  return parsed.data;
}

/** Quantile models can cross. The band is sorted here so a low above a high never reaches the outlook. */
export function parsePrediction(text: string): ModelForecast[] {
  const { modelVersion, forecasts } = parse(Prediction, text, "model predict");
  return forecasts.map((row) => {
    const [p10, p50, p90] = [row.p10, row.p50, row.p90].sort((a, b) => a - b);
    return { instrumentId: row.instrumentId, day: row.day, p10, p50, p90, modelVersion };
  });
}

export function parseHealth(text: string): ModelHealth {
  const { modelVersion, trainedAt } = parse(Health, text, "model health");
  return { modelVersion, trainedAt: trainedAt ? new Date(trainedAt) : null };
}

export function modelClient(baseUrl: string): ModelClient {
  const base = baseUrl.replace(/\/$/, "");
  return {
    async health() {
      return parseHealth(await fetchText(`${base}/health`, "model health", TIMEOUT_MS));
    },
    async predict(asOf) {
      return parsePrediction(await postJson(`${base}/predict`, "model predict", TIMEOUT_MS, { asOf: asOf.toISOString() }));
    },
  };
}
```

Create `backend/src/sources/__fakes__/fake.model.ts`:

```ts
import type { ModelClient, ModelForecast, ModelHealth } from "../model";

/** Answers every ask with the forecasts it was handed, and remembers each ask. No test may reach the model service. */
export class FakeModelClient implements ModelClient {
  readonly asked: Date[] = [];

  constructor(
    private readonly forecasts: ModelForecast[],
    private readonly version: string | null = forecasts[0]?.modelVersion ?? null,
  ) {}

  async health(): Promise<ModelHealth> {
    return { modelVersion: this.version, trainedAt: this.version ? new Date("2026-10-11T02:00:00Z") : null };
  }

  async predict(asOf: Date): Promise<ModelForecast[]> {
    this.asked.push(asOf);
    return this.forecasts;
  }
}
```

In `backend/src/sources/index.ts` add, keeping the alphabetical order of the list:

```ts
export { type ModelClient, modelClient, type ModelForecast, type ModelHealth } from "./model";
```

- [ ] **Step 6: Run the test and the type check**

Run: `cd backend && pnpm test -- test/sources/model.test.ts && pnpm type-check`
Expected: 6 tests pass, clean.

- [ ] **Step 7: Commit**

```bash
git add backend/src/sources/http.ts backend/src/sources/model.ts backend/src/sources/__fakes__/fake.model.ts backend/src/sources/index.ts backend/test/fixtures/model-contract.ts backend/test/sources/model.test.ts
git commit -m "Add the model service client and its fake

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 5: The model step of the cycle

**Files:**
- Modify: `backend/src/config.ts`
- Modify: `backend/src/sources/catalog.ts` (`TRACKED_SOURCES`, `SOURCE_CATALOG`)
- Modify: `backend/src/repositories/openaq.repo.ts` (add `sensors`; shared with plan C)
- Create: `backend/src/services/instruments.ts` (shared with plan C)
- Create: `backend/src/jobs/model-forecast.ts`
- Modify: `backend/src/jobs/ingest.ts` (`IngestDeps`)
- Modify: `backend/src/jobs/cycle.ts` (`CycleOptions`, the step)
- Modify: `backend/src/jobs/main.ts`
- Modify: `backend/test/fixtures/cycle.ts`
- Test: `backend/test/jobs/model-forecast.test.ts`

**Interfaces:**
- Consumes: `ModelClient` and `FakeModelClient` from Task 4, `modelForecasts.insertMany` and `latestFor` from Task 3, `recordFetch`, `stations.list`, `metar.airports`, `StoredSensor` from `openaq.repo.ts`.
- Produces: `config.MODEL_URL`, `config.MODEL_MODE: "off" | "shadow" | "live"`, `ModelMode` type exported from `config.ts`; `runModelForecast(pool, model, asOf): Promise<number>`; `IngestDeps.model?: ModelClient | null`; `CycleOptions.model: boolean`; source id `"model"`. Shared with plan C, identical content, if the file or function exists do nothing: `openaq.sensors(db): Promise<StoredSensor[]>` and `listInstruments(db): Promise<Instrument[]>` with `Instrument = { id: string; kind: "doe" | "nea" | "openaq" | "airport"; lat: number; lon: number }` in `services/instruments.ts`.

- [ ] **Step 1: Write the failing test**

Create `backend/test/jobs/model-forecast.test.ts`:

```ts
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { closePool, getPool } from "../../src/db";
import { runCycle } from "../../src/jobs/cycle";
import { runModelForecast } from "../../src/jobs/model-forecast";
import { modelForecasts, sourceFetches } from "../../src/repositories";
import { FakeModelClient } from "../../src/sources/__fakes__/fake.model";
import { FakeDoeClient, FakeFiresClient, FakeMetarClient, FakeNeaClient, FakeWeatherClient } from "../../src/sources/__fakes__/fake.sources";
import { recordedCycle } from "../fixtures/cycle";
import { CONTRACT_FORECASTS, CONTRACT_VERSION } from "../fixtures/model-contract";
import { LAST_HOUR, READINGS, STATIONS } from "../fixtures/recorded";
import { steadyWind } from "../fixtures/steady-wind";

afterAll(closePool);

describe("the model step", () => {
  const pool = getPool();

  beforeAll(async () => {
    await recordedCycle();
  }, 120_000);

  it("stores the answer for instruments it knows, drops the rest, and counts both", async () => {
    const model = new FakeModelClient(CONTRACT_FORECASTS);
    // Nine rows name stations the recorded week has; the tenth names a sensor nothing stored. A rerun finds the nine already there.
    expect(await runModelForecast(pool, model, LAST_HOUR)).toBeLessThanOrEqual(9);
    expect(model.asked).toEqual([LAST_HOUR]);
    expect(await runModelForecast(pool, model, LAST_HOUR)).toBe(0);
    const stored = await modelForecasts.latestFor(pool, "CA24N");
    expect(stored?.modelVersion).toBe(CONTRACT_VERSION);
    expect([...(stored?.days.keys() ?? [])]).toEqual(["2026-10-11", "2026-10-12", "2026-10-13"]);
    expect(await modelForecasts.latestFor(pool, "openaq:999999")).toBeNull();
    const [fetch] = await sourceFetches.page(pool, "model", 1, 0);
    expect(fetch).toMatchObject({ ok: true, detail: { received: 10, unknownInstruments: 1, added: 0 } });
  });

  it("is a step of the cycle that a failing service cannot stop", async () => {
    const refusing: FakeModelClient = Object.assign(new FakeModelClient([]), {
      predict: async () => {
        throw new Error("the service is down");
      },
    });
    const deps = {
      pool,
      doe: new FakeDoeClient(STATIONS, READINGS),
      fires: new FakeFiresClient([]),
      weather: new FakeWeatherClient(steadyWind(new Date("2026-10-06T00:00:00Z"), 200, 3, 3)),
      metar: new FakeMetarClient([]),
      nea: new FakeNeaClient([]),
      model: refusing,
    };
    await runCycle(deps, new Date(LAST_HOUR.getTime() + 20 * 60_000), { fires: false, model: true });
    const [fetch] = await sourceFetches.page(pool, "model", 1, 0);
    expect(fetch).toMatchObject({ ok: false, error: "the service is down" });
  });
});
```

`sourceFetches.page(db, source, limit, offset)` already exists in `backend/src/repositories/source-fetches.repo.ts` and answers newest first with `ok`, `detail` and `error`; nothing is added there.

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd backend && pnpm test -- test/jobs/model-forecast.test.ts`
Expected: FAIL, cannot find module `../../src/jobs/model-forecast`.

- [ ] **Step 3: Add the config and the tracked source**

In `backend/src/config.ts`, after the `LLM_MAX_CONCURRENCY` entry, add:

```ts
  // The model service of the compose stack (model/). 4002 is where
  // compose.yaml publishes it on the host; inside compose it is
  // http://model:4002.
  MODEL_URL: z.url().default("http://127.0.0.1:4002"),
  // off: never asked. shadow: asked each cycle, stored and scored, shown on
  // the Simulation page only. live: its forecast is the outlook's, so alerts
  // and the assistant follow it. Set live by hand, once the shadow rule on the
  // Simulation page has passed (14 days, 10% better than the hourly forecast).
  MODEL_MODE: z.enum(["off", "shadow", "live"]).default("off"),
```

After `export type Config = ...` add:

```ts
export type ModelMode = Config["MODEL_MODE"];
```

In `backend/src/sources/catalog.ts` add `"model"` to the end of `TRACKED_SOURCES`, and this entry at the end of `SOURCE_CATALOG`:

```ts
  {
    id: "model",
    name: "Learned forecast",
    provider: "This app's model service",
    what: "Each instrument's peak 24 hour PM2.5 for the next three days, with a band, from a model trained on the stored history. Asked after each hourly run while MODEL_MODE is shadow or live.",
    endpoint: "http://model:4002/predict",
    link: "docs/MODEL.md",
    cadence: "Every hour, after the run",
    everyHours: 1,
    tracked: true,
  },
```

Check `backend/test/sources/*.test.ts` and `frontend/components/sources/` for a test that counts tracked sources or lists their ids, and extend it by this one entry if one exists.

- [ ] **Step 4: Add the instrument list**

**Shared with plan C: identical content; if the file or function already exists in your worktree, do nothing here. At merge, plan C's version wins.**

In `backend/src/repositories/openaq.repo.ts` add:

```ts
/** Every sensor stored, by OpenAQ's id. */
export async function sensors(db: Queryable): Promise<StoredSensor[]> {
  const { rows } = await db.query<{ sensor_id: string; name: string; provider: string; reference: boolean; lat: number; lon: number }>(
    "select sensor_id, name, provider, reference, lat, lon from openaq_sensors order by sensor_id",
  );
  return rows.map((row) => ({ sensorId: Number(row.sensor_id), name: row.name, provider: row.provider, reference: row.reference, lat: row.lat, lon: row.lon }));
}
```

Create `backend/src/services/instruments.ts`:

```ts
import type { Queryable } from "../db";
import { metar, openaq, stations } from "../repositories";

/**
 * Everything that measures the air or sees the haze, under one id scheme:
 * a station by its id, an OpenAQ sensor as `openaq:<id>`, an airport by its
 * ICAO code. The hindcast job, the model step and the model package all name
 * instruments this way, so a forecast and a feature can never disagree about
 * which place they mean.
 */

export type InstrumentKind = "doe" | "nea" | "openaq" | "airport";

export interface Instrument {
  id: string;
  kind: InstrumentKind;
  lat: number;
  lon: number;
}

const ORDER: InstrumentKind[] = ["doe", "nea", "openaq", "airport"];

/** Every instrument stored, stations first, then sensors, then airports, each group by id. */
export async function listInstruments(db: Queryable): Promise<Instrument[]> {
  const [found, sensors, airports] = await Promise.all([stations.list(db), openaq.sensors(db), metar.airports(db)]);
  const all: Instrument[] = [
    ...found.map((station) => ({ id: station.id, kind: station.network, lat: station.lat, lon: station.lon })),
    ...sensors.map((sensor) => ({ id: `openaq:${sensor.sensorId}`, kind: "openaq" as const, lat: sensor.lat, lon: sensor.lon })),
    ...airports.map((airport) => ({ id: airport.icao, kind: "airport" as const, lat: airport.lat, lon: airport.lon })),
  ];
  return all.sort((a, b) => ORDER.indexOf(a.kind) - ORDER.indexOf(b.kind) || a.id.localeCompare(b.id));
}
```

- [ ] **Step 5: Write the step**

Create `backend/src/jobs/model-forecast.ts`:

```ts
import type { Pool } from "pg";

import { childLogger } from "../lib/logger";
import { modelForecasts } from "../repositories";
import { listInstruments } from "../services/instruments";
import type { ModelClient } from "../sources";
import { recordFetch } from "./record-fetch";

/**
 * Ask the model service for its forecast as of the run's hour and keep it.
 * In shadow mode this is all that happens to it: the Simulation page scores
 * the rows as their days come in. In live mode the outlook reads them too.
 */

const log = childLogger({ module: "jobs.model-forecast" });

/** Every id a forecast may name, under the one id scheme the instrument list defines. */
async function knownInstruments(pool: Pool): Promise<Set<string>> {
  return new Set((await listInstruments(pool)).map((instrument) => instrument.id));
}

/** Returns how many rows were new. A forecast for an instrument nothing stored is dropped and counted, not an error. */
export async function runModelForecast(pool: Pool, model: ModelClient, asOf: Date): Promise<number> {
  const detail = await recordFetch(pool, "model", async () => {
    const forecasts = await model.predict(asOf);
    const known = await knownInstruments(pool);
    const rows = forecasts.filter((forecast) => known.has(forecast.instrumentId)).map((forecast) => ({ asOf, ...forecast }));
    const added = await modelForecasts.insertMany(pool, rows);
    return {
      asOf: asOf.toISOString(),
      modelVersion: forecasts[0]?.modelVersion ?? "none",
      received: forecasts.length,
      unknownInstruments: forecasts.length - rows.length,
      added,
    };
  });
  log.info(detail, "model forecasts stored");
  return detail.added;
}
```

- [ ] **Step 6: Wire the step into the cycle and the process**

In `backend/src/jobs/ingest.ts`, extend the sources import with `ModelClient` and add to `IngestDeps`, after `push`:

```ts
  /** The model service. Null or absent while MODEL_MODE is off, and the cycle never asks it. */
  model?: ModelClient | null;
```

In `backend/src/jobs/cycle.ts`:

```ts
import { runModelForecast } from "./model-forecast";
```

```ts
export interface CycleOptions {
  /** The fire files are large and change a few times a day, so the loop skips them on most hours. */
  fires: boolean;
  /** Whether to ask the model service after the run: MODEL_MODE is shadow or live. */
  model: boolean;
}
```

After the forecast step and before the alerts step:

```ts
  const model = deps.model;
  if (options.model && model) await attempt("model", () => runModelForecast(deps.pool, model, asOf));
```

In `backend/src/jobs/main.ts`: import `modelClient` from `../sources`; in `deps` add `model: config.MODEL_MODE === "off" ? null : modelClient(config.MODEL_URL),`; and pass `model: config.MODEL_MODE !== "off"` in both `runCycle` calls:

```ts
    await runCycle(deps, new Date(), { fires: turn % FIRES_EVERY_HOURS === 0, model: config.MODEL_MODE !== "off" });
```

```ts
    if (command === "once") await runCycle(deps, new Date(), { fires: true, model: config.MODEL_MODE !== "off" });
```

In `backend/test/fixtures/cycle.ts` change the options of its `runCycle` call to `{ fires: true, model: false }`.

- [ ] **Step 7: Run the tests and the type check**

Run: `cd backend && pnpm test -- test/jobs/model-forecast.test.ts test/jobs/cycle.test.ts && pnpm type-check`
Expected: all pass, clean. `pnpm test` as a whole must still pass; run it once here because `CycleOptions` changed.

- [ ] **Step 8: Commit**

```bash
git add backend/src/config.ts backend/src/sources/catalog.ts backend/src/repositories/openaq.repo.ts backend/src/services/instruments.ts backend/src/jobs/model-forecast.ts backend/src/jobs/ingest.ts backend/src/jobs/cycle.ts backend/src/jobs/main.ts backend/test/fixtures/cycle.ts backend/test/jobs/model-forecast.test.ts
git commit -m "Ask the model service after each run and keep its forecast

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 6: A learned band in the day outlook

**Files:**
- Modify: `backend/src/haze/chance.ts`
- Modify: `backend/src/haze/outlook.ts`
- Test: `backend/test/haze/outlook.test.ts`

**Interfaces:**
- Consumes: `pm25ToApi` from `haze/api-index.ts`, `LINES` from `haze/guidelines.ts` (100, 150, 180, 200), `firstHindcast` for the test's `errorsFor`.
- Produces: `Band = [number, number, number]` and `chanceAboveBand(line, band)` in `chance.ts`; `ModelDay` re-exported from `outlook.ts` (same shape as the repository's: `{ p10, p50, p90 }` in ug/m3); `dayOutlooks(asOf, readings, forecast, errorsFor, modelDays?: ReadonlyMap<string, ModelDay>)`.

- [ ] **Step 1: Write the failing test**

Create `backend/test/haze/outlook.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { pm25ToApi } from "../../src/haze/api-index";
import { chanceAboveBand, firstHindcast } from "../../src/haze/chance";
import { addHours } from "../../src/haze/grid";
import { dayOutlooks, type Hourly, type ModelDay } from "../../src/haze/outlook";

/** 11:00 Malaysian time on 10 October 2026, with a station at 120 and climbing, and a flat hourly forecast of 125. */
const AS_OF = new Date("2026-10-10T03:00:00Z");
const READINGS: Hourly[] = [110, 114, 120].map((api, index) => ({ at: addHours(AS_OF, index - 2), api }));
const FORECAST: Hourly[] = Array.from({ length: 84 }, (_, index) => ({ at: addHours(AS_OF, index + 1), api: 125 }));
const errorsFor = firstHindcast;

describe("the chance from a forecast's own band", () => {
  const band: [number, number, number] = [40, 50, 60];

  it("is the share of the band above the line, straight between the quantiles", () => {
    expect(chanceAboveBand(50, band)).toBe(0.5);
    expect(chanceAboveBand(55, band)).toBe(0.3);
    expect(chanceAboveBand(45, band)).toBe(0.7);
  });

  it("never reaches 0 or 1, even far outside the band", () => {
    expect(chanceAboveBand(30, band)).toBe(0.99);
    expect(chanceAboveBand(100, band)).toBe(0.01);
    expect(chanceAboveBand(50, [50, 50, 50])).toBe(0.5);
  });
});

describe("the day outlook with a learned forecast", () => {
  const learned = new Map<string, ModelDay>([
    ["2026-10-10", { p10: 300, p50: 300, p90: 300 }],
    ["2026-10-11", { p10: 40, p50: 52, p90: 80 }],
  ]);
  const days = dayOutlooks(AS_OF, READINGS, FORECAST, errorsFor, learned);

  it("takes tomorrow's peak and band from the learned forecast, converted to the index", () => {
    const tomorrow = days[1];
    expect(tomorrow.day).toBe("2026-10-11");
    expect(tomorrow.forecastPeak).toBe(Math.round(pm25ToApi(52)));
    expect(tomorrow.low).toBe(Math.round(pm25ToApi(40)));
    expect(tomorrow.high).toBe(Math.round(pm25ToApi(80)));
    expect(tomorrow.forecastPeak).toBe(116);
    expect(tomorrow.chance["150"]).toBe(chanceAboveBand(150, [pm25ToApi(40), pm25ToApi(52), pm25ToApi(80)]));
    expect(tomorrow.chance["150"]).toBeCloseTo(0.21, 2);
    expect(tomorrow.chance["100"]).toBeGreaterThan(0.6);
  });

  it("leaves today to the readings, however high the learned forecast for it", () => {
    expect(days[0].forecastPeak).toBe(125);
    expect(days[0].chance["100"]).toBe(1);
  });

  it("falls back to the hourly forecast on a day the learned forecast does not cover", () => {
    const without = dayOutlooks(AS_OF, READINGS, FORECAST, errorsFor);
    expect(days[2]).toEqual(without[2]);
    expect(days[2].forecastPeak).toBe(125);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd backend && pnpm test -- test/haze/outlook.test.ts`
Expected: FAIL, `chanceAboveBand` is not exported.

- [ ] **Step 3: Add the band chance**

Append to `backend/src/haze/chance.ts`:

```ts
/** A forecast's own 10th, 50th and 90th percentile, in API points, lowest first. */
export type Band = [number, number, number];

const BAND_LEVELS = [0.1, 0.5, 0.9];

/** The share of the band at or below `value`: a straight line between its points and on past them, so a value outside it still moves the chance. */
function bandShare(value: number, band: Band): number {
  const k = value <= band[1] ? 0 : 1;
  const span = band[k + 1] - band[k];
  if (span <= 0) return value < band[k] ? BAND_LEVELS[k] : BAND_LEVELS[k + 1];
  return BAND_LEVELS[k] + ((value - band[k]) / span) * (BAND_LEVELS[k + 1] - BAND_LEVELS[k]);
}

/** The chance a forecast with this band passes `line`. Never 0 or 1: three quantiles cannot rule anything out. */
export function chanceAboveBand(line: number, band: Band): number {
  const chance = 1 - bandShare(line, band);
  return Math.round(Math.min(0.99, Math.max(0.01, chance)) * 100) / 100;
}
```

- [ ] **Step 4: Take the learned forecast in the outlook**

Replace the body of `backend/src/haze/outlook.ts` from the `Hourly` interface down with:

```ts
export interface Hourly {
  at: Date;
  api: number;
}

/** A learned forecast of a day's peak 24 h PM2.5, ug/m3: its 10th, 50th and 90th percentile. */
export interface ModelDay {
  p10: number;
  p50: number;
  p90: number;
}

/** Errors for a forecast this many hours ahead at a station that is or is not already hazy. */
export type ErrorsFor = (leadHours: number, hazy: boolean) => Quantiles;

/** What a day's forecast says, whichever forecast it came from. */
interface Expected {
  peak: number;
  low: number;
  high: number;
  chanceAbove: (line: number) => number;
}

function peak(values: Hourly[]): number | null {
  return values.length === 0 ? null : Math.max(...values.map((value) => value.api));
}

function fromHourly(forecastPeak: number, errors: Quantiles): Expected {
  return { peak: forecastPeak, low: Math.max(0, forecastPeak + errors[0]), high: forecastPeak + errors[4], chanceAbove: (line) => chanceAbove(forecastPeak, line, errors) };
}

function fromLearned(day: ModelDay): Expected {
  const band: Band = [pm25ToApi(day.p10), pm25ToApi(day.p50), pm25ToApi(day.p90)];
  return { peak: band[1], low: Math.max(0, band[0]), high: band[2], chanceAbove: (line) => chanceAboveBand(line, band) };
}

/**
 * `modelDays` is the learned model's forecast by Malaysian day, used for the
 * days after today where it has one. Today stays with the readings and the
 * hourly forecast: a day half over is best described by what it has read.
 */
export function dayOutlooks(asOf: Date, readings: Hourly[], forecast: Hourly[], errorsFor: ErrorsFor, modelDays: ReadonlyMap<string, ModelDay> = new Map()): DayOutlook[] {
  const latest = readings.at(-1)?.api ?? null;
  const hazy = latest !== null && latest > 100;
  const days: DayOutlook[] = [];

  for (let offset = 0; offset < OUTLOOK_DAYS; offset++) {
    const day = localDay(addHours(asOf, 24 * offset));
    const observedPeak = peak(readings.filter((reading) => localDay(reading.at) === day));
    const forecastPeak = peak(forecast.filter((value) => localDay(value.at) === day));
    const learned = offset > 0 ? (modelDays.get(day) ?? null) : null;
    // Today is scored as a one-day forecast: what is left of it is at most that far ahead.
    const expected = learned ? fromLearned(learned) : forecastPeak === null ? null : fromHourly(forecastPeak, errorsFor(Math.max(24, 24 * offset), hazy));

    const chance: Record<string, number> = {};
    for (const line of LINES) {
      if (observedPeak !== null && observedPeak > line) chance[line] = 1;
      else if (expected) chance[line] = expected.chanceAbove(line);
      else chance[line] = 0;
    }
    days.push({
      day,
      observedPeak,
      forecastPeak: expected ? Math.round(expected.peak) : null,
      low: expected ? Math.round(expected.low) : null,
      high: expected ? Math.round(expected.high) : null,
      chance,
    });
  }
  return days;
}
```

And change the imports at the top of the file to:

```ts
import type { DayOutlook } from "../contracts";
import { pm25ToApi } from "./api-index";
import { type Band, chanceAbove, chanceAboveBand, type Quantiles } from "./chance";
import { addHours } from "./grid";
import { LINES } from "./guidelines";
```

- [ ] **Step 5: Run the tests and the type check**

Run: `cd backend && pnpm test -- test/haze/outlook.test.ts test/jobs/cycle.test.ts test/haze/alert-rules.test.ts && pnpm type-check`
Expected: all pass, clean. The cycle test's outlook expectations (`days[0].chance["180"]` is 1 for Seremban) still hold because nothing changes without `modelDays`.

- [ ] **Step 6: Commit**

```bash
git add backend/src/haze/chance.ts backend/src/haze/outlook.ts backend/test/haze/outlook.test.ts
git commit -m "Let the day outlook take a learned band for the days ahead

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 7: The outlook service in live mode

**Files:**
- Modify: `backend/src/services/outlook.ts`
- Test: `backend/test/services/outlook.test.ts`

**Interfaces:**
- Consumes: `config.MODEL_MODE` and `ModelMode` from Task 5, `modelForecasts.latestFor` from Task 3, `ModelDay` and `dayOutlooks` from Task 6, `runModelForecast` and the contract fixture for the test.
- Produces: `OutlookContext.learned: boolean`; `outlookContext(db, mode: ModelMode = config.MODEL_MODE)`. Callers in `services/areas.ts`, `services/city.ts` and `jobs/alerts.ts` keep calling `outlookContext(db)` and so follow the config.

- [ ] **Step 1: Write the failing test**

Create `backend/test/services/outlook.test.ts`:

```ts
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { closePool, getPool } from "../../src/db";
import { pm25ToApi } from "../../src/haze/api-index";
import { runModelForecast } from "../../src/jobs/model-forecast";
import { modelForecasts, stations } from "../../src/repositories";
import { outlookContext, outlookFor } from "../../src/services/outlook";
import { FakeModelClient } from "../../src/sources/__fakes__/fake.model";
import { recordedCycle } from "../fixtures/cycle";
import { CONTRACT_FORECASTS } from "../fixtures/model-contract";
import { LAST_HOUR } from "../fixtures/recorded";

afterAll(closePool);

describe("the station outlook under each model mode", () => {
  const pool = getPool();

  beforeAll(async () => {
    await recordedCycle();
    // The same rows the model step stores, so this file and the step's test agree whichever ran first.
    await runModelForecast(pool, new FakeModelClient(CONTRACT_FORECASTS), LAST_HOUR);
  }, 120_000);

  async function seremban(mode: "off" | "shadow" | "live") {
    const station = await stations.find(pool, "CA24N");
    const context = await outlookContext(pool, mode);
    if (!station || !context) throw new Error("the recorded cycle stored no run or no Seremban");
    return outlookFor(pool, station, context);
  }

  it("shows the learned forecast only in live mode", async () => {
    const live = await seremban("live");
    const shadow = await seremban("shadow");
    const stored = await modelForecasts.latestFor(pool, "CA24N");
    const tomorrow = stored?.days.get("2026-10-11");
    expect(tomorrow).toBeDefined();
    expect(live.days[1].forecastPeak).toBe(Math.round(pm25ToApi(tomorrow?.p50 ?? 0)));
    expect(shadow.days[1].forecastPeak).not.toBe(live.days[1].forecastPeak);
    expect(shadow.days[1]).toEqual((await seremban("off")).days[1]);
  });

  it("leaves a station the model never forecast on the hourly forecast", async () => {
    const station = await stations.find(pool, "CA21B");
    const context = await outlookContext(pool, "live");
    if (!station || !context) throw new Error("the recorded cycle stored no run or no Klang");
    const live = await outlookFor(pool, station, context);
    const off = await outlookFor(pool, station, { ...context, learned: false });
    expect(live.days).toEqual(off.days);
  });
});
```

`CA21B` is Klang in `backend/test/fixtures/recorded.ts`, a station the contract fixture never names.

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd backend && pnpm test -- test/services/outlook.test.ts`
Expected: FAIL, `outlookContext` takes one argument, or `learned` does not exist on the context.

- [ ] **Step 3: Pass the learned forecast in live mode**

In `backend/src/services/outlook.ts`:

```ts
import { config, type ModelMode } from "../config";
import { dayOutlooks, type ErrorsFor, type Hourly, type ModelDay } from "../haze/outlook";
import { forecasts, modelForecasts, nea, readings, scores, stations } from "../repositories";
```

```ts
/** A learned forecast older than this against the run is stale, and the hourly forecast speaks instead. */
const LEARNED_STALE_HOURS = 24;

export interface OutlookContext {
  asOf: Date;
  runId: number;
  errorsFor: ErrorsFor;
  /** Whether the learned model's forecast is the outlook's for the days ahead: MODEL_MODE is live. */
  learned: boolean;
}

/** Null before the model has run once. `mode` is the config's unless a test says otherwise. */
export async function outlookContext(db: Queryable, mode: ModelMode = config.MODEL_MODE): Promise<OutlookContext | null> {
  const run = await forecasts.latest(db);
  if (!run) return null;
  return { asOf: new Date(run.asOf), runId: run.id, errorsFor: await loadErrors(db), learned: mode === "live" };
}

/** The newest learned forecast for a station, empty where there is none or it is older than the run by a day. */
async function learnedDays(db: Queryable, stationId: string, asOf: Date): Promise<Map<string, ModelDay>> {
  const stored = await modelForecasts.latestFor(db, stationId);
  if (!stored || stored.asOf < addHours(asOf, -LEARNED_STALE_HOURS)) return new Map();
  return stored.days;
}
```

In `outlookFor`, before the `return`, add `const modelDays = context.learned ? await learnedDays(db, station.id, asOf) : new Map<string, ModelDay>();` and change the `days` line to:

```ts
    days: dayOutlooks(asOf, observed, ahead, errorsFor, modelDays),
```

`stationOutlook` keeps calling `outlookContext(db)`.

- [ ] **Step 4: Run the tests and the type check**

Run: `cd backend && pnpm test -- test/services/outlook.test.ts test/jobs/cycle.test.ts && pnpm type-check`
Expected: all pass, clean. `services/outlook.ts` must stay under 200 lines (it is about 90 after this).

- [ ] **Step 5: Commit**

```bash
git add backend/src/services/outlook.ts backend/test/services/outlook.test.ts
git commit -m "Read the learned forecast into the outlook when MODEL_MODE is live

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 8: Scoring the learned forecast on the Simulation page's contract

**Files:**
- Modify: `backend/src/contracts.simulation.ts`
- Create: `backend/src/services/model-skill.ts`
- Modify: `backend/src/services/simulation.ts`
- Modify: `backend/src/routes/haze.routes.ts:78`
- Test: `backend/test/services/model-skill.test.ts`

**Interfaces:**
- Consumes: `modelForecasts.scorable`, `modelForecasts.newestVersion` from Task 3, `MODEL_VERSION` from `haze/run.ts`, `pm25ToApi`, `config.MODEL_MODE` and `ModelMode` from Task 5, `Network` from `contracts.haze.ts`.
- Produces: contract `ModelMode`, `ModelLeadSkill`, `ModelSkill` in `contracts.simulation.ts`; `Simulation.model: ModelSkill`; `modelSkill(db, mode): Promise<ModelSkill>`; `simulation(db, mode)`; constants `SHADOW_DAYS = 14` and `SHADOW_GAIN = 0.1`.

- [ ] **Step 1: Add the contract**

In `backend/src/contracts.simulation.ts`, import `Network` from `./contracts.haze` and add before `Simulation`:

```ts
export const ModelMode = z.enum(["off", "shadow", "live"]);
export type ModelMode = z.infer<typeof ModelMode>;

/** The learned model against what happened, for one kind of instrument at one lead. Errors in API points. */
export const ModelLeadSkill = z.object({
  network: Network,
  leadDays: z.number().int(),
  /** Instrument-days scored: a model forecast for a day whose peak reading is in. */
  cases: z.number().int(),
  model: z.number().nullable(),
  /** "No change", the newest reading at the issue time, on the cases that had one. */
  persistence: z.number().nullable(),
  persistenceCases: z.number().int(),
  /** The hourly forecast's peak over the same day, on the cases that had a run at the same hour. */
  v2: z.number().nullable(),
  v2Cases: z.number().int(),
});
export type ModelLeadSkill = z.infer<typeof ModelLeadSkill>;

/**
 * The learned model's live record and the rule that lets it speak: after
 * `shadowDaysRequired` days of forecasts for DOE stations, a day-ahead error
 * at least `gainRequired` below the hourly forecast's.
 */
export const ModelSkill = z.object({
  mode: ModelMode,
  modelVersion: z.string().nullable(),
  since: z.string().nullable(),
  shadowDays: z.number().int(),
  shadowDaysRequired: z.number().int(),
  /** 1 minus model over v2 at one day ahead for DOE stations, null before both exist. */
  gain: z.number().nullable(),
  gainRequired: z.number(),
  passed: z.boolean(),
  leads: z.array(ModelLeadSkill),
});
export type ModelSkill = z.infer<typeof ModelSkill>;
```

And add to `Simulation`, after `arrivals`:

```ts
  /** The learned model scored as its days come in, and whether the shadow rule has passed. */
  model: ModelSkill,
```

- [ ] **Step 2: Write the failing test**

Create `backend/test/services/model-skill.test.ts`:

```ts
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { Simulation } from "../../src/contracts";
import { closePool, getPool } from "../../src/db";
import { pm25ToApi } from "../../src/haze/api-index";
import { modelForecasts, readings } from "../../src/repositories";
import { modelSkill, SHADOW_DAYS, SHADOW_GAIN } from "../../src/services/model-skill";
import { testApp } from "../app";
import { recordedCycle } from "../fixtures/cycle";

afterAll(closePool);

/**
 * Forecasts for Seremban's 9 October, the one whole Malaysian day in the
 * recorded week, made a day and two days earlier, under a version only this
 * file writes. No reading precedes those hours, so "no change" has no case.
 */
const VERSION = "test-skill";
const ROWS = [
  { asOf: new Date("2026-10-08T03:00:00Z"), instrumentId: "CA24N", day: "2026-10-09", p10: 60, p50: 90, p90: 120, modelVersion: VERSION },
  { asOf: new Date("2026-10-07T03:00:00Z"), instrumentId: "CA24N", day: "2026-10-09", p10: 50, p50: 70, p90: 100, modelVersion: VERSION },
];

describe("the learned model's live score", () => {
  const pool = getPool();

  beforeAll(async () => {
    await recordedCycle();
    await modelForecasts.insertMany(pool, ROWS);
  }, 120_000);

  it("scores each lead for DOE stations against the day's peak, no change, and the hourly run", async () => {
    const skill = await modelSkill(pool, "shadow", VERSION);
    expect(skill).toMatchObject({ mode: "shadow", modelVersion: VERSION, shadowDaysRequired: SHADOW_DAYS, gainRequired: SHADOW_GAIN, passed: false });
    const ninth = await readings.forStation(pool, "CA24N", new Date("2026-10-08T16:00:00Z"), new Date("2026-10-09T15:00:00Z"));
    const peak = Math.max(...ninth.map((reading) => reading.api));
    const dayAhead = skill.leads.find((lead) => lead.network === "doe" && lead.leadDays === 1);
    const twoAhead = skill.leads.find((lead) => lead.network === "doe" && lead.leadDays === 2);
    // A forecast of 90 ug/m3 is an index of about 168, scored against the 9th's peak reading.
    expect(dayAhead).toMatchObject({ cases: 1, persistence: null, persistenceCases: 0 });
    expect(dayAhead?.model).toBeCloseTo(Math.abs(pm25ToApi(90) - peak), 1);
    expect(twoAhead?.cases).toBe(1);
    expect(twoAhead?.model).toBeCloseTo(Math.abs(pm25ToApi(70) - peak), 1);
    expect(skill.leads.map((lead) => [lead.network, lead.leadDays])).toEqual([["doe", 1], ["doe", 2], ["nea", 1], ["nea", 2]]);
    expect(skill.shadowDays).toBe(1);
  });

  it("answers with nulls and no pass before any forecast of a version exists", async () => {
    const skill = await modelSkill(pool, "off", "no-such-version");
    expect(skill).toMatchObject({ mode: "off", modelVersion: "no-such-version", since: null, shadowDays: 0, gain: null, passed: false });
    expect(skill.leads.every((lead) => lead.cases === 0 && lead.model === null)).toBe(true);
  });

  it("is part of the simulation the api serves", async () => {
    const simulation = Simulation.parse((await request(testApp()).get("/haze/simulation").expect(200)).body);
    expect(simulation.model.mode).toBe("off");
    expect(simulation.model.leads).toHaveLength(4);
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `cd backend && pnpm test -- test/services/model-skill.test.ts`
Expected: FAIL, cannot find module `../../src/services/model-skill`.

- [ ] **Step 4: Write the scoring service**

Create `backend/src/services/model-skill.ts`:

```ts
import type { ModelLeadSkill, ModelMode, ModelSkill, Network } from "../contracts";
import type { Queryable } from "../db";
import { pm25ToApi } from "../haze/api-index";
import { MODEL_VERSION } from "../haze/run";
import { modelForecasts } from "../repositories";
import type { ScoreRow } from "../repositories/model-forecasts.repo";

/**
 * The learned model scored on what came in, beside "no change" and the hourly
 * forecast, and the shadow rule: it may become the outlook only after enough
 * days of forecasts for DOE stations with a day-ahead error clearly below the
 * hourly forecast's. The rule is here, not in a person's head.
 */

export const SHADOW_DAYS = 14;
export const SHADOW_GAIN = 0.1;
const NETWORKS: Network[] = ["doe", "nea"];
const LEADS = [1, 2];

function mean(values: number[]): number | null {
  return values.length === 0 ? null : Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 100) / 100;
}

/** The model is scored on every case; each baseline on the cases where it had a value, which live is nearly all of them. */
function leadSkill(rows: ScoreRow[], network: Network, leadDays: number): ModelLeadSkill {
  const cases = rows.filter((row) => row.network === network && row.leadDays === leadDays && row.observed !== null);
  const observed = (row: ScoreRow): number => row.observed ?? 0;
  const withReading = cases.filter((row) => row.persistence !== null);
  const withRun = cases.filter((row) => row.v2 !== null);
  return {
    network,
    leadDays,
    cases: cases.length,
    model: mean(cases.map((row) => Math.abs(pm25ToApi(row.p50) - observed(row)))),
    persistence: mean(withReading.map((row) => Math.abs((row.persistence ?? 0) - observed(row)))),
    persistenceCases: withReading.length,
    v2: mean(withRun.map((row) => Math.abs((row.v2 ?? 0) - observed(row)))),
    v2Cases: withRun.length,
  };
}

/** `version` is the newest stored unless a test names one. */
export async function modelSkill(db: Queryable, mode: ModelMode, version?: string): Promise<ModelSkill> {
  const newest = await modelForecasts.newestVersion(db);
  const modelVersion = version ?? newest?.modelVersion ?? null;
  const rows = modelVersion ? (await modelForecasts.scorable(db, MODEL_VERSION)).filter((row) => row.modelVersion === modelVersion) : [];
  const leads = NETWORKS.flatMap((network) => LEADS.map((leadDays) => leadSkill(rows, network, leadDays)));

  const dayAhead = leads[0];
  const shadowDays = new Set(rows.filter((row) => row.network === "doe" && row.leadDays === 1 && row.observed !== null).map((row) => row.asOf.toISOString().slice(0, 10))).size;
  const gain = dayAhead.model !== null && dayAhead.v2 !== null && dayAhead.v2 > 0 ? Math.round((1 - dayAhead.model / dayAhead.v2) * 100) / 100 : null;
  const since = modelVersion && newest?.modelVersion === modelVersion ? newest.since.toISOString() : null;
  return {
    mode,
    modelVersion,
    since,
    shadowDays,
    shadowDaysRequired: SHADOW_DAYS,
    gain,
    gainRequired: SHADOW_GAIN,
    passed: shadowDays >= SHADOW_DAYS && gain !== null && gain >= SHADOW_GAIN,
    leads,
  };
}
```

- [ ] **Step 5: Add it to the simulation and the route**

In `backend/src/services/simulation.ts`: import `type ModelMode` from `../contracts` and `modelSkill` from `./model-skill`; change the signature to `export async function simulation(db: Queryable, mode: ModelMode): Promise<Simulation>`; add to the returned object, after `arrivals`:

```ts
    model: await modelSkill(db, mode),
```

In `backend/src/routes/haze.routes.ts`, import `config` from `../config` and change the simulation route to:

```ts
  router.get("/simulation", async (_req, res) => {
    res.json(await simulation(deps.pool, config.MODEL_MODE));
  });
```

`simulation.ts` stays under 200 lines (about 85).

- [ ] **Step 6: Run the tests and the type check**

Run: `cd backend && pnpm test -- test/services/model-skill.test.ts test/jobs/cycle.test.ts && pnpm type-check`
Expected: all pass, clean.

- [ ] **Step 7: Commit**

```bash
git add backend/src/contracts.simulation.ts backend/src/services/model-skill.ts backend/src/services/simulation.ts backend/src/routes/haze.routes.ts backend/test/services/model-skill.test.ts
git commit -m "Score the learned model's forecasts beside no change and the hourly run

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 9: The Simulation page shows the learned model and the shadow rule

**Files:**
- Modify: `frontend/lib/api/simulation-schemas.ts`
- Create: `frontend/components/simulation/model-state.ts`
- Create: `frontend/components/simulation/model-table.tsx`
- Modify: `frontend/app/(app)/simulation/page.tsx` (the `limits` chapter)
- Test: `frontend/components/simulation/model-state.test.ts`

**Interfaces:**
- Consumes: the `ModelSkill` contract from Task 8, `Chapter` and the `card` class in the page, `formatWhen` from `@/lib/when`.
- Produces: `ModelSkill` zod mirror; `shadowSummary(model: ModelSkill): string`; `<ModelTable model={...} />`.

Read `frontend/AGENTS.md` and the Next docs it names before touching the page. Keep the page under 200 lines (it is 166; the chapter adds about 8 lines, so the table and its wording live in the two new files).

- [ ] **Step 1: Mirror the contract**

In `frontend/lib/api/simulation-schemas.ts`, add before `Simulation`:

```ts
export const Network = z.enum(["doe", "nea"]);

export const ModelMode = z.enum(["off", "shadow", "live"]);
export type ModelMode = z.infer<typeof ModelMode>;

export const ModelLeadSkill = z.object({
  network: Network,
  leadDays: z.number().int(),
  cases: z.number().int(),
  model: z.number().nullable(),
  persistence: z.number().nullable(),
  v2: z.number().nullable(),
  v2Cases: z.number().int(),
});
export type ModelLeadSkill = z.infer<typeof ModelLeadSkill>;

export const ModelSkill = z.object({
  mode: ModelMode,
  modelVersion: z.string().nullable(),
  since: z.string().nullable(),
  shadowDays: z.number().int(),
  shadowDaysRequired: z.number().int(),
  gain: z.number().nullable(),
  gainRequired: z.number(),
  passed: z.boolean(),
  leads: z.array(ModelLeadSkill),
});
export type ModelSkill = z.infer<typeof ModelSkill>;
```

And `model: ModelSkill,` to `Simulation` after `arrivals`. If `Network` is already exported from `haze-schemas.ts`, import it from there instead of declaring it again.

- [ ] **Step 2: Write the failing test**

Create `frontend/components/simulation/model-state.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import type { ModelSkill } from "@/lib/api/simulation-schemas";

import { shadowSummary } from "./model-state";

const lead = (network: "doe" | "nea", leadDays: number, model: number | null, v2: number | null, cases = 10) => ({ network, leadDays, cases, model, persistence: model === null ? null : model + 2, persistenceCases: model === null ? 0 : cases, v2, v2Cases: v2 === null ? 0 : cases });

const BASE: ModelSkill = {
  mode: "shadow",
  modelVersion: "2026-10-18-ab12cd",
  since: "2026-10-18T03:20:00.000Z",
  shadowDays: 9,
  shadowDaysRequired: 14,
  gain: 0.14,
  gainRequired: 0.1,
  passed: false,
  leads: [lead("doe", 1, 12.4, 14.4), lead("doe", 2, 20.1, 21), lead("nea", 1, null, null, 0), lead("nea", 2, null, null, 0)],
};

describe("what the page says about the learned model", () => {
  it("says it is off when nothing asks it", () => {
    expect(shadowSummary({ ...BASE, mode: "off", modelVersion: null, since: null, shadowDays: 0, gain: null })).toBe("Not running. Nothing on this page comes from a learned model.");
  });

  it("counts the shadow days still to go and the gain so far", () => {
    expect(shadowSummary(BASE)).toBe("In shadow: 9 of 14 days scored, 14% better than the hourly forecast a day ahead at DOE stations. Needs 10%. Nothing a person sees comes from it yet.");
  });

  it("says when the rule has passed and when the model is live", () => {
    expect(shadowSummary({ ...BASE, shadowDays: 14, passed: true })).toBe("In shadow: 14 of 14 days scored, 14% better than the hourly forecast a day ahead at DOE stations. The rule has passed; it may be set live.");
    expect(shadowSummary({ ...BASE, mode: "live", shadowDays: 20, passed: true })).toBe("Live: the outlook for the days ahead is this model's. 20 days scored, 14% better than the hourly forecast a day ahead at DOE stations.");
  });

  it("does not claim a gain it cannot measure", () => {
    expect(shadowSummary({ ...BASE, gain: null, shadowDays: 2 })).toBe("In shadow: 2 of 14 days scored, not yet comparable with the hourly forecast. Needs 10%. Nothing a person sees comes from it yet.");
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `cd frontend && pnpm test -- components/simulation/model-state.test.ts`
Expected: FAIL, cannot find module `./model-state`.

- [ ] **Step 4: Write the wording and the table**

Create `frontend/components/simulation/model-state.ts`:

```ts
import type { ModelSkill } from "@/lib/api/simulation-schemas";

/** One sentence on where the learned model stands against the shadow rule, in the page's own words. The numbers are the backend's. */

function gainWords(model: ModelSkill): string {
  if (model.gain === null) return "not yet comparable with the hourly forecast";
  return `${Math.round(model.gain * 100)}% better than the hourly forecast a day ahead at DOE stations`;
}

export function shadowSummary(model: ModelSkill): string {
  if (model.mode === "off") return "Not running. Nothing on this page comes from a learned model.";
  if (model.mode === "live") return `Live: the outlook for the days ahead is this model's. ${model.shadowDays} days scored, ${gainWords(model)}.`;
  const scored = `In shadow: ${model.shadowDays} of ${model.shadowDaysRequired} days scored, ${gainWords(model)}.`;
  if (model.passed) return `${scored} The rule has passed; it may be set live.`;
  return `${scored} Needs ${Math.round(model.gainRequired * 100)}%. Nothing a person sees comes from it yet.`;
}
```

Create `frontend/components/simulation/model-table.tsx`:

```tsx
import type { ModelSkill } from "@/lib/api/simulation-schemas";

import { shadowSummary } from "./model-state";

/** The learned model's live record by instrument kind and lead, beside "no change" and the hourly forecast, with the shadow rule's state above it. */

const NETWORK_NAME = { doe: "DOE stations", nea: "Singapore regions" } as const;

function cell(value: number | null, best: boolean): string {
  return `py-2 text-right font-mono text-mono ${value === null ? "text-ink-tertiary" : best ? "font-medium text-ink" : "text-ink-secondary"}`;
}

export function ModelTable({ model }: { model: ModelSkill }) {
  return (
    <div>
      <p className="text-small text-ink-secondary">{shadowSummary(model)}</p>
      {model.modelVersion ? <p className="mt-1 text-caption text-ink-tertiary">Version {model.modelVersion}.</p> : null}
      <table className="mt-3 w-full max-w-[640px] border-collapse text-small">
        <thead>
          <tr className="text-caption text-ink-tertiary">
            <th className="py-1.5 text-left font-normal">Instruments, days ahead</th>
            <th className="py-1.5 text-right font-normal">This model</th>
            <th className="py-1.5 text-right font-normal">Hourly forecast</th>
            <th className="py-1.5 text-right font-normal">No change</th>
            <th className="py-1.5 text-right font-normal">Checked</th>
          </tr>
        </thead>
        <tbody>
          {model.leads.map((lead) => {
            const lowest = Math.min(...[lead.model, lead.v2, lead.persistence].filter((value): value is number => value !== null));
            return (
              <tr key={`${lead.network}-${lead.leadDays}`} className="border-t border-hairline-faint">
                <td className="py-2 text-ink-secondary">
                  {NETWORK_NAME[lead.network]}, {lead.leadDays}
                </td>
                <td className={cell(lead.model, lead.model === lowest)}>{lead.model ?? "none yet"}</td>
                <td className={cell(lead.v2, lead.v2 === lowest)}>{lead.v2 ?? "none yet"}</td>
                <td className={cell(lead.persistence, lead.persistence === lowest)}>{lead.persistence ?? "none yet"}</td>
                <td className="py-2 text-right font-mono text-mono text-ink-secondary">{lead.cases.toLocaleString("en-GB")}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="mt-2 text-caption text-ink-tertiary">Average miss of the day's peak, in API points. Scored on the hours DOE and NEA published, once each day has passed.</p>
    </div>
  );
}
```

In `frontend/app/(app)/simulation/page.tsx`, import `ModelTable` from `@/components/simulation/model-table` and, inside the `limits` chapter after the live runs block (the `ScoreTable` and its fallback paragraph), add:

```tsx
              <h3 className="mt-6 text-small font-medium text-ink">The learned model</h3>
              {sim ? (
                <div className="mt-2">
                  <ModelTable model={sim.model} />
                </div>
              ) : null}
```

- [ ] **Step 5: Run the frontend checks**

Run: `cd frontend && pnpm type-check && pnpm lint && pnpm test`
Expected: clean, all tests pass including the 4 new ones. Lint enforces the 200 line limit; the page must still be under it.

- [ ] **Step 6: See it once**

With the compose Postgres up and the backend api running (`cd backend && pnpm dev`), run `cd frontend && pnpm dev` and open http://localhost:3000/simulation. The "Limits and live record" chapter ends with "The learned model", the sentence "Not running. Nothing on this page comes from a learned model." and a table of four rows reading "none yet". Stop both dev servers.

- [ ] **Step 7: Commit**

```bash
git add frontend/lib/api/simulation-schemas.ts frontend/components/simulation/model-state.ts frontend/components/simulation/model-table.tsx frontend/components/simulation/model-state.test.ts "frontend/app/(app)/simulation/page.tsx"
git commit -m "Show the learned model's record and the shadow rule on the Simulation page

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 10: Compose, environment files and the handover

**Files:**
- Modify: `compose.yaml`
- Modify: `.env.example`
- Modify: `backend/.env.example`
- Modify: `README.md` (the environment table or section that lists the backend's variables)
- Modify: `docs/HANDOVER.md`
- Modify: `docs/FEATURES.md` (section 3.3 tables, section 10 next steps)

**Interfaces:**
- Consumes: plan A's `model/Dockerfile`, which listens on 4002 and reads `PG_HOST`, `PG_PORT`, `PG_DATABASE`, `PG_USER`, `PG_PASSWORD` and `MODEL_ARTIFACTS=/app/artifacts`. Plan A owns everything under `model/`; this task only names the service.
- Produces: the `model` compose service, `MODEL_URL` and `MODEL_MODE` for `jobs` and `api`.

- [ ] **Step 1: Add the service and the variables to compose**

In `compose.yaml`, after the `llm-proxy` service, add:

```yaml
  # The learned forecast (model/): reads the stored history, serves a forecast
  # of each instrument's peak PM2.5 for the next three days. Without a
  # promoted artifact it answers 503 and the cycle logs it and goes on.
  model:
    build: ./model
    environment:
      PG_HOST: postgres
      PG_PORT: 5432
      PG_DATABASE: postgres
      PG_USER: postgres
      PG_PASSWORD: localdev
      MODEL_ARTIFACTS: /app/artifacts
      LOG_LEVEL: ${LOG_LEVEL:-info}
    # 4002 on the host; 4000 and 4001 are the proxies'.
    ports:
      - "127.0.0.1:4002:4002"
    volumes:
      - model-artifacts:/app/artifacts
    depends_on:
      postgres:
        condition: service_healthy
    restart: unless-stopped
```

In the `&backend-env` anchor add:

```yaml
      MODEL_URL: http://model:4002
      # off, shadow or live. shadow asks the model each cycle and scores it on
      # the Simulation page; live makes its forecast the outlook's. Set live by
      # hand once the shadow rule on that page has passed.
      MODEL_MODE: ${MODEL_MODE:-shadow}
```

Under `volumes:` add `model-artifacts:`. Add `model` with `condition: service_started` to the `depends_on` of `jobs`. The `api` reads only the database, so it needs no dependency on the service.

Run: `docker compose config --quiet` from the root. Expected: no output, exit 0. If `model/` does not exist yet in your worktree (plan A is separate), `docker compose config` still validates; `docker compose up` of the `model` service will fail until plan A lands, which is expected and noted in the handover.

- [ ] **Step 2: Document the variables**

In `.env.example`, after the `LLM_MODEL_CHAT` lines, add:

```sh
# The learned model's mode in the jobs and api services: off, shadow or live.
# shadow (the default) asks it every cycle and scores it on the Simulation
# page without showing a person any of it. live makes its forecast the outlook's.
# Set live by hand, once the Simulation page says the shadow rule has passed.
# MODEL_MODE=shadow
```

In `backend/.env.example`, after the `LLM_PROXY_URL` block, add:

```sh
# The model service of the root compose.yaml, published on 4002.
MODEL_URL=http://127.0.0.1:4002
# off (default), shadow or live. See compose.yaml.
# MODEL_MODE=off
```

In `README.md`, where the backend's environment variables are listed, add `MODEL_URL` and `MODEL_MODE` with the same one-line meanings, and `model` to the list of compose services with "the learned forecast, port 4002".

- [ ] **Step 3: Update the handover and the features document**

In `docs/FEATURES.md` section 3.3, add the three tables to the table list with one line each: `weather_forecasts`, "a forecast hour of one fetch, by fetch time, append-only, the leak-free record of what the wind forecast said"; `smoke_hindcasts`, "the transport model's smoke near an instrument as of an issue time, written by `pnpm haze:hindcast`"; `model_forecasts`, "the learned model's band for an instrument-day, append-only, scored on the Simulation page". In section 10, replace the "Store weather by fetch time" item with "Stored by fetch time in `weather_forecasts` since migration 008; the backtest still reads the analysis until the hindcast job and the model package read it (plans C and D)".

In `docs/HANDOVER.md`, under "Things that will surprise you", add:

- **The model service is asked every cycle in compose.** `MODEL_MODE` defaults to `shadow` there and `off` for a host process. In shadow the cycle logs "a step of the cycle failed" with `what: model` until `model/` (plan A) is built and an artifact promoted; everything else runs. The Simulation page's last chapter shows the shadow rule's state. Set `MODEL_MODE=live` only when it says the rule has passed.
- **Three tables are append-only by contract**: `weather_forecasts`, `smoke_hindcasts`, `model_forecasts`. A method change is a new version string, never an update.

And under "Where to look": "The model seam: `backend/src/sources/model.ts`, the step `backend/src/jobs/model-forecast.ts`, the score `backend/src/services/model-skill.ts`".

- [ ] **Step 4: Check the whole backend and frontend once more**

Run: `cd backend && pnpm test && pnpm type-check` then `cd ../frontend && pnpm type-check && pnpm lint && pnpm test`.
Expected: every suite passes, both type checks clean.

- [ ] **Step 5: Commit**

```bash
git add compose.yaml .env.example backend/.env.example README.md docs/HANDOVER.md docs/FEATURES.md
git commit -m "Run the model service in compose and document the shadow rule

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

## Self-review notes

**Spec coverage.** 8.2 tables: Task 1. 8.3 seam, repositories, `ingestWeather` forecast write, cycle step, config, outlook input, outlook service, simulation scoring and contracts: Tasks 1, 3, 4, 5, 6, 7, 8, 9. 8.5 compose: Task 10. Section 9 error handling: 503 is an `UpstreamError` the cycle logs (Tasks 4 and 5), unknown instruments dropped and counted (Task 5), a missing artifact answers 503 on the service side (plan A). Acceptance 3 (shadow storage through the seam with the fake in tests): Task 5. Acceptance 4 (Simulation page shows the live score beside v2): Tasks 8 and 9. The hindcast job itself is plan C; this plan gives it its tables and repository (Tasks 1 and 2) and the shared instrument list (Task 5, Step 4).

**Shared pieces with plan C, identical by agreement:** `backend/db/migrations/008_model.sql` (Task 1, byte for byte), `backend/src/repositories/smoke-hindcasts.repo.ts` with only `insertMany` and `storedDays` (Task 2), `openaq.sensors(db)` and `backend/src/services/instruments.ts` (Task 5, Step 4). If any of them already exists in the worktree, do nothing to it; at merge, plan C's version wins.

**Scoring rows.** The model is scored on every instrument-day whose peak reading is in; "no change" and the hourly run are scored on the subset where each had a value, with their own case counts in the contract, because the recorded test week has no hour that both precedes a whole day and follows a reading. Live, every case has both.

**Type consistency.** `ModelDay` is declared in `model-forecasts.repo.ts` and `haze/outlook.ts` with the same three fields; the service passes the repository's map straight to the outlook. `ModelMode` is one type in `config.ts` (derived from the env schema) and one zod enum in the contract with the same three values; `modelSkill` takes the contract's. `CycleOptions.model` is set in `main.ts` from `config.MODEL_MODE !== "off"` and to `false` in the test fixture. `runModelForecast(pool, model, asOf)` is called by the cycle and by two tests with that order.

**Review focus, pinned:** crossing quantiles, Task 4 test "sorts a band the service wrote out of order"; unknown instrument, Task 5 test "drops the rest, and counts both"; 503 and the cycle going on, Task 4 "upstream failure with its status" and Task 5 "a failing service cannot stop"; stale or absent forecast in live mode, Task 7 "leaves a station the model never forecast" and the 24 hour rule in `learnedDays`; no forecast hours or a repeated fetch, Task 1 "stores nothing for a fetch made after its last hour" and the second `insertForecastHours` call answering 0.
