import { describe, expect, it } from "vitest";

import { CouncilEvent } from "@/lib/api/council-schemas";

import recorded from "./fixtures/council-run-1.json";
import { ABSORB, sceneAt } from "./scene";
import { BEATS, beatIndexAt, beatLength, buildTimeline, PULSES_AT_ONCE } from "./timeline";
import { saidUpTo, trayAt } from "./tray";

/** Run 1's events as the database recorded them, through the same contract the page parses with. */
const events = CouncilEvent.array().parse(recorded);
const timeline = buildTimeline(events);

describe("the timeline", () => {
  it("plays every event back to back on fixed beats, in seq order", () => {
    expect(timeline.beats).toHaveLength(events.length);
    timeline.beats.forEach((beat, index) => {
      expect(beat.end - beat.start).toBeCloseTo(beatLength(beat.event));
      if (index > 0) expect(beat.start).toBeCloseTo(timeline.beats[index - 1].end);
      if (index > 0) expect(beat.event.seq).toBeGreaterThan(timeline.beats[index - 1].event.seq);
    });
    expect(timeline.duration).toBeCloseTo(timeline.beats.at(-1)!.end);
  });

  it("does not depend on the order the events arrive in", () => {
    const shuffled = [...events].reverse();
    expect(buildTimeline(shuffled).duration).toBeCloseTo(timeline.duration);
  });

  it("gives the kinds their beats", () => {
    const stage = timeline.beats.find((beat) => beat.event.kind === "stage")!;
    expect(stage.end - stage.start).toBe(BEATS.stage);
  });

  it("finds the beat playing at a time", () => {
    expect(beatIndexAt(timeline, -1)).toBe(-1);
    expect(beatIndexAt(timeline, 0)).toBe(0);
    const middle = timeline.beats[Math.floor(timeline.beats.length / 2)];
    expect(beatIndexAt(timeline, middle.start + 0.01)).toBe(timeline.beats.indexOf(middle));
    expect(beatIndexAt(timeline, timeline.duration + 10)).toBe(timeline.beats.length - 1);
  });

  it("sends a message to many in waves of at most two pulses", () => {
    const broadcast = timeline.beats.find((beat) => beat.event.kind === "message" && beat.event.payload.to.length > PULSES_AT_ONCE)!;
    expect(broadcast).toBeDefined();
    const inside = timeline.deliveries.filter((delivery) => delivery.depart >= broadcast.start && delivery.arrive <= broadcast.end);
    if (broadcast.event.kind !== "message") throw new Error("not a message");
    expect(inside).toHaveLength(broadcast.event.payload.to.length);
    for (let t = broadcast.start; t < broadcast.end; t += 0.05) {
      expect(sceneAt(timeline, t).pulses.length).toBeLessThanOrEqual(PULSES_AT_ONCE);
    }
  });

  it("pairs every tool call with its result", () => {
    const results = events.filter((event) => event.kind === "tool_result").length;
    expect(timeline.calls.filter((call) => call.resultAt !== null)).toHaveLength(results);
  });
});

describe("the scene", () => {
  it("is the same whether reached by playing forward or by jumping back", () => {
    const target = timeline.duration * 0.6;
    let forward = sceneAt(timeline, 0);
    for (let t = 0; t <= target; t += 0.25) forward = sceneAt(timeline, t);
    forward = sceneAt(timeline, target);
    sceneAt(timeline, timeline.duration);
    expect(sceneAt(timeline, target)).toEqual(forward);
  });

  it("is empty before the run starts", () => {
    const scene = sceneAt(timeline, -1);
    expect(scene.agents).toHaveLength(0);
    expect(scene.event).toBeNull();
    expect(scene.caption).toBe("The council has not met yet.");
  });

  it("seats an agent from the first beat it takes part in, even a brief sent before its join", () => {
    const brief = timeline.beats.find((beat) => beat.event.kind === "message" && beat.event.payload.to.includes("health"))!;
    const join = timeline.beats.find((beat) => beat.event.kind === "agent_joined" && beat.event.payload.agent === "health")!;
    expect(brief.start).toBeLessThan(join.start);
    expect(sceneAt(timeline, brief.start - 0.01).agents.some((agent) => agent.id === "health")).toBe(false);
    expect(sceneAt(timeline, brief.start).agents.some((agent) => agent.id === "health")).toBe(true);
  });

  it("never draws a thread or a pulse to an agent not yet seated", () => {
    for (let t = 0; t < timeline.duration; t += 0.5) {
      const scene = sceneAt(timeline, t);
      const seated = new Set(scene.agents.map((agent) => agent.id));
      for (const pulse of scene.pulses) expect(seated.has(pulse.from) && seated.has(pulse.to)).toBe(true);
      for (const thread of scene.threads) expect(seated.has(thread.a) && seated.has(thread.b)).toBe(true);
    }
  });

  it("buds a satellite on a tool call and absorbs it after the result", () => {
    const call = timeline.calls.find((item) => item.resultAt !== null)!;
    expect(sceneAt(timeline, call.start).satellites.map((item) => item.callId)).toContain(call.callId);
    expect(sceneAt(timeline, call.resultAt! + ABSORB / 2).satellites.map((item) => item.callId)).toContain(call.callId);
    expect(sceneAt(timeline, call.resultAt! + ABSORB + 0.01).satellites.map((item) => item.callId)).not.toContain(call.callId);
  });

  it("dims everyone outside the message now playing", () => {
    const beat = timeline.beats.find((item) => item.event.kind === "message" && item.event.payload.from === "chair")!;
    const scene = sceneAt(timeline, beat.start + 0.1);
    if (beat.event.kind !== "message") throw new Error("not a message");
    const inIt = new Set([beat.event.payload.from, ...beat.event.payload.to]);
    for (const agent of scene.agents) expect(agent.focus).toBe(inIt.has(agent.id));
    expect(scene.agents.find((agent) => agent.id === "chair")?.state).toBe("speaking");
  });

  it("leaves a thread for every message that has landed", () => {
    const end = sceneAt(timeline, timeline.duration);
    const landed = timeline.deliveries.length;
    expect(end.threads.reduce((sum, thread) => sum + thread.count, 0)).toBe(landed);
    expect(end.pulses).toHaveLength(0);
  });

  it("names the stage and says what is happening in plain words", () => {
    const thinking = timeline.beats.find((beat) => beat.event.kind === "thinking" && beat.event.payload.agent === "chair")!;
    const scene = sceneAt(timeline, thinking.start + 0.1);
    expect(scene.caption).toBe("Chair thinks it over.");
    expect(scene.stage?.stage).toBe("mission");
    expect(scene.agents.find((agent) => agent.id === "chair")?.state).toBe("thinking");
  });

  it("captions each kind of event without leaving words out", () => {
    for (const beat of timeline.beats) {
      const caption = sceneAt(timeline, beat.start + 0.01).caption;
      expect(caption.length).toBeGreaterThan(8);
      expect(caption).not.toMatch(/undefined|null|\[object/);
    }
  });
});

describe("the rail", () => {
  it("tables each plan once, the chosen one first and the baselines after the council's own", () => {
    const tray = trayAt(timeline, timeline.beats.length - 1);
    const ids = tray.plans.map((plan) => plan.planId);
    expect(new Set(ids).size).toBe(ids.length);
    const verdict = events.find((event) => event.kind === "verdict");
    if (verdict?.kind === "verdict") {
      expect(tray.chosen).toBe(verdict.payload.planId);
      expect(tray.plans[0].planId).toBe(verdict.payload.planId);
    }
    const rest = tray.plans.slice(1);
    const firstBaseline = rest.findIndex((plan) => plan.baseline);
    if (firstBaseline >= 0) expect(rest.slice(firstBaseline).every((plan) => plan.baseline)).toBe(true);
  });

  it("gives a plan the engine's score and the seats' ratings only once the replay reaches them", () => {
    const simulation = timeline.beats.findIndex((beat) => beat.event.kind === "simulation");
    const beat = timeline.beats[simulation];
    if (beat.event.kind !== "simulation") throw new Error("not a simulation");
    const planId = beat.event.payload.planId;
    expect(trayAt(timeline, simulation - 1).plans.find((plan) => plan.planId === planId)?.score ?? null).toBeNull();
    expect(trayAt(timeline, simulation).plans.find((plan) => plan.planId === planId)?.score).toEqual(beat.event.payload.score);
    const lastVote = timeline.beats.findLastIndex((item) => item.event.kind === "vote");
    if (lastVote > 0) expect(trayAt(timeline, lastVote).plans.some((plan) => plan.ratings.length > 0)).toBe(true);
  });

  it("lists what was said up to the beat, and nothing after", () => {
    const all = saidUpTo(timeline, timeline.beats.length - 1);
    expect(all).toHaveLength(events.filter((event) => event.kind === "message").length);
    expect(saidUpTo(timeline, -1)).toHaveLength(0);
  });
});
