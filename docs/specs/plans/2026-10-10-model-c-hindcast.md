# Smoke Hindcast Job Implementation Plan (track C)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fill `smoke_hindcasts` with the physical transport model's smoke near every instrument at 00:00 UTC of every stored day, with fires and wind as known at that time, so the learned model (track D) can use the physics as feature group 3.

**Architecture:** A new resumable job `pnpm haze:hindcast [from] [to]` in `backend/src/jobs/hindcast.ts` loads each day's inputs through the existing `loadRunInput` (the same door the live run and the backtest use, so the leak controls are inherited), runs the existing ensemble transport and `smokeFrom`, and stores three numbers per instrument through a new repository. A new `services/instruments.ts` gives the one list of instruments (DOE and Singapore stations, OpenAQ sensors, airports) that the backend and the Python package must agree on.

**Tech Stack:** TypeScript strict, Node, pg, pino, vitest against the `haze_test` database from the root compose Postgres (port 5433). No new dependencies.

**Spec:** `docs/specs/2026-10-10-predictive-model-design.md`, sections 4 (group 3), 8.2 (`smoke_hindcasts`), 8.4 (the hindcast job), 11 (track C). Read `CLAUDE.md` in full and `docs/FORECAST.md` section 2 before starting.

## Global Constraints

- TypeScript strict, no `any`; `unknown` at boundaries narrowed with zod (CLAUDE.md "Code style").
- Functions over classes; named exports; files kebab-case; files under 200 lines.
- `repositories/` owns all SQL. Nothing else writes SQL, tests included.
- Dependencies point inward: `jobs -> services -> repositories -> haze`. A job may import services and repositories; a service composes repositories and `haze/`; `haze/` imports nothing but itself and contracts.
- Never delete, truncate or overwrite anything in any database. `smoke_hindcasts` is append-only; a conflict does nothing.
- Migrations are forward-only SQL in `backend/db/migrations/NNN_name.sql`. Never edit an applied one. Migration `008_model.sql` is shared with track B and must be byte for byte the content in Task 1.
- Real data only: test fixtures are recorded values; `test/fixtures/steady-wind.ts` is a labelled uniform wind test vector for the physics and is the only non-recorded input a test may use. Test points for the physics (Task 5) are labelled as such in a comment, the way `steady-wind.ts` is.
- Errors: throw `TerminalError` from `lib/errors.ts` for a bad argument. Never `catch {}`.
- Comments say why, never what. No banner comments, no emoji, no em dashes, anywhere.
- Logging: pino, one `childLogger({ module: "jobs.hindcast" })` per module. Config only from `config.ts`.
- Tests never delete, add only to `haze_test`, and never reach a data source or the network.
- Commit messages: imperative mood, no emoji, no em dashes, ending with the line `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`.
- Run every command inside `backend/`: `pnpm test -- test/jobs/hindcast.test.ts`, `pnpm type-check`. Postgres must be up: `docker compose up -d postgres` from the repo root.

## Review Focus

Inputs the spec implies that a person will meet, each pinned to a test in the task that owns the code:

1. A day before the stored wind begins (the history has fires from January 2025 but wind only from June 2025): the job must skip it and count it as `short`, never fill or guess. Pinned in Task 5, "skips a day the stored wind does not reach".
2. The stored wind reaches the issue time but not 48 hours past it (the newest days, and the end of any partial history fetch): the day is skipped whole, not stored with a partial or zero `smoke_48h`. Pinned in Task 5, "skips a day whose wind stops before two days on".
3. An instrument outside the region (an OpenAQ sensor OpenAQ places on the wrong continent, or an airport added later): no row, no crash, counted in the log. Pinned in Task 4, "writes no row for an instrument outside the region".
4. A restart after a version bump: rows stored under another `model` string must not make the day count as done. Pinned in Task 5, "does not skip a day stored under another model".
5. A command line with `from` after `to`, or a date that is not `YYYY-MM-DD`: a `TerminalError` naming the argument before any query. Pinned in Task 5, "refuses a span that runs backwards".

---

### Task 1: Migration 008, shared with track B

**Files:**
- Create: `backend/db/migrations/008_model.sql` (only if absent)

**Interfaces:**
- Consumes: nothing.
- Produces: tables `weather_forecasts`, `smoke_hindcasts`, `model_forecasts`. Track B creates the same file with the same bytes; identical add/add merges cleanly, so do not change a character.

- [ ] **Step 1: Check whether the file already exists**

Run: `ls backend/db/migrations/008_model.sql`
Expected: `No such file or directory`. If it exists, compare it with the content below with `diff`; if identical, skip to Task 2. If it differs, stop and report: the shared interface has drifted and the parent must reconcile.

- [ ] **Step 2: Write the migration, exactly this content**

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

- [ ] **Step 3: Apply it to the development and test databases**

Run: `cd backend && pnpm db:migrate && pnpm test -- test/jobs/coverage.test.ts`
Expected: `db:migrate` prints the new file as applied; the coverage test passes (its global setup migrates `haze_test`).

- [ ] **Step 4: Commit**

```bash
git add backend/db/migrations/008_model.sql
git commit -m "Add the model tables: forecast weather, smoke hindcasts, model forecasts

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 2: The smoke hindcast repository, shared with track B

**Files:**
- Create: `backend/src/repositories/smoke-hindcasts.repo.ts` (only if absent)
- Modify: `backend/src/repositories/index.ts` (add one export line, alphabetically)
- Test: `backend/test/repositories/smoke-hindcasts.test.ts`

**Interfaces:**
- Consumes: `Queryable` from `src/db.ts`.
- Produces: `interface SmokeHindcast { asOf: Date; instrumentId: string; smokeNow: number; smoke24h: number; smoke48h: number; model: string }`, `insertMany(pool: Queryable, rows: SmokeHindcast[]): Promise<number>` (how many were new), `storedDays(pool: Queryable, model: string): Promise<Set<string>>` (ISO strings of `as_of`). Exactly these two functions and nothing else, so track B's copy is identical.

- [ ] **Step 1: Write the failing test**

Create `backend/test/repositories/smoke-hindcasts.test.ts`:

```ts
import { afterAll, describe, expect, it } from "vitest";

import { closePool, getPool } from "../../src/db";
import { smokeHindcasts } from "../../src/repositories";

afterAll(closePool);

/** A model name no job writes, so the rows this file adds are its own on every run. */
const MODEL = "test-repo";
const AS_OF = new Date("2026-10-09T00:00:00Z");

describe("smoke hindcasts", () => {
  it("stores rows once, keeps the first on a repeat, and lists the days stored for a model", async () => {
    const pool = getPool();
    await smokeHindcasts.insertMany(pool, [{ asOf: AS_OF, instrumentId: "CA16W", smokeNow: 1.5, smoke24h: 2.5, smoke48h: 3.5, model: MODEL }]);
    await smokeHindcasts.insertMany(pool, [{ asOf: AS_OF, instrumentId: "CA16W", smokeNow: 9, smoke24h: 9, smoke48h: 9, model: MODEL }]);
    const days = await smokeHindcasts.storedDays(pool, MODEL);
    expect(days.has(AS_OF.toISOString())).toBe(true);
    expect(await smokeHindcasts.storedDays(pool, "no-such-model")).toEqual(new Set());
  });

  it("does nothing with no rows", async () => {
    await expect(smokeHindcasts.insertMany(getPool(), [])).resolves.toBeUndefined();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd backend && pnpm test -- test/repositories/smoke-hindcasts.test.ts`
Expected: FAIL, `smokeHindcasts` is not exported from `../../src/repositories`.

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

Add to `backend/src/repositories/index.ts`, between `scores` and `sourceFetches`:

```ts
export * as smokeHindcasts from "./smoke-hindcasts.repo";
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd backend && pnpm test -- test/repositories/smoke-hindcasts.test.ts && pnpm type-check`
Expected: 2 tests pass; type-check clean.

- [ ] **Step 5: Commit**

```bash
git add backend/src/repositories/smoke-hindcasts.repo.ts backend/src/repositories/index.ts backend/test/repositories/smoke-hindcasts.test.ts
git commit -m "Store the smoke hindcasts, append-only, keyed by issue time, instrument and model

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 3: One list of instruments

**Files:**
- Create: `backend/src/services/instruments.ts`
- Modify: `backend/src/repositories/openaq.repo.ts` (add `sensors`)
- Test: `backend/test/services/instruments.test.ts`

**Interfaces:**
- Consumes: `stations.list(db)` (returns `Station[]` with `network: "doe" | "nea"`), `metar.airports(db)` (returns `Airport[]`), and a new `openaq.sensors(db): Promise<StoredSensor[]>`.
- Produces: `type InstrumentKind = "doe" | "nea" | "openaq" | "airport"`, `interface Instrument { id: string; kind: InstrumentKind; lat: number; lon: number }`, `listInstruments(db: Queryable): Promise<Instrument[]>`. Track A's Python package builds the same list by the same rule, written in the file's comment.

Why a service: the list composes three repositories and is read by this job, by track B's simulation scoring and by the model seam. CLAUDE.md puts "the reads that routes, jobs and chat tools share" in `services/`, which jobs may import. It is not `haze/` because it reads the database.

The rule, which the Python package must copy exactly:
- Every row of `stations`: id as stored, kind from `network` (`doe` or `nea`).
- Every row of `openaq_sensors`, reference or not: id `openaq:<sensor_id>`, kind `openaq`.
- Every row of `airports`: id the ICAO code, kind `airport`.
- Ordered by kind in the order above, then id. Nothing filtered by region: a point outside it gets no smoke, which the hindcast handles.

- [ ] **Step 1: Write the failing test**

Create `backend/test/services/instruments.test.ts`:

```ts
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { closePool, getPool } from "../../src/db";
import { openaq } from "../../src/repositories";
import { listInstruments } from "../../src/services/instruments";
import { parseOpenAqSensors } from "../../src/sources/openaq";
import { recordedCycle } from "../fixtures/cycle";
import { OPENAQ_LOCATIONS_JSON } from "../fixtures/recorded-history";

afterAll(closePool);

describe("the one list of instruments", () => {
  beforeAll(async () => {
    await recordedCycle();
    await openaq.upsertSensors(getPool(), parseOpenAqSensors(OPENAQ_LOCATIONS_JSON));
  }, 120_000);

  it("names every station, sensor and airport once, by the shared rule", async () => {
    const instruments = await listInstruments(getPool());
    const ids = instruments.map((item) => item.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(instruments.find((item) => item.id === "CA16W")).toEqual({ id: "CA16W", kind: "doe", lat: 3.10626, lon: 101.717931 });
    expect(instruments.find((item) => item.id === "SGCENTRAL")).toMatchObject({ kind: "nea" });
    // The reference monitor at the US embassy in Kuala Lumpur, as OpenAQ lists it.
    expect(instruments.find((item) => item.id === "openaq:2085316")).toMatchObject({ kind: "openaq", lat: 3.15675, lon: 101.72145 });
    // Subang, the first airport of the recorded METAR sample.
    expect(instruments.find((item) => item.kind === "airport")).toMatchObject({ id: expect.stringMatching(/^W[A-Z]{3}$/) });
  });

  it("orders by kind then id, so a run and the model package see the same order", async () => {
    const kinds = (await listInstruments(getPool())).map((item) => item.kind);
    const order = ["doe", "nea", "openaq", "airport"];
    expect(kinds).toEqual([...kinds].sort((a, b) => order.indexOf(a) - order.indexOf(b)));
  });
});
```

Check the first airport code the fixture carries before relying on the regex: `grep -o '"icaoId":"[A-Z]*"' backend/test/fixtures/recorded-context.ts | head -3`. If the codes are not all `W...` (Brunei is `WBSB`, Changi `WSSS`, Indonesian ones `WI..`), the regex still holds; if the sample has none, replace that expectation with the first code the grep prints.

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd backend && pnpm test -- test/services/instruments.test.ts`
Expected: FAIL, cannot find module `../../src/services/instruments`.

- [ ] **Step 3: Add the sensor list read to the OpenAQ repository**

Append to `backend/src/repositories/openaq.repo.ts`:

```ts
/** Every sensor ever stored, reference and low-cost alike, oldest id first. */
export async function sensors(db: Queryable): Promise<StoredSensor[]> {
  const { rows } = await db.query<{ sensor_id: string; name: string; provider: string; reference: boolean; lat: number; lon: number }>(
    "select sensor_id, name, provider, reference, lat, lon from openaq_sensors order by sensor_id",
  );
  return rows.map((row) => ({ sensorId: Number(row.sensor_id), name: row.name, provider: row.provider, reference: row.reference, lat: row.lat, lon: row.lon }));
}
```

(`sensor_id` is `bigint`, which pg returns as a string; `Number` is how `spanBySensor` in the same file already reads it. Check that file and copy its conversion if it differs.)

- [ ] **Step 4: Write the service**

Create `backend/src/services/instruments.ts`:

```ts
import type { Queryable } from "../db";
import { metar, openaq, stations } from "../repositories";

/**
 * Every place that measures the air or sees the haze, as one list with one
 * naming rule. The hindcast, the simulation scores and the model package all
 * read it, and the Python package builds the same list from the same tables,
 * so the rule here is the contract:
 *
 *   stations        id as stored; kind is the network (doe or nea)
 *   openaq_sensors  "openaq:" and the sensor id; reference and low-cost alike
 *   airports        the ICAO code
 *
 * Ordered by kind in that order, then id. Nothing is filtered by region.
 */

export type InstrumentKind = "doe" | "nea" | "openaq" | "airport";

export interface Instrument {
  id: string;
  kind: InstrumentKind;
  lat: number;
  lon: number;
}

export function openAqInstrumentId(sensorId: number): string {
  return `openaq:${sensorId}`;
}

export async function listInstruments(db: Queryable): Promise<Instrument[]> {
  const byId = (a: Instrument, b: Instrument): number => a.id.localeCompare(b.id);
  const placed = (await stations.list(db)).map((station) => ({ id: station.id, kind: station.network, lat: station.lat, lon: station.lon }));
  const sensors = (await openaq.sensors(db)).map((sensor) => ({ id: openAqInstrumentId(sensor.sensorId), kind: "openaq" as const, lat: sensor.lat, lon: sensor.lon }));
  const airports = (await metar.airports(db)).map((airport) => ({ id: airport.icao, kind: "airport" as const, lat: airport.lat, lon: airport.lon }));
  return [
    ...placed.filter((item) => item.kind === "doe").sort(byId),
    ...placed.filter((item) => item.kind === "nea").sort(byId),
    ...sensors.sort(byId),
    ...airports.sort(byId),
  ];
}
```

If `Station["network"]` is typed as a zod enum narrower or wider than `"doe" | "nea"`, map it explicitly: `kind: station.network === "nea" ? "nea" : "doe"`.

- [ ] **Step 5: Run the test to verify it passes**

Run: `cd backend && pnpm test -- test/services/instruments.test.ts && pnpm type-check`
Expected: 2 tests pass; type-check clean.

- [ ] **Step 6: Commit**

```bash
git add backend/src/services/instruments.ts backend/src/repositories/openaq.repo.ts backend/test/services/instruments.test.ts
git commit -m "List every instrument once, by the rule the model package shares

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 4: The hindcast of one day

**Files:**
- Create: `backend/src/jobs/hindcast.ts` (the per-day part; Task 6 adds the loop in the same file)
- Test: `backend/test/jobs/hindcast.test.ts` (first tests; Task 6 adds more)

**Interfaces:**
- Consumes: `loadRunInput(pool, asOf): Promise<RunInput | null>` from `jobs/forecast.ts`; `emissionsFor`, `ensembleMean`, `smokeFrom`, `REACH_KM`, `cellsWithin`, `hoursBetween`, `WEATHER_POINTS`, `MODEL_VERSION` from `haze/`; `Instrument` from Task 3; `SmokeHindcast` from Task 2.
- Produces: `HINDCAST_MODEL = \`${MODEL_VERSION}-analysis\``, `AHEAD_HOURS = 48`, `SPIN_UP_HOURS = 72`, `type DaySkip = "no-wind" | "short-spin-up" | "short-ahead"`, `hindcastDay(pool: Pool, asOf: Date, instruments: Instrument[]): Promise<{ rows: SmokeHindcast[]; outside: number } | DaySkip>`.

What the numbers are, so nobody reads them as a concentration: `smokeFrom(...).near(cells, hour)` is the ensemble-mean modelled smoke mass summed over the field cells within 50 km, as a trailing 24 hour mean, in the transport model's own arbitrary units. It is the quantity `run.ts` calibrates against readings; the hindcast stores it before calibration, because most of the history has no readings to calibrate on and the learned model fits its own gain. The `model` column says which method and which wind: `v2-analysis` means `MODEL_VERSION` v2 run on the stored analysis wind (the known leak, spec 7.5).

- [ ] **Step 1: Write the failing tests**

Create `backend/test/jobs/hindcast.test.ts`:

```ts
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { closePool, getPool } from "../../src/db";
import { AHEAD_HOURS, HINDCAST_MODEL, hindcastDay } from "../../src/jobs/hindcast";
import { weather } from "../../src/repositories";
import type { Instrument } from "../../src/services/instruments";
import { recordedCycle } from "../fixtures/cycle";
import { steadyWind } from "../fixtures/steady-wind";

afterAll(closePool);

/**
 * Two points on the steady wind's line through the recorded Sumatran fires
 * (about 3.4 S, 105.2 E, carried north-east by u = v = 3 m/s): test vectors
 * for the physics, like the wind itself, not places anyone will see.
 */
const DOWNWIND: Instrument = { id: "test-downwind", kind: "airport", lat: -1.5, lon: 107 };
const UPWIND: Instrument = { id: "test-upwind", kind: "airport", lat: -5, lon: 103.5 };
const OUTSIDE: Instrument = { id: "test-outside", kind: "airport", lat: 20, lon: 130 };
/** The day after the recorded fires of 7 to 9 October are all complete. */
const AS_OF = new Date("2026-10-10T00:00:00Z");

describe("the smoke hindcast of one day", () => {
  beforeAll(async () => {
    await recordedCycle();
    // The run looks back 8 days; the recorded cycle's wind starts on the 6th, so the same steady wind is laid over the days before.
    await weather.upsertGrid(getPool(), steadyWind(new Date("2026-09-30T00:00:00Z"), 24 * 6, 3, 3));
  }, 120_000);

  it("gives every instrument its smoke at the issue time and a day and two days on", async () => {
    const result = await hindcastDay(getPool(), AS_OF, [DOWNWIND, UPWIND]);
    expect(typeof result).toBe("object");
    if (typeof result !== "object") return;
    expect(result.rows.map((row) => row.instrumentId)).toEqual(["test-downwind", "test-upwind"]);
    for (const row of result.rows) {
      expect(row).toMatchObject({ asOf: AS_OF, model: HINDCAST_MODEL });
      for (const value of [row.smokeNow, row.smoke24h, row.smoke48h]) expect(Number.isFinite(value) && value >= 0).toBe(true);
    }
  });

  it("carries more smoke to the point downwind of the fires than to the point upwind", async () => {
    const result = await hindcastDay(getPool(), AS_OF, [DOWNWIND, UPWIND]);
    if (typeof result !== "object") throw new Error(`skipped: ${result}`);
    const [downwind, upwind] = result.rows;
    expect(downwind.smoke24h).toBeGreaterThan(upwind.smoke24h);
    expect(downwind.smoke48h).toBeGreaterThan(upwind.smoke48h);
  });

  it("writes no row for an instrument outside the region, and counts it", async () => {
    const result = await hindcastDay(getPool(), AS_OF, [DOWNWIND, OUTSIDE]);
    if (typeof result !== "object") throw new Error(`skipped: ${result}`);
    expect(result.rows.map((row) => row.instrumentId)).toEqual(["test-downwind"]);
    expect(result.outside).toBe(1);
  });

  it("names the horizon it stores", () => {
    expect(AHEAD_HOURS).toBe(48);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd backend && pnpm test -- test/jobs/hindcast.test.ts`
Expected: FAIL, cannot find module `../../src/jobs/hindcast`.

- [ ] **Step 3: Write the per-day hindcast**

Create `backend/src/jobs/hindcast.ts`:

```ts
import type { Pool } from "pg";

import { ensembleMean } from "../haze/ensemble";
import { emissionsFor } from "../haze/fires";
import { cellsWithin, hoursBetween, WEATHER_POINTS } from "../haze/grid";
import { MODEL_VERSION } from "../haze/run";
import { REACH_KM, smokeFrom } from "../haze/smoke";
import type { Weather } from "../haze/transport";
import { childLogger } from "../lib/logger";
import type { SmokeHindcast } from "../repositories/smoke-hindcasts.repo";
import type { Instrument } from "../services/instruments";
import { loadRunInput } from "./forecast";

/**
 * The transport model replayed at the start of each stored day, so the learned
 * model can read what the physics would have said then. What is stored is the
 * ensemble-mean smoke within 50 km as a trailing day mean, in the model's own
 * units and before calibration: the history mostly has no readings to calibrate
 * on, and the learned model fits its own gain.
 *
 * Inputs come through `loadRunInput`, the same door as the live run and the
 * backtest, so a day sees only the fire days complete at its issue time. The
 * wind is the stored analysis, which the `model` name says.
 */

const log = childLogger({ module: "jobs.hindcast" });

export const HINDCAST_MODEL = `${MODEL_VERSION}-analysis`;
/** The learned model's second target is the day after tomorrow, so the smoke two days on is the last number it needs. */
export const AHEAD_HOURS = 48;
/** Smoke released before the run started is missing, so a run with less wind behind it than this says little. */
export const SPIN_UP_HOURS = 72;

export type DaySkip = "no-wind" | "short-spin-up" | "short-ahead";

/** The first `hours` of a weather grid, so the ensemble is not run past what is read. */
function clipped(weather: Weather, hours: number): Weather {
  const points = hours * WEATHER_POINTS;
  return { hours, u: weather.u.subarray(0, points), v: weather.v.subarray(0, points), rain: weather.rain.subarray(0, points) };
}

export async function hindcastDay(pool: Pool, asOf: Date, instruments: Instrument[]): Promise<{ rows: SmokeHindcast[]; outside: number } | DaySkip> {
  const input = await loadRunInput(pool, asOf);
  if (!input) return "no-wind";
  const now = hoursBetween(input.start, asOf);
  if (now < SPIN_UP_HOURS) return "short-spin-up";
  const hours = now + AHEAD_HOURS + 1;
  if (input.weather.hours < hours) return "short-ahead";

  const weather = clipped(input.weather, hours);
  const smoke = smokeFrom(ensembleMean(emissionsFor(input.fires, input.start, asOf, hours), weather), hours);
  const rows: SmokeHindcast[] = [];
  let outside = 0;
  for (const instrument of instruments) {
    const cells = cellsWithin(instrument.lat, instrument.lon, REACH_KM);
    if (cells.length === 0) {
      outside += 1;
      continue;
    }
    rows.push({
      asOf,
      instrumentId: instrument.id,
      smokeNow: smoke.near(cells, now),
      smoke24h: smoke.near(cells, now + 24),
      smoke48h: smoke.near(cells, now + AHEAD_HOURS),
      model: HINDCAST_MODEL,
    });
  }
  if (outside > 0) log.debug({ asOf: asOf.toISOString(), outside }, "instruments outside the region got no smoke");
  return { rows, outside };
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd backend && pnpm test -- test/jobs/hindcast.test.ts && pnpm type-check`
Expected: 4 tests pass (the two that run the ensemble take some seconds each); type-check clean. If the downwind test fails, print both rows: with u = v = 3 m/s the plume moves about 365 km a day north-east, and the downwind point is about 270 km north-east of the fires' centre, so after 24 hours it must hold more than the point 270 km south-west, which the wind never reaches. A failure there means the clip or the hour index is wrong, not the physics.

- [ ] **Step 5: Commit**

```bash
git add backend/src/jobs/hindcast.ts backend/test/jobs/hindcast.test.ts
git commit -m "Replay the smoke model at one issue time for every instrument

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 5: The resumable loop over a span of days

**Files:**
- Modify: `backend/src/jobs/hindcast.ts` (append)
- Test: `backend/test/jobs/hindcast.test.ts` (append a `describe`)

**Interfaces:**
- Consumes: `hindcastDay` (Task 4), `smokeHindcasts.insertMany` and `storedDays` (Task 2), `listInstruments` (Task 3), `TerminalError` from `lib/errors.ts`.
- Produces: `interface HindcastOptions { from: string; to: string; instruments?: Instrument[] }`, `interface HindcastSummary { days: number; stored: number; rows: number; skipped: number; short: number; ms: number }`, `runHindcast(pool: Pool, options: HindcastOptions): Promise<HindcastSummary>`, `formatHindcast(summary: HindcastSummary): string`.

`from` and `to` are UTC days `YYYY-MM-DD`, both inclusive; the issue time of a day is its 00:00 UTC. `instruments` is for tests; a run without it lists them from the database. `stored` counts days with rows written this run, `skipped` days already stored for `HINDCAST_MODEL`, `short` days skipped for any `DaySkip` reason.

- [ ] **Step 1: Write the failing tests**

Append to `backend/test/jobs/hindcast.test.ts` (add `runHindcast`, `formatHindcast` to the import from `../../src/jobs/hindcast`, `smokeHindcasts` to the repositories import, and `TerminalError` from `../../src/lib/errors`):

```ts
describe("the hindcast over a span of days", () => {
  it("stores one day, then skips it on a rerun without a second row", async () => {
    const pool = getPool();
    const options = { from: "2026-10-10", to: "2026-10-10", instruments: [DOWNWIND, UPWIND] };
    const first = await runHindcast(pool, options);
    const before = (await smokeHindcasts.storedDays(pool, HINDCAST_MODEL)).has(AS_OF.toISOString());
    const again = await runHindcast(pool, options);
    expect(before).toBe(true);
    // The first run may itself find the day stored by an earlier run of this file; either way the rerun stores nothing.
    expect(first.stored + first.skipped).toBe(1);
    expect(again).toMatchObject({ days: 1, stored: 0, rows: 0, skipped: 1, short: 0 });
  });

  it("does not skip a day stored under another model", async () => {
    const pool = getPool();
    await smokeHindcasts.insertMany(pool, [{ asOf: new Date("2026-10-09T00:00:00Z"), instrumentId: DOWNWIND.id, smokeNow: 0, smoke24h: 0, smoke48h: 0, model: "other-model" }]);
    const summary = await runHindcast(pool, { from: "2026-10-09", to: "2026-10-09", instruments: [DOWNWIND] });
    expect(summary.stored + summary.skipped).toBe(1);
    expect((await smokeHindcasts.storedDays(pool, HINDCAST_MODEL)).has("2026-10-09T00:00:00.000Z")).toBe(true);
  });

  it("skips a day the stored wind does not reach", async () => {
    const summary = await runHindcast(getPool(), { from: "2025-01-15", to: "2025-01-15", instruments: [DOWNWIND] });
    expect(summary).toMatchObject({ days: 1, stored: 0, skipped: 0, short: 1 });
  });

  it("skips a day whose wind stops before two days on", async () => {
    // The recorded cycle's wind runs 200 hours from 6 October, to the 14th at 07:00: the 13th has it, but not 48 hours past it.
    const summary = await runHindcast(getPool(), { from: "2026-10-13", to: "2026-10-13", instruments: [DOWNWIND] });
    expect(summary).toMatchObject({ days: 1, stored: 0, short: 1 });
  });

  it("refuses a span that runs backwards or a day that is not a date", async () => {
    await expect(runHindcast(getPool(), { from: "2026-10-11", to: "2026-10-10" })).rejects.toBeInstanceOf(TerminalError);
    await expect(runHindcast(getPool(), { from: "11/10/2026", to: "2026-10-12" })).rejects.toBeInstanceOf(TerminalError);
  });

  it("prints the summary on one line", () => {
    expect(formatHindcast({ days: 3, stored: 1, rows: 180, skipped: 1, short: 1, ms: 12_345 })).toBe("hindcast: 3 days, 1 stored (180 rows), 1 already stored, 1 without enough wind, 12 s");
  });
});
```

If other test files have stored wind in `haze_test` that reaches past 15 October (none does when this is written; `grep -rn "steadyWind(" backend/test` lists every span), move the "stops before two days on" day to the last day the wind covers minus one.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd backend && pnpm test -- test/jobs/hindcast.test.ts`
Expected: FAIL, `runHindcast` is not exported.

- [ ] **Step 3: Write the loop**

Append to `backend/src/jobs/hindcast.ts` (add `TerminalError` from `../lib/errors`, `smokeHindcasts` from `../repositories`, `listInstruments` to the existing import from `../services/instruments`; `addHours` from `../haze/grid`):

```ts
export interface HindcastOptions {
  /** First and last UTC day, inclusive, as YYYY-MM-DD. */
  from: string;
  to: string;
  /** For tests. A run without it lists the instruments from the database. */
  instruments?: Instrument[];
}

export interface HindcastSummary {
  days: number;
  stored: number;
  rows: number;
  skipped: number;
  short: number;
  ms: number;
}

const DAY = /^\d{4}-\d{2}-\d{2}$/;

function issueTime(day: string, name: string): Date {
  if (!DAY.test(day) || Number.isNaN(Date.parse(`${day}T00:00:00Z`))) throw new TerminalError(`${name} must be a UTC day as YYYY-MM-DD, not "${day}"`);
  return new Date(`${day}T00:00:00Z`);
}

export async function runHindcast(pool: Pool, options: HindcastOptions): Promise<HindcastSummary> {
  const from = issueTime(options.from, "from");
  const to = issueTime(options.to, "to");
  if (from > to) throw new TerminalError(`from (${options.from}) is after to (${options.to})`);

  const started = Date.now();
  const instruments = options.instruments ?? (await listInstruments(pool));
  const done = await smokeHindcasts.storedDays(pool, HINDCAST_MODEL);
  const summary: HindcastSummary = { days: 0, stored: 0, rows: 0, skipped: 0, short: 0, ms: 0 };
  for (let asOf = from; asOf <= to; asOf = addHours(asOf, 24)) {
    summary.days += 1;
    if (done.has(asOf.toISOString())) {
      summary.skipped += 1;
      continue;
    }
    const dayStarted = Date.now();
    const result = await hindcastDay(pool, asOf, instruments);
    if (typeof result === "string") {
      summary.short += 1;
      log.info({ asOf: asOf.toISOString(), why: result }, "day skipped");
      continue;
    }
    await smokeHindcasts.insertMany(pool, result.rows);
    summary.stored += 1;
    summary.rows += result.rows.length;
    log.info({ asOf: asOf.toISOString(), rows: result.rows.length, outside: result.outside, ms: Date.now() - dayStarted }, "day stored");
  }
  summary.ms = Date.now() - started;
  return summary;
}

export function formatHindcast(summary: HindcastSummary): string {
  return `hindcast: ${summary.days} days, ${summary.stored} stored (${summary.rows} rows), ${summary.skipped} already stored, ${summary.short} without enough wind, ${Math.round(summary.ms / 1000)} s`;
}
```

If `hindcast.ts` passes 200 lines, move `HindcastOptions`, `HindcastSummary`, `issueTime`, `runHindcast` and `formatHindcast` to `backend/src/jobs/hindcast-span.ts` and have the tests import from there; keep `hindcastDay` and the constants in `hindcast.ts`.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd backend && pnpm test -- test/jobs/hindcast.test.ts && pnpm type-check`
Expected: 10 tests pass; type-check clean.

- [ ] **Step 5: Commit**

```bash
git add backend/src/jobs/hindcast.ts backend/test/jobs/hindcast.test.ts
git commit -m "Run the smoke hindcast over a span of days, skipping what is stored

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 6: The command line, the script, and the docs

**Files:**
- Modify: `backend/src/jobs/main.ts` (the comment block, the `else if` chain)
- Modify: `backend/package.json` (one script)
- Modify: `docs/HANDOVER.md` ("What that leaves to do" and the commands), `docs/FEATURES.md` section 3.4 (one row), `CLAUDE.md` Commands block (one line)
- Test: `backend/test/jobs/hindcast.test.ts` already covers the job; the command line is checked by running it.

**Interfaces:**
- Consumes: `runHindcast`, `formatHindcast` (Task 5), `config.HISTORY_FROM`.
- Produces: `pnpm haze:hindcast [from] [to]`.

- [ ] **Step 1: Add the script**

In `backend/package.json`, after `"haze:evaluate"`:

```json
    "haze:hindcast": "node --env-file-if-exists=.env --import tsx src/jobs/main.ts hindcast"
```

- [ ] **Step 2: Register the command**

In `backend/src/jobs/main.ts`, add to the imports:

```ts
import { formatHindcast, runHindcast } from "./hindcast";
```

Add a line to the usage comment after `pnpm haze:evaluate`:

```
 *   pnpm haze:hindcast   replay the smoke model at 00:00 UTC of every stored day, for the learned model's
 *                        training set; writes smoke_hindcasts and skips days already there
 *                        (optional: first day, last day, as YYYY-MM-DD; default HISTORY_FROM to yesterday)
```

Add before the final `else throw`:

```ts
    } else if (command === "hindcast") {
      const yesterday = new Date(Date.now() - 24 * 3_600_000).toISOString().slice(0, 10);
      const summary = await runHindcast(deps.pool, { from: process.argv[3] ?? config.HISTORY_FROM, to: process.argv[4] ?? yesterday });
      process.stdout.write(`${formatHindcast(summary)}\n`);
```

and add `hindcast` to the list in the `unknown command` message: `Use once, backfill, loop, history, coverage, evaluate or hindcast.`

- [ ] **Step 3: Run it for two days against the development database**

Run: `cd backend && pnpm haze:hindcast 2026-10-08 2026-10-09`
Expected: two `day stored` log lines with `rows` about 189 each and `ms` in the tens of seconds, then one summary line `hindcast: 2 days, 2 stored (...)`. Run it again: `2 already stored`. Then `pnpm type-check` clean.

- [ ] **Step 4: Write the docs**

In `CLAUDE.md`, Commands block, after the `haze:coverage` line:

```
pnpm haze:hindcast                  # replay the smoke model at 00:00 UTC of each stored day into smoke_hindcasts; name a first and last day to limit it
```

In `docs/FEATURES.md` section 3.4, add a row to the table after PM2.5:

```
| Modelled smoke | Input (feature group 3) | `smoke_hindcasts` | `(as_of, instrument_id, model)`, the issue time 00:00 UTC. `smoke_now`, `smoke_24h`, `smoke_48h` are the ensemble-mean smoke within 50 km as a trailing day mean, uncalibrated, in the model's units. `model` names the method and the wind: `v2-analysis` is the stored analysis wind, the known leak. | Every instrument of `services/instruments.ts` |
```

and one bullet under "What to know before fitting anything to it":

```
- **The smoke hindcast is uncalibrated and on the analysis wind.** It is the physics' own view of where smoke was and would be, in its own units; the learned model fits the gain. A hindcast on the forecast wind needs `weather_forecasts` to have filled first, and will carry a different `model` name.
```

In `docs/HANDOVER.md`, in the list "What that leaves to do", add:

```
5. Run `pnpm haze:hindcast` once over the stored history (about an hour or two: one ensemble run per day since June 2025). It resumes where it stopped. The learned model's phase 2 training reads the result.
```

- [ ] **Step 5: Run the whole backend suite and commit**

Run: `cd backend && pnpm test && pnpm type-check`
Expected: every file passes (the count grows by the new tests); type-check clean.

```bash
git add backend/package.json backend/src/jobs/main.ts CLAUDE.md docs/FEATURES.md docs/HANDOVER.md
git commit -m "Add pnpm haze:hindcast and document the smoke hindcast as training input

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 7: Fill the history

**Files:** none changed. This is the run that makes track D's phase 2 possible.

- [ ] **Step 1: Start the full run in the background from the host**

Run from `backend/`: `nohup pnpm haze:hindcast > /tmp/claude-0/-root-ai-dorm-haze-app/9e465f4c-634c-4218-bd85-469f2e37fe0c/scratchpad/hindcast.log 2>&1 &`
Expected: the log fills with one `day stored` line per day. Days before the wind begins (June 2025) log `day skipped` with `why: no-wind`; the first three days after it log `short-spin-up`.

- [ ] **Step 2: Check progress and the result without writing anything**

Run: `tail -3 <the log>` now and then. When the summary line prints, count what is stored through the repository's own read in a one-off script, or by `pnpm haze:coverage` once track B extends it; until then the summary line is the record. Report the summary line and the elapsed time to the parent.

- [ ] **Step 3: Nothing to commit**

The rows live in the database and are not in the seed. Note in the hand-back that `pnpm db:export-seed` does not carry `smoke_hindcasts`, so a teammate reruns the job.

---

## Self-review

**Spec coverage.** 8.4: a job at each daily issue time, through `loadRunInput` with the leak controls (Task 4), three numbers per instrument (Task 4), skipping stored days for the current version (Task 5), analysis wind recorded in `model` (Task 4), the command `pnpm haze:hindcast [from] [to]` (Task 6). 8.2 `smoke_hindcasts` (Task 1). Group 3 features need `smoke_now`, 24 and 48 hours and the change, which track A computes from these three columns. Track C's row in section 11 depends on B's migration, met by the identical-bytes rule in Task 1. Not in this plan, by the spec: the hindcast on forecast wind (needs `weather_forecasts` to fill first; noted in the docs bullet).

**Placeholders.** None: every step carries its code or its exact command.

**Type consistency.** `SmokeHindcast` fields (`asOf`, `instrumentId`, `smokeNow`, `smoke24h`, `smoke48h`, `model`) match between Task 2, Task 4 and the tests. `Instrument` and `InstrumentKind` match between Task 3, Task 4 and Task 5. `hindcastDay` returns `{ rows, outside } | DaySkip` in Task 4 and is read with `typeof result === "string"` in Task 5. `HindcastSummary` has the six fields the formatter and the tests use.

**Review Focus.** Items 1, 2, 4 and 5 are pinned in Task 5's tests; item 3 in Task 4's. One further input, checked and accepted: a day with wind but no fires at all stores rows of zeros, which is the truthful answer and is what the learned model should see; the Task 4 "finite and at least zero" assertion covers it.
