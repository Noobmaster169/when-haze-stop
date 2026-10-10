import type { Statement, StatementAction, StatementIssuer, StatementKind, StatementStatus } from "../contracts";
import { flatten } from "./statement-text";

/**
 * Which statements are one, which are still in force, and which areas they
 * cover. Pure: the service hands in what is stored and today's date.
 */

/** A verified statement as stored, one per fetched item. */
export interface StoredStatement {
  id: number;
  url: string;
  channel: string;
  outlet: string;
  publishedAt: Date;
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
}

/** Advice and a lift have no end of their own; they are news for this many days. */
const NEWS_DAYS = 2;
/**
 * A closure with no stated end runs "until further notice", and a reopening is
 * reported less than a closing. Past this many days without a word it is no
 * longer called in force.
 */
const OPEN_ORDER_DAYS = 7;
const ORIGINALS = new Set(["moe-statements", "doe-statements"]);

function addDays(day: string, days: number): string {
  return new Date(Date.parse(`${day}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);
}

function malaysianDay(at: Date): string {
  return new Date(at.getTime() + 8 * 3_600_000).toISOString().slice(0, 10);
}

/**
 * Reports of one decision are one statement. A rule is its line. An order is
 * who decided what for which day: "schools close on 9 October" reached the
 * press as five headlines each naming some of the states, and is one decision
 * covering all of them.
 */
/** Issuers that are one body each. "state", "ruler" and "other" are kinds of body, so their name says which. */
const SINGLE_BODIES: ReadonlySet<StatementIssuer> = new Set(["moe", "doe", "nadma", "moh", "federal"]);

function sameKey(statement: StoredStatement): string {
  const { kind, action } = statement;
  const issuer = SINGLE_BODIES.has(statement.issuer) ? statement.issuer : `${statement.issuer}:${flatten(statement.issuerName)}`;
  if (kind === "rule") return [issuer, kind, action, statement.threshold, statement.sustainedDays ?? 1].join("|");
  return [issuer, kind, action, statement.effectiveFrom ?? malaysianDay(statement.publishedAt)].join("|");
}

function union(lists: string[][]): string[] {
  return [...new Set(lists.flat())];
}

/** The group's areas, every report's together. */
function merged(group: StoredStatement[]): StoredStatement {
  const first = group[0];
  const districts = new Map(group.flatMap((item) => item.districts).map((district) => [flatten(district), district]));
  const ends = group.map((item) => item.effectiveUntil);
  return {
    ...first,
    nationwide: group.some((item) => item.nationwide),
    states: union(group.map((item) => item.states)),
    districts: [...districts.values()],
    // One report naming no end means the end is not agreed: it runs until further notice.
    effectiveUntil: ends.every((end) => end !== null) ? (ends.sort().at(-1) ?? null) : null,
  };
}

function covering(later: StoredStatement, earlier: StoredStatement): boolean {
  if (later.nationwide) return true;
  if (earlier.nationwide) return false;
  return earlier.states.every((state) => later.states.includes(state)) && earlier.districts.every((district) => later.districts.map(flatten).includes(flatten(district)));
}

function overlaps(a: StoredStatement, b: StoredStatement): boolean {
  if (a.nationwide || b.nationwide) return true;
  return a.states.some((state) => b.states.includes(state)) || a.districts.some((district) => b.districts.map(flatten).includes(flatten(district)));
}

function statusOf(statement: StoredStatement, later: StoredStatement[], all: StoredStatement[], today: string): StatementStatus {
  const { kind, action, issuer } = statement;
  if (kind === "rule") {
    const replaced = later.some((other) => other.kind === "rule" && other.issuer === issuer && other.action === action && (other.sustainedDays ?? 1) === (statement.sustainedDays ?? 1));
    if (replaced) return "replaced";
  }
  if (kind === "order" && !statement.effectiveFrom) {
    // A report with no start date is the dated decision of that day, told less fully.
    const dated = all.some((other) => other !== statement && other.kind === "order" && other.issuer === issuer && other.action === action && other.effectiveFrom !== null && covering(other, statement) && Math.abs(other.publishedAt.getTime() - statement.publishedAt.getTime()) <= 86_400_000);
    if (dated) return "replaced";
  }
  if (kind === "order") {
    // "Schools reopen on Monday" ends the closure on Monday, not on the day it was said.
    const lifted = later.some((other) => (other.kind === "lift" || other.action === "reopen") && overlaps(other, statement) && (other.effectiveFrom ?? malaysianDay(other.publishedAt)) <= today);
    if (lifted) return "ended";
    if (later.some((other) => other.kind === "order" && other.action === action && covering(other, statement))) return "replaced";
  }
  const from = statement.effectiveFrom;
  if (from && from > today) return "upcoming";
  const start = from ?? malaysianDay(statement.publishedAt);
  const fallback = kind === "advice" || kind === "lift" ? addDays(start, NEWS_DAYS) : kind === "order" ? addDays(start, OPEN_ORDER_DAYS) : null;
  const until = statement.effectiveUntil ?? fallback;
  return until && until < today ? "ended" : "in-force";
}

/**
 * Whether a reading can be acted on. An order or a lift must say where: "Malaysia
 * closes schools in several states" names nothing a station can be matched to.
 * And a headline cannot make an order nationwide; international reports call a
 * closure in six states "nationwide", so only a ministry or DOE original can.
 */
export function usable(statement: StoredStatement): boolean {
  if (statement.kind !== "order" && statement.kind !== "lift") return true;
  if (statement.nationwide) return ORIGINALS.has(statement.channel);
  return statement.states.length > 0 || statement.districts.length > 0;
}

/** Every statement once, newest first, each with its status on `today` (a Malaysian `YYYY-MM-DD`). */
export function resolveStatements(stored: StoredStatement[], today: string): Statement[] {
  const groups = new Map<string, StoredStatement[]>();
  for (const statement of stored.filter(usable).sort((a, b) => a.publishedAt.getTime() - b.publishedAt.getTime() || a.id - b.id)) {
    const key = sameKey(statement);
    groups.set(key, [...(groups.get(key) ?? []), statement]);
  }
  const firsts = [...groups.values()].map(merged);

  const resolved = [...groups.values()].map((group, index): Statement => {
    const first = firsts[index];
    const later = firsts.filter((other) => other !== first && other.publishedAt > first.publishedAt);
    // The ministry's own copy when one was fetched, else the report that names the most areas.
    const widest = [...group].sort((a, b) => b.states.length + b.districts.length - (a.states.length + a.districts.length))[0];
    const link = group.find((item) => ORIGINALS.has(item.channel)) ?? widest;
    return {
      id: first.id,
      issuer: first.issuer,
      issuerName: first.issuerName,
      kind: first.kind,
      action: first.action,
      summary: link.summary,
      quote: link.quote,
      states: first.states,
      districts: first.districts,
      nationwide: first.nationwide,
      threshold: first.threshold,
      sustainedDays: first.sustainedDays,
      effectiveFrom: first.effectiveFrom,
      effectiveUntil: first.effectiveUntil,
      publishedAt: first.publishedAt.toISOString(),
      url: link.url,
      outlet: link.outlet,
      reports: group.length,
      status: statusOf(first, later, firsts, today),
    };
  });
  return resolved.sort((a, b) => b.publishedAt.localeCompare(a.publishedAt) || b.id - a.id);
}
