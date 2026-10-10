import type { ReactNode } from "react";

import { CHAPTERS } from "./chapters";

/** One numbered chapter: its number, title and one-line summary from the shared list, then its content. */
export function Chapter({ id, children }: { id: string; children: ReactNode }) {
  const index = CHAPTERS.findIndex((chapter) => chapter.id === id);
  const chapter = CHAPTERS[index];
  return (
    <section id={id} className="scroll-mt-6 border-t border-hairline-faint pt-8 pb-4 first:border-t-0 first:pt-2">
      <div className="flex items-baseline gap-3">
        <span className="font-mono text-small text-accent">{String(index + 1).padStart(2, "0")}</span>
        <h2 className="text-title font-medium text-ink">{chapter.title}</h2>
      </div>
      <p className="mt-1 max-w-[68ch] text-body text-ink-secondary">{chapter.summary}</p>
      <div className="mt-4">{children}</div>
    </section>
  );
}

/** A figure with its label, for the answer at the top. */
export function Tile({ figure, label }: { figure: string; label: string }) {
  return (
    <div className="rounded-lg border border-hairline bg-surface p-4">
      <div className="font-display text-display text-ink">{figure}</div>
      <p className="mt-1 text-small text-ink-secondary">{label}</p>
    </div>
  );
}

/** What each line means, shared by the replayed cases. */
export function Legend() {
  return (
    <div className="flex flex-wrap gap-4 text-caption text-ink-secondary">
      <span className="flex items-center gap-1.5">
        <span className="inline-block h-0.5 w-5 bg-accent" />
        This forecast
      </span>
      <span className="flex items-center gap-1.5">
        <span className="inline-block w-5 border-t-2 border-dotted border-ink-tertiary" />
        Assuming no change
      </span>
      <span className="flex items-center gap-1.5">
        <span className="inline-block h-0.5 w-5 bg-ink" />
        What DOE read
      </span>
    </div>
  );
}
