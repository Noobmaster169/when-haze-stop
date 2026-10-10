"use client";

import { Icon, type IconName } from "@/components/ui/icons";

import { useDock } from "./dock-state";

/**
 * The dock's two header rows: what this panel is, and what can be done with
 * the conversation in it. Its own file because dock.tsx is the thread.
 */

const ICON_BUTTON =
  "flex h-7 w-7 shrink-0 items-center justify-center rounded-sm text-ink-secondary transition-colors duration-150 hover:bg-active hover:text-ink disabled:opacity-40 disabled:hover:bg-transparent";

function IconButton({ name, label, on = false, onClick, disabled = false }: { name: IconName; label: string; on?: boolean; onClick(): void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      aria-pressed={on}
      disabled={disabled}
      className={`${ICON_BUTTON} ${on ? "bg-accent-tint text-accent" : ""}`}
    >
      <Icon name={name} size={13} />
    </button>
  );
}

export type DockView = "thread" | "history";

export function DockHeader({
  title,
  view,
  onView,
  canStartNew,
}: {
  /** The conversation's own name, or the first thing asked in it. */
  title: string;
  view: DockView;
  onView(next: DockView): void;
  /** False for a conversation that is already empty and unopened: New would do nothing. */
  canStartNew: boolean;
}) {
  const dock = useDock();
  return (
    <header className="shrink-0 border-b border-hairline">
      <div className="flex h-14 items-center gap-2.5 px-[18px]">
        <Icon name="chat" size={15} className="text-accent" />
        <h2 className="text-[14px] font-semibold tracking-[-0.01em]">Ask Haze</h2>
        <span className="grow" />
        <button
          type="button"
          onClick={() => dock.setOpen(false)}
          aria-label="Close the assistant"
          className="flex h-6 w-6 items-center justify-center rounded-sm text-ink-faint hover:bg-active hover:text-ink-secondary"
        >
          <Icon name="close" size={14} />
        </button>
      </div>
      <div className="flex h-9 items-center gap-1 px-[18px] pb-1.5">
        <span className="min-w-0 grow truncate text-caption text-ink-tertiary">{view === "history" ? "Every conversation" : title}</span>
        <IconButton
          name="clock"
          label={view === "history" ? "Back to the conversation" : "History"}
          on={view === "history"}
          onClick={() => onView(view === "history" ? "thread" : "history")}
        />
        <IconButton name="plus" label="New conversation" onClick={dock.startNew} disabled={!canStartNew} />
      </div>
    </header>
  );
}
