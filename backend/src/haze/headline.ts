import type { Headline } from "../contracts";
import { CLEAR_LINE, CLOSE_LINE, type ClosingInput, closingOutlook, LIKELY, percent, SUSTAINED_LINE, weekday } from "./closing";

/**
 * What an area's card leads with. Always the forecast for tomorrow, also on a
 * calm day, so a person sees what is coming and not only what is bad. Orders
 * in force are shown under it.
 */

export function headlineFor(input: ClosingInput): Headline {
  const outlook = closingOutlook(input);
  const { tomorrow } = outlook;
  if (!tomorrow || tomorrow.forecastPeak === null) {
    return { tone: "calm", title: "No forecast yet", sentence: "The model has not run for this area, so only the reading is known." };
  }
  if (outlook.passChance >= LIKELY) {
    return { tone: "close", title: "Schools may close tomorrow", sentence: `${percent(outlook.passChance)} chance of passing ${CLOSE_LINE}, the Education Ministry's closing line.` };
  }
  if (outlook.thirdDayChance >= LIKELY) {
    return { tone: "close", title: "Schools may close", sentence: `${percent(outlook.thirdDayChance)} chance tomorrow is a third day above ${SUSTAINED_LINE}, which closes schools.` };
  }
  if (outlook.clearingDay) {
    const when = outlook.clearingDay === tomorrow ? "tomorrow" : `by ${weekday(outlook.clearingDay.day)}`;
    return { tone: "clear", title: `Clearing ${when}`, sentence: `Likely back under ${CLEAR_LINE} ${when}, when outdoor activities can resume.` };
  }
  if ((tomorrow.chance[CLEAR_LINE] ?? 0) >= LIKELY) {
    return { tone: "watch", title: "Unhealthy tomorrow", sentence: `Peak near ${tomorrow.forecastPeak}. Outdoor activities stop above ${CLEAR_LINE}; no school closure expected.` };
  }
  return { tone: "calm", title: "No action expected tomorrow", sentence: `Peak near ${tomorrow.forecastPeak}, under every line that triggers an official action.` };
}
