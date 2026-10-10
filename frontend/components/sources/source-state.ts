import type { SourceFetch, SourceStatus } from "@/lib/api/source-schemas";

/** Whether a source is being fetched as it should be, and how that reads on the page. */

export type SourceState = "fresh" | "late" | "failing" | "never" | "untracked";

/** A cycle starts at 20 past and can take minutes, so a fetch is late only well after the next one was due. */
const GRACE_MS = 30 * 60_000;
const HOUR_MS = 3_600_000;

export function sourceState(source: SourceStatus, now: Date): SourceState {
  if (!source.tracked) return "untracked";
  const { lastSuccess, lastFailure } = source;
  if (lastFailure && (!lastSuccess || lastFailure.startedAt > lastSuccess.startedAt)) return "failing";
  if (!lastSuccess) return "never";
  if (source.everyHours === null) return "fresh";
  const age = now.getTime() - new Date(lastSuccess.finishedAt).getTime();
  return age > 2 * source.everyHours * HOUR_MS + GRACE_MS ? "late" : "fresh";
}

const WORST_FIRST: SourceState[] = ["failing", "late", "never", "fresh", "untracked"];

/** A dataset is as healthy as its least healthy fetch. */
export function worstState(sources: readonly SourceStatus[], now: Date): SourceState {
  const states = sources.map((source) => sourceState(source, now));
  return WORST_FIRST.find((state) => states.includes(state)) ?? "never";
}

export const STATE_TONE: Record<SourceState, { label: string; chip: string; dot: string; icon: "check" | "alert" | "clock" }> = {
  fresh: { label: "Up to date", chip: "border-match-line bg-match-tint text-match", dot: "bg-match", icon: "check" },
  late: { label: "Late", chip: "border-differ-line bg-differ-tint text-differ", dot: "bg-differ", icon: "clock" },
  failing: { label: "Last fetch failed", chip: "border-fault-line bg-fault-tint text-fault", dot: "bg-fault", icon: "alert" },
  never: { label: "Not fetched yet", chip: "border-hairline-strong bg-sunken text-ink-tertiary", dot: "bg-ink-faint", icon: "clock" },
  untracked: { label: "Not scheduled", chip: "border-hairline-strong bg-sunken text-ink-tertiary", dot: "bg-ink-faint", icon: "clock" },
};

/** The newest attempt, good or failed. */
export function lastAttempt(source: SourceStatus): SourceFetch | null {
  const { lastSuccess, lastFailure } = source;
  if (!lastSuccess || !lastFailure) return lastSuccess ?? lastFailure;
  return lastFailure.startedAt > lastSuccess.startedAt ? lastFailure : lastSuccess;
}

/** The jobs process wakes at this minute of every hour (backend/src/jobs/main.ts). */
const CYCLE_MINUTE = 20;

/**
 * When the next fetch should start: the first cycle at 20 past that is a full
 * interval on from the last attempt. Null for a source with no schedule or no
 * attempt yet.
 */
export function nextFetch(source: SourceStatus): number | null {
  const last = lastAttempt(source);
  if (!last || source.everyHours === null) return null;
  const earliest = new Date(last.startedAt).getTime() + (source.everyHours - 1) * HOUR_MS;
  const onMark = Math.floor(earliest / HOUR_MS) * HOUR_MS + CYCLE_MINUTE * 60_000;
  return onMark > earliest ? onMark : onMark + HOUR_MS;
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
