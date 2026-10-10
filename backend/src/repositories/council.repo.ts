import type { RunStatus } from "../contracts";
import type { Queryable } from "../db";
import { GRID_KEY } from "../haze/grid";
import { MODEL_VERSION } from "../haze/run";

/**
 * The Suppression Council's reads and writes: what the council needs from the
 * stored model runs and fires, and its own runs and their event log.
 */

export interface RunCalibration {
  asOf: Date;
  intercept: number;
  slope: number;
}

/** The newest model run on the current grid and method, with the line that turns its smoke into ug/m3. */
export async function latestCalibration(db: Queryable): Promise<RunCalibration | null> {
  const { rows } = await db.query<{ as_of: Date; intercept: number; slope: number }>(
    "select as_of, intercept, slope from forecast_runs where grid = $1 and model = $2 order by as_of desc, id desc limit 1",
    [GRID_KEY, MODEL_VERSION],
  );
  return rows[0] ? { asOf: rows[0].as_of, intercept: rows[0].intercept, slope: rows[0].slope } : null;
}

/** For every cell that burned between the two days, how many days it burned. */
export async function daysBurning(db: Queryable, fromDay: string, toDay: string): Promise<Map<string, number>> {
  const { rows } = await db.query<{ lat10: number; lon10: number; days: number }>(
    `select lat10, lon10, count(distinct day)::int as days from fire_cells
      where day between $1 and $2 and coalesce(burning_mw, frp_mw) > 0 group by lat10, lon10`,
    [fromDay, toDay],
  );
  return new Map(rows.map((row) => [`${row.lat10}|${row.lon10}`, row.days]));
}

// Runs and their event log ---------------------------------------------------

interface RunRow {
  id: string;
  target: string;
  budget_rm: string | null;
  status: RunStatus;
  as_of: Date | null;
  created_at: Date;
  started_at: Date | null;
  finished_at: Date | null;
  verdict: unknown;
  error: string | null;
}

export interface StoredRun {
  id: number;
  target: string;
  budgetRm: number | null;
  status: RunStatus;
  asOf: string | null;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  /** As stored; the route parses it against the contract. */
  verdict: unknown;
  error: string | null;
}

const RUN_COLUMNS = "id, target, budget_rm, status, as_of, created_at, started_at, finished_at, verdict, error";
const iso = (at: Date | null) => (at ? at.toISOString() : null);
const toRun = (row: RunRow): StoredRun => ({
  id: Number(row.id),
  target: row.target,
  budgetRm: row.budget_rm === null ? null : Number(row.budget_rm),
  status: row.status,
  asOf: iso(row.as_of),
  createdAt: row.created_at.toISOString(),
  startedAt: iso(row.started_at),
  finishedAt: iso(row.finished_at),
  verdict: row.verdict,
  error: row.error,
});

/** Queues a run; null where one is already queued or running (the unique index says no). */
export async function queue(db: Queryable, target: string, budgetRm: number): Promise<StoredRun | null> {
  const { rows } = await db.query<RunRow>(
    `insert into council_runs (target, budget_rm, status) values ($1, $2, 'queued') on conflict do nothing returning ${RUN_COLUMNS}`,
    [target, budgetRm],
  );
  return rows[0] ? toRun(rows[0]) : null;
}

/** Takes the oldest queued run and marks it running; null where there is none. */
export async function claimNext(db: Queryable): Promise<StoredRun | null> {
  const { rows } = await db.query<RunRow>(
    `update council_runs set status = 'running', started_at = now()
      where id = (select id from council_runs where status = 'queued' order by id limit 1 for update skip locked)
      returning ${RUN_COLUMNS}`,
  );
  return rows[0] ? toRun(rows[0]) : null;
}

export async function setAsOf(db: Queryable, id: number, asOf: Date): Promise<void> {
  await db.query("update council_runs set as_of = $2 where id = $1", [id, asOf]);
}

export async function finish(db: Queryable, id: number, verdict: unknown): Promise<void> {
  await db.query("update council_runs set status = 'done', finished_at = now(), verdict = $2 where id = $1", [id, JSON.stringify(verdict)]);
}

export async function fail(db: Queryable, id: number, error: string): Promise<void> {
  await db.query("update council_runs set status = 'failed', finished_at = now(), error = $2 where id = $1", [id, error]);
}

export async function list(db: Queryable, limit = 20): Promise<StoredRun[]> {
  const { rows } = await db.query<RunRow>(`select ${RUN_COLUMNS} from council_runs order by id desc limit $1`, [limit]);
  return rows.map(toRun);
}

export async function find(db: Queryable, id: number): Promise<StoredRun | null> {
  const { rows } = await db.query<RunRow>(`select ${RUN_COLUMNS} from council_runs where id = $1`, [id]);
  return rows[0] ? toRun(rows[0]) : null;
}

export interface StoredEvent {
  seq: number;
  at: string;
  kind: string;
  actor: string;
  payload: unknown;
}

export async function appendEvent(db: Queryable, runId: number, event: { seq: number; kind: string; actor: string; payload: unknown }): Promise<void> {
  await db.query("insert into council_events (run_id, seq, kind, actor, payload) values ($1, $2, $3, $4, $5)", [
    runId,
    event.seq,
    event.kind,
    event.actor,
    JSON.stringify(event.payload),
  ]);
}

/** The run's events after `after` (exclusive), oldest first. */
export async function eventsAfter(db: Queryable, runId: number, after: number, limit = 2000): Promise<StoredEvent[]> {
  const { rows } = await db.query<{ seq: number; at: Date; kind: string; actor: string; payload: unknown }>(
    "select seq, at, kind, actor, payload from council_events where run_id = $1 and seq > $2 order by seq limit $3",
    [runId, after, limit],
  );
  return rows.map((row) => ({ seq: row.seq, at: row.at.toISOString(), kind: row.kind, actor: row.actor, payload: row.payload }));
}

/**
 * Closes runs left "running" by a worker that died: each gets a last
 * `run_failed` event and is marked failed, so the one-active-run rule stops
 * refusing new runs. Only for a worker starting up, when nothing can be
 * running; there is one worker.
 */
export async function failAbandoned(db: Queryable, reason: string): Promise<number[]> {
  const { rows } = await db.query<{ id: string }>("select id from council_runs where status = 'running'");
  for (const { id } of rows) {
    await db.query(
      `insert into council_events (run_id, seq, kind, actor, payload)
        values ($1, coalesce((select max(seq) + 1 from council_events where run_id = $1), 0), 'run_failed', 'system', $2)`,
      [id, JSON.stringify({ error: reason })],
    );
    await fail(db, Number(id), reason);
  }
  return rows.map((row) => Number(row.id));
}
