"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import { Island } from "./island";
import { activeFor } from "./nav";
import { SchemeSwitch } from "./scheme-switch";

/**
 * What floats over the top of every page: the island in the middle, and the
 * light or dark switch and the chat's button in the right corner. The strip itself lets clicks through,
 * so the page under it stays usable between the two.
 */
export function TopControls({ toggle }: { toggle: ReactNode }) {
  const pathname = usePathname();
  return (
    <div className="pointer-events-none absolute inset-x-0 top-3 z-40 flex justify-center px-3">
      <div className="pointer-events-auto">
        <Island active={activeFor(pathname)} />
      </div>
      <div className="pointer-events-auto absolute right-3 top-0 flex items-center gap-2">
        <SchemeSwitch />
        {toggle}
      </div>
    </div>
  );
}
