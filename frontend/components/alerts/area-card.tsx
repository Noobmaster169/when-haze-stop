import Link from "next/link";

import { Icon } from "@/components/ui/icons";
import type { AreaCard as Area } from "@/lib/api/alert-schemas";
import { dayName } from "@/lib/malaysia-time";

import { HEADLINE_TEXT, TONE } from "./alert-tone";
import { DayStrip } from "./day-strip";

/** One followed area: tomorrow's forecast as the headline, four days of peaks, and any order in force there. */
export function AreaCardView({ area, onStop }: { area: Area; onStop(): void }) {
  const edge = area.alert ? `border-l-[3px] ${TONE[area.alert.kind].edge}` : "";
  return (
    <article id={`area-${area.stationId}`} className={`scroll-mt-20 rounded-lg border border-hairline bg-surface p-4 ${edge}`}>
      <header className="flex items-baseline gap-2">
        <h3 className="min-w-0 truncate text-title font-medium text-ink">{area.stationName}</h3>
        <span className="text-caption text-ink-tertiary">{area.state}</span>
        <span className="grow" />
        {area.api !== null ? <span className="text-small text-ink-secondary tabular-nums">API {area.api} now</span> : null}
        <button type="button" onClick={onStop} aria-label={`Stop following ${area.stationName}`} className="-mr-1 flex h-6 w-6 items-center justify-center self-center rounded-sm text-ink-tertiary hover:bg-active hover:text-ink">
          <Icon name="close" size={12} />
        </button>
      </header>

      <p className={`mt-3 font-display text-[19px] leading-6 ${HEADLINE_TEXT[area.headline.tone]}`}>{area.headline.title}</p>
      <p className="mt-0.5 text-small text-ink-secondary">{area.headline.sentence}</p>

      <div className="mt-3">
        <DayStrip days={area.days} />
      </div>

      {area.orders.length > 0 ? (
        <ul className="mt-3 space-y-1.5 border-t border-hairline-faint pt-3">
          {area.orders.map((order) => (
            <li key={order.id} className="flex items-start gap-2 text-small">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-fault" aria-hidden />
              <p className="min-w-0 grow text-ink">
                <span className="font-medium">{order.issuerName}:</span> {order.summary}
                {order.status === "upcoming" && order.effectiveFrom ? <span className="text-ink-tertiary"> From {dayName(order.effectiveFrom)}.</span> : null}
              </p>
              <a href={order.url} target="_blank" rel="noreferrer" aria-label="Read the original" className="mt-0.5 shrink-0 text-ink-tertiary hover:text-accent">
                <Icon name="external" size={13} />
              </a>
            </li>
          ))}
        </ul>
      ) : null}

      <Link href={`/map?station=${encodeURIComponent(area.stationId)}`} className="mt-3 inline-flex items-center gap-1 text-small text-ink-tertiary hover:text-accent">
        View on map
        <Icon name="right" size={12} />
      </Link>
    </article>
  );
}
