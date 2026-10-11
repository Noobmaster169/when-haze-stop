import type { Verdict } from "@/lib/api/council-schemas";

import { DOC_LINKS } from "./package";

/** The red team's unresolved objection and any dissent, what would trigger re-planning, and the caveats. */

const CAVEATS: { text: string; href: string; link: string }[] = [
  { text: "The package beyond what Indonesia accepted, Indonesia letting every aircraft and crew work where needed, and every suppression rate are assumptions.", href: DOC_LINKS.package, link: "What the package rests on" },
  { text: "Past the forecast, the wind is replayed from past windows, so the horizon is a spread of analogues, not a forecast.", href: DOC_LINKS.engine, link: "How a plan is scored" },
  { text: "The engine weighs fires by power, which under-weights smouldering peat by three to six times.", href: DOC_LINKS.questions, link: "What is not settled" },
  { text: "Every figure rests on the smoke engine, replayed against a week of DOE readings.", href: "/simulation", link: "How the engine was checked" },
];

export function VerdictNotes({ verdict }: { verdict: Verdict }) {
  return (
    <div className="space-y-6">
      <div className="grid gap-6 sm:grid-cols-2">
        <div>
          <h3 className="text-strong font-semibold text-ink">Minority report</h3>
          <p className="mt-1.5 text-body whitespace-pre-line text-ink-secondary">{verdict.minorityReport}</p>
        </div>
        <div>
          <h3 className="text-strong font-semibold text-ink">What would trigger re-planning</h3>
          <p className="mt-1.5 text-body whitespace-pre-line text-ink-secondary">{verdict.replanTrigger}</p>
        </div>
      </div>
      <ul className="space-y-1.5 rounded-lg bg-sunken px-4 py-3 text-small text-ink-secondary">
        {CAVEATS.map((caveat) => (
          <li key={caveat.href}>
            {caveat.text}{" "}
            <a href={caveat.href} {...(caveat.href.startsWith("http") ? { target: "_blank", rel: "noreferrer" } : {})} className="whitespace-nowrap text-ink underline underline-offset-2 hover:text-accent">
              {caveat.link}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
