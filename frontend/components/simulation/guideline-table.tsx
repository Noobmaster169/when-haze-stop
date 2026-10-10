import type { Guideline } from "@/lib/api/haze-schemas";

/** The official lines: what each one triggers, for whom, and whose rule it is. */
export function GuidelineTable({ guidelines }: { guidelines: Guideline[] }) {
  return (
    <table className="w-full max-w-[760px] border-collapse text-small">
      <thead>
        <tr className="text-caption text-ink-tertiary">
          <th className="py-1.5 pr-4 text-left font-normal">API</th>
          <th className="py-1.5 pr-4 text-left font-normal">Who</th>
          <th className="py-1.5 pr-4 text-left font-normal">What happens</th>
          <th className="py-1.5 text-left font-normal">Issued by</th>
        </tr>
      </thead>
      <tbody>
        {guidelines.map((line) => (
          <tr key={`${line.threshold}-${line.audience}`} className="border-t border-hairline-faint align-top">
            <td className="whitespace-nowrap py-2 pr-4 font-mono text-mono text-ink">
              Above {line.threshold}
              {line.sustainedDays ? <span className="block font-sans text-caption text-ink-tertiary">for {line.sustainedDays} days</span> : null}
            </td>
            <td className="py-2 pr-4 text-ink-secondary">{line.audience}</td>
            <td className="py-2 pr-4 text-ink">{line.action}</td>
            <td className="py-2 text-ink-secondary">
              <a href={line.source} target="_blank" rel="noreferrer" className="underline-offset-2 hover:text-accent hover:underline">
                {line.issuer}
              </a>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
