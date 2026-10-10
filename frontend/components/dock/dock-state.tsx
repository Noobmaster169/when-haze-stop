"use client";

import { createContext, useCallback, useContext, useMemo, useState, useSyncExternalStore, type ReactNode } from "react";

import { rememberedConversation } from "./remembered";

/**
 * What the dock holds across pages: whether it is open and which conversation
 * it is in. The turns themselves live in `useChat` inside the panel, which
 * survives navigation because the panel is in the layout.
 *
 * Both are remembered in local storage, so a reload resumes the conversation.
 */

interface DockState {
  open: boolean;
  setOpen(open: boolean): void;
  conversationId: string | null;
  /** Records the conversation the thread is in without remounting it: the first question sets it mid-flight. */
  setConversationId(id: string | null): void;
  /** Rises when the thread must start over: New, or an older conversation opened from the history. */
  thread: number;
  startNew(): void;
  /** Opens an older conversation in the dock, seeding its turns. */
  openThread(id: string): void;
}

const Context = createContext<DockState | null>(null);

const OPEN_KEY = "haze.dock.open";
const CONVERSATION_KEY = "haze.dock.conversation";

function stored(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    // A private window keeps nothing; the session still works.
    return null;
  }
}

function store(key: string, value: string | null): void {
  try {
    if (value === null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, value);
  } catch {
    // As above: nothing is kept, and nothing depends on it being kept.
  }
}

/** What was remembered; with nothing remembered, open only where the dock has a column of its own rather than covering the page. */
function rememberedOpen(): boolean {
  const held = stored(OPEN_KEY);
  if (held !== null) return held !== "closed";
  return window.matchMedia("(min-width: 1280px)").matches;
}

/** Storage fires for other tabs only; this tab's own change goes through the state below. */
function subscribe(onChange: () => void): () => void {
  window.addEventListener("storage", onChange);
  return () => window.removeEventListener("storage", onChange);
}

export function DockProvider({ children }: { children: ReactNode }) {
  // The server renders the dock open; the client reads what was remembered
  // without a hydration mismatch, and a choice made on this page wins.
  const wasOpen = useSyncExternalStore(subscribe, rememberedOpen, () => true);
  const [override, setOverride] = useState<boolean | null>(null);
  const open = override ?? wasOpen;
  const rememberedId = useSyncExternalStore(subscribe, () => rememberedConversation(stored(CONVERSATION_KEY)), () => null);
  const [chosenId, setChosenId] = useState<string | null | undefined>(undefined);
  const conversationId = chosenId === undefined ? rememberedId : chosenId;
  const [thread, setThread] = useState(0);

  const setOpen = useCallback((next: boolean) => {
    setOverride(next);
    store(OPEN_KEY, next ? "open" : "closed");
  }, []);

  const setConversationId = useCallback((id: string | null) => {
    setChosenId(id);
    store(CONVERSATION_KEY, id);
  }, []);

  const startNew = useCallback(() => {
    setConversationId(null);
    setThread((was) => was + 1);
  }, [setConversationId]);

  const openThread = useCallback(
    (id: string) => {
      setConversationId(id);
      setThread((was) => was + 1);
    },
    [setConversationId],
  );

  const value = useMemo<DockState>(
    () => ({ open, setOpen, conversationId, setConversationId, thread, startNew, openThread }),
    [open, setOpen, conversationId, setConversationId, thread, startNew, openThread],
  );
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useDock(): DockState {
  const held = useContext(Context);
  if (!held) throw new Error("useDock outside the DockProvider");
  return held;
}
