import { RetryableError, UpstreamError } from "../lib/errors";

/**
 * One GET to a data source, with a ceiling on how long it may take.
 *
 * A source that answers with a failure is an UpstreamError; one that does not
 * answer at all is retryable, because the next cycle is an hour away and will
 * ask again anyway.
 */
export async function fetchText(url: string, what: string, timeoutMs: number): Promise<string> {
  let response: Response;
  try {
    response = await fetch(url, { signal: AbortSignal.timeout(timeoutMs), headers: { accept: "application/json, text/csv, */*" } });
  } catch (error) {
    throw new RetryableError(`${what} did not answer`, { cause: error });
  }
  if (!response.ok) throw new UpstreamError(response.status, `${what} answered ${response.status}`);
  return response.text();
}

export function pause(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
