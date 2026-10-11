import { describe, expect, it } from "vitest";

import { confirmedFires } from "../../src/haze/fire-confirm";
import { parseFirmsCsv } from "../../src/sources/firms";
import { LIVE_FIRE, LIVE_KERTEH } from "../fixtures/recorded-archive";

const kerteh = LIVE_KERTEH.flatMap((group) => parseFirmsCsv(group.csv, group.satellite));

describe("keeping only the fires the satellites agree on", () => {
  it("keeps a fire seen in one pass when it burns hard", () => {
    // West Kalimantan, 1 August, the night pass of NOAA-20 alone: six pixels, 63 MW together.
    const fire = parseFirmsCsv(LIVE_FIRE.csv, LIVE_FIRE.satellite).filter((hit) => hit.hour === 18);
    expect(fire).toHaveLength(6);
    expect(confirmedFires(fire)).toEqual({ confirmed: fire, unconfirmed: 0 });
  });

  it("keeps a weak fire that a second pass saw again", () => {
    // 4.52N 103.44E on 1 August: 5.4 MW from NOAA-21 in the morning, 0.9 MW from NOAA-20 at night.
    const twice = kerteh.filter((hit) => hit.day === "2026-08-01" && hit.lat < 4.53);
    expect(twice.map((hit) => hit.satellite).sort()).toEqual(["noaa20", "noaa21"]);
    expect(confirmedFires(twice).unconfirmed).toBe(0);
  });

  it("drops a single faint pixel seen once", () => {
    // 4.57N 103.30E on 5 August: 2 MW, one pass of one satellite, nothing before or after.
    const once = kerteh.filter((hit) => hit.lon < 103.3);
    expect(once).toHaveLength(1);
    expect(confirmedFires(once)).toEqual({ confirmed: [], unconfirmed: 1 });
  });
});
