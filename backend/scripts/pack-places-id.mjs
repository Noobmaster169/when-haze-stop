import { readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Packs the provinces, regencies and towns of Indonesia inside the model's
 * region from GeoNames (CC BY 4.0, geonames.org) into
 * src/sources/places-id-data.ts, so a fire complex in Sumatra or Kalimantan
 * can be named "near Pulang Pisau, Central Kalimantan".
 *
 *   curl -O https://download.geonames.org/export/dump/ID.zip
 *   unzip ID.zip ID.txt
 *   node scripts/pack-places-id.mjs <folder with ID.txt>
 *
 * Kept: regencies and cities (ADM2) and towns of 5,000 people or more, within
 * 96 to 120 E and 6 S to 8 N. Province names are given in English.
 */

const here = dirname(fileURLToPath(import.meta.url));
const TARGET = join(here, "../src/sources/places-id-data.ts");
const DOMAIN = { lon0: 96, lat0: -6, lon1: 120, lat1: 8 };
const MIN_TOWN = 5000;

/** GeoNames admin1 codes for Indonesia, in English. Only provinces inside the region are needed. */
const PROVINCES = {
  "01": "Aceh",
  "02": "Bali",
  "03": "Bengkulu",
  "04": "Jakarta",
  "05": "Jambi",
  "07": "Central Java",
  "08": "East Java",
  "10": "Yogyakarta",
  "11": "West Kalimantan",
  "12": "South Kalimantan",
  "13": "Central Kalimantan",
  "14": "East Kalimantan",
  "15": "Lampung",
  "17": "West Nusa Tenggara",
  "18": "East Nusa Tenggara",
  "21": "Central Sulawesi",
  "22": "South East Sulawesi",
  "24": "West Sumatra",
  "26": "North Sumatra",
  "28": "Maluku",
  "29": "North Maluku",
  "30": "West Java",
  "31": "North Sulawesi",
  "32": "South Sumatra",
  "33": "Banten",
  "34": "Gorontalo",
  "35": "Bangka Belitung",
  "37": "Riau",
  "38": "South Sulawesi",
  "39": "West Papua",
  "40": "Riau Islands",
  "41": "West Sulawesi",
  "42": "North Kalimantan",
};

const folder = process.argv[2];
if (!folder) throw new Error("usage: node scripts/pack-places-id.mjs <folder with ID.txt>");

const rows = (await readFile(join(folder, "ID.txt"), "utf8")).split("\n").filter(Boolean).map((line) => line.split("\t"));
const unknown = new Set();
const entries = [];
for (const row of rows) {
  const [, name, , , lat, lon, featureClass, featureCode, , , admin1, , , , population] = row;
  const y = Number(lat);
  const x = Number(lon);
  if (x < DOMAIN.lon0 || x >= DOMAIN.lon1 || y < DOMAIN.lat0 || y >= DOMAIN.lat1) continue;
  const people = Number(population) || 0;
  const kind = featureCode === "ADM2" ? "regency" : featureClass === "P" && people >= MIN_TOWN ? "town" : null;
  if (!kind) continue;
  const province = PROVINCES[admin1];
  if (!province) {
    unknown.add(admin1);
    continue;
  }
  // "Kabupaten Pulang Pisau" is the regency of Pulang Pisau; the word is the kind, not the name.
  const plain = name.replace(/^(Kabupaten|Kota)\s+/i, "").replace(/\s+(Regency|City)$/i, "");
  entries.push([plain, kind, province, Math.round(y * 1e4), Math.round(x * 1e4), people]);
}
entries.sort((a, b) => b[5] - a[5] || a[0].localeCompare(b[0]));
if (unknown.size > 0) console.warn(`admin1 codes with no English name, left out: ${[...unknown].join(", ")}`);

const body = `/**
 * Regencies and towns of Indonesia inside the model's region from GeoNames
 * (CC BY 4.0, https://www.geonames.org), packed by scripts/pack-places-id.mjs.
 * Do not edit by hand. Each entry: name, kind, province, latitude and longitude
 * in ten-thousandths of a degree, population (0 where not known).
 */
export type IndonesianPlaceKind = "regency" | "town";
export type IndonesianPlaceEntry = readonly [string, IndonesianPlaceKind, string, number, number, number];
export const INDONESIAN_PLACES: readonly IndonesianPlaceEntry[] = ${JSON.stringify(entries)};
`;
await writeFile(TARGET, body);
console.log(`${entries.length} places written to ${TARGET}`);
