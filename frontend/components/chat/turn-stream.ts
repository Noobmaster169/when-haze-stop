import { z } from "zod";

import { ChatAnswer, ChatProgress, ChatToolCall } from "@/lib/api/chat-schemas";

import { eventFrames } from "./sse";

const Step = z.object({ calls: z.array(ChatToolCall) });

/**
 * One streamed turn, as the things that can actually happen to it.
 *
 * This is the contract boundary: frames arrive as text and leave as values the
 * page can draw, or not at all. A `progress` or `step` frame that does not
 * parse is dropped and the next one is taken: both are repaints of something
 * about to be replaced by the answer. An `answer` that does not parse is the
 * turn, so it becomes a failure.
 */

export type TurnEvent =
  | { kind: "progress"; progress: ChatProgress }
  | { kind: "calls"; calls: ChatToolCall[] }
  | { kind: "answer"; answer: ChatAnswer }
  | { kind: "failure"; message: string };

function body(data: string): unknown {
  try {
    return JSON.parse(data) as unknown;
  } catch {
    return null;
  }
}

export async function* turnEvents(stream: ReadableStream<Uint8Array>): AsyncGenerator<TurnEvent> {
  for await (const frame of eventFrames(stream)) {
    if (frame.event === "progress") {
      const parsed = ChatProgress.safeParse(body(frame.data));
      if (parsed.success) yield { kind: "progress", progress: parsed.data };
    } else if (frame.event === "step") {
      const parsed = Step.safeParse(body(frame.data));
      if (parsed.success) yield { kind: "calls", calls: parsed.data.calls };
    } else if (frame.event === "answer") {
      const parsed = ChatAnswer.safeParse(body(frame.data));
      if (parsed.success) yield { kind: "answer", answer: parsed.data };
      else yield { kind: "failure", message: "The answer arrived outside the contract. Reopen the conversation to read what was stored." };
    } else if (frame.event === "failure") {
      const said = body(frame.data) as { error?: unknown } | null;
      yield { kind: "failure", message: typeof said?.error === "string" ? said.error : "The answer did not arrive." };
    }
  }
}
