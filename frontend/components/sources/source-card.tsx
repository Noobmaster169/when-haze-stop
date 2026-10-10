import type { SourceFetch, SourceStatus } from "@/lib/api/source-schemas";
import { formatWhen } from "@/lib/when";

import { ago, describeDetail, duration, STATE_TONE, sourceState } from "./source-state";

/** One source: what it is, where it is asked, and its newest good and failed fetch. */

function FetchLine({ label, fetch, now }: { label: string; fetch: SourceFetch; now: Date }) {
  return (
    <div className="mt-3">
      <p className="text-caption text-ink-tertiary">
        {label}: <span className="text-ink-secondary">{formatWhen(fetch.finishedAt)} UTC</span> ({ago(fetch.finishedAt, now)}, took {duration(fetch)})
      </p>
      {fetch.ok ? (
        <dl className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-small">
          {describeDetail(fetch.detail).map(({ label: name, value }) => (
            <div key={name} className="flex gap-1.5">
              <dt className="text-ink-tertiary">{name}</dt>
              <dd className="font-mono text-mono text-ink">{value}</dd>
            </div>
          ))}
        </dl>
      ) : (
        <p className="mt-1 text-small text-fault">{fetch.error}</p>
      )}
    </div>
  );
}

export function SourceCard({ source, now }: { source: SourceStatus; now: Date }) {
  const tone = STATE_TONE[sourceState(source, now)];
  const failedLast = source.lastFailure && (!source.lastSuccess || source.lastFailure.startedAt > source.lastSuccess.startedAt);

  return (
    <article className="rounded-lg border border-hairline bg-canvas p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-title font-medium text-ink">{source.name}</h3>
          <a href={source.link} target="_blank" rel="noreferrer" className="text-small text-ink-secondary underline-offset-2 hover:text-accent hover:underline">
            {source.provider}
          </a>
        </div>
        <span className={`rounded-sm border px-2 py-0.5 text-caption font-medium ${tone.chip}`}>{tone.label}</span>
      </div>
      <p className="mt-2 text-body text-ink-secondary">{source.what}</p>
      <p className="mt-2 break-all font-mono text-caption text-ink-tertiary">{source.endpoint}</p>
      <p className="mt-1 text-caption text-ink-tertiary">
        {source.cadence}
        {source.tracked ? `. Last 24 hours: ${source.day.ok} fetched, ${source.day.failed} failed.` : "."}
      </p>
      {source.lastSuccess ? <FetchLine label="Last fetched" fetch={source.lastSuccess} now={now} /> : null}
      {source.lastFailure && failedLast ? <FetchLine label="Last failure" fetch={source.lastFailure} now={now} /> : null}
    </article>
  );
}
