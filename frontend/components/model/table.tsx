import type { ReactNode } from "react";

/**
 * The Simulation page's table style, as parts: a caption-sized header, faint
 * rules between rows, the row label in ink.
 */

/** The first header names the rows and sits left; every other header heads a column of numbers unless `textFrom` says where text columns start. */
export function Table({ head, children, wide = false, textFrom }: { head: readonly string[]; children: ReactNode; wide?: boolean; textFrom?: number }) {
  return (
    <div className="overflow-x-auto">
      <table className={`w-full border-collapse text-small ${wide ? "max-w-[900px]" : "max-w-[720px]"}`}>
        <thead>
          <tr className="text-caption text-ink-tertiary">
            {head.map((label, index) => (
              <th key={label} className={`py-1.5 font-normal ${index === 0 ? "pr-4 text-left" : textFrom !== undefined && index >= textFrom ? "pr-4 pl-4 text-left" : "pl-4 text-right"}`}>
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

export function Row({ children }: { children: ReactNode }) {
  return <tr className="border-t border-hairline-faint align-top">{children}</tr>;
}

export function Label({ children }: { children: ReactNode }) {
  return <td className="py-2 pr-4 text-ink-secondary">{children}</td>;
}

/** Plain text in a non-numeric column, left-aligned. */
export function Text({ children }: { children: ReactNode }) {
  return <td className="py-2 pr-4 pl-4 text-left text-ink-secondary">{children}</td>;
}

/** A share as a whole percent: 0.59 reads 59%. */
export function percent(share: number): string {
  return `${Math.round(share * 100)}%`;
}
