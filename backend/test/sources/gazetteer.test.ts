import { describe, expect, it } from "vitest";

import { matchTier, normalise, searchGazetteer } from "../../src/sources/gazetteer";

describe("searching the gazetteer", () => {
  it("ignores case, accents and punctuation", () => {
    expect(normalise("  Kota-Kinabalu ")).toBe("kota kinabalu");
    expect(normalise("Ságu")).toBe("sagu");
  });

  it("ranks a whole name over a start, a word start and a middle", () => {
    expect(matchTier("petaling", "petaling")).toBe(4);
    expect(matchTier("petaling jaya", "petaling")).toBe(3);
    expect(matchTier("taman petaling", "petaling")).toBe(2);
    expect(matchTier("sripetaling", "petaling")).toBe(1);
    expect(matchTier("klang", "petaling")).toBe(0);
  });

  it("finds towns and districts people type, as fast as they type", () => {
    const started = performance.now();
    const shah = searchGazetteer("shah alam", 5);
    expect(performance.now() - started).toBeLessThan(50);
    expect(shah[0]).toMatchObject({ name: "Shah Alam", kind: "town", region: "Selangor", country: "Malaysia" });
    expect(searchGazetteer("hulu langat", 5).map((place) => place.kind)).toEqual(expect.arrayContaining(["town", "district"]));
  });

  it("puts the bigger place first among equal matches", () => {
    const petaling = searchGazetteer("petaling j", 3);
    expect(petaling[0].name).toBe("Petaling Jaya");
  });

  it("reaches eastern Sabah", () => {
    expect(searchGazetteer("semporna", 3)[0]).toMatchObject({ name: "Semporna", region: "Sabah" });
  });

  it("says nothing for one letter", () => {
    expect(searchGazetteer("k", 5)).toEqual([]);
  });
});
