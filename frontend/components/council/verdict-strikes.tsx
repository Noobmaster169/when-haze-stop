import type { Consent, StrikeLine } from "@/lib/api/council-schemas";

import { percent } from "./words";

/** One row per complex the plan attacks, in the order it attacks them. */

const WAITS: Record<Consent, string> = { sumatra: "Yes, to work in Sumatra", ground_crews: "Yes, to send ground crews" };

export function VerdictStrikes({ lines }: { lines: StrikeLine[] }) {
  if (lines.length === 0) return <p className="text-small text-ink-tertiary">The chosen plan sends nothing to a fire complex.</p>;
  const sorted = [...lines].sort((a, b) => a.order - b.order);
  return (
    <div>
      <ol className="space-y-3 sm:hidden">
        {sorted.map((line) => (
          <li key={`${line.order}-${line.complexId}`} className="flex gap-3 border-b border-hairline-faint pb-3 text-small">
            <span className="inline-flex size-6 shrink-0 items-center justify-center rounded-full bg-ink text-caption font-semibold text-ink-inverse tabular-nums">{line.order}</span>
            <div className="min-w-0 grow">
              <div className="flex items-baseline justify-between gap-2">
                <span className="font-medium text-ink">{line.place}</span>
                <span className="font-medium text-ink tabular-nums">{percent(line.share)}</span>
              </div>
              <div className="text-caption text-ink-tertiary">
                {line.province}, {line.country}, {Math.round(100 * line.peatShare)}% peat land
              </div>
              <div className="mt-1 text-ink-secondary">{line.assets}</div>
              <div className={`mt-0.5 text-caption ${line.waitsOn ? "text-differ" : "text-ink-tertiary"}`}>{line.waitsOn ? `Needs Indonesia to agree: ${WAITS[line.waitsOn].replace(/^Yes, /, "")}` : "Can start without asking"}</div>
            </div>
          </li>
        ))}
      </ol>
      <table className="hidden w-full text-left text-small sm:table">
        <thead className="text-caption text-ink-tertiary">
          <tr className="border-b border-hairline">
            <th className="py-2 pr-3 font-normal">Order</th>
            <th className="py-2 pr-3 font-normal">Place</th>
            <th className="py-2 pr-3 text-right font-normal">Peat land</th>
            <th className="py-2 pr-3 font-normal">Sent</th>
            <th className="py-2 pr-3 font-normal">Days</th>
            <th className="py-2 pr-3 font-normal">Needs Indonesia</th>
            <th className="py-2 text-right font-normal">Smoke removed</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((line) => (
            <tr key={`${line.order}-${line.complexId}`} className="border-b border-hairline-faint align-top">
              <td className="py-2.5 pr-3">
                <span className="inline-flex size-6 items-center justify-center rounded-full bg-ink text-caption font-semibold text-ink-inverse tabular-nums">{line.order}</span>
              </td>
              <td className="py-2.5 pr-3">
                <div className="font-medium text-ink">{line.place}</div>
                <div className="text-caption text-ink-tertiary">
                  {line.province}, {line.country}
                </div>
              </td>
              <td className="py-2.5 pr-3 text-right text-ink-secondary tabular-nums">{Math.round(100 * line.peatShare)}%</td>
              <td className="py-2.5 pr-3 text-ink-secondary">{line.assets}</td>
              <td className="py-2.5 pr-3 whitespace-nowrap text-ink-secondary tabular-nums">
                {line.fromDay === line.toDay ? `Day ${line.fromDay}` : `Day ${line.fromDay} to ${line.toDay}`}
              </td>
              <td className={`py-2.5 pr-3 ${line.waitsOn ? "text-differ" : "text-ink-tertiary"}`}>{line.waitsOn ? WAITS[line.waitsOn] : "No"}</td>
              <td className="py-2.5 text-right font-medium text-ink tabular-nums">{percent(line.share)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-2 text-caption text-ink-tertiary">Smoke removed: how much of the smoke any plan could clear from KL&apos;s air comes from the work at this place. Peat land burns underground and is the hardest to put out. Day 1 is the first day the team can work.</p>
    </div>
  );
}
