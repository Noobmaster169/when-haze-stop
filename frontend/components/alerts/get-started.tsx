"use client";

import { ReplayButton } from "./demo/replay-button";
import { FollowSearch } from "./follow-search";
import type { Follows } from "./use-follows";

/** What a browser that follows nothing sees first: what alerts are for, and the one step that starts them. */
export function GetStarted({ follows }: { follows: Follows }) {
  return (
    <section aria-labelledby="get-started" className="rounded-xl border border-hairline bg-surface p-6">
      <h2 id="get-started" className="font-display text-[24px] leading-8 text-ink">
        Know before schools close
      </h2>
      <p className="mt-1.5 max-w-[60ch] text-body text-ink-secondary">
        Follow a town and you are told when the forecast says its schools may close, when an official order covers it, and when the air is clearing. Search below to start.
      </p>
      <div className="mt-5">
        <FollowSearch follows={follows} />
      </div>
      <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-hairline-faint pt-4">
        <p className="text-small text-ink-tertiary">Not sure what you would get?</p>
        <ReplayButton label="Replay the evening of 8 October" />
      </div>
    </section>
  );
}
