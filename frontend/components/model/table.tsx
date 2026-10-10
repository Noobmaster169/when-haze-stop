import type { ReactNode } from "react";

/**
 * The Simulation page's table style, as parts: a caption-sized header, faint
 * rules between rows, numbers right-aligned in tabular mono. The best figure
 * in a row is set in ink, a clearly worse one in the fault hue, the rest in
 * grey, so the eye finds the winner without a legend.
 */

export type Tone = "best" | "worse" | "plain";

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

const TONE: Record<Tone, string> = { best: "font-medium text-ink", worse: "text-fault", plain: "text-ink-secondary" };

/** A number cell; `words` sets a worded entry ("never moves") in the running text face instead of mono. */
export function Num({ children, tone = "plain", words = false }: { children?: ReactNode; tone?: Tone; words?: boolean }) {
  const face = words ? "text-small" : "font-mono text-mono tabular-nums";
  return <td className={`whitespace-nowrap py-2 pl-4 text-right ${face} ${TONE[tone]}`}>{children}</td>;
}

/** Each value's tone in a row where lower wins: the lowest is best. */
export function lowestBest(values: readonly number[]): Tone[] {
  const lowest = Math.min(...values);
  return values.map((value) => (value === lowest ? "best" : "plain"));
}

/** Each value's tone in a row where higher wins: the highest is best. */
export function highestBest(values: readonly number[]): Tone[] {
  const highest = Math.max(...values);
  return values.map((value) => (value === highest ? "best" : "plain"));
}

/** A share as a whole percent: 0.59 reads 59%. */
export function percent(share: number): string {
  return `${Math.round(share * 100)}%`;
}

/** A small note under a table or chart, in the caption size. */
export function Note({ children }: { children: ReactNode }) {
  return <p className="mt-2 max-w-[78ch] text-caption text-ink-tertiary">{children}</p>;
}
