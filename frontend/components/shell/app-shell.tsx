"use client";

import type { ReactNode } from "react";

import { AlertBar } from "@/components/alerts/alert-bar";
import { Dock } from "@/components/dock/dock";
import { DockProvider } from "@/components/dock/dock-state";

import { Banner } from "./banner";

/**
 * Every screen is this: the banner, the alert bar when there is one, then the page and the dock.
 *
 * Mounted once by app/(app)/layout.tsx, so the banner and the chat survive
 * every navigation. A page renders its content in a column that fills the
 * space beside the dock.
 */
export function AppShell({ children }: { children: ReactNode }) {
  return (
    <DockProvider>
      <div className="flex h-dvh flex-col overflow-hidden bg-canvas text-ink">
        <Banner />
        <AlertBar />
        <div className="flex min-h-0 grow">
          {children}
          <Dock />
        </div>
      </div>
    </DockProvider>
  );
}
