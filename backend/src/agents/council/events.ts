import type { CouncilEvent, CouncilEventKind } from "../../contracts";

/**
 * Where a council run writes what happens, in order. The real one appends to
 * `council_events`; a test keeps them in memory. Sequence numbers are handed
 * out here, so concurrent seats never write the same one.
 */

type PayloadOf<K extends CouncilEventKind> = Extract<CouncilEvent, { kind: K }>["payload"];

export interface Emitter {
  emit<K extends CouncilEventKind>(kind: K, actor: string, payload: PayloadOf<K>): Promise<void>;
}

export type Sink = (event: { seq: number; kind: string; actor: string; payload: unknown }) => Promise<void>;

export function emitter(sink: Sink): Emitter {
  let seq = 0;
  // Writes go out one at a time in seq order, even when seats emit at once.
  let chain: Promise<void> = Promise.resolve();
  return {
    emit(kind, actor, payload) {
      const event = { seq: seq++, kind, actor, payload };
      chain = chain.then(() => sink(event));
      return chain;
    },
  };
}

/** A sink that keeps events in memory, for tests and for the situation script. */
export function memorySink(): { sink: Sink; events: { seq: number; kind: string; actor: string; payload: unknown }[] } {
  const events: { seq: number; kind: string; actor: string; payload: unknown }[] = [];
  return { events, sink: async (event) => void events.push(event) };
}
