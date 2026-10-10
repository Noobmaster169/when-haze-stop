import { breathe, curveBetween, drift, easeInOut, type Frame, pointOn, ringOut, type Seat, springIn } from "./layout";
import { ABSORB, pairKey, type Scene } from "./scene";
import { ACT_COLOUR, ENGINE_TOOLS, KIND_COLOUR } from "./words";

/**
 * One frame of the council table, written straight onto the SVG the graph
 * rendered once. Only transforms, opacities and the odd colour change: no
 * element is created or removed per frame, so the browser never lays out.
 */

export interface NodeRefs {
  group: SVGGElement;
  halo: SVGCircleElement;
  burst: SVGCircleElement;
  ring: SVGCircleElement;
  /** The engine has no label under it: its name is inside the disc. */
  label?: SVGTextElement;
}

export interface SatelliteRefs {
  group: SVGGElement;
  tether: SVGLineElement;
  body: SVGCircleElement;
  flash: SVGCircleElement;
}

export interface PulseRefs {
  head: SVGGElement;
  core: SVGCircleElement;
  glow: SVGCircleElement;
  tail: SVGCircleElement[];
}

export interface GraphRefs {
  nodes: Map<string, NodeRefs>;
  threads: Map<string, SVGPathElement>;
  satellites: SatelliteRefs[];
  pulses: PulseRefs[];
  engineGlow: SVGCircleElement | null;
}

export interface PaintMemory {
  focus: Map<string, number>;
  halo: Map<string, number>;
  ring: Map<string, number>;
  engine: number;
  threadCounts: Map<string, number>;
}

export const newMemory = (): PaintMemory => ({ focus: new Map(), halo: new Map(), ring: new Map(), engine: 0, threadCounts: new Map() });

const set = (element: Element, name: string, value: string) => {
  if (element.getAttribute(name) !== value) element.setAttribute(name, value);
};

/** Eases a remembered value toward its target, so focus and halos fade instead of blinking between short beats. */
function approach(memory: Map<string, number>, key: string, target: number, rate: number): number {
  const next = (memory.get(key) ?? target) + (target - (memory.get(key) ?? target)) * rate;
  memory.set(key, next);
  return next;
}

function speakColour(scene: Scene): string {
  const event = scene.event;
  if (event?.kind === "message") return ACT_COLOUR[event.payload.act];
  if (event?.kind === "verdict") return "var(--accent)";
  if (event?.kind === "candidate") return "var(--signal)";
  return "var(--ink-tertiary)";
}

export function paint(scene: Scene, refs: GraphRefs, seats: Map<string, Seat>, frame: Frame, memory: PaintMemory, wall: number, dt: number, reduced: boolean): void {
  const rate = Math.min(1, dt * 7);
  const present = new Map(scene.agents.map((agent) => [agent.id, agent]));
  const wander = reduced ? 0 : 3.2;

  for (const [id, node] of refs.nodes) {
    const agent = present.get(id);
    const seat = seats.get(id);
    if (!agent || !seat) {
      set(node.group, "opacity", "0");
      memory.focus.delete(id);
      continue;
    }
    const since = scene.t - agent.joinedAt;
    const scale = reduced ? 1 : springIn(since * 1.15);
    const appear = Math.min(1, since / (reduced ? 0.5 : 0.18));
    const focus = approach(memory.focus, id, agent.focus ? 1 : 0.4, rate);
    const nudge = reduced || agent.landedAt === null ? 0 : ringOut(scene.t - agent.landedAt) * 6;
    const { dx, dy } = agent.kind === "engine" ? { dx: 0, dy: 0 } : drift(id, wall, wander);
    const x = seat.x + dx + Math.cos(seat.angle) * nudge;
    const y = seat.y + dy + Math.sin(seat.angle) * nudge;
    set(node.group, "transform", `translate(${x.toFixed(2)} ${y.toFixed(2)}) scale(${Math.max(0.001, scale).toFixed(3)})`);
    set(node.group, "opacity", (appear * focus).toFixed(3));

    const burst = reduced ? 1 : Math.min(1, since / 0.9);
    set(node.burst, "opacity", burst >= 1 ? "0" : (0.55 * (1 - burst)).toFixed(3));
    set(node.burst, "transform", `scale(${(1 + 1.8 * easeInOut(burst)).toFixed(3)})`);

    const halo = approach(memory.halo, id, agent.state === "thinking" ? 1 : 0, rate * 0.6);
    const breath = reduced ? 0.5 : breathe(wall, 2.8);
    set(node.halo, "opacity", (halo * (0.12 + 0.16 * breath)).toFixed(3));
    set(node.halo, "transform", `scale(${(1.25 + 0.3 * breath).toFixed(3)})`);

    const speaking = approach(memory.ring, id, agent.state === "speaking" ? 1 : 0, rate * 1.4);
    set(node.ring, "opacity", speaking.toFixed(3));
    if (agent.state === "speaking") set(node.ring, "stroke", speakColour(scene));
    if (node.label) set(node.label, "fill", agent.focus && agent.state !== "idle" ? "var(--ink)" : "var(--ink-secondary)");
  }

  if (refs.engineGlow) {
    memory.engine += ((scene.engineLit ? 1 : 0) - memory.engine) * rate;
    const pulse = reduced ? 0.5 : breathe(wall, 1.4);
    set(refs.engineGlow, "opacity", (memory.engine * (0.25 + 0.3 * pulse)).toFixed(3));
    set(refs.engineGlow, "transform", `scale(${(1 + 0.18 * pulse).toFixed(3)})`);
  }

  const counts = new Map(scene.threads.map((thread) => [pairKey(thread.a, thread.b), thread.count]));
  for (const [key, path] of refs.threads) {
    const count = counts.get(key) ?? 0;
    if (memory.threadCounts.get(key) === count) continue;
    memory.threadCounts.set(key, count);
    set(path, "opacity", count === 0 ? "0" : Math.min(0.42, 0.14 + 0.035 * count).toFixed(3));
    set(path, "stroke-width", (0.7 + 0.85 * Math.sqrt(count)).toFixed(2));
  }

  const perAgent = new Map<string, number>();
  const shown = scene.satellites.slice(0, refs.satellites.length);
  refs.satellites.forEach((satellite, slot) => {
    const call = shown[slot];
    const seat = call ? seats.get(call.agent) : undefined;
    if (!call || !seat) {
      set(satellite.group, "opacity", "0");
      set(satellite.tether, "opacity", "0");
      return;
    }
    const order = perAgent.get(call.agent) ?? 0;
    perAgent.set(call.agent, order + 1);
    // Seats in the lower half bud sideways, so a satellite never lands on the name under the node.
    const lower = Math.sin(seat.angle) > 0.2 ? (Math.cos(seat.angle) >= 0 ? -1.1 : 1.1) : 0;
    const angle = seat.angle + lower + (order % 2 === 0 ? 1 : -1) * Math.ceil(order / 2) * 0.55;
    const reach = frame.node + 17;
    const bud = reduced ? 1 : springIn((scene.t - call.start) * 1.4);
    const absorbed = call.resultAt === null ? 0 : easeInOut((scene.t - call.resultAt) / ABSORB);
    const out = reach * bud * (1 - absorbed);
    const x = seat.x + Math.cos(angle) * out;
    const y = seat.y + Math.sin(angle) * out;
    const running = call.resultAt === null || scene.t < call.resultAt ? 1 + (reduced ? 0 : 0.14 * Math.sin(wall * 7)) : 1;
    const colour = ENGINE_TOOLS.has(call.tool) ? "var(--verdict-review)" : call.ok === false ? "var(--verdict-fault)" : KIND_COLOUR[present.get(call.agent)?.kind ?? "seat"];
    set(satellite.body, "fill", colour);
    set(satellite.flash, "stroke", colour);
    set(satellite.group, "transform", `translate(${x.toFixed(2)} ${y.toFixed(2)}) scale(${(Math.max(0.001, bud * (1 - absorbed)) * running).toFixed(3)})`);
    set(satellite.group, "opacity", reduced ? (1 - absorbed).toFixed(3) : "1");
    // The flash plays once, from the moment the result comes back; before that it is spent.
    const flash = call.resultAt === null || scene.t < call.resultAt ? 1 : Math.min(1, (scene.t - call.resultAt) / 0.35);
    set(satellite.flash, "opacity", flash >= 1 ? "0" : (0.7 * (1 - flash)).toFixed(3));
    set(satellite.flash, "transform", `scale(${(1 + 1.6 * flash).toFixed(3)})`);
    set(satellite.tether, "x1", seat.x.toFixed(1));
    set(satellite.tether, "y1", seat.y.toFixed(1));
    set(satellite.tether, "x2", x.toFixed(1));
    set(satellite.tether, "y2", y.toFixed(1));
    set(satellite.tether, "opacity", (0.75 * (1 - absorbed)).toFixed(3));
  });

  refs.pulses.forEach((pulse, slot) => {
    const flight = scene.pulses[slot];
    const from = flight ? seats.get(flight.from) : undefined;
    const to = flight ? seats.get(flight.to) : undefined;
    if (!flight || !from || !to) {
      set(pulse.head, "opacity", "0");
      pulse.tail.forEach((dot) => set(dot, "opacity", "0"));
      return;
    }
    const curve = curveBetween(from, to, flight.from > flight.to);
    const colour = ACT_COLOUR[flight.act];
    set(pulse.core, "fill", colour);
    set(pulse.glow, "fill", colour);
    if (reduced) {
      const at = pointOn(curve, 1);
      set(pulse.head, "transform", `translate(${at.x.toFixed(2)} ${at.y.toFixed(2)})`);
      set(pulse.head, "opacity", Math.sin(Math.PI * flight.progress).toFixed(3));
      return;
    }
    const share = easeInOut(flight.progress);
    const at = pointOn(curve, share);
    set(pulse.head, "transform", `translate(${at.x.toFixed(2)} ${at.y.toFixed(2)})`);
    set(pulse.head, "opacity", Math.min(1, flight.progress * 8, (1 - flight.progress) * 10).toFixed(3));
    pulse.tail.forEach((dot, index) => {
      const behind = Math.max(0, share - 0.035 * (index + 1));
      const spot = pointOn(curve, behind);
      set(dot, "fill", colour);
      set(dot, "transform", `translate(${spot.x.toFixed(2)} ${spot.y.toFixed(2)})`);
      set(dot, "opacity", (behind <= 0 ? 0 : 0.45 - 0.12 * index).toFixed(3));
    });
  });
}
