"use client";

import { useEffect, useState } from "react";

import { Icon } from "@/components/ui/icons";

import { type PushState, pushState, turnOff, turnOn } from "./push";
import { useSessionId } from "./session";

const NOTE: Partial<Record<PushState, string>> = {
  unsupported: "This browser cannot show notifications.",
  unavailable: "This server has no push key set, so alerts show only in the app.",
  blocked: "Notifications are blocked for this site in the browser's settings.",
};

/** Sends this browser's alerts to the device as notifications, with the tab closed too. */
export function NotifyToggle() {
  const session = useSessionId();
  const [state, setState] = useState<PushState | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let live = true;
    void pushState().then((found) => live && setState(found));
    return () => {
      live = false;
    };
  }, []);

  if (state === null) return null;
  const on = state === "on";
  const flip = async (): Promise<void> => {
    if (!session) return;
    setBusy(true);
    try {
      setState(on ? await turnOff(session) : await turnOn(session));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        onClick={() => void flip()}
        disabled={busy || state === "unsupported"}
        aria-pressed={on}
        className={`flex h-8 items-center gap-2 rounded-md border px-3 text-small font-medium transition-colors duration-150 disabled:opacity-60 ${
          on ? "border-accent-line bg-accent-tint text-accent" : "border-hairline-strong text-ink-secondary hover:bg-active hover:text-ink"
        }`}
      >
        <Icon name="bell" size={14} />
        {on ? "Notifying this device" : "Notify this device"}
      </button>
      {NOTE[state] ? <p className="text-caption text-ink-tertiary">{NOTE[state]}</p> : null}
    </div>
  );
}
