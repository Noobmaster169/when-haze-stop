import type { ReactNode, SelectHTMLAttributes } from "react";

/**
 * A labelled select with the browser's arrow replaced by a drawn chevron, so
 * the arrow keeps its distance from the text and looks the same everywhere.
 */
export function SelectField({ id, label, title, children, ...rest }: { id: string; label: string; title?: string; children: ReactNode } & SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div className="flex flex-col items-start gap-1.5 sm:flex-row sm:items-center sm:gap-3">
      <label htmlFor={id} className="shrink-0 text-body text-ink-secondary sm:w-[148px]" title={title}>
        {label}
      </label>
      <div className="relative">
        <select
          id={id}
          title={title}
          className="h-10 cursor-pointer appearance-none rounded-lg border border-hairline-strong bg-surface pr-10 pl-3 text-body text-ink transition-colors hover:border-ink-faint focus-visible:border-accent"
          {...rest}
        >
          {children}
        </select>
        <svg viewBox="0 0 16 16" aria-hidden className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-ink-tertiary">
          <path d="M4 6.25 L8 10.25 L12 6.25" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
    </div>
  );
}
