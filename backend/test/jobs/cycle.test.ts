import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { Accuracy, AlertFeed, GuidelineList, HazeMap, PlaceList, StationOutlook, Subscription, SubscriptionList } from "../../src/contracts";
import { closePool } from "../../src/db";
import { FIELD_CELLS } from "../../src/haze/grid";
import { type FakeDoeClient, FakeGeocoder } from "../../src/sources/__fakes__/fake.sources";
import { testApp } from "../app";
import { recordedCycle } from "../fixtures/cycle";
import { LAST_HOUR, PLACES, STATIONS } from "../fixtures/recorded";

afterAll(closePool);

const SESSION = "test-session-0001";

describe("one cycle, then what the api serves", () => {
  const app = testApp({ geocoder: new FakeGeocoder(PLACES) });
  let doe: FakeDoeClient;

  beforeAll(async () => {
    doe = await recordedCycle();
  }, 120_000);

  it("stores the stations and their readings, asking DOE one state at a time", async () => {
    expect(new Set(doe.asked.map((call) => call.stateId))).toEqual(new Set([5, 10, 13, 14]));
    const outlook = StationOutlook.parse((await request(app).get("/haze/stations/CA19B").expect(200)).body);
    expect(outlook.station).toMatchObject({ name: "Petaling Jaya", state: "Selangor", api: 161, observedAt: LAST_HOUR.toISOString() });
    expect(outlook.readings.length).toBeGreaterThanOrEqual(24);
    expect(outlook.readings.at(-1)).toEqual({ at: LAST_HOUR.toISOString(), api: 161 });
  });

  it("serves a map with the run, its frames, the wind and the fires", async () => {
    const map = HazeMap.parse((await request(app).get("/haze/map").expect(200)).body);
    expect(map.run?.asOf).toBe(LAST_HOUR.toISOString());
    expect(map.stations.map((station) => station.id)).toEqual(expect.arrayContaining(STATIONS.map((station) => station.id)));
    const now = map.frames.find((frame) => frame.validAt === LAST_HOUR.toISOString());
    expect(now?.observed).toBe(true);
    expect(Buffer.from(now?.field ?? "", "base64")).toHaveLength(FIELD_CELLS);
    expect(map.frames.some((frame) => !frame.observed)).toBe(true);
    expect(map.wind.length).toBeGreaterThan(0);
    expect(map.fires[0].frpMw).toBeGreaterThan(1000);
  });

  it("gives a station a forecast and a day-by-day outlook against the official lines", async () => {
    const outlook = StationOutlook.parse((await request(app).get("/haze/stations/CA24N").expect(200)).body);
    expect(outlook.forecast).toHaveLength(84);
    expect(outlook.days).toHaveLength(4);
    // Seremban read up to 189 on the 10th, so that day has already passed 180.
    expect(outlook.days[0]).toMatchObject({ day: "2026-10-10", observedPeak: 189 });
    expect(outlook.days[0].chance["180"]).toBe(1);
    expect(Object.keys(outlook.days[1].chance)).toEqual(["100", "150", "180", "200"]);
  });

  it("raises an alert for a reading over a line, once", async () => {
    const feed = AlertFeed.parse((await request(app).get("/alerts").expect(200)).body);
    const seremban = feed.events.filter((event) => event.stationId === "CA24N" && event.kind === "observed");
    expect(seremban).toHaveLength(1);
    expect(seremban[0].message).toBe("Seremban: API 182, above 180. Schools close under the Education Ministry rule.");
  });

  it("lets a browser follow a station and read only what it follows", async () => {
    const followed = await request(app).post("/alerts/subscriptions").send({ sessionId: SESSION, stationId: "CA24N" }).expect(201);
    expect(Subscription.parse(followed.body)).toMatchObject({ stationId: "CA24N", stationName: "Seremban" });
    await request(app).post("/alerts/subscriptions").send({ sessionId: SESSION, stationId: "CA24N" }).expect(201);
    const list = SubscriptionList.parse((await request(app).get(`/alerts/subscriptions?session=${SESSION}`).expect(200)).body);
    expect(list.subscriptions).toHaveLength(1);

    const mine = AlertFeed.parse((await request(app).get(`/alerts?session=${SESSION}`).expect(200)).body);
    expect(mine.events.length).toBeGreaterThan(0);
    expect(mine.events.every((event) => event.stationId === "CA24N")).toBe(true);
    await request(app).post("/alerts/subscriptions").send({ sessionId: SESSION, stationId: "NOPE" }).expect(404);
  });

  it("finds a place by name, a station's own name first", async () => {
    const found = PlaceList.parse((await request(app).get("/haze/places?q=klang").expect(200)).body);
    expect(found.places[0]).toMatchObject({ name: "Klang", region: "Selangor", nearest: { id: "CA21B", km: 0 } });
    const other = PlaceList.parse((await request(app).get("/haze/places?q=shah").expect(200)).body);
    // Shah Alam has no station of its own in this sample; Petaling Jaya is the closest, about 10 km away.
    expect(other.places[0].nearest).toMatchObject({ id: "CA19B", name: "Petaling Jaya" });
    await request(app).get("/haze/places?q=k").expect(400);
  });

  it("lists the official lines and reports accuracy even before any forecast has been checked", async () => {
    const lines = GuidelineList.parse((await request(app).get("/haze/guidelines").expect(200)).body);
    expect(lines.guidelines.map((line) => line.threshold)).toEqual([100, 100, 150, 180, 200]);
    const accuracy = Accuracy.parse((await request(app).get("/haze/accuracy").expect(200)).body);
    expect(accuracy.leads.map((lead) => lead.leadHours)).toEqual([24, 48, 72]);
  });
});
