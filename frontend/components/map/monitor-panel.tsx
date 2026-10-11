"use client";

import { Icon } from "@/components/ui/icons";
import type { AirMonitor } from "@/lib/api/haze-schemas";
import { malaysiaClock, malaysiaWhen } from "@/lib/malaysia-time";

import { FLOATING_PANEL } from "./floating-panel";
import { pm25At } from "./map-data";
import { monitorKind } from "./monitors";
import { BAND_SWATCH, band, bandKey, pm25ToApi } from "./scale";

/**
 * One instrument on a past day: what it measured in the hour the timeline is
 * on, and its 24 hours as bars in the colours of the index.
 */

const HOUR_MS = 3_600_000;
/** The bars share a scale with every other instrument, so a clean day looks clean; a worse hour raises the ceiling. */
const SCALE_UG = 150;

export function MonitorPanel({ monitor, dayStart, at, onClose }: { monitor: AirMonitor; dayStart: number; at: number; onClose(): void }) {
  const value = pm25At(monitor, dayStart, at);
  const slot = Math.min(monitor.pm25.length - 1, Math.max(0, Math.ceil((at - dayStart) / HOUR_MS) - 1));
  const ceiling = Math.max(SCALE_UG, ...monitor.pm25.map((hour) => hour ?? 0));
  const measured = monitor.pm25.filter((hour) => hour !== null).length;

  return (
    <aside aria-label={`${monitor.name}, PM2.5`} className={FLOATING_PANEL}>
      <header className="flex items-start gap-2 px-5 pt-4">
        <div className="min-w-0 grow">
          <h2 className="truncate font-display text-[21px] leading-7 text-ink">{monitor.name}</h2>
          <p className="text-caption text-ink-tertiary">{monitorKind(monitor)}</p>
        </div>
        <button type="button" onClick={onClose} aria-label="Close" className="flex h-7 w-7 shrink-0 items-center justify-center rounded-sm text-ink-tertiary hover:bg-active hover:text-ink">
          <Icon name="close" size={14} />
        </button>
      </header>

      <div className="space-y-4 px-5 pb-5 pt-3">
        {value === null ? (
          <p className="text-small text-ink-tertiary">Nothing was measured here in the hour to {malaysiaClock(dayStart + (slot + 1) * HOUR_MS)}.</p>
        ) : (
          <div className="flex items-end gap-3">
            <span className="flex items-baseline gap-1.5">
              <span className="text-strong text-ink-tertiary">PM2.5</span>
              <span className="font-display text-display-lg leading-none tabular-nums text-ink">{Math.round(value)}</span>
              <span className="text-caption text-ink-tertiary">ug/m3</span>
            </span>
            <div className="pb-0.5">
              <p className="flex items-center gap-1.5 text-strong font-medium text-ink">
                <span aria-hidden="true" className={`h-2.5 w-4 rounded-xs ${BAND_SWATCH[bandKey(pm25ToApi(value))]}`} />
                {band(pm25ToApi(value))}
              </p>
              <p className="text-caption text-ink-tertiary">
                {monitor.averaging === "24h" ? "24 hour mean to" : "Hour to"} {malaysiaWhen(dayStart + (slot + 1) * HOUR_MS)}
              </p>
            </div>
          </div>
        )}

        <div>
          <h3 className="text-strong font-medium text-ink">The day, hour by hour</h3>
          <div aria-hidden="true" className="mt-2 flex h-16 items-end gap-px border-b border-hairline-strong">
            {monitor.pm25.map((hour, index) => (
              <span key={index} className={`flex h-full min-w-0 flex-1 items-end ${index === slot ? "bg-accent-tint" : ""}`}>
                {hour === null ? null : <span className={`w-full rounded-t-[1px] ${BAND_SWATCH[bandKey(pm25ToApi(hour))]}`} style={{ height: `${Math.max(3, (hour / ceiling) * 100)}%` }} />}
              </span>
            ))}
          </div>
          <div aria-hidden="true" className="mt-1 flex justify-between font-mono text-mono-xs text-ink-tertiary">
            <span>{malaysiaClock(dayStart)}</span>
            <span>{malaysiaClock(dayStart + 12 * HOUR_MS)}</span>
            <span>{malaysiaClock(dayStart + 24 * HOUR_MS)}</span>
          </div>
          <p className="mt-1 text-caption text-ink-tertiary">
            {measured} of 24 hours measured, to a ceiling of {Math.round(ceiling)} ug/m3. The band is the one the index would be in if the value held for a day.
          </p>
        </div>

        <p className="text-small text-ink-secondary">{note(monitor)}</p>
      </div>
    </aside>
  );
}

function note(monitor: AirMonitor): string {
  if (monitor.source === "doe") return "DOE publishes an index, not a concentration. This is the 24 hour mean PM2.5 its reading stands for, so it moves slowly.";
  if (monitor.reference) return "A reference monitor: the instrument a regulator would use, measured over each hour.";
  return "A low-cost sensor. It follows the same rises and falls as a reference monitor, but can read tens of ug/m3 high.";
}
