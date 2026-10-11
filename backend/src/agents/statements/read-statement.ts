import { z } from "zod";

import { MalaysianState, StatementAction, StatementIssuer, StatementKind } from "../../contracts";
import { loadPrompt } from "../prompts/registry";
import { callStructured, type StructuredDeps } from "../structured";

/** One fetched item read once by the model into what an authority decided in it. */

export const STATEMENT_PROMPT = "v5";

const Day = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .nullable();

export const StatementReading = z.object({
  isStatement: z.boolean(),
  issuer: StatementIssuer,
  issuerName: z.string(),
  kind: StatementKind,
  action: StatementAction,
  audience: z.string(),
  states: z.array(MalaysianState),
  districts: z.array(z.string()),
  nationwide: z.boolean(),
  threshold: z.number().int().nullable(),
  sustainedDays: z.number().int().nullable(),
  effectiveFrom: Day,
  effectiveUntil: Day,
  summary: z.string().max(200),
  quote: z.string(),
});
export type StatementReading = z.infer<typeof StatementReading>;

export interface ItemToRead {
  title: string;
  outlet: string;
  publishedAt: Date;
  text: string;
}

/** Long statements are cut here: every decision so far was on the first page. */
const MAX_TEXT = 8000;

/** With the hour, so "esok" said at 10pm is read as the next day and not the one after. */
function malaysianTime(at: Date): string {
  return new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Kuala_Lumpur" }).format(at);
}

export async function readStatement(deps: StructuredDeps, item: ItemToRead): Promise<{ reading: StatementReading; promptVersion: string }> {
  const { value, promptVersion } = await callStructured(deps, {
    prompt: loadPrompt("statement", STATEMENT_PROMPT),
    input: {
      Title: item.title,
      Publisher: item.outlet,
      "Published (Malaysian time)": malaysianTime(item.publishedAt),
      Text: item.text.slice(0, MAX_TEXT),
    },
    schema: StatementReading,
    project: "statements",
    conversationId: null,
  });
  return { reading: value, promptVersion };
}
