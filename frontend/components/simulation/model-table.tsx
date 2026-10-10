import type { ModelSkill } from "@/lib/api/simulation-schemas";

import { shadowSummary } from "./model-state";

/** The learned model's live record by instrument kind and lead, beside "no change" and the hourly forecast, with the shadow rule's state above it. */

const NETWORK_NAME = { doe: "DOE stations", nea: "Singapore regions" } as const;

function cell(value: number | null, best: boolean): string {
  return `py-2 text-right font-mono text-mono ${value === null ? "text-ink-tertiary" : best ? "font-medium text-ink" : "text-ink-secondary"}`;
}

export function ModelTable({ model }: { model: ModelSkill }) {
  return (
    <div>
      <p className="text-small text-ink-secondary">{shadowSummary(model)}</p>
      {model.modelVersion ? <p className="mt-1 text-caption text-ink-tertiary">Version {model.modelVersion}.</p> : null}
      {model.mode !== "off" && model.comparedCases < model.cases ? (
        <p className="mt-1 text-caption text-ink-tertiary">The gain counts the {model.comparedCases.toLocaleString("en-GB")} of {model.cases.toLocaleString("en-GB")} day-ahead DOE cases the hourly forecast also covers.</p>
      ) : null}
      <table className="mt-3 w-full max-w-[640px] border-collapse text-small">
        <thead>
          <tr className="text-caption text-ink-tertiary">
            <th className="py-1.5 text-left font-normal">Instruments, days ahead</th>
            <th className="py-1.5 text-right font-normal">This model</th>
            <th className="py-1.5 text-right font-normal">Hourly forecast</th>
            <th className="py-1.5 text-right font-normal">No change</th>
            <th className="py-1.5 text-right font-normal">Checked</th>
          </tr>
        </thead>
        <tbody>
          {model.leads.map((lead) => {
            const lowest = Math.min(...[lead.model, lead.v2, lead.persistence].filter((value): value is number => value !== null));
            return (
              <tr key={`${lead.network}-${lead.leadDays}`} className="border-t border-hairline-faint">
                <td className="py-2 text-ink-secondary">
                  {NETWORK_NAME[lead.network]}, {lead.leadDays}
                </td>
                <td className={cell(lead.model, lead.model === lowest)}>{lead.model === null ? "none yet" : lead.model.toFixed(1)}</td>
                <td className={cell(lead.v2, lead.v2 === lowest)}>{lead.v2 === null ? "none yet" : lead.v2.toFixed(1)}</td>
                <td className={cell(lead.persistence, lead.persistence === lowest)}>{lead.persistence === null ? "none yet" : lead.persistence.toFixed(1)}</td>
                <td className="py-2 text-right font-mono text-mono text-ink-secondary">{lead.cases.toLocaleString("en-GB")}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="mt-2 text-caption text-ink-tertiary">Average miss of the day&apos;s peak, in API points. Scored on the hours DOE and NEA published, once each day has passed.</p>
    </div>
  );
}
