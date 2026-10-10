import type { MessageAct } from "../../../contracts";
import { figuresIn, unverified } from "../fact-check";
import type { TurnDeps } from "../turn";

let counter = 0;

/** A message on the replay, with any figure the sender was not shown flagged. */
export async function say(
  deps: TurnDeps,
  message: { from: string; to: string[]; act: MessageAct; headline: string; detail: string; planId?: string | null; seen: string[] },
): Promise<void> {
  // The engine's own messages are written by code from the scores; there is nothing to check them against.
  const seen = message.from === "engine" ? null : figuresIn(message.seen);
  await deps.emit.emit("message", message.from, {
    id: `m${++counter}`,
    from: message.from,
    to: message.to,
    act: message.act,
    headline: message.headline,
    detail: message.detail,
    planId: message.planId ?? null,
    unverified: seen ? unverified(`${message.headline}\n${message.detail}`, seen) : [],
  });
}
