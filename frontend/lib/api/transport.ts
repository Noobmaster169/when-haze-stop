import type { z } from "zod";

/**
 * How the frontend reaches the backend, and nothing about what it asks for.
 * Server-side only: BACKEND_URL is not in the browser, so nothing under
 * components/ may import this. Pages, route handlers and server actions do.
 *
 * The backend authenticates nobody yet. When it does, the credential goes on
 * the headers here, which is the one place every call passes through.
 */

function baseUrl(): string {
  const url = process.env.BACKEND_URL;
  if (!url) throw new Error("BACKEND_URL is not set");
  return url.replace(/\/+$/, "");
}

export async function request(path: string, init: RequestInit & { timeoutMs?: number } = {}): Promise<Response> {
  const { timeoutMs = 15_000, headers, signal, ...rest } = init;
  return fetch(`${baseUrl()}${path}`, {
    ...rest,
    headers: { "content-type": "application/json", ...(headers as Record<string, string> | undefined) },
    // A caller's own signal is kept rather than replaced by the timeout. The
    // streamed turn needs both: the timeout is the ceiling, and the caller's
    // signal is the person pressing Stop, which has to reach the backend.
    signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(timeoutMs)]) : AbortSignal.timeout(timeoutMs),
    cache: "no-store",
  });
}

/**
 * The contract check every response goes through. The schemas in this folder
 * are mirrored from the backend by hand, so without a parse here a renamed
 * field type-checks on both sides and fails in the browser as undefined. A
 * drift now surfaces where it happened, naming the field.
 */
export async function parseAs<T>(schema: z.ZodType<T>, response: Response, what: string): Promise<T> {
  const parsed = schema.safeParse(await response.json().catch(() => null));
  if (!parsed.success) {
    const [issue] = parsed.error.issues;
    throw new Error(`${what} answered outside the contract at ${issue?.path.join(".") || "(root)"}: ${issue?.message}`);
  }
  return parsed.data;
}

/** The backend answered, and not with success. `status` says whose fault it was. */
export class BackendError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "BackendError";
  }
}

/** A read that either parses or throws, for the GETs whose failure is a page-level error. */
export async function get<T>(schema: z.ZodType<T>, path: string, init?: RequestInit & { timeoutMs?: number }): Promise<T> {
  const response = await request(path, init);
  if (!response.ok) throw new BackendError(`Backend GET ${path} answered ${response.status}`, response.status);
  return parseAs(schema, response, `GET ${path}`);
}

/** The `{ error }` body the api sends with every refusal. */
export async function refusalMessage(response: Response): Promise<string> {
  const body: unknown = await response.json().catch(() => null);
  const message = typeof body === "object" && body !== null ? (body as { error?: unknown }).error : undefined;
  return typeof message === "string" ? message : `Backend returned ${response.status}`;
}
