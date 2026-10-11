import Link from "next/link";

import { Icon } from "@/components/ui/icons";
import type { StatementPage } from "@/lib/api/statement-schemas";

import { StatementRow } from "./statement-row";

/** What the government has said, five to a page: what is in force by default, everything on request. */

export interface StatementQuery {
  all: boolean;
  page: number;
}

function href(query: StatementQuery): string {
  const params = new URLSearchParams();
  if (query.all) params.set("statements", "all");
  if (query.page > 1) params.set("page", String(query.page));
  const text = params.toString();
  return text ? `/alerts?${text}#statements` : "/alerts#statements";
}

export function StatementList({ page, query }: { page: StatementPage | null; query: StatementQuery }) {
  const tab = (active: boolean): string => `h-7 rounded-sm px-2.5 text-small leading-7 ${active ? "bg-ink font-medium text-ink-inverse" : "text-ink-tertiary hover:bg-active hover:text-ink"}`;
  const pager = "inline-flex size-7 items-center justify-center rounded-sm border border-hairline text-ink-secondary hover:bg-active";

  return (
    <section id="statements" aria-labelledby="statements-title" className="scroll-mt-20">
      <div className="flex flex-wrap items-center gap-3">
        <h2 id="statements-title" className="text-title font-medium text-ink">
          Official statements
        </h2>
        <span className="grow" />
        <nav className="flex gap-0.5 rounded-md border border-hairline p-0.5" aria-label="Which statements">
          <Link href={href({ all: false, page: 1 })} scroll={false} aria-current={!query.all ? "page" : undefined} className={tab(!query.all)}>
            In force
          </Link>
          <Link href={href({ all: true, page: 1 })} scroll={false} aria-current={query.all ? "page" : undefined} className={tab(query.all)}>
            All
          </Link>
        </nav>
      </div>
      <p className="mt-1 text-small text-ink-secondary">Read each hour from the Education Ministry, DOE and the news, and shown only when the wording was found in the source.</p>

      {page === null ? <p className="mt-4 text-small text-fault">The statements could not be read.</p> : null}
      {page && page.total === 0 ? <p className="mt-4 text-small text-ink-tertiary">{query.all ? "No statement has been read yet." : "Nothing is in force now."}</p> : null}
      {page && page.total > 0 ? (
        <>
          <ul className="mt-2 divide-y divide-hairline-faint">
            {page.statements.map((statement) => (
              <StatementRow key={statement.id} statement={statement} />
            ))}
          </ul>
          {page.pages > 1 ? (
            <div className="mt-2 flex items-center justify-end gap-2 text-caption text-ink-tertiary">
              <span className="tabular-nums">
                Page {page.page} of {page.pages}
              </span>
              {page.page > 1 ? (
                <Link href={href({ ...query, page: page.page - 1 })} scroll={false} className={pager} aria-label="Newer statements">
                  <Icon name="left" size={13} />
                </Link>
              ) : null}
              {page.page < page.pages ? (
                <Link href={href({ ...query, page: page.page + 1 })} scroll={false} className={pager} aria-label="Older statements">
                  <Icon name="right" size={13} />
                </Link>
              ) : null}
            </div>
          ) : null}
        </>
      ) : null}
    </section>
  );
}
