/** What every route handler under app/api/ answers when the backend could not be asked. */
export function backendFailure(what: string, error: unknown): Response {
  console.error(`[api] ${what} failed:`, error);
  return Response.json({ error: "Could not reach the backend." }, { status: 503 });
}

/** A read passed through to the backend, so the browser never needs its address. */
export async function passRead(what: string, read: () => Promise<unknown>): Promise<Response> {
  try {
    return Response.json(await read());
  } catch (error) {
    return backendFailure(what, error);
  }
}
