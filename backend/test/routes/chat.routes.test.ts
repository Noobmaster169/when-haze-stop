import request from "supertest";
import { afterAll, describe, expect, it } from "vitest";

import { FakeLlmClient } from "../../src/agents/__fakes__/fake.llm-client";
import { ChatAnswer, ChatConversation, ChatThread } from "../../src/contracts";
import { closePool, getPool } from "../../src/db";
import { step, testApp } from "../app";

afterAll(closePool);

async function newConversation(app: ReturnType<typeof testApp>): Promise<string> {
  const created = await request(app).post("/chat/conversations").expect(201);
  return ChatConversation.parse(created.body).id;
}

/** The events of an SSE body, in order. */
function events(body: string): { event: string; data: unknown }[] {
  return body
    .split("\n\n")
    .filter(Boolean)
    .map((block) => {
      const [eventLine, dataLine] = block.split("\n");
      return { event: eventLine.replace("event: ", ""), data: JSON.parse(dataLine.replace("data: ", "")) };
    });
}

describe("chat routes", () => {
  it("creates a conversation, answers a message and keeps the thread", async () => {
    const app = testApp({ llm: new FakeLlmClient([step.tool({ tool: "get_time" }), step.final("It is **now**.")]) });
    const id = await newConversation(app);

    const answered = await request(app).post(`/chat/${id}/messages`).send({ content: "What time is it right now?" }).expect(200);
    const answer = ChatAnswer.parse(answered.body);
    expect(answer.asked.content).toBe("What time is it right now?");
    expect(answer.turn).toMatchObject({ role: "assistant", content: "It is **now**.", stopped: false });
    expect(answer.turn.toolCalls.map((call) => call.tool)).toEqual(["get_time"]);

    const thread = ChatThread.parse((await request(app).get(`/chat/${id}`).expect(200)).body);
    expect(thread.turns.map((turn) => turn.role)).toEqual(["user", "assistant"]);
    expect(thread.conversation.title).toBe("What time is it right");

    const listed = await request(app).get("/chat/conversations").expect(200);
    expect(listed.body.conversations[0].id).toBe(id);

    const ledger = await getPool().query("select ok from llm_calls where conversation_id = $1", [id]);
    expect(ledger.rows).toEqual([{ ok: true }, { ok: true }]);
  });

  it("gives the model the conversation so far", async () => {
    const llm = new FakeLlmClient([step.final("First answer."), step.final("Second answer.")]);
    const app = testApp({ llm });
    const id = await newConversation(app);
    await request(app).post(`/chat/${id}/messages`).send({ content: "first question" }).expect(200);
    await request(app).post(`/chat/${id}/messages`).send({ content: "second question" }).expect(200);
    expect(llm.requests[1].user).toContain("Person: first question");
    expect(llm.requests[1].user).toContain("You: First answer.");
  });

  it("streams progress, steps and the answer when asked for an event stream", async () => {
    const app = testApp({ llm: new FakeLlmClient([step.tool({ tool: "get_time" }), step.final("Streamed.")]) });
    const id = await newConversation(app);
    const response = await request(app).post(`/chat/${id}/messages`).set("accept", "text/event-stream").send({ content: "go" }).expect(200);
    expect(response.headers["content-type"]).toContain("text/event-stream");

    const seen = events(response.text);
    expect(seen.map((item) => item.event)).toContain("progress");
    expect(seen.filter((item) => item.event === "step")).toHaveLength(1);
    expect(ChatAnswer.parse(seen.at(-1)?.data).turn.content).toBe("Streamed.");
    expect(seen.at(-1)?.event).toBe("answer");
  });

  it("reports a failed turn as a failure event and keeps the question", async () => {
    const app = testApp({ llm: new FakeLlmClient(new Error("the proxy is on fire")) });
    const id = await newConversation(app);
    const response = await request(app).post(`/chat/${id}/messages`).set("accept", "text/event-stream").send({ content: "still here?" }).expect(200);
    expect(events(response.text).at(-1)).toEqual({ event: "failure", data: { error: "the proxy is on fire" } });

    const thread = ChatThread.parse((await request(app).get(`/chat/${id}`)).body);
    expect(thread.turns.map((turn) => turn.content)).toEqual(["still here?"]);
  });

  it("refuses bad input and unknown conversations", async () => {
    const app = testApp();
    const id = await newConversation(app);
    await request(app).post(`/chat/${id}/messages`).send({ content: "   " }).expect(400);
    await request(app).post("/chat/not-a-uuid/messages").send({ content: "hi" }).expect(400);
    await request(app).get("/chat/00000000-0000-4000-8000-000000000000").expect(404);
  });

  it("deletes a conversation with its turns", async () => {
    const app = testApp({ llm: new FakeLlmClient(step.final("ok")) });
    const id = await newConversation(app);
    await request(app).post(`/chat/${id}/messages`).send({ content: "hi" }).expect(200);
    await request(app).delete(`/chat/${id}`).expect(204);
    await request(app).get(`/chat/${id}`).expect(404);
    await request(app).delete(`/chat/${id}`).expect(404);
  });
});
