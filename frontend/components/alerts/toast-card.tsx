import Link from "next/link";

import { Icon } from "@/components/ui/icons";
import type { AlertKind } from "@/lib/api/alert-schemas";

import { TONE } from "./alert-tone";

/** One alert as it slides in from the right: what kind, where and when, the whole message, and where to go next. */
export function ToastCard({
  kind,
  place,
  when,
  message,
  tag,
  action,
  onClose,
}: {
  kind: AlertKind;
  place: string;
  when: string;
  message: string;
  tag?: string;
  action?: { label: string; href: string; onFollow?(): void };
  onClose?(): void;
}) {
  const tone = TONE[kind];
  return (
    <article className={`pointer-events-auto rounded-lg border border-l-[3px] border-hairline bg-surface py-3 pr-2 pl-3.5 shadow-overlay motion-safe:animate-[toast-in_520ms_var(--ease-island)_both] ${tone.edge}`}>
      <header className="flex min-h-6 items-center gap-2 text-caption">
        {tag ? <span className="shrink-0 rounded-sm bg-ink px-1.5 py-px font-semibold text-ink-inverse">{tag}</span> : null}
        <span className={`shrink-0 font-semibold tracking-[0.04em] uppercase ${tone.text}`}>{tone.label}</span>
        <span className="min-w-0 grow truncate text-ink-tertiary">
          {place} · {when}
        </span>
        {onClose ? (
          <button type="button" onClick={onClose} aria-label="Mark this alert read" className="flex h-6 w-6 shrink-0 items-center justify-center rounded-sm text-ink-tertiary hover:bg-active hover:text-ink">
            <Icon name="close" size={12} />
          </button>
        ) : null}
      </header>
      <p className="mt-1 pr-1.5 text-body text-ink">{message}</p>
      {action ? (
        <Link href={action.href} onClick={action.onFollow} className="mt-2 inline-flex items-center gap-1 text-small font-medium text-accent hover:underline">
          {action.label}
          <Icon name="right" size={12} />
        </Link>
      ) : null}
    </article>
  );
}
