"use client";

import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";

import { Dock } from "@/components/dock/dock";
import { DockProvider } from "@/components/dock/dock-state";

import { activeFor } from "./nav";
import { Rail } from "./rail";

/**
 * Every screen is this: a rail, then the page, then the dock.
 *
 * Mounted once by app/(app)/layout.tsx, so the rail and the chat survive
 * every navigation. A page renders its own `<TopBar>` and its content in a
 * column that fills the space between.
 */
export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [railOpen, setRailOpen] = useState(true);
  return (
    <DockProvider>
      <div className="flex h-dvh overflow-hidden bg-canvas text-ink">
        <div className="hidden md:flex">
          <Rail open={railOpen} onToggle={() => setRailOpen((was) => !was)} active={activeFor(pathname)} />
        </div>
        {children}
        <Dock />
      </div>
    </DockProvider>
  );
}
