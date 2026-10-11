import type { FireCellDay } from "../../src/haze/fires";
import type { DoeReading, DoeStation, FoundPlace } from "../../src/sources";

/**
 * Samples recorded from the real sources on 10 October 2026, during the haze
 * episode this project was built in. Nothing here is made up: every station,
 * reading, fire and row is what DOE, NASA FIRMS or Open-Meteo answered.
 */

/** Five DOE stations as `mapcaqm` listed them. */
export const STATIONS: DoeStation[] = [
  { id: "CA16W", name: "Cheras", state: "WP Kuala Lumpur", stateId: 14, lat: 3.10626, lon: 101.717931 },
  { id: "CA19B", name: "Petaling Jaya", state: "Selangor", stateId: 10, lat: 3.130875, lon: 101.60868 },
  { id: "CA21B", name: "Klang", state: "Selangor", stateId: 10, lat: 3.014899, lon: 101.413136 },
  { id: "CA24N", name: "Seremban", state: "Negeri Sembilan", stateId: 5, lat: 2.723441, lon: 101.968395 },
  { id: "CA65Q", name: "Kuching", state: "Sarawak", stateId: 13, lat: 1.562167, lon: 110.388916 },
];

/** The first of the 36 hours below, and the last: 11:00 on 10 October in Malaysia. */
export const FIRST_HOUR = new Date("2026-10-08T16:00:00Z");
export const LAST_HOUR = new Date("2026-10-10T03:00:00Z");

const HOURLY: Record<string, number[]> = {
  CA16W: [170, 170, 170, 170, 170, 170, 170, 170, 170, 170, 170, 170, 170, 169, 170, 171, 172, 177, 172, 172, 172, 173, 173, 173, 173, 174, 174, 174, 175, 175, 175, 175, 175, 175, 175, 174],
  CA19B: [169, 169, 169, 169, 170, 169, 169, 169, 169, 169, 169, 168, 168, 168, 168, 169, 167, 167, 167, 165, 164, 164, 164, 164, 163, 163, 163, 163, 162, 162, 162, 162, 162, 161, 161, 161],
  CA21B: [165, 166, 167, 167, 167, 167, 168, 168, 168, 167, 166, 166, 166, 166, 167, 167, 167, 167, 166, 166, 166, 165, 165, 165, 164, 164, 164, 164, 163, 163, 162, 161, 159, 158, 157, 156],
  CA24N: [188, 188, 188, 187, 187, 187, 187, 186, 186, 186, 185, 187, 187, 188, 189, 189, 189, 189, 189, 188, 188, 189, 189, 189, 189, 188, 188, 187, 187, 186, 186, 185, 184, 184, 183, 182],
  CA65Q: [88, 87, 86, 85, 85, 84, 83, 83, 82, 82, 82, 82, 82, 85, 84, 86, 87, 88, 88, 90, 90, 90, 91, 92, 94, 96, 98, 105, 124, 139, 151, 152, 152, 153, 153, 154],
};

export const READINGS: DoeReading[] = Object.entries(HOURLY).flatMap(([stationId, values]) =>
  values.map((api, hour) => ({ stationId, observedAt: new Date(FIRST_HOUR.getTime() + hour * 3_600_000), api })),
);

/** The strongest fire cells west of 107E on 7, 8 and 9 October, after taking the largest of the three satellites. */
export const FIRE_CELLS: FireCellDay[] = [
  ["2026-10-07", -34, 1052, 3413.4],
  ["2026-10-07", -33, 1054, 3133.9],
  ["2026-10-07", -36, 1057, 2083.5],
  ["2026-10-07", -19, 1039, 2028.4],
  ["2026-10-07", -32, 1044, 1334.7],
  ["2026-10-07", -27, 1055, 1332.4],
  ["2026-10-07", -17, 1043, 843.1],
  ["2026-10-07", -34, 1051, 669.4],
  ["2026-10-08", -36, 1057, 3132.2],
  ["2026-10-08", -34, 1052, 1912.5],
  ["2026-10-08", -19, 1039, 1904.1],
  ["2026-10-08", -32, 1044, 1758.4],
  ["2026-10-08", -33, 1054, 1159.3],
  ["2026-10-08", -35, 1052, 928.4],
  ["2026-10-08", -15, 1044, 729.7],
  ["2026-10-08", -34, 1051, 665.7],
  ["2026-10-09", -36, 1057, 2694.3],
  ["2026-10-09", -32, 1044, 546.4],
  ["2026-10-09", 9, 1061, 483.3],
  ["2026-10-09", 10, 1062, 453.1],
  ["2026-10-09", -19, 1039, 445.4],
  ["2026-10-09", -15, 1044, 436.3],
  ["2026-10-09", -24, 1042, 402.4],
  ["2026-10-09", -34, 1051, 293],
].map(([day, lat10, lon10, frpMw]) => ({ day: day as string, lat10: lat10 as number, lon10: lon10 as number, frpMw: frpMw as number }));

/** The head of the Suomi NPP seven-day file: its header and first nine rows. */
export const FIRMS_CSV = `latitude,longitude,bright_ti4,scan,track,acq_date,acq_time,satellite,confidence,version,bright_ti5,frp,daynight
-3.15776,113.95805,333.58,0.38,0.36,2026-10-03,0603,N,nominal,2.0NRT,299.58,2.44,D
-4.41621,152.11021,333.24,0.64,0.72,2026-10-03,0241,N,nominal,2.0NRT,293.02,3.79,D
-4.31815,152.10938,328.61,0.64,0.72,2026-10-03,0241,N,nominal,2.0NRT,293.09,3.83,D
-4.23477,152.04686,350.43,0.64,0.72,2026-10-03,0241,N,nominal,2.0NRT,292.01,13.37,D
-3.99474,152.85268,330.92,0.56,0.69,2026-10-03,0241,N,nominal,2.0NRT,293.29,4.65,D
-3.95538,152.80782,346.65,0.57,0.69,2026-10-03,0241,N,nominal,2.0NRT,292.17,6.23,D
-3.95348,152.80994,335.28,0.57,0.69,2026-10-03,0241,N,nominal,2.0NRT,292.22,7.43,D
-3.74516,152.51602,328.79,0.59,0.7,2026-10-03,0241,N,nominal,2.0NRT,293.03,5.2,D
-3.6585,152.47925,327.99,0.59,0.7,2026-10-03,0241,N,nominal,2.0NRT,293.75,4.77,D
`;

/** Two rows of DOE's `mapcaqm`, as the portal sent them. */
export const DOE_MAP_JSON =
  '{"data":[{"ID":1,"STATE_ID":9,"STATE_NAME":"Perlis","STATION_STATUS":1,"STATION_ID":"CA01R","STATION_LOCATION":"Kangar, PERLIS","LONGITUDE":100.210937,"LATITUDE":6.429928,"API":61,"PARAM_SYMBOL":"**","CLASS":"Moderate","RECORD_DT":"2026-10-10T11:00:00"},' +
  '{"ID":2,"STATE_ID":2,"STATE_NAME":"Kedah","STATION_STATUS":1,"STATION_ID":"CA02K","STATION_LOCATION":"Langkawi, KEDAH","LONGITUDE":99.858461,"LATITUDE":6.331608,"API":57,"PARAM_SYMBOL":"**","CLASS":"Moderate","RECORD_DT":"2026-10-10T11:00:00"}]}';

/** Three rows of DOE's `apitablehourly` for Putrajaya. */
export const DOE_HOURLY_JSON =
  '{"api_table_hourly":[' +
  '{"PAGE_ROWNUM":1,"PAGE_TOTALROW":24,"PAGE":1,"PAGE_TOTAL":1,"STATION_ID":"CA17W","STATE_ID":16,"STATION_NAME":null,"STATION_LOCATION":"Putrajaya, W.P. PUTRAJAYA","LATITUDE":2.915793,"LONGITUDE":101.690946,"DATETIME":"2026-10-10T11:00:00","API":167,"PARAM_SYMBOL":"**"},' +
  '{"PAGE_ROWNUM":2,"PAGE_TOTALROW":24,"PAGE":1,"PAGE_TOTAL":1,"STATION_ID":"CA17W","STATE_ID":16,"STATION_NAME":null,"STATION_LOCATION":"Putrajaya, W.P. PUTRAJAYA","LATITUDE":2.915793,"LONGITUDE":101.690946,"DATETIME":"2026-10-10T10:00:00","API":167,"PARAM_SYMBOL":"**"},' +
  '{"PAGE_ROWNUM":3,"PAGE_TOTALROW":24,"PAGE":1,"PAGE_TOTAL":1,"STATION_ID":"CA17W","STATE_ID":16,"STATION_NAME":null,"STATION_LOCATION":"Putrajaya, W.P. PUTRAJAYA","LATITUDE":2.915793,"LONGITUDE":101.690946,"DATETIME":"2026-10-10T09:00:00","API":169,"PARAM_SYMBOL":"**"}]}';

/** What Open-Meteo's geocoder returned for these names. */
export const PLACES: FoundPlace[] = [
  { name: "Shah Alam", region: "Selangor", country: "Malaysia", lat: 3.085, lon: 101.533 },
  { name: "Klang", region: "Selangor", country: "Malaysia", lat: 3.037, lon: 101.443 },
];
