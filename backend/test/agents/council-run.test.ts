import { afterAll, describe, expect, it } from "vitest";

import { FakeLlmClient } from "../../src/agents/__fakes__/fake.llm-client";
import { emitter, memorySink } from "../../src/agents/council/events";
import { figuresIn, unverified } from "../../src/agents/council/fact-check";
import { runCouncil } from "../../src/agents/council/run";
import type { LlmRequest } from "../../src/agents/llm-client";
import { CouncilEvent, Verdict } from "../../src/contracts";
import { closePool, getPool } from "../../src/db";
import { TARGETS } from "../../src/suppression/targets";
import { vectorAttribution } from "../fixtures/council-vector";

afterAll(closePool);

const final = (answer: unknown, gist = "weighing it") => JSON.stringify({ action: "final", gist, answer });
const line = (complexId: string, asset: string, units: number, fromDay = 1, toDay = 10) => ({ complexId, asset, units, fromDay, toDay, needsConsent: null });
const plan = (title: string, assignments: unknown[]) => ({
  title,
  headline: `${title}.`,
  assignments,
  requests: [],
  share: null,
  rationale: `Because C02 is 0.2 ug/m3 a day.`,
  assumptions: [],
  confidence: 0.6,
  dependsOn: "the wind",
});

/** Plays every seat: answers by what the prompt asks, with plans on the test vector's three complexes. */
function script(request: LlmRequest): string {
  const { system, user } = request;
  const seatTitle = /You are the (.+?) seat/.exec(system)?.[1] ?? "";
  if (system.includes("You are opening the meeting")) {
    return final({
      headline: "We decide which complexes to put out first for KL.",
      objective: "Remove the most of KL's coming smoke with the package.",
      weights: { klBenefit: 0.45, robustness: 0.2, feasibility: 0.15, diplomacy: 0.1, cost: 0.05, sideBenefits: 0.05 },
      weightReasons: "The defaults.",
      premises: [],
      openingBrief: "Bring plans scored by the engine.",
    });
  }
  if (system.includes("You draft one plan, alone")) {
    // One tool step first, so the tool path and its events are exercised.
    if (!user.includes("you called simulate_plan")) {
      return JSON.stringify({ action: "tools", gist: "checking a plan", calls: [{ tool: "simulate_plan", args: { assignments: [line("C02", "bomba_domestic", 100)] } }] });
    }
    // Bomba sent abroad: refused by the validator, then repaired.
    if (seatTitle === "Domestic Fire" && !user.includes("Your plan was refused")) return final(plan("Bomba to Kalimantan", [line("C01", "bomba_domestic", 50)]));
    if (seatTitle === "Domestic Fire") return final(plan("Bomba at home", [line("C02", "bomba_domestic", 100)]));
    if (seatTitle === "Air Quality") return final(plan("Ask for Sumatra", [line("C03", "ground_task_force", 150, 7, 14), line("C02", "bomba_domestic", 60)]));
    if (seatTitle === "Peat Science") return final(plan("Crews on Kalimantan peat", [line("C01", "ground_teams", 2, 2, 13)]));
    return final(plan(`${seatTitle} plan`, [line("C01", "cl415", 1), line("C02", "bomba_domestic", 40)]));
  }
  if (system.includes("You are cross-examining one plan")) {
    return final({
      headline: "It leaves the biggest source burning.",
      verdict: "support_with_changes",
      challenges: [{ claim: "C03 is 0.3 ug/m3 a day and untouched.", evidence: "C03", kind: "fact" }],
      variant: seatTitle === "Peat Science" ? { title: "Add Bomba at home", assignments: [line("C02", "bomba_domestic", 100), line("C01", "ground_teams", 2, 2, 13)] } : null,
      strongestObjection: "Nothing reaches C03.",
    });
  }
  if (system.includes("Run a pre-mortem")) {
    const ids = [...new Set(user.match(/\bP\d+\b/g) ?? [])];
    return final({ headline: "The wind turned.", premortems: ids.map((planId) => ({ planId, headline: `${planId} failed: the peat relit over 9999 ha.`, failure: "The peat relit. It was 9999 ha.", evidence: "R3" })), mostFragile: ids[0], mostRobust: ids[1] ?? ids[0] });
  }
  if (system.includes("The Committee has cross-examined your plan")) {
    return final({ headline: "Held, with Bomba added.", plan: plan("Revised", [line("C02", "bomba_domestic", 100), line("C01", "cl415", 1)]), changes: "Added Bomba on C02 for its 0.2 a day." });
  }
  if (system.includes("Rate every plan on the shortlist")) {
    const ids = [...new Set(user.match(/\bP\d+\b/g) ?? [])];
    return final({ headline: "Rated.", ratings: ids.map((planId, index) => ({ planId, score: 7 - (index % 3), note: "fine" })) });
  }
  if (system.includes("The Committee has finished")) {
    return final({
      headline: "Bomba at home first; ask for Sumatra.",
      actNow: "Bomba on C02 today.",
      ask: "Ask Indonesia for crews on C03.",
      share: "Share the ranking.",
      reasoning: "It beat the baselines.",
      minorityReport: "Peat Science doubts the crews.",
      replanTrigger: "Rain.",
    });
  }
  if (system.includes("whether they stand behind it")) {
    return final({ headline: seatTitle === "Foreign Affairs" ? "I cannot back asking Jakarta for crews in Jambi." : "I stand behind it.", stance: seatTitle === "Foreign Affairs" ? "dissent" : "support", reason: "From my mandate." });
  }
  throw new Error(`the script has no answer for: ${system.slice(0, 80)}`);
}

async function run() {
  const llm = new FakeLlmClient(script);
  const { sink, events } = memorySink();
  const verdict = await runCouncil({ llm, pool: getPool(), engine: { attribute: async () => vectorAttribution(), simulate: async () => null }, emit: emitter(sink) }, TARGETS["klang-valley"]);
  return { llm, events, verdict };
}

describe("a council run", () => {
  it("goes through every stage in order and ends with a verdict", async () => {
    const { events, verdict } = await run();
    const stages = events.filter((event) => event.kind === "stage").map((event) => (event.payload as { stage: string }).stage);
    expect(stages.slice(0, 5)).toEqual(["situation", "mission", "drafts", "screening", "wargame"]);
    expect(stages.slice(-2)).toEqual(["comparison", "decision"]);
    expect(stages).toContain("cross_examination");
    expect(events.at(-1)?.kind).toBe("run_finished");
    expect(Verdict.safeParse(verdict).success).toBe(true);
    expect(verdict.strikeList.length).toBeGreaterThan(0);
    expect(verdict.baselines.map((item) => item.title)).toContain("Biggest fire first: everything on C01");
    // The chosen plan fits the money set aside (8 million by default), and says what it costs.
    expect(verdict.cost?.budget).toBe(8_000_000);
    expect(verdict.cost!.total).toBeLessThanOrEqual(verdict.cost!.budget);
  });

  it("writes only events the page can parse, numbered without gaps", async () => {
    const { events } = await run();
    events.forEach((event, index) => {
      expect(event.seq).toBe(index);
      const parsed = CouncilEvent.safeParse({ ...event, at: new Date().toISOString() });
      expect(parsed.success, `${event.kind}: ${parsed.success ? "" : parsed.error.message}`).toBe(true);
    });
  });

  it("sends a refused plan back to its author, and tables the repair", async () => {
    const { events } = await run();
    const refused = events.find((event) => event.kind === "message" && event.actor === "engine" && (event.payload as { act: string }).act === "challenge");
    expect(refused).toBeDefined();
    const screening = events.findIndex((event) => event.kind === "stage" && (event.payload as { stage: string }).stage === "screening");
    const bomba = events.slice(0, screening).filter((event) => event.kind === "candidate" && (event.payload as { by: string }).by === "domestic_fire");
    expect(bomba).toHaveLength(2);
  });

  it("tables a critic's variant only when the engine scores it higher", async () => {
    const { events } = await run();
    const variants = events.filter((event) => event.kind === "candidate" && String((event.payload as { premise: string | null }).premise).startsWith("variant of"));
    for (const variant of variants) expect(events.some((event) => event.kind === "simulation" && (event.payload as { planId: string }).planId === (variant.payload as { planId: string }).planId)).toBe(true);
  });

  it("ends with every member saying whether they stand behind the decision", async () => {
    const { events } = await run();
    const verdictAt = events.findIndex((event) => event.kind === "verdict");
    const closing = events.slice(0, verdictAt).filter((event) => event.kind === "message" && ["support", "dissent"].includes((event.payload as { act: string }).act) && (event.payload as { to: string[] }).to.includes("chair"));
    expect(closing.some((event) => (event.payload as { act: string }).act === "dissent")).toBe(true);
    expect(new Set(closing.map((event) => event.actor)).size).toBeGreaterThanOrEqual(10);
  });

  it("says where KL's coming smoke comes from, by area, adding up to the whole", async () => {
    const { verdict } = await run();
    const total = (verdict.sources ?? []).reduce((sum, item) => sum + item.share, 0);
    expect(total).toBeCloseTo(1, 5);
    expect(verdict.strikeList.map((line) => line.fromDay)).toEqual([...verdict.strikeList.map((line) => line.fromDay)].sort((a, b) => a - b));
  });

  it("flags a figure the seat was never shown", async () => {
    const { events } = await run();
    const red = events.filter((event) => event.kind === "message" && event.actor === "red_cell");
    expect(red.length).toBeGreaterThan(0);
    expect((red[0].payload as { unverified: string[] }).unverified).toContain("9999");
  });

  it("keeps drafts blind: no draft prompt holds another seat's plan", async () => {
    const { llm } = await run();
    const drafts = llm.requests.filter((request) => request.system.includes("You draft one plan, alone"));
    for (const request of drafts) expect(request.user).not.toMatch(/\bP\d+\b.*lines:/);
  });
});

describe("the fact check", () => {
  it("accepts figures in any quoted form and flags the rest", () => {
    const seen = figuresIn(["C014 is 11.06% of the ceiling, 1,899 MW, peat 0.640"]);
    expect(unverified("C014 causes 11.06% and burns 1899 MW at peat 0.64", seen)).toEqual([]);
    expect(unverified("It burns 2,500 MW on 14 days in 2026", seen)).toEqual(["2500"]);
  });
});

describe("the fact check on names and ranges", () => {
  it("reads no figures in ids, ranges or PM2.5", () => {
    expect(unverified("C121 and P22 on days 1-10 in W2; PM2.5 at C120-C121", figuresIn([]))).toEqual([]);
    expect(unverified("a fall of -2.5 ug/m3", figuresIn([]))).toEqual(["-2.5"]);
  });
});
