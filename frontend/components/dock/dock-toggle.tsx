"use client";

import { Icon } from "@/components/ui/icons";

import { useDock } from "./dock-state";

/** The chat's button, floating in the top right corner like the island beside it. Hidden while the chat is open: it has its own close. */
export function DockToggle() {
  const dock = useDock();
  if (dock.open) return null;
  return (
    <button
      type="button"
      onClick={() => dock.setOpen(true)}
      aria-label="Open the assistant"
      className="flex h-10 items-center gap-2 rounded-full bg-ink pl-3 pr-3.5 text-strong font-medium text-ink-inverse shadow-overlay transition-transform duration-300 ease-island hover:scale-[1.03] focus-visible:rounded-full!"
    >
      <Icon name="chat" size={15} />
      <span className="hidden sm:inline">Ask Haze</span>
    </button>
  );
}
