import { readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Packs the share of each 0.1 degree cell that is peat into
 * src/sources/peat-data.ts, from PEATMAP (Xu, Morris, Liu and Holden 2018,
 * University of Leeds, CC BY 4.0, doi:10.5518/252), so the council can tell a
 * peat fire from one on mineral soil. The map has no depth.
 *
 * The polygons are in World Cylindrical Equal Area (ESRI:54034). With GDAL:
 *
 *   curl -O https://archive.researchdata.leeds.ac.uk/251/5/Asia.zip && unzip Asia.zip
 *   ogr2ogr -t_srs EPSG:4326 -dim XY sea4326.gpkg Asia/SEA_Peatland.shp
 *   gdal_rasterize -burn 1 -ot Byte -init 0 -a_nodata 255 -te 95 -8 120 8 -tr 0.002 0.002 sea4326.gpkg fine.tif
 *   gdalwarp -r average -tr 0.1 0.1 -ot Float32 fine.tif frac.tif
 *   gdal_translate -of XYZ frac.tif frac.xyz
 *   node scripts/pack-peat.mjs frac.xyz
 *
 * Keep `-a_nodata 255`: without it GDAL takes 0 as nodata and every cell
 * averages to 1. Cells under 1% peat are left out.
 */

const here = dirname(fileURLToPath(import.meta.url));
const TARGET = join(here, "../src/sources/peat-data.ts");

const file = process.argv[2];
if (!file) throw new Error("usage: node scripts/pack-peat.mjs <frac.xyz>");

const entries = [];
for (const line of (await readFile(file, "utf8")).split("\n")) {
  const [lon, lat, share] = line.trim().split(/\s+/).map(Number);
  if (!Number.isFinite(share) || share < 0.01 || share > 1) continue;
  // XYZ gives cell centres; the model names a cell by its south-west corner in tenths of a degree.
  entries.push([Math.round(lat * 10 - 0.5), Math.round(lon * 10 - 0.5), Math.round(share * 100)]);
}
entries.sort((a, b) => a[0] - b[0] || a[1] - b[1]);

const body = `/**
 * Percent of each 0.1 degree cell that is peat, from PEATMAP (Xu, Morris, Liu
 * and Holden 2018, Catena 160:134-140, doi:10.1016/j.catena.2017.09.010;
 * dataset doi:10.5518/252, CC BY 4.0), resampled to 0.1 degree peat fraction
 * by scripts/pack-peat.mjs. Its Indonesian part is the Ministry of
 * Agriculture's map (Ritung et al. 2011), its Malaysian part Wetlands
 * International (2010). Do not edit by hand. Each entry: lat10, lon10 of the
 * cell's south-west corner, percent peat. Cells under 1% are absent.
 */
export const PEAT_CELLS: readonly (readonly [number, number, number])[] = ${JSON.stringify(entries)};
`;
await writeFile(TARGET, body);
console.log(`${entries.length} peat cells written to ${TARGET}`);
