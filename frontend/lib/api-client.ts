/**
 * The only door from the frontend to the backend: a barrel over lib/api/, one
 * file per resource plus transport.ts. Server-side only.
 */
export * from "./api/chat-client";
export { BackendError } from "./api/transport";
