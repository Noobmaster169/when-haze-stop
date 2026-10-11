import type { SourceStatus } from "@/lib/api/source-schemas";
import { malaysiaClock } from "@/lib/malaysia-time";

/** The last 24 hours as a line, one mark per fetch where it started: green when it worked, red when it failed. */

const DAY_MS = 86_400_000;

export function FetchStrip({ marks, now }: { marks: SourceStatus["marks"]; now: Date }) {
  const start = now.getTime() - DAY_MS;
  const failed = marks.filter((mark) => !mark.ok).length;
  const summary = `${marks.length} fetches in the last 24 hours${failed ? `, ${failed} failed` : ""}`;

  return (
    <figure className="mt-5" aria-label={summary}>
      <div className="relative h-5 rounded-xs bg-sunken">
        {marks.map((mark) => {
          const left = ((new Date(mark.at).getTime() - start) / DAY_MS) * 100;
          return (
            <span
              key={mark.at}
              title={`${malaysiaClock(mark.at)} ${mark.ok ? "fetched" : "failed"}`}
              className={`absolute top-0.5 bottom-0.5 w-[3px] -translate-x-1/2 rounded-full ${mark.ok ? "bg-match" : "bg-fault"}`}
              style={{ left: `${Math.min(100, Math.max(0, left))}%` }}
            />
          );
        })}
      </div>
      <figcaption className="mt-1 flex justify-between text-caption text-ink-tertiary">
        <span>24 hours ago</span>
        <span>{summary}</span>
        <span>Now</span>
      </figcaption>
    </figure>
  );
}
