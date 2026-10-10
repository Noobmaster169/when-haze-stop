/**
 * The only door from the frontend to the backend: a barrel over lib/api/, one
 * file per resource plus transport.ts. Server-side only.
 */
export * from "./api/alerts-client";
export * from "./api/chat-client";
export * from "./api/city-client";
export * from "./api/haze-client";
export * from "./api/sources-client";
export { BackendError } from "./api/transport";
