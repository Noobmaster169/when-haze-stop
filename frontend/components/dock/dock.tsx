"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import useSWR from "swr";
import { z } from "zod";

import { Composer } from "@/components/chat/composer";
import { PendingTurn, Turn } from "@/components/chat/turn";
import { useChat } from "@/components/chat/use-chat";
import { ChatThread, type ChatTurn } from "@/lib/api/chat-schemas";
import { parsedFetcher } from "@/lib/poll";

import { DockHeader, type DockView } from "./dock-header";
import { DockHistory } from "./dock-history";
import { useDock } from "./dock-state";

/**
 * The 380px dock on the right of every page. Mounted once, in the layout, so
 * a question asked on one page is still being answered on the next. It resumes
 * the conversation it was left in, and its History lists every other one.
 *
 * Below 1280px it is a sheet over the page rather than a column, which keeps
 * the page from moving when it opens.
 */

const Held = z.object({ thread: ChatThread.nullable() });

const noop = () => () => undefined;

/** False during hydration, when the store still answers with the server's empty snapshot. */
function useHydrated(): boolean {
  return useSyncExternalStore(
    noop,
    () => true,
    () => false,
  );
}

export function Dock() {
  const dock = useDock();
  // The remembered conversation is read from local storage, which the server
  // cannot see; seeding before hydration would resume nothing every time.
  const hydrated = useHydrated();
  if (!dock.open || !hydrated) return null;
  return (
    <aside
      aria-label="Ask Haze"
      className="fixed inset-y-0 right-0 z-30 flex w-full max-w-[380px] shrink-0 flex-col border-l border-hairline bg-surface shadow-overlay xl:static xl:shadow-none"
    >
      {/* Keyed on the thread counter, so New and an opened history item start fresh while the first question's own conversation does not remount it. */}
      <DockSeed key={dock.thread} />
    </aside>
  );
}

/**
 * Reads the remembered conversation once, then hands its turns to the thread.
 * `useChat` seeds from `initial` on mount, so the thread is rendered only when
 * there is something to seed it with, or nothing to fetch.
 */
function DockSeed() {
  const dock = useDock();
  // Captured at mount: the id the first question sets afterwards must not refetch.
  const [seedId] = useState(dock.conversationId);
  const { data, error } = useSWR(seedId ? `/api/chat/${seedId}` : null, parsedFetcher(Held), { revalidateOnFocus: false });
  if (seedId && !data && !error) {
    return <div className="flex grow items-center justify-center text-caption text-ink-faint">Picking up where you left off</div>;
  }
  // A conversation nobody holds any more starts the dock fresh rather than failing it.
  return <DockThread initial={data?.thread?.turns ?? []} title={data?.thread?.conversation.title ?? null} />;
}

function DockThread({ initial, title }: { initial: ChatTurn[]; title: string | null }) {
  const dock = useDock();
  const [view, setView] = useState<DockView>("thread");
  const chat = useChat({ conversationId: dock.conversationId, initial, onOpened: dock.setConversationId });
  const foot = useRef<HTMLDivElement>(null);
  useEffect(() => {
    foot.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [chat.turns.length, chat.pending, chat.progress?.answer, chat.calls.length]);

  return (
    <>
      <DockHeader
        title={title ?? chat.turns[0]?.content ?? "A new question"}
        view={view}
        onView={setView}
        canStartNew={chat.turns.length > 0 || dock.conversationId !== null}
      />

      {view === "history" ? (
        <DockHistory onOpen={() => setView("thread")} />
      ) : (
        <div className="min-h-0 grow space-y-5 overflow-y-auto px-[18px] py-4">
          {chat.turns.length === 0 && !chat.pending ? (
            <p className="text-small leading-[19px] text-ink-tertiary">Ask anything. The assistant can call the tools and skills defined in the backend.</p>
          ) : null}
          {chat.turns.map((turn, index) => (
            <Turn key={turn.id} turn={turn} exhausted={chat.exhausted && index === chat.turns.length - 1} />
          ))}
          {chat.pending ? <PendingTurn progress={chat.progress} calls={chat.calls} /> : null}
          {chat.error ? <p className="rounded-md border border-fault-line bg-fault-tint px-3 py-2 text-small text-fault">{chat.error}</p> : null}
          <div ref={foot} />
        </div>
      )}

      <Composer
        onAsk={(question) => {
          setView("thread");
          chat.ask(question);
        }}
        onStop={chat.stop}
        pending={chat.pending}
        placeholder="Ask a question"
      />
    </>
  );
}
