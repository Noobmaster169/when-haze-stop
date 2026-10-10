import type { ChatProgress, ChatToolCall, ChatTurn } from "@/lib/api/chat-schemas";

import { Markdown } from "./markdown";
import { Sources } from "./sources";
import { ToolsUsed } from "./tools-used";

/**
 * One turn. What is on the page is the answer; how it got there is kept one
 * click down, in `ToolsUsed`.
 */
export function Turn({ turn, exhausted = false }: { turn: ChatTurn; exhausted?: boolean }) {
  if (turn.role === "user") {
    return (
      <div className="flex justify-end">
        <p className="max-w-[85%] whitespace-pre-wrap rounded-lg rounded-tr-xs bg-ink px-3.5 py-2.5 text-strong leading-[21px] text-ink-inverse">
          {turn.content}
        </p>
      </div>
    );
  }
  return (
    <div className="space-y-3">
      {turn.content ? <Markdown text={turn.content} /> : null}
      {turn.stopped ? <p className="text-caption text-ink-faint">Stopped.</p> : null}
      {exhausted ? (
        <p className="rounded-md border border-differ-line bg-differ-tint px-3 py-2 text-small text-differ-ink">
          The agent ran out of steps before it finished. What it looked at is below.
        </p>
      ) : null}
      <Sources calls={turn.toolCalls} />
      <ToolsUsed calls={turn.toolCalls} />
    </div>
  );
}

const SAYING: Record<ChatProgress["phase"], string> = { reading: "Thinking", looking: "Looking", writing: "Writing" };

/** The turn in flight: the answer as it is written, the calls as they finish, and a line saying which of the three it is doing. */
export function PendingTurn({ progress, calls }: { progress: ChatProgress | null; calls: ChatToolCall[] }) {
  const phase = progress?.phase ?? "reading";
  const running = phase === "looking" && progress ? `: ${progress.tools.join(", ")}` : "";
  return (
    <div className="space-y-3" aria-live="polite" aria-busy="true">
      {progress?.answer ? <Markdown text={progress.answer} /> : null}
      <ToolsUsed calls={calls} open />
      <p className="flex items-center gap-2 text-caption text-ink-tertiary">
        <span aria-hidden="true" className="h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-accent" />
        <span className="truncate">
          {SAYING[phase]}
          <span className="font-mono text-mono-xs">{running}</span>
        </span>
      </p>
    </div>
  );
}
