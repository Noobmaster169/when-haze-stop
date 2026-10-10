import { Icon } from "@/components/ui/icons";
import type { Statement, StatementIssuer, StatementStatus } from "@/lib/api/statement-schemas";
import { dayName, malaysiaDate } from "@/lib/malaysia-time";

/** One official statement: who, what, its status, where it applies, and the original. */

const CATEGORY: Record<StatementIssuer, string> = {
  moe: "KPM",
  doe: "JAS",
  nadma: "NADMA",
  moh: "KKM",
  state: "State",
  ruler: "Ruler",
  federal: "Federal",
  other: "Other",
};

const STATUS: Record<StatementStatus, { label: string; className: string }> = {
  "in-force": { label: "In force", className: "border-fault-line bg-fault-tint text-fault" },
  upcoming: { label: "Coming", className: "border-differ-line bg-differ-tint text-differ" },
  replaced: { label: "Replaced", className: "border-hairline text-ink-tertiary" },
  ended: { label: "Ended", className: "border-hairline text-ink-tertiary" },
};

/**
 * The badge: a national body by its usual initials; a state body, Ruler or
 * other by the short name it goes by ("JAKIM", "JAIS"), since "State" alone
 * does not say which.
 */
export function badge(statement: Statement): string {
  if (statement.issuer !== "state" && statement.issuer !== "ruler" && statement.issuer !== "other") return CATEGORY[statement.issuer];
  const initials = statement.issuerName.match(/\b[A-Z]{3,8}\b/);
  return initials ? initials[0] : CATEGORY[statement.issuer];
}

export function areas(statement: Statement): string {
  if (statement.nationwide) return statement.kind === "rule" ? "Wherever the line is passed" : "All of Malaysia";
  const names = [...statement.states.map((state) => state.replace(/^WP /, "")), ...statement.districts];
  return names.length > 0 ? names.join(", ") : "Area not named";
}

/** "Malaysiakini and 4 more" reads better than a bare count. */
export function reports(statement: Statement): string {
  return statement.reports > 1 ? `${statement.outlet} and ${statement.reports - 1} more` : statement.outlet;
}

export function StatementRow({ statement }: { statement: Statement }) {
  const status = STATUS[statement.status];
  const settled = statement.status === "replaced" || statement.status === "ended";
  return (
    <li className="py-3.5">
      <div className="flex items-start gap-3">
        <span className="w-[52px] shrink-0 pt-0.5 text-caption text-ink-tertiary tabular-nums">{malaysiaDate(statement.publishedAt)}</span>
        <span className="mt-px shrink-0 rounded-sm bg-sunken px-1.5 py-0.5 text-caption font-semibold tracking-[0.04em] text-ink-secondary" title={statement.issuerName}>
          {badge(statement)}
        </span>
        <div className="min-w-0 grow">
          <p className={`text-body ${settled ? "text-ink-secondary" : "text-ink"}`}>{statement.summary}</p>
          <p className="mt-0.5 flex flex-wrap gap-x-3 text-caption text-ink-tertiary">
            <span>
              {areas(statement)}
              {statement.effectiveFrom ? `, from ${dayName(statement.effectiveFrom)}` : ""}
              {statement.effectiveUntil ? ` until ${dayName(statement.effectiveUntil)}` : ""}
            </span>
            <a href={statement.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 hover:text-accent">
              {reports(statement)}
              <Icon name="external" size={11} />
            </a>
          </p>
          <details className="group mt-1">
            <summary className="w-fit cursor-pointer list-none text-caption text-ink-tertiary hover:text-ink">
              <span className="group-open:hidden">Original wording</span>
              <span className="hidden group-open:inline">Hide wording</span>
            </summary>
            <blockquote lang="ms" className="mt-1.5 border-l-2 border-hairline-strong pl-3 text-small text-ink-secondary italic">
              {statement.quote}
            </blockquote>
          </details>
        </div>
        <span className={`shrink-0 rounded-full border px-2 py-0.5 text-caption font-medium ${status.className}`}>{status.label}</span>
      </div>
    </li>
  );
}
