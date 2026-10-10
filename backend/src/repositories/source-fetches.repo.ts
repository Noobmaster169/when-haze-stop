import type { FetchDetail, SourceFetch } from "../contracts";
import type { Queryable } from "../db";

/** One row per fetch of an outside source. Insert only. */

export interface NewSourceFetch {
  source: string;
  startedAt: Date;
  finishedAt: Date;
  ok: boolean;
  detail: FetchDetail;
  error: string | null;
}

interface FetchRow {
  id: string;
  source: string;
  started_at: Date;
  finished_at: Date;
  ok: boolean;
  detail: FetchDetail;
  error: string | null;
}

const COLUMNS = "id, source, started_at, finished_at, ok, detail, error";

function toFetch(row: FetchRow): SourceFetch {
  return {
    id: Number(row.id),
    source: row.source,
    startedAt: row.started_at.toISOString(),
    finishedAt: row.finished_at.toISOString(),
    ok: row.ok,
    detail: row.detail,
    error: row.error,
  };
}

export async function insert(db: Queryable, fetch: NewSourceFetch): Promise<void> {
  await db.query("insert into source_fetches (source, started_at, finished_at, ok, detail, error) values ($1, $2, $3, $4, $5, $6)", [
    fetch.source,
    fetch.startedAt,
    fetch.finishedAt,
    fetch.ok,
    JSON.stringify(fetch.detail),
    fetch.error,
  ]);
}

/** Each source's newest success and newest failure. */
export async function latest(db: Queryable): Promise<SourceFetch[]> {
  const { rows } = await db.query<FetchRow>(
    `select distinct on (source, ok) ${COLUMNS} from source_fetches order by source, ok, started_at desc`,
  );
  return rows.map(toFetch);
}

export async function recent(db: Queryable, limit: number): Promise<SourceFetch[]> {
  const { rows } = await db.query<FetchRow>(`select ${COLUMNS} from source_fetches order by started_at desc, id desc limit $1`, [limit]);
  return rows.map(toFetch);
}

/** How many fetches of each source worked and failed since an instant. */
export async function countsSince(db: Queryable, since: Date): Promise<Map<string, { ok: number; failed: number }>> {
  const { rows } = await db.query<{ source: string; ok: string; failed: string }>(
    `select source, count(*) filter (where ok) as ok, count(*) filter (where not ok) as failed
       from source_fetches where started_at >= $1 group by source`,
    [since],
  );
  return new Map(rows.map((row) => [row.source, { ok: Number(row.ok), failed: Number(row.failed) }]));
}

/** What every good fetch of one source brought back, so a job that was stopped half way can tell what it already has. */
export async function succeeded(db: Queryable, source: string): Promise<FetchDetail[]> {
  const { rows } = await db.query<{ detail: FetchDetail }>("select detail from source_fetches where source = $1 and ok", [source]);
  return rows.map((row) => row.detail);
}
