import { describe, expect, it } from "vitest";

import type { StoredDay } from "../../src/contracts";
import { byMonth, formatCoverage } from "../../src/jobs/coverage";

const EMPTY: StoredDay = { day: "2025-07-25", cells: 0, frpMw: 0, windHours: 0, airports: 0, hazeAirports: 0, monitors: 0, pm25: null };

describe("what is stored, month by month", () => {
  const days: StoredDay[] = [
    // 20 July 2025 as the history test stores it, and a day of the same month with only part of its wind.
    { ...EMPTY, day: "2025-07-20", airports: 3, hazeAirports: 2, monitors: 1, pm25: 41.3 },
    { ...EMPTY, day: "2025-07-21", cells: 12, frpMw: 340, windHours: 9, airports: 29 },
    { ...EMPTY, day: "2025-08-01", cells: 2, frpMw: 71, windHours: 24 },
  ];

  it("counts the days that have each kind of data, and a day of wind only when all 24 hours are there", () => {
    expect(byMonth(days)).toEqual([
      { month: "2025-07", days: 2, fireDays: 1, windDays: 0, airportDays: 2, airports: 29, airDays: 1, monitors: 1 },
      { month: "2025-08", days: 1, fireDays: 1, windDays: 1, airportDays: 0, airports: 0, airDays: 0, monitors: 0 },
    ]);
  });

  it("writes one line a month under a heading", () => {
    const lines = formatCoverage(byMonth(days)).split("\n");
    expect(lines).toHaveLength(4);
    expect(lines[1]).toMatch(/^2025-07\s+2\s+1\s+0\s+2\s+\(29\)\s+1\s+\(1\)$/);
  });
});
