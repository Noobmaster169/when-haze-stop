/** Worth another attempt: a timeout, a 5xx, a dependency that is restarting. */
export class RetryableError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "RetryableError";
  }
}

/** The model could not be reached or is rate limited, and the client's own retries are spent. */
export class LlmUnavailableError extends RetryableError {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "LlmUnavailableError";
  }
}

/**
 * The model did not answer within the request timeout. Not retried inside the
 * client, because each try already costs the full timeout.
 */
export class LlmTimeoutError extends RetryableError {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "LlmTimeoutError";
  }
}

/**
 * The caller abandoned the call mid-flight: a person pressed stop. Not a
 * failure and not an outage.
 *
 * Deliberately not a RetryableError. Retrying is exactly what must not happen
 * here, because the person who stopped it does not want the answer.
 */
export class CallAbortedError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "CallAbortedError";
  }
}

/** Will fail the same way every time: bad input, a 404, a schema that does not parse. */
export class TerminalError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "TerminalError";
  }
}

/**
 * A dependency answered and the answer was a failure. `status` is what the api
 * relays to its own caller.
 *
 * `retryable` carries the dependency's own verdict. Status alone cannot separate
 * a permanent misconfiguration from an outage: the proxy answers 500 both for a
 * provider name that does not exist and for an upstream that fell over, and
 * guessing wrong in that direction retries a typo forever.
 */
export class UpstreamError extends Error {
  readonly status: number;
  /** Null where the dependency does not say, leaving `status` as the only signal. */
  readonly retryable: boolean | null;

  constructor(status: number, message: string, options?: { cause?: unknown; retryable?: boolean | null }) {
    super(message, { cause: options?.cause });
    this.name = "UpstreamError";
    this.status = status;
    this.retryable = options?.retryable ?? null;
  }
}

/**
 * Whether another attempt could plausibly succeed. The dependency's own verdict
 * wins; without one, 429 and 5xx are transient and everything else is a request
 * this side has to fix.
 */
export function isTransient(error: UpstreamError): boolean {
  return error.retryable ?? (error.status === 429 || error.status >= 500);
}

/**
 * What the api answers when a dependency failed. A 4xx is this request's fault
 * and says so; anything else is the dependency's and becomes a plain 502, so a
 * caller never sees an upstream's 500 as if the api itself had broken.
 */
export function relayStatus(status: number): number {
  return status >= 400 && status < 500 ? status : 502;
}
