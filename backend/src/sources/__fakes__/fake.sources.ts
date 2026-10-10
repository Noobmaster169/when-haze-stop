import type { Detection } from "../../haze/fires";
import type { WeatherGrid } from "../../haze/transport";
import { RetryableError } from "../../lib/errors";
import type { DoeClient, DoeReading, DoeStation } from "../doe";
import type { FiresClient } from "../firms";
import type { FoundPlace, Geocoder } from "../geocoder";
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

export class FakeWeatherClient implements WeatherClient {
  constructor(private readonly weather: WeatherGrid) {}

  async grid(): Promise<WeatherGrid> {
    return this.weather;
  }
}

/** A weather service that does not answer, failing the way fetchText does when a request times out. */
export class SilentWeatherClient implements WeatherClient {
  async grid(): Promise<WeatherGrid> {
    throw new RetryableError("Open-Meteo forecast did not answer");
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
