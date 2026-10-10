import { z } from "zod";

import { neighbours } from "../../../suppression/complexes";
import type { CouncilContext } from "../context";
import { complexLine } from "./format";
import { type CouncilTool, refused, type ToolResult } from "./types";

const Input = z.object({ id: z.string().min(1).max(16).describe("A complex id, as C014.") });
type Input = z.infer<typeof Input>;

export const getComplex: CouncilTool<Input> = {
  name: "get_complex",
  description: "One complex in full: its line, its cells, how far it is from staging and the sea, and the complexes next to it whose fire could relight it.",
  schema: Input,
  run(input, ctx: CouncilContext): ToolResult {
    const complex = ctx.complex(input.id);
    if (!complex) return refused(`there is no complex ${input.id}`);
    const near = neighbours(ctx.attribution.complexes).get(complex.id) ?? [];
    const logistics = ctx.logistics(complex.id);
    const lines = [
      complexLine(complex, ctx),
      `Centre ${complex.lat.toFixed(2)}, ${complex.lon.toFixed(2)}; ${complex.cells.length} cells of 0.1 degree.`,
      logistics ? `Nearest staging: ${logistics.staging.name}, ${Math.round(logistics.staging.km)} km. Open sea ${Math.round(logistics.coastKm)} km away (large rivers are not mapped).` : "Logistics not worked out for this complex.",
      near.length ? `Within 10 km: ${near.join(", ")}. Left burning, they can relight it.` : "No other complex within 10 km.",
    ];
    return { ok: true, text: lines.join("\n"), preview: `${complex.id} ${complex.place.name}` };
  },
};
