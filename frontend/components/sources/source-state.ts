import type { FetchDetail, SourceFetch, SourceStatus } from "@/lib/api/source-schemas";
import { formatWhenShort } from "@/lib/when";

/** Whether a source is being fetched as it should be, and how that reads on the page. */

export type SourceState = "fresh" | "late" | "failing" | "never" | "untracked";

/** A cycle starts at 20 past and can take minutes, so a fetch is late only well after the next one was due. */
const GRACE_MS = 30 * 60_000;

export function sourceState(source: SourceStatus, now: Date): SourceState {
  if (!source.tracked) return "untracked";
  const { lastSuccess, lastFailure } = source;
  if (lastFailure && (!lastSuccess || lastFailure.startedAt > lastSuccess.startedAt)) return "failing";
  if (!lastSuccess) return "never";
  if (source.everyHours === null) return "fresh";
  const age = now.getTime() - new Date(lastSuccess.finishedAt).getTime();
  return age > 2 * source.everyHours * 3_600_000 + GRACE_MS ? "late" : "fresh";
}

export const STATE_TONE: Record<SourceState, { label: string; chip: string }> = {
  fresh: { label: "Up to date", chip: "border-match-line bg-match-tint text-match" },
  late: { label: "Late", chip: "border-differ-line bg-differ-tint text-differ" },
  failing: { label: "Last fetch failed", chip: "border-fault-line bg-fault-tint text-fault" },
  never: { label: "Not fetched yet", chip: "border-hairline-strong bg-sunken text-ink-tertiary" },
  untracked: { label: "Not scheduled", chip: "border-hairline-strong bg-sunken text-ink-tertiary" },
};

const LABELS: Record<string, string> = {
  stations: "stations",
  states: "states",
  daysBack: "days asked",
  requests: "requests",
  emptyAnswers: "empty answers",
  received: "readings received",
  added: "new readings",
  newestReading: "newest reading",
  hoursAsked: "hours asked",
  daysAsked: "days asked",
  airports: "airports",
  reports: "reports",
  newestReport: "newest report",
  feed: "feed",
  satellite: "satellite",
  sites: "fixed sources known",
  days: "days",
  detections: "detections",
  glintDropped: "dropped as sun glint",
  offshoreDropped: "dropped as offshore",
  fixedDropped: "dropped as fixed sources",
  fixedSeen: "fixed source sightings",
  fixedAdded: "new sightings",
  cellDays: "fire cell-days",
  firstDay: "first day",
  lastDay: "last day",
  points: "grid points",
  hours: "hours",
  from: "from",
  to: "to",
};

const ISO_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/;

const ORDER = Object.keys(LABELS);

/** Where a key sits in reading order. Postgres jsonb stores keys shortest first, so the stored order means nothing. */
function rank(key: string): number {
  const at = ORDER.indexOf(key);
  return at < 0 ? ORDER.length : at;
}

/** A fetch's detail as label and value pairs in reading order, times in the page's one zone (UTC). */
export function describeDetail(detail: FetchDetail): { label: string; value: string }[] {
  const entries = Object.entries(detail).sort(([a], [b]) => rank(a) - rank(b));
  return entries.map(([key, value]) => ({
    label: LABELS[key] ?? key,
    value: typeof value === "number" ? value.toLocaleString("en-GB") : ISO_TIME.test(value) ? formatWhenShort(value) : value,
  }));
}

/** "4.2 s" or "3 min 10 s". */
export function duration(fetch: SourceFetch): string {
  const seconds = (new Date(fetch.finishedAt).getTime() - new Date(fetch.startedAt).getTime()) / 1000;
  if (seconds < 60) return `${seconds.toFixed(1)} s`;
  return `${Math.floor(seconds / 60)} min ${Math.round(seconds % 60)} s`;
}

/** "12 min ago", "3 h ago", "2 d ago". */
export function ago(iso: string, now: Date): string {
  const minutes = Math.max(0, Math.round((now.getTime() - new Date(iso).getTime()) / 60_000));
  if (minutes < 60) return `${minutes} min ago`;
  if (minutes < 48 * 60) return `${Math.round(minutes / 60)} h ago`;
  return `${Math.round(minutes / 1440)} d ago`;
}
