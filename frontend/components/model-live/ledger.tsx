import type { ModelLedgerRow } from "@/lib/api/model-schemas";
import { formatWhenShort } from "@/lib/when";

/** Every scored learned forecast once its day has passed, newest issue first. This is the table the shadow rule reads. */

const HEAD = ["Issued", "Station", "Day", "Ahead", "Forecast", "Band", "Observed", "Model miss", "Blend miss", "Hourly miss", "No change miss"] as const;
const TEXT_COLUMNS = 3;

function cell(value: number | null, lowest: number): string {
  return `py-2 pl-4 text-right font-mono text-mono ${value === null ? "text-ink-tertiary" : value === lowest ? "font-medium text-ink" : "text-ink-secondary"}`;
}

function Miss({ value, lowest }: { value: number | null; lowest: number }) {
  return <td className={cell(value, lowest)}>{value === null ? "none" : value.toFixed(1)}</td>;
}

function LedgerRow({ row }: { row: ModelLedgerRow }) {
  const lowest = Math.min(...[row.miss, row.blendMiss, row.v2Miss, row.persistenceMiss].filter((value): value is number => value !== null));
  return (
    <tr className="border-t border-hairline-faint align-top">
      <td className="py-2 pr-4 whitespace-nowrap text-ink-secondary">{formatWhenShort(row.asOf)}</td>
      <td className="py-2 pr-4 text-ink">{row.stationName}</td>
      <td className="py-2 pr-4 whitespace-nowrap text-ink-secondary">{row.day}</td>
      <td className="py-2 pl-4 text-right font-mono text-mono text-ink-secondary">{row.leadDays}</td>
      <td className="py-2 pl-4 text-right font-mono text-mono text-ink">{row.forecast}</td>
      <td className="py-2 pl-4 text-right font-mono text-mono whitespace-nowrap text-ink-tertiary">
        {row.low} to {row.high}
      </td>
      <td className="py-2 pl-4 text-right font-mono text-mono text-ink">{row.observed}</td>
      <Miss value={row.miss} lowest={lowest} />
      <Miss value={row.blendMiss} lowest={lowest} />
      <Miss value={row.v2Miss} lowest={lowest} />
      <Miss value={row.persistenceMiss} lowest={lowest} />
    </tr>
  );
}

export function Ledger({ ledger }: { ledger: ModelLedgerRow[] }) {
  if (ledger.length === 0) return <p className="text-small text-ink-secondary">No forecast has come due yet.</p>;
  return (
    <div>
      <div className="overflow-x-auto">
        <table className="w-full max-w-[900px] border-collapse text-small">
          <thead>
            <tr className="text-caption text-ink-tertiary">
              {HEAD.map((label, index) => (
                <th key={label} className={`py-1.5 font-normal ${index < TEXT_COLUMNS ? "pr-4 text-left" : "pl-4 text-right"}`}>
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ledger.map((row) => (
              <LedgerRow key={`${row.asOf}-${row.stationId}-${row.day}`} row={row} />
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-caption text-ink-tertiary">
        Forecast and band are the learned median and its 10th to 90th percentile in API; observed is the day&apos;s peak reading. Misses are in API points, the lowest of the four in ink; the blend is what the panel shows, the model and the hourly run averaged. DOE stations alone: Singapore publishes PSI, whose bands differ from DOE&apos;s index.
      </p>
    </div>
  );
}
