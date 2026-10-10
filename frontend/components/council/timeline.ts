import type { AgentKind, CouncilEvent, CouncilEventKind, MessageAct, StageId } from "@/lib/api/council-schemas";

import { ownerOf } from "./owner";

/**
 * When each recorded event plays. Pure.
 *
 * A run spends most of its time waiting on models, 20 to 60 seconds a call, so
 * the recorded `at` gaps are thrown away: every event gets a fixed beat by its
 * kind and the events play back to back in `seq` order. A run of a few hundred
 * events then plays in a few minutes at 1x, and the same events always give the
 * same timeline, which is what lets scrubbing back equal playing forward.
 */

export const BEATS: Record<Exclude<CouncilEventKind, "message">, number> = {
  run_started: 1.4,
  stage: 1.4,
  agent_joined: 0.6,
  thinking: 0.7,
  tool_call: 0.3,
  tool_result: 0.12,
  candidate: 0.9,
  simulation: 0.5,
  vote: 0.4,
  verdict: 2,
  run_finished: 1.2,
  run_failed: 1.2,
};

/** A message: the speaker lights, the pulses travel two at a time, the room settles. */
const MESSAGE_LEAD = 0.35;
const MESSAGE_SETTLE = 0.25;
const TRAVEL = 0.9;
/** A broadcast to the whole table shares this much travel time among its waves, so it does not drag. */
const BROADCAST_TRAVEL = 2.6;
/** At most this many pulses in flight at once; the rest wait for the next wave. */
export const PULSES_AT_ONCE = 2;
/** A thinking halo stays on until the agent acts, but never longer than this. */
const THINKING_MAX = 6;

export interface Beat {
  event: CouncilEvent;
  start: number;
  end: number;
}

export interface StageMark {
  stage: StageId;
  title: string;
  index: number;
  of: number;
  start: number;
}

export interface Agent {
  id: string;
  kind: AgentKind;
  title: string;
  institution: string;
  joinedAt: number;
}

export interface Delivery {
  from: string;
  to: string;
  act: MessageAct;
  depart: number;
  arrive: number;
}

export interface Call {
  callId: string;
  agent: string;
  tool: string;
  start: number;
  /** When the result comes back; null while a live run has not written it yet. */
  resultAt: number | null;
  ok: boolean | null;
}

export type Thought = { agent: string; start: number; end: number };

export interface Timeline {
  beats: Beat[];
  duration: number;
  stages: StageMark[];
  /** In the order they joined. */
  agents: Agent[];
  deliveries: Delivery[];
  calls: Call[];
  thoughts: Thought[];
}

function messageWaves(recipients: number): { waves: number; travel: number } {
  const waves = Math.max(1, Math.ceil(recipients / PULSES_AT_ONCE));
  return { waves, travel: Math.min(TRAVEL, BROADCAST_TRAVEL / waves) };
}

export function beatLength(event: CouncilEvent): number {
  if (event.kind !== "message") return BEATS[event.kind];
  const { waves, travel } = messageWaves(event.payload.to.length);
  return MESSAGE_LEAD + waves * travel + MESSAGE_SETTLE;
}

export function buildTimeline(events: CouncilEvent[]): Timeline {
  const sorted = [...events].sort((a, b) => a.seq - b.seq);
  const beats: Beat[] = [];
  const stages: StageMark[] = [];
  const agents: Agent[] = [];
  /** The first beat each agent takes part in. A seat can be briefed before its own join event; it is seated from then. */
  const firstSeen = new Map<string, number>();
  const seen = (id: string, at: number) => void (firstSeen.has(id) || firstSeen.set(id, at));
  const deliveries: Delivery[] = [];
  const calls: Call[] = [];
  const thoughts: Thought[] = [];
  // A seat in two turns at once reuses call ids, so results pair with the oldest open call of that id.
  const openCalls = new Map<string, Call[]>();
  const openThoughts = new Map<string, Thought>();
  let clock = 0;

  for (const event of sorted) {
    const start = clock;
    const end = start + beatLength(event);
    beats.push({ event, start, end });
    clock = end;

    const owner = ownerOf(event);
    if (owner) seen(owner, start);
    if (event.kind === "message") event.payload.to.forEach((id) => seen(id, start));
    const thought = owner ? openThoughts.get(owner) : undefined;
    if (thought && event.kind !== "thinking") {
      thought.end = Math.min(thought.end, start);
      openThoughts.delete(owner!);
    }

    switch (event.kind) {
      case "stage":
        stages.push({ stage: event.payload.stage, title: event.payload.title, index: event.payload.index, of: event.payload.of, start });
        break;
      case "agent_joined":
        if (!agents.some((agent) => agent.id === event.payload.agent)) {
          agents.push({ id: event.payload.agent, kind: event.payload.kind, title: event.payload.title, institution: event.payload.institution, joinedAt: Math.min(start, firstSeen.get(event.payload.agent) ?? start) });
        }
        break;
      case "thinking": {
        if (thought) thought.end = Math.min(thought.end, start);
        const next = { agent: event.payload.agent, start, end: start + THINKING_MAX };
        thoughts.push(next);
        openThoughts.set(event.payload.agent, next);
        break;
      }
      case "tool_call": {
        const call: Call = { callId: event.payload.callId, agent: event.payload.agent, tool: event.payload.tool, start, resultAt: null, ok: null };
        calls.push(call);
        openCalls.set(call.callId, [...(openCalls.get(call.callId) ?? []), call]);
        break;
      }
      case "tool_result": {
        const call = openCalls.get(event.payload.callId)?.shift();
        if (call) {
          call.resultAt = start;
          call.ok = event.payload.ok;
        }
        break;
      }
      case "message": {
        const { travel } = messageWaves(event.payload.to.length);
        event.payload.to.forEach((to, position) => {
          const depart = start + MESSAGE_LEAD + Math.floor(position / PULSES_AT_ONCE) * travel;
          deliveries.push({ from: event.payload.from, to, act: event.payload.act, depart, arrive: depart + travel });
        });
        break;
      }
      default:
        break;
    }
  }
  agents.sort((a, b) => a.joinedAt - b.joinedAt);
  return { beats, duration: clock, stages, agents, deliveries, calls, thoughts };
}

/** The index of the beat playing at `t`: the last one started by then, -1 before the first. */
export function beatIndexAt(timeline: Timeline, t: number): number {
  let low = 0;
  let high = timeline.beats.length - 1;
  let found = -1;
  while (low <= high) {
    const middle = (low + high) >> 1;
    if (timeline.beats[middle].start <= t) {
      found = middle;
      low = middle + 1;
    } else {
      high = middle - 1;
    }
  }
  return found;
}
