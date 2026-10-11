"use client";

import { type MouseEvent, useEffect, useState } from "react";

import { Icon, type IconName } from "@/components/ui/icons";

/**
 * The page's contents, grouped, with the section in view marked. On a wide
 * screen it is a column beside the page; on a narrow one a row of chips above
 * it. The page scrolls inside its own container, not the window, so that
 * container is what the observer watches.
 */

export interface TocItem {
  id: string;
  label: string;
  icon: IconName;
  /** The section's health as a coloured dot and its words, or null for an entry with no status. */
  status: { dot: string; label: string } | null;
}

export interface TocGroup {
  label: string;
  items: TocItem[];
}

function useActiveSection(ids: string[], rootId: string): [string | null, (id: string) => void] {
  const [active, setActive] = useState<string | null>(ids[0] ?? null);
  const key = ids.join("|");

  useEffect(() => {
    const root = document.getElementById(rootId);
    const sections = key
      .split("|")
      .map((id) => document.getElementById(id))
      .filter((section): section is HTMLElement => section !== null);
    if (!root || sections.length === 0) return;
    // A section counts as read once its top passes the upper fifth of the view.
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((entry) => entry.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActive(visible[0].target.id);
      },
      { root, rootMargin: "-10% 0px -70% 0px" },
    );
    for (const section of sections) observer.observe(section);
    return () => observer.disconnect();
  }, [key, rootId]);

  return [active, setActive];
}

function StatusDot({ status }: { status: TocItem["status"] }) {
  if (!status) return null;
  return (
    <span title={status.label} className={`size-1.5 shrink-0 rounded-full ${status.dot}`}>
      <span className="sr-only">{status.label}</span>
    </span>
  );
}

export function SourcesToc({ groups, rootId, layout }: { groups: TocGroup[]; rootId: string; layout: "column" | "bar" }) {
  const [active, setActive] = useActiveSection(
    groups.flatMap((group) => group.items.map((item) => item.id)),
    rootId,
  );

  // A plain #anchor jump scrolls every scrolling ancestor, the window too, which pushes the banner off screen. Scroll only the page.
  const go = (event: MouseEvent<HTMLAnchorElement>, id: string) => {
    const root = document.getElementById(rootId);
    const target = document.getElementById(id);
    if (!root || !target) return;
    event.preventDefault();
    const margin = Number.parseFloat(getComputedStyle(target).scrollMarginTop) || 0;
    const top = target.getBoundingClientRect().top - root.getBoundingClientRect().top + root.scrollTop - margin;
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    root.scrollTo({ top, behavior: still ? "auto" : "smooth" });
    window.history.replaceState(null, "", `#${id}`);
    setActive(id);
  };

  if (layout === "bar") {
    return (
      <nav aria-label="On this page" className="-mx-6 overflow-x-auto border-b border-hairline bg-canvas/95 px-6 py-2 backdrop-blur md:-mx-10 md:px-10">
        <ul className="flex gap-2">
          {groups.flatMap((group) => group.items).map((item) => (
            <li key={item.id} className="shrink-0">
              <a
                href={`#${item.id}`}
                onClick={(event) => go(event, item.id)}
                aria-current={active === item.id ? "location" : undefined}
                className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-small ${active === item.id ? "border-ink bg-ink text-ink-inverse" : "border-hairline text-ink-secondary hover:bg-active"}`}
              >
                <StatusDot status={item.status} />
                {item.label}
              </a>
            </li>
          ))}
        </ul>
      </nav>
    );
  }

  return (
    <nav aria-label="On this page">
      {groups.map((group) => (
        <div key={group.label} className="mb-6">
          <p className="mb-2 px-2 text-caption text-ink-tertiary">{group.label}</p>
          <ul className="space-y-0.5">
            {group.items.map((item) => {
              const current = active === item.id;
              return (
                <li key={item.id}>
                  <a
                    href={`#${item.id}`}
                    onClick={(event) => go(event, item.id)}
                    aria-current={current ? "location" : undefined}
                    className={`relative flex items-center gap-2 rounded-md px-2 py-1.5 text-small transition-colors ${current ? "bg-active font-medium text-ink" : "text-ink-secondary hover:bg-active hover:text-ink"}`}
                  >
                    {current ? <span aria-hidden className="absolute top-1.5 bottom-1.5 -left-px w-0.5 rounded-full bg-ink" /> : null}
                    <Icon name={item.icon} size={14} className={current ? "text-ink" : "text-ink-tertiary"} />
                    <span className="grow">{item.label}</span>
                    <StatusDot status={item.status} />
                  </a>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}
