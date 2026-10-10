import { Router } from "express";
import { z } from "zod";

import type { ModelList } from "../contracts";
import { chat, listModels } from "../llm";

/**
 * The proxy, as the api exposes it: which aliases exist, and one plain
 * completion with no agent around it. The second is for smoke tests and for a
 * feature that only needs a model to say something once.
 */

const Completion = z.object({
  model: z.string().regex(/^[\w.:-]{1,64}$/, 'must be a proxy alias like "sonnet" or "haiku"'),
  messages: z
    .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().max(200_000) }))
    .min(1)
    .refine((messages) => messages[0].role === "user", "the first message must be from the user"),
  system: z.string().max(20_000).optional(),
  maxTokens: z.number().int().min(1).max(8192).optional(),
});

export function aiRouter(): Router {
  const router = Router();

  router.get("/models", async (_req, res) => {
    const body: ModelList = { models: await listModels() };
    res.json(body);
  });

  router.post("/chat", async (req, res) => {
    const body = Completion.safeParse(req.body);
    if (!body.success) {
      res.status(400).json({ error: "invalid completion request", issues: body.error.issues });
      return;
    }
    res.json(await chat("api", body.data));
  });

  return router;
}
