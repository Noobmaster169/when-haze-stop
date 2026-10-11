"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { centre, curveBetween, type Frame, NARROW, pathOf, ringRadii, seatsFor, WIDE } from "./layout";
import { type GraphRefs, newMemory, type NodeRefs, paint, type PulseRefs } from "./paint";
import { pairKey, sceneAt } from "./scene";
import type { Timeline } from "./timeline";
import type { Playback } from "./use-playback";
import { initials, KIND_COLOUR, KIND_TINT } from "./words";

/**
 * The council table: agents on a loose ring, the engine at the centre, the
 * talk as pulses along curved edges. Rendered once per cast of agents; every
 * frame after that is paint.ts writing transforms onto these elements.
 */

const SATELLITES = 14;
const PULSES = 2;
const TAIL = 3;

function useFrame(): [React.RefObject<HTMLDivElement | null>, Frame] {
  const box = useRef<HTMLDivElement>(null);
  const [frame, setFrame] = useState<Frame>(WIDE);
  useEffect(() => {
    const element = box.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => setFrame(entry.contentRect.width < 620 ? NARROW : WIDE));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return [box, frame];
}

export function CouncilGraph({ timeline, playback, reduced }: { timeline: Timeline; playback: Playback; reduced: boolean }) {
  const [box, frame] = useFrame();
  const seats = useMemo(() => seatsFor(timeline.agents, frame), [timeline.agents, frame]);
  const pairs = useMemo(() => {
    const seen = new Map<string, { a: string; b: string }>();
    for (const delivery of timeline.deliveries) {
      const key = pairKey(delivery.from, delivery.to);
      if (!seen.has(key)) seen.set(key, { a: key.split("|")[0], b: key.split("|")[1] });
    }
    return [...seen.entries()];
  }, [timeline.deliveries]);
  const refs = useRef<GraphRefs>({ nodes: new Map(), threads: new Map(), satellites: [], pulses: [], engineGlow: null });
  const memory = useRef(newMemory());

  useEffect(() => {
    memory.current.threadCounts.clear();
    let last = performance.now() / 1000;
    return playback.subscribe((clock, wall) => {
      const dt = Math.min(0.1, wall - last);
      last = wall;
      paint(sceneAt(timeline, clock.t), refs.current, seats, frame, memory.current, wall, dt, reduced);
    });
  }, [playback, timeline, seats, frame, reduced]);

  const middle = centre(frame);
  const { rx, ry } = ringRadii(frame);
  const nodeRef = (id: string, part: keyof NodeRefs) => (element: SVGElement | null) => {
    const entry = refs.current.nodes.get(id) ?? ({} as NodeRefs);
    if (element) Object.assign(entry, { [part]: element });
    refs.current.nodes.set(id, entry);
  };

  return (
    <div ref={box} className="relative h-full w-full">
      <svg viewBox={`0 0 ${frame.width} ${frame.height}`} className="h-full w-full" role="img" aria-label="The council table: who is speaking to whom">
        <ellipse cx={middle.x.toFixed(1)} cy={middle.y.toFixed(1)} rx={rx.toFixed(1)} ry={ry.toFixed(1)} fill="none" stroke="var(--hairline-strong)" strokeWidth={1} strokeDasharray="1 7" strokeLinecap="round" />
        <g fill="none" strokeLinecap="round">
          {pairs.map(([key, pair]) => {
            const a = seats.get(pair.a);
            const b = seats.get(pair.b);
            if (!a || !b) return null;
            return (
              <path
                key={key}
                ref={(element) => {
                  if (element) refs.current.threads.set(key, element);
                  else refs.current.threads.delete(key);
                }}
                d={pathOf(curveBetween(a, b, pair.a > pair.b))}
                stroke="var(--ink-faint)"
                opacity={0}
              />
            );
          })}
        </g>
        {Array.from({ length: SATELLITES }, (_, slot) => (
          <line key={`tether-${slot}`} ref={(element) => void (element && (part(refs.current.satellites, slot).tether = element))} stroke="var(--ink-faint)" strokeWidth={1} opacity={0} />
        ))}
        {timeline.agents.map((agent) => {
          const r = agent.kind === "engine" ? frame.node * 1.75 : frame.node;
          return (
            <g key={agent.id} ref={nodeRef(agent.id, "group")} opacity={0}>
              {agent.kind === "engine" ? <circle ref={(element) => void (refs.current.engineGlow = element)} r={r * 1.45} fill="var(--verdict-review)" opacity={0} /> : null}
              <circle ref={nodeRef(agent.id, "halo")} r={r * 1.5} fill={KIND_COLOUR[agent.kind]} opacity={0} />
              <circle ref={nodeRef(agent.id, "burst")} r={r} fill="none" stroke={KIND_COLOUR[agent.kind]} strokeWidth={1.5} opacity={0} />
              <circle ref={nodeRef(agent.id, "ring")} r={r + 5} fill="none" strokeWidth={2} opacity={0} />
              <circle r={r} fill={KIND_TINT[agent.kind]} stroke={KIND_COLOUR[agent.kind]} strokeWidth={agent.kind === "seat" ? 1.25 : 1.75} />
              <text textAnchor="middle" dominantBaseline="central" fontSize={agent.kind === "engine" ? frame.label : frame.label - 2} fontWeight={600} fill="var(--ink)" style={{ letterSpacing: "0.02em" }}>
                {agent.kind === "engine" ? "Engine" : initials(agent.title)}
              </text>
              {agent.kind === "engine" ? null : (
                <text ref={nodeRef(agent.id, "label")} y={r + frame.label + 5} textAnchor="middle" fontSize={frame.label} fill="var(--ink-secondary)" stroke="var(--canvas)" strokeWidth={4} paintOrder="stroke" strokeLinejoin="round">
                  {agent.title}
                </text>
              )}
            </g>
          );
        })}
        {Array.from({ length: SATELLITES }, (_, slot) => (
          <g key={`satellite-${slot}`} ref={(element) => void (element && (part(refs.current.satellites, slot).group = element))} opacity={0}>
            <circle ref={(element) => void (element && (part(refs.current.satellites, slot).flash = element))} r={6} fill="none" strokeWidth={1.25} opacity={0} />
            <circle ref={(element) => void (element && (part(refs.current.satellites, slot).body = element))} r={5} stroke="var(--canvas)" strokeWidth={1.5} />
          </g>
        ))}
        {Array.from({ length: PULSES }, (_, slot) => (
          <g key={`pulse-${slot}`}>
            {Array.from({ length: TAIL }, (_, index) => (
              <circle key={index} ref={(element) => void (element && pulsePart(refs.current, slot).tail.splice(index, 1, element))} r={3.2 - 0.6 * index} opacity={0} />
            ))}
            <g ref={(element) => void (element && (pulsePart(refs.current, slot).head = element))} opacity={0}>
              <circle ref={(element) => void (element && (pulsePart(refs.current, slot).glow = element))} r={13} opacity={0.24} />
              <circle ref={(element) => void (element && (pulsePart(refs.current, slot).core = element))} r={5.5} stroke="var(--canvas)" strokeWidth={1.5} />
            </g>
          </g>
        ))}
      </svg>
    </div>
  );
}

/** The refs for one pooled element, filled in part by part as React mounts them. */
function part<T extends object>(list: T[], index: number): T {
  list[index] ??= {} as T;
  return list[index];
}

function pulsePart(refs: GraphRefs, slot: number): PulseRefs {
  const pulse = part(refs.pulses, slot);
  pulse.tail ??= [];
  return pulse;
}
