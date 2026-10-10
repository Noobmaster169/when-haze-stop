import type { Detection } from "../../haze/fires";
import type { WeatherGrid } from "../../haze/transport";
import { RetryableError } from "../../lib/errors";
import type { DoeClient, DoeReading, DoeStation } from "../doe";
import type { FiresClient } from "../firms";
import type { ArchiveSpan, FireArchiveClient, LabelledSource, Satellite } from "../firms-archive";
import type { FoundPlace, Geocoder } from "../geocoder";
import type { MetarClient, MetarReport } from "../metar";
import type { NeaClient, NeaHour } from "../nea";
import type { WeatherClient } from "../weather";

/**
 * The data sources as tests see them: each answers from what it was handed,
 * which in this repo is always a recorded sample of what the real source said.
 * No test may reach DOE, FIRMS or Open-Meteo.
 */

const DAY_MS = 86_400_000;

/** Answers the way the portal does: a state's readings in the 24 hours ending at `until`. */
export class FakeDoeClient implements DoeClient {
  readonly asked: { stateId: number; until: Date }[] = [];

  constructor(
    private readonly known: DoeStation[],
    private readonly recorded: DoeReading[],
  ) {}

  async stations(): Promise<DoeStation[]> {
    return this.known;
  }

  async readings(stateId: number, until: Date): Promise<DoeReading[]> {
    this.asked.push({ stateId, until });
    const inState = new Set(this.known.filter((station) => station.stateId === stateId).map((station) => station.id));
    return this.recorded.filter(
      (reading) => inState.has(reading.stationId) && reading.observedAt <= until && reading.observedAt.getTime() > until.getTime() - DAY_MS,
    );
  }
}

export class FakeFiresClient implements FiresClient {
  constructor(private readonly detections: Detection[]) {}

  async recent(): Promise<Detection[]> {
    return this.detections;
  }
}

function dayAfter(day: string, days: number): string {
  return new Date(Date.parse(`${day}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10);
}

/** Answers the way the area endpoint does: what one satellite recorded in the days asked for. */
export class FakeFireArchiveClient implements FireArchiveClient {
  readonly asked: { satellite: Satellite; labelled: boolean; from: string; days: number }[] = [];

  constructor(
    private readonly available: ArchiveSpan[],
    private readonly live: Detection[],
    private readonly labelled: Partial<Record<Satellite, LabelledSource[]>>,
  ) {}

  async spans(): Promise<ArchiveSpan[]> {
    return this.available;
  }

  async detections(satellite: Satellite, from: string, days: number): Promise<Detection[]> {
    this.asked.push({ satellite, labelled: false, from, days });
    return this.live.filter((hit) => hit.satellite === satellite && hit.day >= from && hit.day < dayAfter(from, days));
  }

  async fixedSources(satellite: Satellite, from: string, days: number): Promise<LabelledSource[]> {
    this.asked.push({ satellite, labelled: true, from, days });
    return (this.labelled[satellite] ?? []).filter((seen) => seen.day >= from && seen.day < dayAfter(from, days));
  }
}

export class FakeWeatherClient implements WeatherClient {
  readonly askedHistory: { firstDay: string; lastDay: string }[] = [];

  constructor(
    private readonly weather: WeatherGrid,
    /** Builds the grid a past span would have come back as. */
    private readonly past?: (start: Date, hours: number) => WeatherGrid,
  ) {}

  async grid(): Promise<WeatherGrid> {
    return this.weather;
  }

  async history(firstDay: string, lastDay: string): Promise<WeatherGrid> {
    this.askedHistory.push({ firstDay, lastDay });
    if (!this.past) throw new RetryableError("Open-Meteo history did not answer");
    const start = new Date(`${firstDay}T00:00:00Z`);
    return this.past(start, Math.round((Date.parse(`${lastDay}T00:00:00Z`) - start.getTime()) / 3_600_000) + 24);
  }
}

/** A weather service that does not answer, failing the way fetchText does when a request times out. */
export class SilentWeatherClient implements WeatherClient {
  async grid(): Promise<WeatherGrid> {
    throw new RetryableError("Open-Meteo forecast did not answer");
  }

  async history(): Promise<WeatherGrid> {
    throw new RetryableError("Open-Meteo history did not answer");
  }
}

export class FakeGeocoder implements Geocoder {
  readonly searched: string[] = [];

  constructor(private readonly places: FoundPlace[] = []) {}

  async search(name: string): Promise<FoundPlace[]> {
    this.searched.push(name);
    return this.places.filter((place) => place.name.toLowerCase().includes(name.trim().toLowerCase()));
  }
}

export class FakeMetarClient implements MetarClient {
  readonly asked: number[] = [];

  constructor(private readonly reports: MetarReport[]) {}

  async recent(hours: number): Promise<MetarReport[]> {
    this.asked.push(hours);
    const newest = Math.max(0, ...this.reports.map((report) => report.observedAt.getTime()));
    return this.reports.filter((report) => report.observedAt.getTime() > newest - hours * 3_600_000);
  }
}

/** Answers the way data.gov.sg does: a Singapore day's hours, or the newest hour. */
export class FakeNeaClient implements NeaClient {
  readonly asked: (string | null)[] = [];

  constructor(private readonly recorded: NeaHour[]) {}

  async hours(day: string | null): Promise<NeaHour[]> {
    this.asked.push(day);
    if (day === null) {
      const newest = Math.max(0, ...this.recorded.map((hour) => hour.observedAt.getTime()));
      return this.recorded.filter((hour) => hour.observedAt.getTime() === newest);
    }
    return this.recorded.filter((hour) => new Date(hour.observedAt.getTime() + 8 * 3_600_000).toISOString().slice(0, 10) === day);
  }
}
