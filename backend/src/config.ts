import { z } from "zod";

/** An env var left empty in .env is the same as one that is not there. */
const optionalString = z
  .string()
  .optional()
  .transform((value) => (value ? value : undefined));

const Env = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(8091),
  // Loopback, because the api authenticates nobody. Widen it only behind
  // something that does.
  HOST: z.string().min(1).default("127.0.0.1"),

  PG_HOST: z.string().min(1),
  PG_PORT: z.coerce.number().int().positive().default(5432),
  PG_DATABASE: z.string().min(1),
  PG_USER: z.string().min(1),
  PG_PASSWORD: z.string().min(1),

  // The llm-proxy service of the compose stack. 4001 is where compose.yaml
  // publishes it on the host; inside compose it is http://llm-proxy:4000.
  LLM_PROXY_URL: z.url().default("http://127.0.0.1:4001"),

  // The chat runs the model its prompt file names. This replaces it; it must
  // be an alias from proxy/proxy.yaml.
  LLM_MODEL_CHAT: optionalString,
  // How many model calls this process has in flight at once. Keep it at or
  // under what the proxy serves at once (max_concurrency in proxy/proxy.yaml):
  // more only wait inside the proxy with their request timeout already running.
  LLM_MAX_CONCURRENCY: z.coerce.number().int().positive().default(4),

  // The NASA FIRMS archive key, read only by `pnpm haze:history`. Everything
  // else runs without it.
  FIRMS_MAP_KEY: optionalString,
  // The OpenAQ key, free from https://explore.openaq.org/register. With it the
  // PM2.5 of the region's other sensors is stored each hour and for the past;
  // without it that one source is skipped.
  OPENAQ_API_KEY: optionalString,
  // The first UTC day `pnpm haze:history` fills back to, for every source.
  HISTORY_FROM: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).default("2025-01-01"),

  // Web Push, so an alert reaches a device with the tab closed. Make a pair
  // with `npx web-push generate-vapid-keys`. Without them alerts still show in
  // the app and no notification is sent.
  VAPID_PUBLIC_KEY: optionalString,
  VAPID_PRIVATE_KEY: optionalString,
  // The contact the push services may write to. Safari refuses a localhost
  // one, so set a real mailto: or https: address before relying on it there.
  VAPID_SUBJECT: z.string().min(1).default("mailto:admin@localhost"),

  LOG_LEVEL: z.enum(["trace", "debug", "info", "warn", "error", "fatal", "silent"]).default("info"),

  // The commit an image was built from. "dev" outside a built image, which is
  // exactly what a local process is. /health reports it.
  GIT_SHA: z.string().min(1).default("dev"),
});

export type Config = z.infer<typeof Env>;

function load(): Config {
  const parsed = Env.safeParse(process.env);
  if (parsed.success) return parsed.data;
  const problems = parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`);
  throw new Error(`Invalid environment:\n  ${problems.join("\n  ")}`);
}

export const config = load();
