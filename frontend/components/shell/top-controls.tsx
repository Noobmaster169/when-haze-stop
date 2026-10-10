"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import { Island } from "./island";
import { IslandAlert } from "./island-alert";
import { activeFor } from "./nav";

/**
 * What floats over the top of every page: the island in the middle with a
 * new alert hanging under it, and the chat's button in the right corner. The strip itself lets clicks through,
 * so the page under it stays usable between the two.
 */
export function TopControls({ toggle }: { toggle: ReactNode }) {
  const pathname = usePathname();
  return (
    <div className="pointer-events-none absolute inset-x-0 top-3 z-40 flex justify-center px-3">
      <div className="flex flex-col items-center gap-2">
        <div className="pointer-events-auto">
          <Island active={activeFor(pathname)} />
        </div>
        <div className="pointer-events-auto">
          <IslandAlert />
        </div>
      </div>
      <div className="pointer-events-auto absolute right-3 top-0">{toggle}</div>
    </div>
  );
}
