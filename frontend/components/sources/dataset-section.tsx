import { Icon } from "@/components/ui/icons";
import type { SourceFetchPage, SourceStatus } from "@/lib/api/source-schemas";
import { malaysiaClock } from "@/lib/malaysia-time";

import type { Dataset } from "./datasets";
import { FetchHistory } from "./fetch-history";
import { FetchStrip } from "./fetch-strip";
import { ago, lastAttempt, nextFetch, STATE_TONE, worstState } from "./source-state";

/** One kind of data: what it is, its numbers from the newest fetch, when it arrives, and its history. */

export function DatasetSection({ dataset, sources, page, params, now }: { dataset: Dataset; sources: readonly SourceStatus[]; page: SourceFetchPage | null; params: Record<string, string>; now: Date }) {
  const members = sources.filter((source) => dataset.members.includes(source.id));
  const main = members.find((source) => source.id === dataset.history);
  const tone = STATE_TONE[worstState(members, now)];
  const detailOf = (id: string) => members.find((source) => source.id === id)?.lastSuccess?.detail ?? null;
  const last = main ? lastAttempt(main) : null;
  const next = main ? nextFetch(main) : null;

  return (
    <section id={`section-${dataset.key}`} aria-labelledby={`dataset-${dataset.key}`} className="scroll-mt-16 border-t border-hairline py-8 lg:scroll-mt-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-md bg-sunken text-ink-secondary">
            <Icon name={dataset.icon} size={18} />
          </span>
          <div>
            <h2 id={`dataset-${dataset.key}`} className="font-display text-[22px] leading-7 text-ink">
              {dataset.title}
            </h2>
            <p className="mt-1 max-w-[60ch] text-body text-ink-secondary">{dataset.what}</p>
          </div>
        </div>
        <span className={`inline-flex items-center gap-1.5 rounded-sm border px-2 py-0.5 text-caption font-medium ${tone.chip}`}>
          <Icon name={tone.icon} size={12} />
          {tone.label}
        </span>
      </div>

      {main?.lastSuccess ? (
        <dl className="mt-6 grid grid-cols-2 gap-x-6 gap-y-5 sm:grid-cols-4">
          {dataset.stats(detailOf).map((stat) => (
            <div key={stat.label} className="flex flex-col-reverse">
              <dt className="mt-1 flex items-center gap-1.5 text-caption text-ink-tertiary">
                <Icon name={stat.icon} size={13} />
                {stat.label}
              </dt>
              <dd className="font-display text-[28px] leading-8 text-ink">{stat.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}

      <div className="mt-6 flex flex-wrap gap-x-8 gap-y-2 text-small">
        <span className="flex items-center gap-1.5 text-ink-secondary">
          <Icon name="clock" size={13} className="text-ink-tertiary" />
          {last ? `${last.ok ? "Last fetched" : "Last tried"} ${malaysiaClock(last.startedAt)}, ${ago(last.startedAt, now)}` : "Not fetched yet"}
        </span>
        {next ? (
          <span className="flex items-center gap-1.5 text-ink-secondary">
            <Icon name="calendar" size={13} className="text-ink-tertiary" />
            {next > now.getTime() ? `Next about ${malaysiaClock(next)}` : "Next fetch is due"}
          </span>
        ) : null}
      </div>
      {main ? <FetchStrip marks={main.marks} now={now} /> : null}

      <FetchHistory dataset={dataset} page={page} params={params} />
    </section>
  );
}
