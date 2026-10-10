import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { Accuracy, AlertFeed, Simulation, AreaList, GuidelineList, HazeMap, PlaceList, PushKey, StatementPage, StationOutlook, Subscription, SubscriptionList } from "../../src/contracts";
import { closePool, getPool } from "../../src/db";
import { evaluateAlerts } from "../../src/jobs/alerts";
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
    expect(map.stations.map((station) => station.id)).toEqual(expect.arrayContaining([...STATIONS.map((station) => station.id), "SGCENTRAL", "SGWEST"]));
    expect(map.stations.find((station) => station.id === "SGCENTRAL")).toMatchObject({ network: "nea", state: "Singapore" });
    expect(map.airports.length).toBe(29);
    // A Singapore region reads like any station, on NEA's PSI, with the measured PM2.5 that only NEA has.
    const singapore = StationOutlook.parse((await request(app).get("/haze/stations/SGCENTRAL").expect(200)).body);
    expect(singapore.readings.at(-1)).toEqual({ at: LAST_HOUR.toISOString(), api: 173 });
    expect(singapore.pm25).toMatchObject({ at: "2026-10-09T15:00:00.000Z" });
    const klia = map.airports.find((airport) => airport.icao === "WMKK");
    expect(klia?.reports.at(-1)).toEqual({ at: "2026-10-10T08:00:00.000Z", m: 6000, wx: "VCSH" });
    const now = map.frames.find((frame) => frame.validAt === LAST_HOUR.toISOString());
    expect(now?.observed).toBe(true);
    expect(Buffer.from(now?.field ?? "", "base64")).toHaveLength(FIELD_CELLS);
    expect(map.frames.some((frame) => !frame.observed)).toBe(true);
    expect(map.wind.length).toBeGreaterThan(0);
    expect(map.fires[0].frpMw).toBeGreaterThan(1000);
    // Each cell says which day it burned on, and the week behind the run is all there for the timeline to walk through.
    expect([...new Set(map.fires.map((fire) => fire.day))].sort()).toEqual(["2026-10-07", "2026-10-08", "2026-10-09"]);
  });

  it("explains the run and replays the stored readings against no change", async () => {
    const simulation = Simulation.parse((await request(app).get("/haze/simulation").expect(200)).body);
    expect(simulation.run?.members).toBe(10);
    expect(simulation.period.stations).toBeGreaterThan(0);
    const oneHour = simulation.skill.find((row) => row.lead === 1);
    expect(oneHour?.cases).toBeGreaterThan(0);
    expect(simulation.histogram.reduce((sum, bin) => sum + bin.count, 0)).toBe(simulation.period.readings);
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

  it("reads the statements once, and shows only those whose quote is in the text", async () => {
    const page = StatementPage.parse((await request(app).get("/statements?status=all").expect(200)).body);
    const summaries = page.statements.map((statement) => statement.summary);
    expect(summaries).toEqual(expect.arrayContaining(["Education institutions close where the API passes 180, from 9 October.", "All education institutions in Negeri Sembilan close from 9 October."]));
    // The Johor reading quoted a sentence its headline does not hold.
    expect(summaries.some((summary) => summary.includes("Johor"))).toBe(false);
    const rule = page.statements.find((statement) => statement.threshold === 180);
    expect(rule).toMatchObject({ status: "in-force", outlet: "Kementerian Pendidikan" });
    expect(page.statements.find((statement) => statement.threshold === 200)?.status).toBe("replaced");
    await request(app).get("/statements?status=some").expect(400);
  });

  it("raises one alert for Seremban, the order that covers it, and says it once", async () => {
    const feed = AlertFeed.parse((await request(app).get("/alerts").expect(200)).body);
    // Newest first. The test database is kept between runs, so older alerts may sit below it.
    const [newest] = feed.events.filter((event) => event.stationId === "CA24N");
    expect(newest).toMatchObject({ kind: "order", message: "Ministry of Education: All education institutions in Negeri Sembilan close from 9 October." });
    expect(await evaluateAlerts(getPool(), null, new Date(LAST_HOUR.getTime() + 20 * 60_000))).toBe(0);
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

  it("gives each followed area a card that leads with the forecast and lists the order in force", async () => {
    const { areas } = AreaList.parse((await request(app).get(`/alerts/areas?session=${SESSION}`).expect(200)).body);
    expect(areas).toHaveLength(1);
    expect(areas[0]).toMatchObject({ stationId: "CA24N", stationName: "Seremban", api: 182, alert: { kind: "order" } });
    expect(areas[0].days).toHaveLength(4);
    expect(areas[0].headline.title.length).toBeGreaterThan(0);
    expect(areas[0].orders.map((order) => order.states)).toEqual([["Negeri Sembilan"]]);
  });

  it("keeps the device a session notifies, and says when no push key is set", async () => {
    const push = { endpoint: "https://fcm.googleapis.com/fcm/send/test-endpoint", keys: { p256dh: "BNcR", auth: "tBHI" } };
    await request(app).put("/alerts/push").send({ sessionId: SESSION, push }).expect(204);
    await request(app).put("/alerts/push").send({ sessionId: SESSION, push: { endpoint: "not a url" } }).expect(400);
    expect(PushKey.parse((await request(app).get("/alerts/push-key").expect(200)).body).publicKey).toBeNull();
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
