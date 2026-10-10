import request from "supertest";
import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { CouncilEventPage, CouncilRun, CouncilRunList } from "../../src/contracts";
import { closePool, getPool } from "../../src/db";
import { council } from "../../src/repositories";
import { testApp } from "../app";

afterAll(closePool);

// Tests never delete: a run left active by an earlier test is finished instead, so the one-active rule lets a new one queue.
beforeEach(async () => {
  await getPool().query("update council_runs set status = 'failed', error = 'closed by a test' where status in ('queued', 'running')");
});

describe("the council routes", () => {
  it("queues a run for KL, and refuses a second while it waits", async () => {
    const app = testApp();
    const first = await request(app).post("/council/runs").send({ target: "klang-valley" });
    expect(first.status).toBe(202);
    expect(CouncilRun.parse(first.body).status).toBe("queued");
    const second = await request(app).post("/council/runs").send({ target: "klang-valley" });
    expect(second.status).toBe(409);
  });

  it("refuses an area the council cannot be asked about yet", async () => {
    const response = await request(testApp()).post("/council/runs").send({ target: "johor-bahru" });
    expect(response.status).toBe(400);
  });

  it("lists runs and serves a run's events after a sequence number", async () => {
    const pool = getPool();
    const run = (await council.queue(pool, "klang-valley", 8_000_000))!;
    await council.appendEvent(pool, run.id, { seq: 0, kind: "stage", actor: "system", payload: { stage: "situation", title: "The situation", index: 1, of: 9 } });
    await council.appendEvent(pool, run.id, { seq: 1, kind: "thinking", actor: "chair", payload: { agent: "chair", gist: "reading the fact sheet" } });
    await council.appendEvent(pool, run.id, { seq: 2, kind: "not_a_kind", actor: "chair", payload: {} });

    const list = CouncilRunList.parse((await request(testApp()).get("/council/runs")).body);
    expect(list.runs[0].id).toBe(run.id);
    const page = CouncilEventPage.parse((await request(testApp()).get(`/council/runs/${run.id}/events?after=0`)).body);
    // The malformed event is left out rather than breaking the replay.
    expect(page.events.map((event) => event.kind)).toEqual(["thinking"]);
    expect(page.status).toBe("queued");
  });

  it("answers 404 for a run that does not exist", async () => {
    expect((await request(testApp()).get("/council/runs/999999999")).status).toBe(404);
  });
});
