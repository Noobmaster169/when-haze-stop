import { Icon } from "@/components/ui/icons";
import type { SourceStatus } from "@/lib/api/source-schemas";

/** Who publishes each source and the address the app asks, last on the page because it is reference, not status. */
export function WhereTable({ sources }: { sources: readonly SourceStatus[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] border-collapse text-small">
        <thead>
          <tr className="text-left text-caption text-ink-tertiary">
            <th className="py-1.5 pr-4 font-normal">Data</th>
            <th className="py-1.5 pr-4 font-normal">Published by</th>
            <th className="py-1.5 pr-4 font-normal">Address asked</th>
            <th className="py-1.5 font-normal">How often</th>
          </tr>
        </thead>
        <tbody>
          {sources.map((source) => (
            <tr key={source.id} className="border-t border-hairline-faint align-top">
              <td className="py-2 pr-4 text-ink">{source.name}</td>
              <td className="py-2 pr-4">
                <a href={source.link} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-ink-secondary underline-offset-2 hover:text-accent hover:underline">
                  {source.provider}
                  <Icon name="external" size={11} />
                </a>
              </td>
              <td className="py-2 pr-4 font-mono text-caption break-all text-ink-tertiary">{source.endpoint}</td>
              <td className="py-2 whitespace-nowrap text-ink-secondary">{source.cadence}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
