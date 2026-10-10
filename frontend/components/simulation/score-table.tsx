/** Average miss by lead time, this model beside "no change". The lower of the two is set in ink, the other in grey. */

export interface ScoreRow {
  leadHours: number;
  cases: number;
  model: number | null;
  persistence: number | null;
}

export function ScoreTable({ rows }: { rows: readonly ScoreRow[] }) {
  return (
    <table className="w-full max-w-[560px] border-collapse text-small">
      <thead>
        <tr className="text-caption text-ink-tertiary">
          <th className="py-1.5 text-left font-normal">Hours ahead</th>
          <th className="py-1.5 text-right font-normal">This model</th>
          <th className="py-1.5 text-right font-normal">Assuming no change</th>
          <th className="py-1.5 text-right font-normal">Forecasts checked</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => {
          const better = row.model !== null && row.persistence !== null && row.model < row.persistence;
          return (
            <tr key={row.leadHours} className="border-t border-hairline-faint">
              <td className="py-2 text-ink-secondary">{row.leadHours}</td>
              <td className={`py-2 text-right font-mono text-mono ${better ? "font-medium text-ink" : "text-ink-tertiary"}`}>{row.model ?? "none yet"}</td>
              <td className={`py-2 text-right font-mono text-mono ${better ? "text-ink-tertiary" : "font-medium text-ink"}`}>{row.persistence ?? "none yet"}</td>
              <td className="py-2 text-right font-mono text-mono text-ink-secondary">{row.cases.toLocaleString("en-GB")}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
