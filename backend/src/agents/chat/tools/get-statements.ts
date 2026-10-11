import { z } from "zod";

import type { Statement } from "../../../contracts";
import { resolveStation } from "../../../services/places";
import { currentStatements, isCurrent, stationOrders } from "../../../services/statements";
import { type ChatTool, refused, type ToolOutcome } from "./types";

/** What the government has said about the haze: school closures, rules, emergencies, with links. */

const Input = z.object({
  place: z.string().min(2).max(80).optional().describe("A town, district or station in Malaysia, to get only the orders that cover it. Leave out for the whole country."),
});
type Input = z.infer<typeof Input>;

const MAX_LISTED = 12;

function line(statement: Statement): string {
  const dates = [statement.effectiveFrom && `from ${statement.effectiveFrom}`, statement.effectiveUntil && `until ${statement.effectiveUntil}`].filter(Boolean).join(" ");
  const areas = statement.nationwide ? "nationwide" : [...statement.states, ...statement.districts].join(", ");
  return `- [${statement.status}] ${statement.issuerName}, published ${statement.publishedAt.slice(0, 10)}: ${statement.summary} (${areas}${dates ? `; ${dates}` : ""}). Quote: "${statement.quote}" Link: ${statement.url}`;
}

export const getStatements: ChatTool<Input> = {
  name: "get_statements",
  description:
    "Returns what Malaysian authorities have officially said about the haze: school closing rules and closures, emergencies, work from home, " +
    "each with its status (in-force, upcoming, replaced, ended), the areas it covers, the original wording and a link. " +
    "Use it for any question about whether schools are closed or what the government has decided, before answering from the forecast.",
  schema: Input,

  async run(input, ctx): Promise<ToolOutcome> {
    const all = await currentStatements(ctx.pool, new Date());
    if (!input.place) {
      const current = all.filter(isCurrent);
      const shown = (current.length > 0 ? current : all).slice(0, MAX_LISTED);
      if (shown.length === 0) return { ok: true, text: "No official statement about the haze has been found yet.", preview: "no statements", source: "Official statements" };
      return {
        ok: true,
        text: [`Official statements about the haze, newest first (${current.length} in force or upcoming):`, ...shown.map(line)].join("\n"),
        preview: `${current.length} statements in force`,
        source: "Official statements",
      };
    }

    const found = await resolveStation(ctx.pool, ctx.geocoder, input.place);
    if (!found) return refused(`no place named "${input.place}" was found inside the map's region`);
    const orders = stationOrders(all, found.station);
    const rules = all.filter((statement) => statement.kind === "rule" && statement.status === "in-force");
    const place = `${found.station.name}, ${found.station.state}${found.via ? ` (the nearest station to ${found.via})` : ""}`;
    return {
      ok: true,
      text: [
        orders.length > 0 ? `Orders in force or upcoming that cover ${place}:` : `No official order currently names ${place} or its state.`,
        ...orders.map(line),
        rules.length > 0 ? "Rules in force everywhere, applied by the reading:" : "",
        ...rules.map(line),
      ]
        .filter(Boolean)
        .join("\n"),
      preview: `${orders.length} orders for ${found.station.name}`,
      source: "Official statements",
    };
  },
};
