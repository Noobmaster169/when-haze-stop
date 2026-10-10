import type { Queryable } from "../db";

export interface NewLlmCall {
  /** Null for a call that belongs to no conversation. */
  conversationId: string | null;
  step: string;
  model: string;
  promptVersion: string;
  request: unknown;
  response?: unknown;
  parsed?: unknown;
  inputTokens?: number;
  outputTokens?: number;
  costUsd?: number | null;
  latencyMs: number;
  ok: boolean;
  error?: string | null;
  attempt: number;
}

/** The ledger is append-only: a retry is a new row, never an update. */
export async function insert(db: Queryable, call: NewLlmCall): Promise<void> {
  await db.query(
    `insert into llm_calls
       (conversation_id, step, model, prompt_version, request, response, parsed,
        input_tokens, output_tokens, cost_usd, latency_ms, ok, error, attempt)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
    [
      call.conversationId,
      call.step,
      call.model,
      call.promptVersion,
      JSON.stringify(call.request),
      call.response === undefined ? null : JSON.stringify(call.response),
      call.parsed === undefined || call.parsed === null ? null : JSON.stringify(call.parsed),
      call.inputTokens ?? null,
      call.outputTokens ?? null,
      call.costUsd ?? null,
      call.latencyMs,
      call.ok,
      call.error ?? null,
      call.attempt,
    ],
  );
}
