"use client";

import useSWR from "swr";

import { Icon } from "@/components/ui/icons";
import { ChatConversationList } from "@/lib/api/chat-schemas";
import { parsedFetcher } from "@/lib/poll";
import { formatWhenShort } from "@/lib/when";

import { useDock } from "./dock-state";

/** Every conversation, most recently used first, in the dock. */
export function DockHistory({ onOpen }: { onOpen(): void }) {
  const dock = useDock();
  const { data, error, mutate } = useSWR("/api/chat/conversations", parsedFetcher(ChatConversationList), { keepPreviousData: true });
  const conversations = data?.conversations ?? [];

  async function remove(id: string): Promise<void> {
    const response = await fetch(`/api/chat/${id}`, { method: "DELETE" });
    if (!response.ok) return;
    if (id === dock.conversationId) dock.startNew();
    await mutate();
  }

  return (
    <ul className="min-h-0 grow overflow-y-auto p-2" aria-label="Conversations">
      {conversations.map((conversation) => {
        const here = conversation.id === dock.conversationId;
        return (
          <li key={conversation.id} className={`group flex items-center rounded-md ${here ? "bg-accent-tint" : "hover:bg-sunken"}`}>
            <button
              type="button"
              onClick={() => {
                if (!here) dock.openThread(conversation.id);
                onOpen();
              }}
              aria-current={here ? "true" : undefined}
              className="min-w-0 grow px-2.5 py-2 text-left"
            >
              <span className={`block truncate text-small ${here ? "text-accent" : "text-ink"}`}>{conversation.title ?? "A new question"}</span>
              <span className="mt-0.5 block text-caption text-ink-faint">{formatWhenShort(conversation.updatedAt)} UTC</span>
            </button>
            <button
              type="button"
              onClick={() => void remove(conversation.id)}
              aria-label={`Delete ${conversation.title ?? "this conversation"}`}
              className="mr-1.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-sm text-ink-faint opacity-0 hover:bg-active hover:text-fault focus-visible:opacity-100 group-hover:opacity-100"
            >
              <Icon name="trash" size={13} />
            </button>
          </li>
        );
      })}
      {data && conversations.length === 0 ? <li className="px-2.5 py-3 text-caption text-ink-faint">Nothing asked yet.</li> : null}
      {error ? <li className="px-2.5 py-3 text-caption text-fault">The history could not be read.</li> : null}
    </ul>
  );
}
