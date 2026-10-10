import { describe, expect, it } from "vitest";

import { peatShare } from "../../src/sources/peat";
import { placeOf } from "../../src/sources/place-namer";

describe("naming a fire complex", () => {
  it("names the Jambi peat belt and says it needs Sumatra consent", () => {
    expect(placeOf(-1.82, 103.92)).toEqual({ name: "near Muaro Jambi", province: "Jambi", country: "Indonesia", area: "sumatra" });
  });

  it("puts the West Kalimantan border in Kalimantan, where the package is accepted", () => {
    expect(placeOf(-2.85, 110.75)).toMatchObject({ province: "West Kalimantan", country: "Indonesia", area: "kalimantan" });
  });

  it("keeps Johor and Sarawak on Malaysian soil", () => {
    expect(placeOf(1.65, 103.0)).toMatchObject({ province: "Johor", country: "Malaysia", area: "peninsula" });
    expect(placeOf(2.3, 111.8)).toMatchObject({ province: "Sarawak", country: "Malaysia", area: "malaysian_borneo" });
  });
});

describe("the peat map", () => {
  it("shows deep peat in Muaro Jambi and none under the Johor fires", () => {
    expect(peatShare(-19, 1039)).toBe(1);
    expect(peatShare(16, 1029)).toBe(0);
  });
});
