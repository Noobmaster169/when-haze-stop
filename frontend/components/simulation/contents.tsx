"use client";

import { useEffect, useState } from "react";

import { CHAPTERS, type Chapter } from "./chapters";

/**
 * The table of contents: a sticky numbered list beside the chapters on a wide
 * screen, a row of chips above them on a narrow one. The chapter being read is
 * marked as the page's own column scrolls. The Simulation page's list and
 * column are the defaults; the Model page passes its own.
 */

export const SCROLL_ID = "simulation-scroll";

export function Contents({ chapters = CHAPTERS, scrollId = SCROLL_ID }: { chapters?: readonly Chapter[]; scrollId?: string }) {
  const [current, setCurrent] = useState(chapters[0].id);

  useEffect(() => {
    const root = document.getElementById(scrollId);
    if (!root) return;
    // The chapter being read is the last one whose top has passed the upper third of the column.
    const update = (): void => {
      const line = root.getBoundingClientRect().top + root.clientHeight / 3;
      let reading = chapters[0].id;
      for (const chapter of chapters) {
        const element = document.getElementById(chapter.id);
        if (element && element.getBoundingClientRect().top <= line) reading = chapter.id;
      }
      // At the very bottom the last chapters may never reach the line; the last one is then being read.
      if (root.scrollTop + root.clientHeight >= root.scrollHeight - 4) reading = chapters[chapters.length - 1].id;
      setCurrent(reading);
    };
    update();
    root.addEventListener("scroll", update, { passive: true });
    return () => root.removeEventListener("scroll", update);
  }, [chapters, scrollId]);

  return (
    <nav aria-label="Contents">
      <ol className="flex gap-2 overflow-x-auto pb-2 lg:flex-col lg:gap-0.5 lg:overflow-visible lg:pb-0">
        {chapters.map((chapter, index) => {
          const active = chapter.id === current;
          return (
            <li key={chapter.id} className="shrink-0">
              <a
                href={`#${chapter.id}`}
                aria-current={active ? "location" : undefined}
                className={`flex items-baseline gap-2 rounded-md border px-2.5 py-1.5 text-small transition-colors lg:border-0 lg:border-l-2 lg:rounded-none lg:px-3 ${
                  active ? "border-accent bg-accent-tint text-ink lg:bg-transparent" : "border-hairline text-ink-tertiary hover:text-ink-secondary lg:border-transparent"
                }`}
              >
                <span className={`font-mono text-caption ${active ? "text-accent" : "text-ink-faint"}`}>{index + 1}</span>
                <span className="whitespace-nowrap lg:whitespace-normal">{chapter.title}</span>
              </a>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
