"use client";

import { useCallback, useRef, useState } from "react";

import { ChatConversation, type ChatProgress, type ChatToolCall, type ChatTurn } from "@/lib/api/chat-schemas";

import { turnEvents } from "./turn-stream";

/**
 * One conversation, as a component reads and writes it: the turns, the turn in
 * flight, and the two things a person can do, ask and stop.
 *
 * Held by the dock, which the layout mounts once, so a question asked on one
 * page is still being answered on the next.
 */

export interface ChatState {
  turns: ChatTurn[];
  ask(question: string): void;
  stop(): void;
  pending: boolean;
  /** Where the turn in flight has got to. Null when nothing is pending, and before its first frame. */
  progress: ChatProgress | null;
  /** The calls the turn in flight has finished. Emptied when the answer lands, which carries them itself. */
  calls: ChatToolCall[];
  error: string | null;
  /** True when the last answer ran out of its step budget. */
  exhausted: boolean;
}

/** Negative, so an optimistic turn can never collide with a stored one. */
let optimisticId = -1;

function optimistic(role: ChatTurn["role"], content: string, extra: Partial<ChatTurn> = {}): ChatTurn {
  return { id: optimisticId--, role, content, toolCalls: [], skillsUsed: [], stopped: false, createdAt: new Date().toISOString(), ...extra };
}

async function refusal(response: Response): Promise<string> {
  const body = (await response.json().catch(() => null)) as { error?: unknown } | null;
  return typeof body?.error === "string" ? body.error : `The request failed with ${response.status}.`;
}

export function useChat(options: {
  conversationId: string | null;
  initial: ChatTurn[];
  /** Told the id of the conversation the first question opened. */
  onOpened(id: string): void;
}): ChatState {
  const { onOpened } = options;
  const [turns, setTurns] = useState<ChatTurn[]>(options.initial);
  const [pending, setPending] = useState(false);
  const [progress, setProgress] = useState<ChatProgress | null>(null);
  const [calls, setCalls] = useState<ChatToolCall[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [exhausted, setExhausted] = useState(false);
  const conversation = useRef(options.conversationId);
  const abort = useRef<AbortController | null>(null);

  const ask = useCallback(
    (question: string) => {
      if (abort.current) return;
      const controller = new AbortController();
      abort.current = controller;
      const mine = optimistic("user", question);
      let written = "";
      let done: ChatToolCall[] = [];
      setTurns((was) => [...was, mine]);
      setPending(true);
      setProgress(null);
      setCalls([]);
      setError(null);
      setExhausted(false);

      const run = async (): Promise<void> => {
        if (!conversation.current) {
          const opened = await fetch("/api/chat/conversations", { method: "POST", signal: controller.signal });
          if (!opened.ok) throw new Error(await refusal(opened));
          conversation.current = ChatConversation.parse(await opened.json()).id;
          onOpened(conversation.current);
        }
        const response = await fetch(`/api/chat/${conversation.current}/messages`, {
          method: "POST",
          headers: { "content-type": "application/json", accept: "text/event-stream" },
          body: JSON.stringify({ content: question }),
          signal: controller.signal,
        });
        if (!response.ok || !response.body) throw new Error(await refusal(response));

        for await (const event of turnEvents(response.body)) {
          if (event.kind === "progress") {
            written = event.progress.answer || written;
            setProgress(event.progress);
          } else if (event.kind === "calls") {
            done = [...done, ...event.calls];
            setCalls(done);
          } else if (event.kind === "failure") {
            throw new Error(event.message);
          } else {
            const { asked, turn, exhausted: ranOut } = event.answer;
            setTurns((was) => [...was.filter((item) => item.id !== mine.id), asked, turn]);
            setExhausted(ranOut);
          }
        }
      };

      run()
        .catch((caught: unknown) => {
          // Stop is the person's own doing, not an error. The backend stores
          // the same partial turn; this is that turn drawn without a refetch.
          if (controller.signal.aborted) {
            setTurns((was) => [...was, optimistic("assistant", written, { toolCalls: done, stopped: true })]);
            return;
          }
          setError(caught instanceof Error ? caught.message : "The answer did not arrive.");
        })
        .finally(() => {
          abort.current = null;
          setPending(false);
          setProgress(null);
          setCalls([]);
        });
    },
    [onOpened],
  );

  const stop = useCallback(() => abort.current?.abort(), []);

  return { turns, ask, stop, pending, progress, calls, error, exhausted };
}
