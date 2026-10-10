import type { AgentKind } from "@/lib/api/council-schemas";

/**
 * Where each agent sits at the council table, and the small motions the graph
 * draws them with. Pure: positions depend only on who is in the run and the
 * frame size, motions only on time, so nothing is integrated between frames.
 */

export interface Frame {
  width: number;
  height: number;
  /** Node radius and label size, larger on a narrow frame so a phone can read them. */
  node: number;
  label: number;
}

export const WIDE: Frame = { width: 1000, height: 620, node: 21, label: 13 };
export const NARROW: Frame = { width: 560, height: 640, node: 19, label: 15 };

/** The table's seating order clockwise from the top. Seats retired from new runs stay listed so old replays still lay out. An agent this does not know sits after these. */
const ORDER = ["chair", "air_quality", "meteorology", "peat_science", "fire_operations", "force_command", "air_operations", "red_cell", "domestic_fire", "health", "sarawak", "foreign_affairs", "treasury"];

export interface Seat {
  x: number;
  y: number;
  /** The direction from the table's centre, for satellites to bud outward. */
  angle: number;
}

export function centre(frame: Frame): { x: number; y: number } {
  return { x: frame.width / 2, y: frame.height * 0.47 };
}

/** The table's half-widths: a wide oval on a desktop, rounder on a phone. */
export function ringRadii(frame: Frame): { rx: number; ry: number } {
  return { rx: frame.width * (frame.width > frame.height ? 0.37 : 0.39), ry: frame.height * 0.36 };
}

export function seatsFor(agents: { id: string; kind: AgentKind }[], frame: Frame): Map<string, Seat> {
  const seats = new Map<string, Seat>();
  const middle = centre(frame);
  const around = agents.filter((agent) => agent.kind !== "engine");
  const rank = (id: string) => {
    const known = ORDER.indexOf(id);
    return known === -1 ? ORDER.length + around.findIndex((agent) => agent.id === id) : known;
  };
  const ring = [...around].sort((a, b) => rank(a.id) - rank(b.id));
  const { rx, ry } = ringRadii(frame);
  ring.forEach((agent, position) => {
    const angle = -Math.PI / 2 + (2 * Math.PI * position) / Math.max(1, ring.length);
    seats.set(agent.id, { x: middle.x + rx * Math.cos(angle), y: middle.y + ry * Math.sin(angle), angle });
  });
  for (const agent of agents) if (agent.kind === "engine") seats.set(agent.id, { ...middle, angle: Math.PI / 2 });
  return seats;
}

/** A slow, small wander around the seat, different for every agent so the table breathes out of step. */
export function drift(id: string, seconds: number, amplitude: number): { dx: number; dy: number } {
  let seed = 0;
  for (const char of id) seed = (seed * 31 + char.charCodeAt(0)) % 997;
  const phase = (seed / 997) * Math.PI * 2;
  return {
    dx: amplitude * (Math.sin(seconds * 0.31 + phase) + 0.4 * Math.sin(seconds * 0.73 + phase * 2)),
    dy: amplitude * (Math.cos(seconds * 0.27 + phase * 1.3) + 0.4 * Math.sin(seconds * 0.61 + phase)),
  };
}

/** An underdamped spring from 0 to 1, settling in about a second: scale-in for a join or a bud. */
export function springIn(elapsed: number): number {
  if (elapsed <= 0) return 0;
  if (elapsed > 1.6) return 1;
  return 1 - Math.exp(-6 * elapsed) * Math.cos(9 * elapsed);
}

/** A kick that rings out: the nudge a node gives when a pulse lands, 0 at rest. */
export function ringOut(elapsed: number): number {
  if (elapsed < 0 || elapsed > 1.2) return 0;
  return Math.exp(-5 * elapsed) * Math.sin(14 * elapsed);
}

/** 0 to 1 and back, eased, over `period` seconds: a halo breathing. */
export function breathe(seconds: number, period: number): number {
  return 0.5 - 0.5 * Math.cos((2 * Math.PI * seconds) / period);
}

export function easeInOut(share: number): number {
  const s = Math.max(0, Math.min(1, share));
  return s < 0.5 ? 4 * s * s * s : 1 - (-2 * s + 2) ** 3 / 2;
}

export interface Curve {
  x0: number;
  y0: number;
  cx: number;
  cy: number;
  x1: number;
  y1: number;
}

/** A gentle bow between two seats, the same bow both ways so a thread is one line. */
export function curveBetween(a: { x: number; y: number }, b: { x: number; y: number }, flip: boolean): Curve {
  const mx = (a.x + b.x) / 2;
  const my = (a.y + b.y) / 2;
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const bow = (flip ? -1 : 1) * 0.16;
  return { x0: a.x, y0: a.y, cx: mx - dy * bow, cy: my + dx * bow, x1: b.x, y1: b.y };
}

export function pointOn(curve: Curve, share: number): { x: number; y: number } {
  const u = 1 - share;
  return {
    x: u * u * curve.x0 + 2 * u * share * curve.cx + share * share * curve.x1,
    y: u * u * curve.y0 + 2 * u * share * curve.cy + share * share * curve.y1,
  };
}

export function pathOf(curve: Curve): string {
  return `M${curve.x0.toFixed(1)} ${curve.y0.toFixed(1)} Q${curve.cx.toFixed(1)} ${curve.cy.toFixed(1)} ${curve.x1.toFixed(1)} ${curve.y1.toFixed(1)}`;
}
