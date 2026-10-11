import { z } from "zod";

import type { CouncilContext } from "../context";
import { complexLine, meanOf } from "./format";
import type { CouncilTool, ToolResult } from "./types";

const Input = z.object({
  area: z.enum(["all", "sumatra", "kalimantan", "malaysia"]).default("all").describe("Where to look."),
  sort: z.enum(["influence", "power", "persistence", "distance"]).default("influence"),
  limit: z.number().int().min(1).max(30).default(15),
});
type Input = z.infer<typeof Input>;

export const getComplexes: CouncilTool<Input> = {
  name: "get_complexes",
  description:
    "Lists the fire complexes: id, place, fire power, detections, days burned of the last 30, peat and night share (peat or surface), km to KL, and each one's share of KL's coming smoke in every wind member. Sort by influence (default), power, persistence or distance.",
  schema: Input,
  run(input, ctx: CouncilContext): ToolResult {
    const inArea = ctx.attribution.complexes.filter((complex) => {
      if (input.area === "all") return true;
      if (input.area === "malaysia") return complex.place.country === "Malaysia";
      return complex.place.area === input.area;
    });
    const key = {
      influence: (id: string) => -meanOf(ctx.shares(id) ?? [0]),
      power: (id: string) => -(ctx.complex(id)?.firePowerMw ?? 0),
      persistence: (id: string) => -(ctx.complex(id)?.persistenceDays ?? 0),
      distance: (id: string) => ctx.logistics(id)?.kmToTarget ?? Number.POSITIVE_INFINITY,
    }[input.sort];
    const listed = [...inArea].sort((a, b) => key(a.id) - key(b.id)).slice(0, input.limit);
    const header = `${inArea.length} complexes in ${input.area}, ${input.sort} first. W1 to W${ctx.attribution.members.length} are the wind members.`;
    return { ok: true, text: [header, ...listed.map((complex) => complexLine(complex, ctx))].join("\n"), preview: `${listed.length} complexes by ${input.sort}` };
  },
};
