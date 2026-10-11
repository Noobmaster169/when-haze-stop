import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { callTool, TOOL_NAMES, type ToolContext } from "../../src/agents/chat/tools";
import { describeSource, sourceChip } from "../../src/agents/chat/tools/get-forecast";
import type { ForecastSource } from "../../src/contracts";
import { closePool, getPool } from "../../src/db";
import { RetryableError } from "../../src/lib/errors";
import { alerts } from "../../src/repositories";
import { FakeGeocoder } from "../../src/sources/__fakes__/fake.sources";
import { recordedCycle } from "../fixtures/cycle";
import { PLACES } from "../fixtures/recorded";
import { ISSUE_AT, ISSUE_VERSION } from "../fixtures/recorded-model-issue";

afterAll(closePool);

const SESSION = "tools-session-0001";

function context(extra: Partial<ToolContext> = {}): ToolContext {
  return { pool: getPool(), geocoder: new FakeGeocoder(PLACES), conversationId: "none", ...extra };
}

describe("the assistant's haze tools, over one recorded cycle", () => {
  beforeAll(async () => {
    await recordedCycle();
  }, 120_000);

  it("offers every haze tool by name", () => {
    expect(TOOL_NAMES).toEqual(expect.arrayContaining(["get_air_quality", "get_forecast", "get_guidelines", "get_statements", "get_track_record", "get_fires", "get_wind", "get_visibility", "create_alert"]));
  });

  it("reads a station by its own name and says where the reading is from", async () => {
    const outcome = await callTool("get_air_quality", { place: "Seremban" }, context());
    expect(outcome).toMatchObject({ ok: true, source: "DOE" });
    expect(outcome.text).toContain("Seremban, Negeri Sembilan (DOE station CA24N): API 182 (Unhealthy) at Sat 10 Oct, 11:00 Malaysian time");
  });

  it("answers for a place with no station from the nearest one, and says which", async () => {
    const outcome = await callTool("get_air_quality", { place: "Shah Alam" }, context());
    expect(outcome.ok).toBe(true);
    expect(outcome.text).toContain("Petaling Jaya, Selangor (DOE station CA19B, the nearest to Shah Alam,");
  });

  it("reads a Singapore region as a station, on NEA's PSI, with its measured PM2.5", async () => {
    const outcome = await callTool("get_air_quality", { place: "Singapore Central" }, context());
    expect(outcome).toMatchObject({ ok: true, source: "NEA Singapore" });
    // The run's hour is DOE's newest, 11:00 on the 10th, which the recorded PSI day covers; the one-hour PM2.5 recording ends on the 9th.
    expect(outcome.text).toMatch(/^Singapore Central, Singapore \(NEA region SGCENTRAL\): PSI 173 \(Unhealthy\) at Sat 10 Oct, 11:00 Malaysian time\. Over the last 24 hours it ranged from \d+ to \d+\./);
    expect(outcome.text).toMatch(/NEA's measured one-hour PM2.5 there was \d+ ug\/m3 at Fri 9 Oct, 23:00\./);
    expect(await callTool("create_alert", { place: "Singapore Central" }, context({ sessionId: SESSION }))).toMatchObject({ ok: false, preview: expect.stringContaining("NEA region") });
  });

  it("reads an airport by its usual name from the station nearest to it", async () => {
    const outcome = await callTool("get_air_quality", { place: "KLIA" }, context());
    expect(outcome.ok).toBe(true);
    expect(outcome.text).toContain("Seremban, Negeri Sembilan (DOE station CA24N, the nearest to Kuala Lumpur Intl, 28 km away)");
  });

  it("still finds a station by name when the geocoder is down", async () => {
    const down = { search: async (): Promise<never> => Promise.reject(new RetryableError("Open-Meteo geocoder did not answer")) };
    const outcome = await callTool("get_air_quality", { place: "klang" }, context({ geocoder: down }));
    expect(outcome.ok).toBe(true);
    expect(outcome.text).toContain("Klang, Selangor (DOE station CA21B)");
  });

  it("refuses a place it cannot find instead of guessing", async () => {
    const outcome = await callTool("get_forecast", { place: "Atlantis" }, context());
    expect(outcome).toMatchObject({ ok: false });
  });

  it("gives a forecast by day with the chance of passing each official line", async () => {
    const outcome = await callTool("get_forecast", { place: "Seremban" }, context());
    expect(outcome).toMatchObject({ ok: true, source: "Hourly forecast" });
    expect(outcome.text).toContain("- Sun 11 Oct:");
    expect(outcome.text).toMatch(/Chance the peak passes 100: \d+%, 150: \d+%, 180: \d+%, 200: \d+%/);
    expect(outcome.text).toContain("Source: every day and hour is the hourly forecast.");
    expect(outcome.text).toContain("only about as accurate beyond a day");
  });

  it("names the learned model and its record when the days ahead are its forecast", () => {
    const source: ForecastSource = {
      kind: "learned",
      modelVersion: ISSUE_VERSION,
      issuedAt: ISSUE_AT.toISOString(),
      trial: true,
      record: { checkedDays: 3, gain: null, backtest: { model: 11.98, persistence: 13.6, v2: 14.2 } },
    };
    expect(sourceChip(source)).toBe(`Learned model ${ISSUE_VERSION}`);
    const line = describeSource(source);
    expect(line).toContain(`the learned model ${ISSUE_VERSION}'s forecast, issued Sat 10 Oct, 08:00 (on trial until its live record passes)`);
    expect(line).toContain("In its backtest on hazy days it was 12% closer than assuming no change");
    expect(line).toContain("Checked on 3 live days so far.");
    expect(describeSource({ ...source, trial: false, record: { checkedDays: 20, gain: 0.08, backtest: null } })).toContain("Its backtest figure is not available right now. Checked on 20 live days so far, where it was 8% closer than the hourly forecast.");
  });

  it("tells a place the orders that cover it and the rules in force, with the original wording", async () => {
    const outcome = await callTool("get_statements", { place: "Seremban" }, context());
    expect(outcome).toMatchObject({ ok: true, source: "Official statements" });
    expect(outcome.text).toContain("Orders in force or upcoming that cover Seremban, Negeri Sembilan:");
    expect(outcome.text).toContain('All education institutions in Negeri Sembilan close from 9 October. (Negeri Sembilan; from 2026-10-09). Quote: "Semua institusi pendidikan di Negeri Sembilan ditutup esok"');
    expect(outcome.text).toContain("Education institutions close where the API passes 180, from 9 October.");
    const nationally = await callTool("get_statements", {}, context());
    expect(nationally.text).toMatch(/^Official statements about the haze, newest first \(\d+ in force or upcoming\):/);
  });

  it("lists the official lines and admits there is none for events or flights", async () => {
    const outcome = await callTool("get_guidelines", {}, context());
    expect(outcome.text).toContain("Above 180");
    expect(outcome.text).toContain("no national API threshold for public events");
    expect(outcome.text).toContain("no visibility data");
  });

  it("reports the track record, or that there is none yet", async () => {
    const outcome = await callTool("get_track_record", {}, context());
    expect(outcome).toMatchObject({ ok: true, source: "Haze model" });
  });

  it("counts the recorded fires by region and finds the ones near a place", async () => {
    const outcome = await callTool("get_fires", { place: "Seremban" }, context());
    expect(outcome).toMatchObject({ ok: true, source: "NASA FIRMS" });
    expect(outcome.text).toContain("Sumatra and the Riau islands");
    expect(outcome.text).toContain("Within 500 km of Seremban on Fri 9 Oct: 0 cells, 0 MW.");
    expect(outcome.text).toMatch(/The strongest fire that day is \d+ km to the south(-east)? of Seremban, in Sumatra and the Riau islands\./);
  });

  it("describes the wind over a place from the hour of the newest readings", async () => {
    const outcome = await callTool("get_wind", { place: "Klang" }, context());
    expect(outcome).toMatchObject({ ok: true, source: "Open-Meteo" });
    expect(outcome.text).toContain("- Sat 10 Oct, 11:00: from the");
  });

  it("reports the visibility at the nearest airport and which airports are in smoke", async () => {
    const outcome = await callTool("get_visibility", { place: "Seremban" }, context());
    expect(outcome).toMatchObject({ ok: true, source: "METAR" });
    expect(outcome.text).toContain("Visibility at Kuala Lumpur Intl (WMKK), 28 km from Seremban");
    expect(outcome.text).toContain("Now (Sat 10 Oct, 16:00 Malaysian time): 6 km, with showers nearby reported.");
    expect(outcome.text).toContain("Palembang/Badaruddin Arpt 350 m (smoke)");
    expect(outcome.text).toContain("Singapore/Changi Intl 3.5 km (haze)");
    // The geocoder knows a Klias in Sabah; the airport list is asked first.
    const klia = await callTool("get_visibility", { place: "KLIA" }, context());
    expect(klia.text).toContain("Visibility at Kuala Lumpur Intl (WMKK), 0 km from Kuala Lumpur Intl");
  });

  it("follows a station for the browser that asked, and only when it said who it is", async () => {
    expect(await callTool("create_alert", { place: "Klang" }, context())).toMatchObject({ ok: false });
    const outcome = await callTool("create_alert", { place: "Klang" }, context({ sessionId: SESSION }));
    expect(outcome).toMatchObject({ ok: true, preview: "alerts on for Klang" });
    const mine = await alerts.subscriptions(getPool(), SESSION);
    expect(mine.map((item) => item.stationId)).toEqual(["CA21B"]);
  });
});
