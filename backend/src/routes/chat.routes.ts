import { Router } from "express";
import type { Pool } from "pg";
import { z } from "zod";

import type { LlmClient } from "../agents/llm-client";
import type { ChatConversationList, ChatThread } from "../contracts";
import { NewMessage } from "../contracts";
import { childLogger } from "../lib/logger";
import { chat } from "../repositories";
import type { Geocoder } from "../sources";
import { answerTurn } from "./chat.turn";
import { eventStream, wantsStream } from "./sse";

/**
 * Asking a question and getting an answer with its working shown.
 *
 * The POST has two shapes and the caller picks with `Accept`. Without
 * `text/event-stream` it holds until the answer and returns one `ChatAnswer`,
 * which is what scripts and tests want. With it, the same work reports itself:
 * `progress` events while the turn runs, a `step` event with each step's
 * finished calls, then one `answer` event carrying that same `ChatAnswer`, or
 * a `failure` event where a non-2xx body would have been.
 *
 * Stopping is the client aborting the POST, either way.
 */

const log = childLogger({ module: "chat.routes" });

export interface ChatRouteDeps {
  pool: Pool;
  llm: LlmClient;
  geocoder: Geocoder;
}

const IdParam = z.uuid();

export function chatRouter(deps: ChatRouteDeps): Router {
  const router = Router();

  router.post("/conversations", async (_req, res) => {
    res.status(201).json(await chat.create(deps.pool));
  });

  router.get("/conversations", async (_req, res) => {
    const body: ChatConversationList = { conversations: await chat.list(deps.pool) };
    res.json(body);
  });

  router.get("/:id", async (req, res) => {
    const id = IdParam.safeParse(req.params.id);
    if (!id.success) {
      res.status(400).json({ error: "bad conversation id" });
      return;
    }
    const conversation = await chat.find(deps.pool, id.data);
    if (!conversation) {
      res.status(404).json({ error: "no such conversation" });
      return;
    }
    const body: ChatThread = { conversation, turns: await chat.turns(deps.pool, id.data) };
    res.json(body);
  });

  router.post("/:id/messages", async (req, res) => {
    const id = IdParam.safeParse(req.params.id);
    if (!id.success) {
      res.status(400).json({ error: "bad conversation id" });
      return;
    }
    const body = NewMessage.safeParse(req.body);
    if (!body.success) {
      res.status(400).json({ error: "invalid message", issues: body.error.issues });
      return;
    }
    const conversation = await chat.find(deps.pool, id.data);
    if (!conversation) {
      res.status(404).json({ error: "no such conversation" });
      return;
    }

    // Stopping is the client aborting its own POST. Express reports that as
    // `close` before the response was finished, and the abort reaches the model
    // call in flight: the proxy kills the session, the loop keeps what had been
    // written, and the turn is stored as stopped.
    const stop = new AbortController();
    res.on("close", () => {
      if (!res.writableEnded) stop.abort();
    });

    if (!wantsStream(req.headers.accept)) {
      const answer = await answerTurn({ ...deps, signal: stop.signal }, conversation, body.data);
      // A stopped turn is stored, so the thread keeps what it found, and then
      // has nobody to answer: the client that aborted is gone.
      if (!stop.signal.aborted) res.json(answer);
      return;
    }

    const stream = eventStream(res);
    try {
      const answer = await answerTurn(
        {
          ...deps,
          signal: stop.signal,
          onProgress: (progress) => stream.send("progress", progress),
          onCalls: (calls) => stream.send("step", { calls }),
        },
        conversation,
        body.data,
      );
      if (!stop.signal.aborted) stream.send("answer", answer);
    } catch (error) {
      // The 200 went out with the headers, before the work had a chance to
      // fail, so this cannot be a status. The client reads `failure` the way it
      // reads a non-2xx body on the other shape.
      const message = error instanceof Error ? error.message : String(error);
      log.error({ conversationId: id.data, err: message }, "a streamed chat turn failed");
      stream.send("failure", { error: message });
    } finally {
      stream.end();
    }
  });

  router.delete("/:id", async (req, res) => {
    const id = IdParam.safeParse(req.params.id);
    if (!id.success) {
      res.status(400).json({ error: "bad conversation id" });
      return;
    }
    if (await chat.remove(deps.pool, id.data)) {
      res.status(204).end();
      return;
    }
    res.status(404).json({ error: "no such conversation" });
  });

  return router;
}
