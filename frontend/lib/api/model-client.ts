import { ModelLive } from "./model-schemas";
import { get } from "./transport";

/** The live record composes several station outlooks and the full scored ledger, so it takes a moment. */
const MODEL_TIMEOUT_MS = 30_000;

/** `follow` is the stations the browser follows, shown beside the ones the model expects to be worst. */
export async function getModelLive(follow: string[] = []): Promise<ModelLive> {
  const query = follow.length > 0 ? `?follow=${encodeURIComponent(follow.join(","))}` : "";
  return get(ModelLive, `/haze/model${query}`, { timeoutMs: MODEL_TIMEOUT_MS });
}
