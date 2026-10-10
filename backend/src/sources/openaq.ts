import { z } from "zod";

import { DOMAIN } from "../haze/grid";
import { TerminalError } from "../lib/errors";
import { fetchPatiently, pause } from "./http";

/**
 * OpenAQ: the PM2.5 of every fixed sensor in the region that is not already
 * read from its own government, hour by hour, as far back as each has run.
 *
 * In Malaysia that is one embassy reference monitor and the low-cost sensors
 * of AirGradient and Clarity, most of them around Kuala Lumpur. It is the only
 * measured PM2.5 the country has for the months before this app stored DOE's
 * readings. Needs a free key.
 */

export interface OpenAqSensor {
  sensorId: number;
  locationId: number;
  name: string;
  provider: string;
  /** A regulatory-grade monitor, in OpenAQ's own judgement. False for a low-cost sensor. */
  reference: boolean;
  lat: number;
  lon: number;
  /** The first and last hour the place has reported, or null for one that never has. */
  firstAt: Date | null;
  lastAt: Date | null;
}

export interface OpenAqHour {
  sensorId: number;
  /** The end of the hour the mean is over. */
  observedAt: Date;
  pm25: number;
}

export interface OpenAqClient {
  /** Every fixed PM2.5 sensor inside the model's region. */
  sensors(): Promise<OpenAqSensor[]>;
  /** One sensor's hourly means whose hour ends after `from` and at or before `to`. */
  hours(sensorId: number, from: Date, to: Date): Promise<OpenAqHour[]>;
}

const BASE = "https://api.openaq.org/v3";
const TIMEOUT_MS = 90_000;
/** The key allows 60 requests a minute. */
const SPACING_MS = 1100;
const PAGE = 1000;
/** OpenAQ's id for PM2.5. */
const PM25 = 2;
const PARAMETER = "pm25";
/** Singapore's five regions come from NEA itself, which is where OpenAQ's copy stopped being updated in January 2025. */
const READ_DIRECTLY = /^Singapore$/i;

const When = z.object({ utc: z.string() }).nullable();
const Location = z.object({
  id: z.number(),
  name: z.string().nullable(),
  country: z.object({ name: z.string() }).nullable(),
  provider: z.object({ name: z.string() }),
  isMobile: z.boolean(),
  isMonitor: z.boolean(),
  coordinates: z.object({ latitude: z.number(), longitude: z.number() }),
  sensors: z.array(z.object({ id: z.number(), parameter: z.object({ name: z.string() }) })),
  datetimeFirst: When.optional(),
  datetimeLast: When.optional(),
});
const Locations = z.object({ results: z.array(Location) });
const Hours = z.object({
  results: z.array(z.object({ value: z.number().nullable(), period: z.object({ datetimeTo: z.object({ utc: z.string() }) }) })),
});

function parsed<T>(schema: z.ZodType<T>, text: string, what: string): T {
  const result = schema.safeParse(JSON.parse(text));
  if (!result.success) throw new TerminalError(`${what} answered in a shape this client does not know`, { cause: result.error });
  return result.data;
}

export function parseOpenAqSensors(text: string): OpenAqSensor[] {
  const sensors: OpenAqSensor[] = [];
  for (const location of parsed(Locations, text, "OpenAQ locations").results) {
    // A sensor carried about has no place, and a government's own network is read from the government.
    if (location.isMobile || (location.provider.name === "AirNow" && READ_DIRECTLY.test(location.country?.name ?? ""))) continue;
    for (const sensor of location.sensors) {
      if (sensor.parameter.name !== PARAMETER) continue;
      sensors.push({
        sensorId: sensor.id,
        locationId: location.id,
        name: location.name?.trim() || `OpenAQ ${location.id}`,
        provider: location.provider.name,
        reference: location.isMonitor,
        lat: location.coordinates.latitude,
        lon: location.coordinates.longitude,
        firstAt: location.datetimeFirst ? new Date(location.datetimeFirst.utc) : null,
        lastAt: location.datetimeLast ? new Date(location.datetimeLast.utc) : null,
      });
    }
  }
  return sensors;
}

/** A sensor that reports a negative mass has a fault, not clean air; an hour with no value was not measured. */
export function parseOpenAqHours(text: string, sensorId: number): OpenAqHour[] {
  return parsed(Hours, text, "OpenAQ hours").results.flatMap((hour) =>
    hour.value === null || hour.value < 0 ? [] : [{ sensorId, observedAt: new Date(hour.period.datetimeTo.utc), pm25: hour.value }],
  );
}

export function openAqClient(apiKey: string): OpenAqClient {
  const ask = async (path: string, what: string): Promise<string> => {
    const text = await fetchPatiently(`${BASE}${path}`, what, TIMEOUT_MS, { "x-api-key": apiKey });
    await pause(SPACING_MS);
    return text;
  };
  const pages = async <T>(path: string, what: string, parse: (text: string) => T[], count: (text: string) => number): Promise<T[]> => {
    const all: T[] = [];
    for (let page = 1; ; page++) {
      const text = await ask(`${path}&limit=${PAGE}&page=${page}`, what);
      all.push(...parse(text));
      if (count(text) < PAGE) return all;
    }
  };
  return {
    async sensors() {
      const box = `${DOMAIN.lon0},${DOMAIN.lat0},${DOMAIN.lon1},${DOMAIN.lat1}`;
      return pages(`/locations?bbox=${box}&parameters_id=${PM25}`, "OpenAQ locations", parseOpenAqSensors, (text) => parsed(Locations, text, "OpenAQ locations").results.length);
    },
    async hours(sensorId, from, to) {
      const span = `datetime_from=${from.toISOString()}&datetime_to=${to.toISOString()}`;
      return pages(`/sensors/${sensorId}/hours?${span}`, "OpenAQ hours", (text) => parseOpenAqHours(text, sensorId), (text) => parsed(Hours, text, "OpenAQ hours").results.length);
    },
  };
}
