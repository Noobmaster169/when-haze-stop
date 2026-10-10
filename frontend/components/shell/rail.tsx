"use client";

import Link from "next/link";

import { Icon } from "@/components/ui/icons";

import { DESTINATIONS } from "./nav";

/** The left rail: the product's name, then where one can go. Collapses to icons. */
export function Rail({ open, onToggle, active }: { open: boolean; onToggle(): void; active: string | null }) {
  return (
    <nav aria-label="Primary" className={`flex shrink-0 flex-col border-r border-hairline bg-shell transition-[width] duration-150 ${open ? "w-[232px]" : "w-[58px]"}`}>
      <div className={`flex h-14 shrink-0 items-center ${open ? "gap-2.5 px-[18px]" : "justify-center"}`}>
        <span aria-hidden="true" className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-ink font-display text-[14px] text-ink-inverse">
          W
        </span>
        {open ? (
          <>
            <span className="whitespace-nowrap font-display text-[17px] tracking-[-0.01em]">When Haze Stop</span>
            <span className="grow" />
            <CollapseButton open onClick={onToggle} />
          </>
        ) : null}
      </div>
      <div className={`h-px bg-hairline ${open ? "mx-[18px]" : "mx-3"}`} />

      <div className={open ? "px-3 pt-3" : "flex flex-col items-center pt-3"}>
        {DESTINATIONS.map((destination) => {
          const here = destination.key === active;
          return (
            <Link
              key={destination.key}
              href={destination.href}
              aria-label={open ? undefined : destination.label}
              aria-current={here ? "page" : undefined}
              title={open ? undefined : destination.label}
              className={`flex items-center rounded-md transition-colors duration-150 ${
                open ? "h-[34px] gap-2.5 px-2.5" : "mb-1 h-[34px] w-[34px] justify-center"
              } ${here ? "bg-accent-tint" : "hover:bg-active"}`}
            >
              <Icon name={destination.icon} className={`shrink-0 ${here ? "text-accent" : "text-ink-tertiary"}`} />
              {open ? (
                <span className={`whitespace-nowrap text-heading ${here ? "font-medium text-accent" : "font-normal text-ink-secondary"}`}>{destination.label}</span>
              ) : null}
            </Link>
          );
        })}
      </div>

      {open ? null : (
        <div className="flex grow flex-col items-center justify-end pb-3.5">
          <CollapseButton open={false} onClick={onToggle} />
        </div>
      )}
    </nav>
  );
}

function CollapseButton({ open, onClick }: { open: boolean; onClick(): void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={open ? "Collapse the sidebar" : "Open the sidebar"}
      aria-expanded={open}
      className="flex h-6 w-6 shrink-0 items-center justify-center rounded-sm text-ink-faint transition-colors duration-150 hover:bg-active hover:text-ink-secondary"
    >
      <Icon name="panel" size={14} />
    </button>
  );
}
