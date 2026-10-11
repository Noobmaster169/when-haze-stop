import { readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Packs the towns and districts of Malaysia, Singapore and Brunei from
 * GeoNames (CC BY 4.0, geonames.org) into src/sources/gazetteer-data.ts, so a
 * place search answers from memory instead of waiting on a geocoder.
 *
 *   curl -O https://download.geonames.org/export/dump/MY.zip   (and SG, BN)
 *   unzip MY.zip MY.txt ...
 *   node scripts/pack-gazetteer.mjs <folder with MY.txt SG.txt BN.txt>
 *
 * Kept: states, districts and sub-districts, and towns with a population or
 * an administrative role. Villages without a population are left to the
 * geocoder, which knows them.
 */

const here = dirname(fileURLToPath(import.meta.url));
const TARGET = join(here, "../src/sources/gazetteer-data.ts");
const COUNTRIES = { MY: "Malaysia", SG: "Singapore", BN: "Brunei" };
const TOWN_CODES = new Set(["PPLC", "PPLA", "PPLA2", "PPLA3", "PPLA4", "PPLG", "PPLX"]);
const KIND = { ADM1: "state", ADM2: "district", ADM3: "district" };

const folder = process.argv[2];
if (!folder) throw new Error("usage: node scripts/pack-gazetteer.mjs <folder with MY.txt SG.txt BN.txt>");

const entries = [];
for (const [code, country] of Object.entries(COUNTRIES)) {
  const rows = (await readFile(join(folder, `${code}.txt`), "utf8")).split("\n").filter(Boolean).map((line) => line.split("\t"));
  const states = new Map(rows.filter((row) => row[7] === "ADM1").map((row) => [row[10], row[1]]));
  for (const row of rows) {
    const [, name, , , lat, lon, featureClass, featureCode, , , admin1, , , , population] = row;
    const people = Number(population) || 0;
    const kind = KIND[featureCode] ?? (featureClass === "P" && (people > 0 || TOWN_CODES.has(featureCode)) ? "town" : null);
    if (!kind) continue;
    // "Daerah Batu Pahat" is the district of Batu Pahat; the word is the kind, not the name.
    const plain = name.replace(/^(Daerah|Mukim|Bahagian)\s+/i, "").replace(/\s+District$/i, "");
    const region = kind === "state" ? "" : (states.get(admin1) ?? "");
    entries.push([plain, kind, region, country, Math.round(Number(lat) * 1e4), Math.round(Number(lon) * 1e4), people]);
  }
}
entries.sort((a, b) => b[6] - a[6] || a[0].localeCompare(b[0]));

const body = `/**
 * Towns, districts and states of Malaysia, Singapore and Brunei from GeoNames
 * (CC BY 4.0, https://www.geonames.org), packed by scripts/pack-gazetteer.mjs.
 * Do not edit by hand. Each entry: name, kind, state, country, latitude and
 * longitude in ten-thousandths of a degree, population (0 where not known).
 */
export type GazetteerKind = "state" | "district" | "town";
export type GazetteerEntry = readonly [string, GazetteerKind, string, string, number, number, number];
export const GAZETTEER: readonly GazetteerEntry[] = ${JSON.stringify(entries)};
`;
await writeFile(TARGET, body);
console.log(`wrote ${entries.length} places to ${TARGET}`);
