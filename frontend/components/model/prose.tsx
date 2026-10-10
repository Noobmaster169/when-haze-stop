import type { ReactNode } from "react";

/** The Model page's text at the Simulation page's sizes: sub-headings, inline code, formula blocks and bullet lists. */

export function H3({ children }: { children: ReactNode }) {
  return <h3 className="mt-7 mb-2 text-small font-medium text-ink">{children}</h3>;
}

export function Code({ children }: { children: ReactNode }) {
  return <code className="rounded-xs bg-sunken px-1 py-px font-mono text-mono-xs text-ink">{children}</code>;
}

export function Strong({ children }: { children: ReactNode }) {
  return <strong className="font-medium text-ink">{children}</strong>;
}

/** A formula as plain monospace text, kept on its own lines and scrolled sideways on a narrow screen rather than wrapped. */
export function Formula({ children }: { children: string }) {
  return <pre className="mt-3 overflow-x-auto rounded-lg border border-hairline bg-sunken px-4 py-3 font-mono text-mono-sm text-ink">{children}</pre>;
}

export function Bullets({ children }: { children: ReactNode }) {
  return <ul className="mt-3 first:mt-0 max-w-[72ch] list-disc space-y-2 pl-5 text-body text-ink-secondary marker:text-ink-faint">{children}</ul>;
}
