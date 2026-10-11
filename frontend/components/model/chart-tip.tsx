import type { ReactNode } from "react";

/** The hover box every Model chart shares, set on the side away from the pointer so it never covers the mark it describes. */
export function ChartTip({ left, children }: { left: boolean; children: ReactNode }) {
  return (
    <div
      className={`pointer-events-none absolute top-1 z-10 ${left ? "left-2" : "right-2"} rounded-md border border-hairline bg-surface px-3 py-2 text-small text-ink-secondary shadow-[var(--shadow-overlay)]`}
    >
      {children}
    </div>
  );
}

/** One coloured key per series, the same marks the chart draws. */
export function KeyLegend({
  items,
}: {
  items: readonly {
    label: string;
    colour: string;
    shape?: "bar" | "dot" | "line" | "dash";
  }[];
}) {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 text-caption text-ink-secondary">
      {items.map((item) => (
        <span key={item.label} className="flex items-center gap-1.5">
          {item.shape === "dot" ? (
            <span className="inline-block size-2 rounded-full" style={{ background: item.colour }} />
          ) : item.shape === "line" ? (
            <span className="inline-block h-0.5 w-5" style={{ background: item.colour }} />
          ) : item.shape === "dash" ? (
            <span className="inline-block w-5 border-t-2 border-dashed" style={{ borderColor: item.colour }} />
          ) : (
            <span className="inline-block h-2.5 w-3 rounded-[2px]" style={{ background: item.colour }} />
          )}
          {item.label}
        </span>
      ))}
    </div>
  );
}
