import { randomUUID } from "node:crypto";

import { afterAll, describe, expect, it } from "vitest";

import { FakeLlmClient } from "../../src/agents/__fakes__/fake.llm-client";
import { runTurn, type TurnInput } from "../../src/agents/chat";
import type { ChatProgress, ChatToolCall } from "../../src/contracts";
import { closePool, getPool } from "../../src/db";
import { CallAbortedError } from "../../src/lib/errors";
import { FakeGeocoder } from "../../src/sources/__fakes__/fake.sources";
import { step } from "../app";

afterAll(closePool);

function input(question: string, overrides: Partial<TurnInput> = {}): TurnInput {
  // Null-safe for the ledger's foreign key: a conversation that does not exist is stored as none.
  return { conversationId: randomUUID(), question, history: [], today: "2026-01-01", stickySkills: [], ...overrides };
}

async function turn(llm: FakeLlmClient, question = "hello", extra: Partial<Parameters<typeof runTurn>[0]> = {}, overrides: Partial<TurnInput> = {}) {
  const pool = getPool();
  const conversation = await pool.query<{ id: string }>("insert into chat_conversations (id) values ($1) returning id", [randomUUID()]);
  return runTurn({ llm, pool, tools: { pool, geocoder: new FakeGeocoder() }, ...extra }, input(question, { conversationId: conversation.rows[0].id, ...overrides }));
}

describe("the chat loop", () => {
  it("answers at once when the first step is final", async () => {
    const llm = new FakeLlmClient(step.final("Hello there."));
    const result = await turn(llm);
    expect(result).toMatchObject({ answer: "Hello there.", toolCalls: [], exhausted: false, stopped: false });
    expect(llm.requests).toHaveLength(1);
  });

  it("runs a tool step and shows the model the result on the next step", async () => {
    const llm = new FakeLlmClient([step.tool({ tool: "get_time", args: { timezone: "UTC" }, thought: "need the time" }), step.final("It is now.")]);
    const result = await turn(llm, "what time is it?");
    expect(result.answer).toBe("It is now.");
    expect(result.toolCalls).toHaveLength(1);
    expect(result.toolCalls[0]).toMatchObject({ tool: "get_time", ok: true, thought: "need the time" });
    expect(llm.requests[1].user).toContain("you called get_time");
    expect(llm.requests[1].user).toContain("in UTC");
  });

  it("hands a refused call back instead of failing the turn", async () => {
    const llm = new FakeLlmClient([step.tool({ tool: "no_such_tool" }, { tool: "get_time", args: { timezone: "Mars/Olympus" } }), step.final("Could not.")]);
    const result = await turn(llm);
    expect(result.toolCalls.map((call) => call.ok)).toEqual([false, false]);
    expect(llm.requests[1].user).toContain('there is no tool named "no_such_tool"');
    expect(llm.requests[1].user).toContain("not an IANA timezone");
  });

  it("keeps a loaded skill in front of the agent and reports it", async () => {
    const llm = new FakeLlmClient([step.tool({ tool: "load_skill", args: { name: "example" } }), step.final("Done.")]);
    const result = await turn(llm);
    expect(result.skillsUsed).toEqual(["example"]);
    expect(llm.requests[1].user).toContain("## Skill: example");
  });

  it("starts with the skills an earlier turn loaded", async () => {
    const llm = new FakeLlmClient(step.final("Done."));
    const result = await turn(llm, "again", {}, { stickySkills: ["example", "gone-since"] });
    expect(llm.requests[0].user).toContain("## Skill: example");
    expect(result.skillsUsed).toEqual(["example"]);
  });

  it("tells the model when a step says nothing, and takes its next one", async () => {
    const llm = new FakeLlmClient([step.final(""), JSON.stringify({ action: "tool" }), step.final("Now I have it.")]);
    const result = await turn(llm);
    expect(result.answer).toBe("Now I have it.");
    expect(llm.requests[2].user).toContain("final step with no answer");
    expect(llm.requests[2].user).toContain("gave no calls");
  });

  it("says so when it runs out of steps", async () => {
    const llm = new FakeLlmClient(step.tool({ tool: "get_time" }));
    const result = await turn(llm);
    expect(result.exhausted).toBe(true);
    expect(result.toolCalls).toHaveLength(8);
    expect(result.answer).toContain("ran out of steps");
  });

  it("reports progress and each step's calls as it goes", async () => {
    const progress: ChatProgress[] = [];
    const steps: ChatToolCall[][] = [];
    const llm = new FakeLlmClient([step.tool({ tool: "get_time" }), step.final("The answer.")]);
    await turn(llm, "q", { onProgress: (p) => progress.push(p), onStep: (calls) => void steps.push(calls) });
    expect(progress.slice(0, 3).map((p) => p.phase)).toEqual(["reading", "looking", "reading"]);
    expect(progress.slice(3).every((p) => p.phase === "writing")).toBe(true);
    expect(progress.find((p) => p.phase === "looking")?.tools).toEqual(["get_time"]);
    expect(progress.at(-1)?.answer).toBe("The answer.");
    expect(steps).toHaveLength(1);
  });

  it("never moves the streamed answer backwards", async () => {
    const full = step.final("One two three.");
    const answers: string[] = [];
    // The real provider writes the object twice, so the preview drops to empty and starts again.
    const llm = new FakeLlmClient({ text: full, preview: [full.slice(0, -6), "", full.slice(0, 30), full] });
    await turn(llm, "q", { onProgress: (p) => p.phase === "writing" && answers.push(p.answer) });
    for (let i = 1; i < answers.length; i++) expect(answers[i].length).toBeGreaterThanOrEqual(answers[i - 1].length);
    expect(answers.at(-1)).toBe("One two three.");
  });

  it("ends a stopped turn with what had been written", async () => {
    const stop = new AbortController();
    const llm = new FakeLlmClient(step.final("unused"));
    llm.complete = async (request) => {
      await request.onText?.('{"action":"final","answer":"Half an ans');
      stop.abort();
      throw new CallAbortedError("stopped");
    };
    const result = await turn(llm, "q", { signal: stop.signal, onProgress: () => undefined });
    expect(result).toMatchObject({ stopped: true, answer: "Half an ans" });
  });
});
