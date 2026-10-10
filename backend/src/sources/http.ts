import { setDefaultAutoSelectFamilyAttemptTimeout } from "node:net";

import { isTransient, RetryableError, UpstreamError } from "../lib/errors";

/**
 * Node gives each address of a host a quarter of a second to connect before
 * it tries the next, and reports a timeout once all are spent. On a slow link
 * no address makes it in time, so every source fails within a second while
 * the request's own, much longer, timeout is never reached.
 */
setDefaultAutoSelectFamilyAttemptTimeout(5_000);

/**
 * One GET to a data source, with a ceiling on how long it may take.
 *
 * A source that answers with a failure is an UpstreamError; one that does not
 * answer at all is retryable, because the next cycle is an hour away and will
 * ask again anyway.
 */
export async function fetchText(url: string, what: string, timeoutMs: number, headers: Record<string, string> = {}): Promise<string> {
  const response = await get(url, what, timeoutMs, headers);
  try {
    return await response.text();
  } catch (error) {
    // The headers came and the connection dropped part way through the body, which is as retryable as no answer at all.
    throw new RetryableError(`${what} stopped answering part way`, { cause: error });
  }
}

/** The same, for a file read as bytes: a PDF. */
export async function fetchBytes(url: string, what: string, timeoutMs: number): Promise<Uint8Array> {
  return new Uint8Array(await (await get(url, what, timeoutMs)).arrayBuffer());
}

async function get(url: string, what: string, timeoutMs: number, headers: Record<string, string> = {}): Promise<Response> {
  let response: Response;
  try {
    // Some government sites refuse a request that does not name a browser-like agent.
    response = await fetch(url, { signal: AbortSignal.timeout(timeoutMs), headers: { accept: "application/json, text/csv, */*", "user-agent": "Mozilla/5.0 (compatible; WhenHazeStop/1.0)", ...headers } });
  } catch (error) {
    throw new RetryableError(`${what} did not answer`, { cause: error });
  }
  if (!response.ok) throw new UpstreamError(response.status, `${what} answered ${response.status}`);
  return response;
}

/** Six tries with a longer wait each time rides out a link that is down for about five minutes. */
const PATIENT_ATTEMPTS = 6;
/** A source that answers with a failure is up and refusing: three tries tell a blip from a request it will never serve. */
const ANSWERED_ATTEMPTS = 3;
const PATIENT_WAIT_MS = 20_000;
/** A refusal is not a link coming back up, so there is nothing to wait long for. */
const ANSWERED_WAIT_MS = 5_000;
/** A source that says "too many requests" counts them by the minute, so that is how long to stand back. */
const LIMITED_WAIT_MS = 65_000;

/**
 * The same GET for an archive fetch of hundreds of requests, where one dropped
 * connection or one "slow down" should cost a wait and not the whole run.
 */
export async function fetchPatiently(url: string, what: string, timeoutMs: number, headers: Record<string, string> = {}): Promise<string> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await fetchText(url, what, timeoutMs, headers);
    } catch (error) {
      const limited = error instanceof UpstreamError && error.status === 429;
      const answered = error instanceof UpstreamError && !limited;
      const transient = error instanceof RetryableError || (error instanceof UpstreamError && isTransient(error));
      if (!transient || attempt >= (answered ? ANSWERED_ATTEMPTS : PATIENT_ATTEMPTS)) throw error;
      await pause(limited ? LIMITED_WAIT_MS : (answered ? ANSWERED_WAIT_MS : PATIENT_WAIT_MS) * attempt);
    }
  }
}

export function pause(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
/**
 * One POST of a JSON body, with the same rules as a GET: a failure answered
 * is an UpstreamError, no answer is retryable.
 */
export async function postJson(url: string, what: string, timeoutMs: number, body: unknown): Promise<string> {
  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      signal: AbortSignal.timeout(timeoutMs),
      headers: { accept: "application/json", "content-type": "application/json", "user-agent": "Mozilla/5.0 (compatible; WhenHazeStop/1.0)" },
      body: JSON.stringify(body),
    });
  } catch (error) {
    throw new RetryableError(`${what} did not answer`, { cause: error });
  }
  if (!response.ok) throw new UpstreamError(response.status, `${what} answered ${response.status}`);
  try {
    return await response.text();
  } catch (error) {
    throw new RetryableError(`${what} stopped answering part way`, { cause: error });
  }
}
