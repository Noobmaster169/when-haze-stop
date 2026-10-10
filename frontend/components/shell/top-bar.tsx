import Link from "next/link";
import type { ReactNode } from "react";

import { DockToggle } from "@/components/dock/dock-toggle";

/** The 56px top bar: a breadcrumb, whatever the page puts beside it, and the control that opens the dock. */

export interface Crumb {
  label: string;
  href?: string;
  /** An id, set in mono. */
  mono?: boolean;
}

export function TopBar({ crumbs, children }: { crumbs: Crumb[]; children?: ReactNode }) {
  return (
    <header className="flex h-14 shrink-0 items-center gap-2.5 border-b border-hairline bg-shell px-4 md:px-6">
      <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-2.5">
        {crumbs.map((crumb, index) => (
          <span key={`${crumb.label}-${index}`} className="flex min-w-0 items-center gap-2.5">
            {index > 0 ? (
              <span className="text-strong text-ink-faint" aria-hidden="true">
                /
              </span>
            ) : null}
            <Crumbed crumb={crumb} last={index === crumbs.length - 1} />
          </span>
        ))}
      </nav>
      <span className="grow" />
      {children}
      <DockToggle />
    </header>
  );
}

function Crumbed({ crumb, last }: { crumb: Crumb; last: boolean }) {
  const type = crumb.mono ? "font-mono text-strong font-medium" : "text-strong";
  const label = <span className={`truncate ${type} ${last ? "text-ink" : "text-ink-tertiary"}`}>{crumb.label}</span>;
  if (!crumb.href || last) return label;
  return (
    <Link href={crumb.href} className="truncate transition-colors duration-150 hover:text-ink">
      {label}
    </Link>
  );
}
