import { z } from "zod";

import { stationOutlook } from "../../../services/outlook";
import { resolveStation } from "../../../services/places";
import { dayName, percent, when } from "./format";
import { type ChatTool, refused, type ToolOutcome } from "./types";

/** The next three and a half days for a place: peaks, ranges, and the chance of passing each official line. */

const Input = z.object({ place: z.string().min(2).max(80).describe("A town, district, venue or DOE station name in Malaysia.") });
type Input = z.infer<typeof Input>;

/** Every sixth hour is enough for the model to read a trend and to answer "at 4pm on Sunday". */
const EVERY_HOURS = 6;

export const getForecast: ChatTool<Input> = {
  name: "get_forecast",
  description:
    "Returns this app's haze forecast for a place in Malaysia: for each of the next days, the forecast peak API, its likely range, " +
    "and the chance of passing each official line (100, 150, 180, 200), plus a value every six hours. Use it for any question about a future day or time.",
  schema: Input,

  async run(input, ctx): Promise<ToolOutcome> {
    const found = await resolveStation(ctx.pool, ctx.geocoder, input.place);
    if (!found) return refused(`no place named "${input.place}" was found inside the map's region`);
    const outlook = await stationOutlook(ctx.pool, found.station.id);
    if (!outlook || outlook.forecast.length === 0) return refused(`there is no forecast for ${found.station.name} yet`);

    const days = outlook.days.map((day) => {
      const chances = Object.entries(day.chance).map(([line, chance]) => `${line}: ${percent(chance)}`).join(", ");
      const seen = day.observedPeak === null ? "" : ` Read so far: peak ${day.observedPeak}.`;
      const ahead = day.forecastPeak === null ? "" : ` Forecast peak ${day.forecastPeak}, likely between ${day.low} and ${day.high}.`;
      return `- ${dayName(day.day)}:${seen}${ahead} Chance the peak passes ${chances}.`;
    });
    const steps = outlook.forecast.filter((_, index) => (index + 1) % EVERY_HOURS === 0).map((value) => `${when(value.at)} ${value.api}`);
    const tomorrow = outlook.days[1];

    return {
      ok: true,
      text: [
        `Forecast for ${found.station.name}, ${found.station.state}${found.via ? ` (the nearest station to ${found.via})` : ""}, in Malaysian time.`,
        ...days,
        `Every six hours: ${steps.join("; ")}.`,
        "The range covers 8 in 10 past errors. Replayed over every hour of 3 to 10 October 2026, this forecast was about a fifth closer than assuming no change up to 12 hours ahead and only about as accurate beyond a day; call get_track_record before leaning on a day or more ahead.",
      ].join("\n"),
      preview: tomorrow?.forecastPeak ? `${found.station.name} tomorrow peak ${tomorrow.forecastPeak}` : `${found.station.name} forecast`,
      source: "Haze model",
    };
  },
};
