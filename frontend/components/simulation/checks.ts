/**
 * The checks made on each part of the simulation on 10 October 2026, against
 * outside measurements. Each is a measured value; the method and the numbers
 * behind it are in docs/FORECAST.md section 6.
 */

export interface Check {
  part: string;
  headline: string;
  line: string;
}

export const CHECKS: Check[] = [
  {
    part: "Wind direction",
    headline: "6° median error",
    line: "Against 95 weather-balloon ascents at 925 and 850 hPa from 8 stations, 3 to 10 October (NOAA IGRA2).",
  },
  {
    part: "Wind speed",
    headline: "20% slow",
    line: "The same balloons blew 0.7 m/s faster on average, so smoke may arrive a little sooner than drawn.",
  },
  {
    part: "Rain forecast",
    headline: "70% false alarms",
    line: "A day ahead, most hours forecast wet stayed dry at that spot, so rain is not trusted to clear haze.",
  },
  {
    part: "DOE's table",
    headline: "2025 bands confirmed",
    line: "This week's readings leave 101 to 150 almost empty, which only DOE's January 2025 table explains.",
  },
  {
    part: "Weather leak",
    headline: "Skill halves without it",
    line: "Replayed with the wind as forecast at the time, the smoke model's change lost to no change beyond a day, so stations do not use it.",
  },
  {
    part: "Fires",
    headline: "Vegetation only",
    line: "Hotspots on refineries, towns, mines or water are dropped, using NASA's labels and 10 m land cover; 99.5% of what burns is in Indonesia.",
  },
  {
    part: "Readings",
    headline: "100% present",
    line: "68 stations, every hour of the week. A run waits until 80% of stations have posted the hour.",
  },
];
