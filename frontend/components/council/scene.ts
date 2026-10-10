import type { CouncilEvent } from "@/lib/api/council-schemas";

import { captionFor } from "./caption";
import { ownerOf } from "./owner";
import { type Agent, beatIndexAt, type Call, type Delivery, type StageMark, type Timeline } from "./timeline";
import { type Tray, trayAt } from "./tray";
import { ENGINE_TOOLS } from "./words";

/**
 * What the council table looks like at playback time `t`, as a pure function
 * of the timeline and `t`. The graph draws this every frame, so scrubbing back
 * costs the same as playing forward and nothing is remembered between frames.
 */

/** How long a satellite takes to fold back into its agent after the result. */
export const ABSORB = 0.45;
/** How long a node counts as receiving after a pulse lands. */
const RECEIVE_HOLD = 0.45;

export type NodeState = "idle" | "thinking" | "speaking" | "receiving";

export interface AgentNode extends Agent {
  state: NodeState;
  /** In the event now playing, or nothing is singled out. Others dim. */
  focus: boolean;
  /** When the latest pulse landed on it, for the nudge; null for never. */
  landedAt: number | null;
}

export interface Pulse extends Delivery {
  /** 0 at the sender, 1 at the recipient. */
  progress: number;
}

export interface Thread {
  a: string;
  b: string;
  count: number;
}

export interface Scene {
  t: number;
  index: number;
  event: CouncilEvent | null;
  stage: StageMark | null;
  agents: AgentNode[];
  satellites: Call[];
  pulses: Pulse[];
  threads: Thread[];
  engineLit: boolean;
  caption: string;
  tray: Tray;
}

/** Everyone an event is about. Empty for the events about the whole table, which dim nobody. */
export function involved(event: CouncilEvent | null): Set<string> {
  if (!event) return new Set();
  if (event.kind === "message") return new Set([event.payload.from, ...event.payload.to]);
  if (event.kind === "agent_joined") return new Set([event.payload.agent]);
  const owner = ownerOf(event);
  return new Set(owner ? [owner] : []);
}

export function pairKey(a: string, b: string): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

export function sceneAt(timeline: Timeline, t: number): Scene {
  const index = beatIndexAt(timeline, t);
  const beat = index >= 0 ? timeline.beats[index] : null;
  const event = beat?.event ?? null;
  const focusSet = involved(event);

  const pulses: Pulse[] = [];
  const landed = new Map<string, number>();
  const counts = new Map<string, Thread>();
  for (const delivery of timeline.deliveries) {
    if (delivery.depart > t) break;
    if (t < delivery.arrive) {
      pulses.push({ ...delivery, progress: (t - delivery.depart) / (delivery.arrive - delivery.depart) });
      continue;
    }
    landed.set(delivery.to, delivery.arrive);
    const key = pairKey(delivery.from, delivery.to);
    const thread = counts.get(key) ?? { a: delivery.from < delivery.to ? delivery.from : delivery.to, b: delivery.from < delivery.to ? delivery.to : delivery.from, count: 0 };
    thread.count += 1;
    counts.set(key, thread);
  }

  const satellites = timeline.calls.filter((call) => call.start <= t && (call.resultAt === null || t < call.resultAt + ABSORB));
  const thinking = new Set(timeline.thoughts.filter((thought) => thought.start <= t && t < thought.end).map((thought) => thought.agent));
  const receiving = new Set(pulses.map((pulse) => pulse.to));
  for (const [agent, at] of landed) if (t - at < RECEIVE_HOLD) receiving.add(agent);
  const speaker = event && beat && t < beat.end && (event.kind === "message" || event.kind === "candidate" || event.kind === "vote" || event.kind === "verdict") ? ownerOf(event) : null;

  const agents: AgentNode[] = timeline.agents
    .filter((agent) => agent.joinedAt <= t)
    .map((agent) => ({
      ...agent,
      state: agent.id === speaker ? "speaking" : receiving.has(agent.id) ? "receiving" : thinking.has(agent.id) ? "thinking" : "idle",
      focus: focusSet.size === 0 || focusSet.has(agent.id),
      landedAt: landed.get(agent.id) ?? null,
    }));

  const engineLit = satellites.some((call) => ENGINE_TOOLS.has(call.tool) && (call.resultAt === null || t < call.resultAt + ABSORB)) || event?.kind === "simulation";
  let stage: StageMark | null = null;
  for (const mark of timeline.stages) if (mark.start <= t) stage = mark;

  return {
    t,
    index,
    event,
    stage,
    agents,
    satellites,
    pulses,
    threads: [...counts.values()],
    engineLit,
    caption: captionFor(event, timeline.agents),
    tray: trayAt(timeline, index),
  };
}
