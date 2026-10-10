"use client";

import { useState, type ReactNode } from "react";

/** The sensor panels, folded away until asked for: their days vary from 3 to 69, so they read differently from the reference sets above. */
export function SensorToggle({ count, children }: { count: number; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="rounded-md border border-hairline px-3 py-1.5 text-small text-ink-secondary transition-colors hover:bg-surface-active hover:text-ink focus-visible:shadow-[var(--focus-ring)] focus-visible:outline-none"
      >
        {open ? "Hide sensors" : `Show ${count} sensors`}
      </button>
      {open ? <div className="mt-3">{children}</div> : null}
    </div>
  );
}
