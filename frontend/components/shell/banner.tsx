"use client";

import { usePathname } from "next/navigation";

import { DockToggle } from "@/components/dock/dock-toggle";

import { Island } from "./island";
import { activeFor } from "./nav";

/** The 56px banner across every page: the product's name, the island that navigates, and the control that opens the dock. */
export function Banner() {
  const pathname = usePathname();
  return (
    <header className="grid h-14 shrink-0 grid-cols-[1fr_auto_1fr] items-center gap-3 border-b border-hairline bg-shell px-4 md:px-6">
      <div className="flex min-w-0 items-center gap-2.5">
        <span aria-hidden="true" className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-ink font-display text-[14px] text-ink-inverse">
          W
        </span>
        <span className="hidden truncate font-display text-[17px] tracking-[-0.01em] lg:inline">When Haze Stop</span>
      </div>
      <Island active={activeFor(pathname)} />
      <div className="flex justify-end">
        <DockToggle />
      </div>
    </header>
  );
}
