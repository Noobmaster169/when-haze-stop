import { getPool } from "../../src/db";
import type { Detection } from "../../src/haze/fires";
import { runCycle } from "../../src/jobs/cycle";
import { FakeDoeClient, FakeFiresClient, FakeMetarClient, FakeNeaClient, FakeWeatherClient } from "../../src/sources/__fakes__/fake.sources";
import { FakeStatementsClient } from "../../src/sources/__fakes__/fake.statements";
import { parseMetars } from "../../src/sources/metar";
import { parseMoeList } from "../../src/sources/moe-statements";
import { parseNea } from "../../src/sources/nea";
import { parseNewsRss } from "../../src/sources/news-statements";
import { FIRE_CELLS, LAST_HOUR, READINGS, STATIONS } from "./recorded";
import { METAR_JSON, NEA_PM25_DAY_JSON, NEA_PSI_DAY_JSON, NEA_PSI_TODAY_JSON } from "./recorded-context";
import { MOE_LIST_HTML, MOE_PDF_TEXT, NEWS_RSS } from "./recorded-statements";
import { statementReader } from "./statement-readings";
import { steadyWind } from "./steady-wind";

/**
 * The recorded cell-days, as the single detections they would have come from.
 * A cell-day keeps neither the pass nor the brightness, so those are left
 * neutral: no pass, not daytime, not saturated.
 */
const DETECTIONS: Detection[] = FIRE_CELLS.map((cell) => ({
  satellite: "snpp",
  lat: cell.lat10 / 10 + 0.01,
  lon: cell.lon10 / 10 + 0.01,
  day: cell.day,
  hour: 0,
  daytime: false,
  saturated: false,
  frpMw: cell.frpMw,
}));
const WEATHER_START = new Date("2026-10-06T00:00:00Z");

/** The 9 October day feeds and the 10th's PSI hours, as two day fetches would bring them. */
const NEA_HOURS = [...parseNea(NEA_PM25_DAY_JSON, NEA_PSI_DAY_JSON), ...parseNea(JSON.stringify({ items: [] }), NEA_PSI_TODAY_JSON)];

/**
 * One whole cycle over the recorded sample, twenty minutes after its last
 * reading. Safe to run from more than one test file: everything it stores is
 * keyed, so a second run changes nothing.
 */
export async function recordedCycle(): Promise<FakeDoeClient> {
  const doe = new FakeDoeClient(STATIONS, READINGS);
  const moe = parseMoeList(MOE_LIST_HTML);
  const channels = [
    new FakeStatementsClient("moe-statements", moe, { [moe[0].url]: MOE_PDF_TEXT }),
    new FakeStatementsClient("news-statements", parseNewsRss(NEWS_RSS)),
  ];
  await runCycle(
    {
      pool: getPool(),
      doe,
      fires: new FakeFiresClient(DETECTIONS),
      weather: new FakeWeatherClient(steadyWind(WEATHER_START, 200, 3, 3)),
      metar: new FakeMetarClient(parseMetars(METAR_JSON)),
      nea: new FakeNeaClient(NEA_HOURS),
      statements: { channels, llm: statementReader() },
    },
    new Date(LAST_HOUR.getTime() + 20 * 60_000),
    { fires: true, model: false },
  );
  return doe;
}
