"use client";

import type { ReactNode } from "react";

import { Dock } from "@/components/dock/dock";
import { DockProvider } from "@/components/dock/dock-state";
import { DockToggle } from "@/components/dock/dock-toggle";

import { TopControls } from "./top-controls";

/**
 * Every screen is this: the page with the island floating over its top, a
 * new alert hanging under the island, and the dock beside it when it is open.
 * No banner: the island is the navigation and the page keeps the height.
 *
 * Mounted once by app/(app)/layout.tsx, so the island and the chat survive
 * every navigation.
 */
export function AppShell({ children }: { children: ReactNode }) {
  return (
    <DockProvider>
      {/* Relative so an absolutely placed child (an sr-only label, say) is clipped here instead of stretching the document past the viewport. */}
      <div className="relative flex h-dvh flex-col overflow-hidden bg-canvas text-ink">
        <div className="flex min-h-0 grow">
          <div className="relative flex min-w-0 grow">
            {children}
            <TopControls toggle={<DockToggle />} />
          </div>
          <Dock />
        </div>
      </div>
    </DockProvider>
  );
}
