import { UpstreamError } from "../../lib/errors";
import type { MetarReport } from "../metar";
import type { MetarArchiveClient } from "../metar-archive";
import type { OpenAqClient, OpenAqHour, OpenAqSensor } from "../openaq";

/** The sources only the history job asks, each answering from a recorded sample. */

const DAY_MS = 86_400_000;

/** Answers the way the archive does: every airport's reports in the whole UTC days asked for. */
export class FakeMetarArchiveClient implements MetarArchiveClient {
  readonly asked: { from: string; days: number }[] = [];

  constructor(private readonly recorded: MetarReport[]) {}

  async reports(from: string, days: number): Promise<MetarReport[]> {
    this.asked.push({ from, days });
    const start = Date.parse(`${from}T00:00:00Z`);
    return this.recorded.filter((report) => report.observedAt.getTime() >= start && report.observedAt.getTime() < start + days * DAY_MS);
  }
}

/** Answers the way OpenAQ does: the hours of one sensor that begin at or after `from` and end by `to`. */
export class FakeOpenAqClient implements OpenAqClient {
  readonly asked: { sensorId: number; from: Date; to: Date }[] = [];

  constructor(
    private readonly known: OpenAqSensor[],
    private readonly recorded: OpenAqHour[],
    /** Sensors OpenAQ answers 500 for, as it does for a few every time. */
    private readonly refused: number[] = [],
  ) {}

  async sensors(): Promise<OpenAqSensor[]> {
    return this.known;
  }

  async hours(sensorId: number, from: Date, to: Date): Promise<OpenAqHour[]> {
    this.asked.push({ sensorId, from, to });
    if (this.refused.includes(sensorId)) throw new UpstreamError(500, "OpenAQ hours answered 500");
    return this.recorded.filter((hour) => hour.sensorId === sensorId && hour.observedAt > from && hour.observedAt <= to);
  }
}
