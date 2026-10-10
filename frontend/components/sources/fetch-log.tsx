import type { SourceFetch } from "@/lib/api/source-schemas";
import { formatWhenShort } from "@/lib/when";

import { describeDetail, duration } from "./source-state";

/** The newest fetches of every source, newest first, each with what it brought back or why it failed. */
export function FetchLog({ fetches, names }: { fetches: readonly SourceFetch[]; names: ReadonlyMap<string, string> }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] border-collapse text-small">
        <thead>
          <tr className="text-caption text-ink-tertiary">
            <th className="py-1.5 text-left font-normal">Started (UTC)</th>
            <th className="py-1.5 text-left font-normal">Source</th>
            <th className="py-1.5 text-left font-normal">Result</th>
            <th className="py-1.5 text-right font-normal">Took</th>
            <th className="py-1.5 pl-4 text-left font-normal">What came back</th>
          </tr>
        </thead>
        <tbody>
          {fetches.map((fetch) => (
            <tr key={fetch.id} className="border-t border-hairline-faint align-top">
              <td className="py-2 pr-3 font-mono text-mono whitespace-nowrap text-ink-secondary">{formatWhenShort(fetch.startedAt)}</td>
              <td className="py-2 pr-3 text-ink">{names.get(fetch.source) ?? fetch.source}</td>
              <td className={`py-2 pr-3 ${fetch.ok ? "text-match" : "text-fault"}`}>{fetch.ok ? "Fetched" : "Failed"}</td>
              <td className="py-2 text-right font-mono text-mono whitespace-nowrap text-ink-secondary">{duration(fetch)}</td>
              <td className="py-2 pl-4 text-ink-secondary">
                {fetch.ok ? describeDetail(fetch.detail).map(({ label, value }) => `${value} ${label}`).join(", ") : <span className="text-fault">{fetch.error}</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
