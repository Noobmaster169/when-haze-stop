import type { StatementAction, StatementIssuer, StatementKind } from "../contracts";
import type { Queryable } from "../db";
import type { StoredStatement } from "../haze/statements";

/** Every fetched item about the haze, as the model read it. Insert only. */

export interface NewStatement {
  url: string;
  channel: string;
  outlet: string;
  title: string;
  publishedAt: Date;
  isStatement: boolean;
  verified: boolean;
  issuer: StatementIssuer;
  issuerName: string;
  kind: StatementKind;
  action: StatementAction;
  audience: string;
  states: string[];
  districts: string[];
  nationwide: boolean;
  threshold: number | null;
  sustainedDays: number | null;
  effectiveFrom: string | null;
  effectiveUntil: string | null;
  summary: string;
  quote: string;
  promptVersion: string;
}

/** Of these URLs, the ones already read. */
export async function knownUrls(db: Queryable, urls: string[]): Promise<Set<string>> {
  if (urls.length === 0) return new Set();
  const { rows } = await db.query<{ url: string }>("select url from statements where url = any($1)", [urls]);
  return new Set(rows.map((row) => row.url));
}

/** A URL read twice keeps its first reading. Returns whether this one was new. */
export async function insert(db: Queryable, statement: NewStatement): Promise<boolean> {
  const s = statement;
  const { rowCount } = await db.query(
    `insert into statements (url, channel, outlet, title, published_at, is_statement, verified, issuer, issuer_name, kind, action, audience,
       states, districts, nationwide, threshold, sustained_days, effective_from, effective_until, summary, quote, prompt_version)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22)
     on conflict (url) do nothing`,
    [
      s.url, s.channel, s.outlet, s.title, s.publishedAt, s.isStatement, s.verified, s.issuer, s.issuerName, s.kind, s.action, s.audience,
      s.states, s.districts, s.nationwide, s.threshold, s.sustainedDays, s.effectiveFrom, s.effectiveUntil, s.summary, s.quote, s.promptVersion,
    ],
  );
  return (rowCount ?? 0) > 0;
}

interface Row {
  id: string;
  url: string;
  channel: string;
  outlet: string;
  published_at: Date;
  issuer: StatementIssuer;
  issuer_name: string;
  kind: StatementKind;
  action: StatementAction;
  audience: string;
  states: string[];
  districts: string[];
  nationwide: boolean;
  threshold: number | null;
  sustained_days: number | null;
  effective_from: string | null;
  effective_until: string | null;
  summary: string;
  quote: string;
}

/** Statements the model found and whose quote was in the text: the only ones ever shown. */
export async function verified(db: Queryable): Promise<StoredStatement[]> {
  const { rows } = await db.query<Row>(
    `select id, url, channel, outlet, published_at, issuer, issuer_name, kind, action, audience, states, districts, nationwide, threshold,
            sustained_days, to_char(effective_from, 'YYYY-MM-DD') as effective_from, to_char(effective_until, 'YYYY-MM-DD') as effective_until, summary, quote
       from statements where is_statement and verified order by published_at, id`,
  );
  return rows.map((row) => ({
    id: Number(row.id),
    url: row.url,
    channel: row.channel,
    outlet: row.outlet,
    publishedAt: row.published_at,
    issuer: row.issuer,
    issuerName: row.issuer_name,
    kind: row.kind,
    action: row.action,
    audience: row.audience,
    states: row.states,
    districts: row.districts,
    nationwide: row.nationwide,
    threshold: row.threshold,
    sustainedDays: row.sustained_days,
    effectiveFrom: row.effective_from,
    effectiveUntil: row.effective_until,
    summary: row.summary,
    quote: row.quote,
  }));
}
