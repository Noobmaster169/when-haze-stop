import { RetryableError, UpstreamError } from "../lib/errors";

/**
 * One GET to a data source, with a ceiling on how long it may take.
 *
 * A source that answers with a failure is an UpstreamError; one that does not
 * answer at all is retryable, because the next cycle is an hour away and will
 * ask again anyway.
 */
export async function fetchText(url: string, what: string, timeoutMs: number): Promise<string> {
  return (await get(url, what, timeoutMs)).text();
}

/** The same, for a file read as bytes: a PDF. */
export async function fetchBytes(url: string, what: string, timeoutMs: number): Promise<Uint8Array> {
  return new Uint8Array(await (await get(url, what, timeoutMs)).arrayBuffer());
}

async function get(url: string, what: string, timeoutMs: number): Promise<Response> {
  let response: Response;
  try {
    // Some government sites refuse a request that does not name a browser-like agent.
    response = await fetch(url, { signal: AbortSignal.timeout(timeoutMs), headers: { accept: "application/json, text/csv, */*", "user-agent": "Mozilla/5.0 (compatible; WhenHazeStop/1.0)" } });
  } catch (error) {
    throw new RetryableError(`${what} did not answer`, { cause: error });
  }
  if (!response.ok) throw new UpstreamError(response.status, `${what} answered ${response.status}`);
  return response;
}

export function pause(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
