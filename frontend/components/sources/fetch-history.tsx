import Link from "next/link";

import { Icon } from "@/components/ui/icons";
import type { SourceFetchPage } from "@/lib/api/source-schemas";
import { malaysiaWhen } from "@/lib/malaysia-time";

import { type Dataset, resultOf } from "./datasets";
import { duration } from "./source-state";

/** A dataset's fetches five at a time, newest first, paged through its own query parameter so the other sections stay put. */

function pageHref(params: Record<string, string>, key: string, page: number): string {
  const next = new URLSearchParams(params);
  if (page <= 1) next.delete(key);
  else next.set(key, String(page));
  const query = next.toString();
  return query ? `/sources?${query}` : "/sources";
}

export function FetchHistory({ dataset, page, params }: { dataset: Dataset; page: SourceFetchPage | null; params: Record<string, string> }) {
  if (!page) return <p className="mt-6 text-small text-fault">The fetch history could not be read.</p>;
  if (page.total === 0) return null;

  const first = (page.page - 1) * page.pageSize + 1;
  const last = first + page.fetches.length - 1;
  const pages = Math.ceil(page.total / page.pageSize);
  const pager = "inline-flex size-7 items-center justify-center rounded-sm border border-hairline text-ink-secondary hover:bg-active";

  return (
    <div className="mt-6">
      <div className="flex items-center justify-between">
        <h3 className="text-strong font-medium text-ink">Recent fetches</h3>
        <div className="flex items-center gap-2 text-caption text-ink-tertiary">
          <span>
            {first} to {last} of {page.total.toLocaleString("en-GB")}
          </span>
          {page.page > 1 ? (
            <Link href={pageHref(params, dataset.key, page.page - 1)} scroll={false} className={pager} aria-label="Newer fetches">
              <Icon name="left" size={13} />
            </Link>
          ) : null}
          {page.page < pages ? (
            <Link href={pageHref(params, dataset.key, page.page + 1)} scroll={false} className={pager} aria-label="Older fetches">
              <Icon name="right" size={13} />
            </Link>
          ) : null}
        </div>
      </div>
      <ol className="mt-2">
        {page.fetches.map((fetch) => (
          <li key={fetch.id} className="grid grid-cols-[20px_minmax(0,9rem)_4.5rem_minmax(0,1fr)] items-center gap-3 border-t border-hairline-faint py-2 text-small">
            <span className={fetch.ok ? "text-match" : "text-fault"}>
              <Icon name={fetch.ok ? "check" : "alert"} size={14} />
              <span className="sr-only">{fetch.ok ? "Fetched" : "Failed"}</span>
            </span>
            <span className="text-ink-secondary">{malaysiaWhen(fetch.startedAt)}</span>
            <span className="text-right text-ink-tertiary">{duration(fetch)}</span>
            <span className={`truncate ${fetch.ok ? "text-ink" : "text-fault"}`}>{resultOf(dataset, fetch)}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}
