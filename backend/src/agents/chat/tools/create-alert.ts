import { z } from "zod";

import { alerts } from "../../../repositories";
import { resolveStation } from "../../../services/places";
import { type ChatTool, refused, type ToolOutcome } from "./types";

/** Follows a station for the person asking, so its alerts reach their browser. */

const Input = z.object({ place: z.string().min(2).max(80).describe("The town, district, venue or DOE station to be alerted about.") });
type Input = z.infer<typeof Input>;

export const createAlert: ChatTool<Input> = {
  name: "create_alert",
  description:
    "Turns on alerts for a place in Malaysia for the person you are talking to: they are told once when its reading crosses an official line, when the forecast says haze is arriving, and when it says haze is clearing. " +
    "Call it only when the person asks to be alerted, notified or told.",
  schema: Input,

  async run(input, ctx): Promise<ToolOutcome> {
    if (!ctx.sessionId) return refused("this browser sent no session id, so there is nobody to follow the station for. Ask the person to use the Alert me button on the map");
    const found = await resolveStation(ctx.pool, ctx.geocoder, input.place);
    if (!found) return refused(`no place named "${input.place}" was found inside the map's region`);
    if (found.station.network !== "doe") return refused(`${found.station.name} is an NEA region; alerts follow Malaysia's official lines and are not raised for Singapore`);
    await alerts.subscribe(ctx.pool, ctx.sessionId, found.station.id);
    const where = `${found.station.name}, ${found.station.state}${found.via ? ` (the nearest DOE station to ${found.via})` : ""}`;
    return {
      ok: true,
      text: `Alerts are on for ${where}. They show in this browser, in the bar at the top of the app, and can be turned off from the Alerts page.`,
      preview: `alerts on for ${found.station.name}`,
    };
  },
};
