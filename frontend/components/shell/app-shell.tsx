"use client";

import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";

import { AlertBar } from "@/components/alerts/alert-bar";
import { Dock } from "@/components/dock/dock";
import { DockProvider } from "@/components/dock/dock-state";

import { activeFor } from "./nav";
import { Rail } from "./rail";

/**
 * Every screen is this: the alert bar when there is one, then a rail, the page and the dock.
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
      <div className="flex h-dvh flex-col overflow-hidden bg-canvas text-ink">
        <AlertBar />
        <div className="flex min-h-0 grow">
          <div className="hidden md:flex">
            <Rail open={railOpen} onToggle={() => setRailOpen((was) => !was)} active={activeFor(pathname)} />
          </div>
          {children}
          <Dock />
        </div>
      </div>
    </DockProvider>
  );
}
