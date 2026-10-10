"""
Packs where the ground is vegetation into src/haze/vegetation-data.ts, from ESA
WorldCover 2021 v200 (10 m, CC BY 4.0, https://esa-worldcover.org), so the fire
screen can tell a burning forest, plantation or peat swamp from heat on a
refinery, a town, a mine or the water.

    python3 -m venv .venv-geo && .venv-geo/bin/pip install rasterio numpy
    .venv-geo/bin/python scripts/pack-vegetation.py

It reads each 3 degree tile over the model's region from the public bucket at
the files' 1/8 overview (80 m pixels, 225 to each 0.01 degree cell; about 30
tiles, a few minutes), and marks a cell as vegetation where tree cover, shrub,
grass, cropland, herbaceous wetland, mangrove or moss make up at least half of
it. Built-up land, bare ground, water and cells with no data are not.

The output is one string per 0.01 degree row from the south, run lengths
alternating vegetation and not, starting with vegetation.
"""

import os
from pathlib import Path

import numpy as np
import rasterio
from rasterio.enums import Resampling

LON0, LAT0, LON1, LAT1, STEP = 96, -6, 120, 8, 0.01
NX, NY = round((LON1 - LON0) / STEP), round((LAT1 - LAT0) / STEP)
VEGETATION = (10, 20, 30, 40, 90, 95, 100)
SHARE = 0.5
TARGET = Path(__file__).resolve().parent.parent / "src" / "haze" / "vegetation-data.ts"
BUCKET = "https://esa-worldcover.s3.eu-central-1.amazonaws.com/v200/2021/map"

os.environ["GDAL_DISABLE_READDIR_ON_OPEN"] = "EMPTY_DIR"
green = np.zeros((NY, NX), dtype=np.uint16)
seen = np.zeros((NY, NX), dtype=np.uint16)
for lat in range(-6, LAT1 + 1, 3):
    for lon in range(96, LON1, 3):
        name = f"{'N' if lat >= 0 else 'S'}{abs(lat):02d}E{lon:03d}"
        try:
            with rasterio.open(f"/vsicurl/{BUCKET}/ESA_WorldCover_10m_2021_v200_{name}_Map.tif") as tile:
                classes = tile.read(1, out_shape=(tile.height // 8, tile.width // 8), resampling=Resampling.nearest)
        except rasterio.errors.RasterioIOError:
            print(name, "no tile: open sea")
            continue
        per = classes.shape[0] // 300
        # Rows run north to south in the file and south to north in the grid.
        fold = lambda mask: mask.reshape(300, per, 300, per).sum(axis=(1, 3))[::-1]
        row0, col0 = round((lat - LAT0) / STEP), round((lon - LON0) / STEP)
        rows = slice(max(0, row0), min(NY, row0 + 300))
        cols = slice(max(0, col0), min(NX, col0 + 300))
        inside = (slice(rows.start - row0, rows.stop - row0), slice(cols.start - col0, cols.stop - col0))
        green[rows, cols] += fold(np.isin(classes, VEGETATION))[inside].astype(np.uint16)
        seen[rows, cols] += fold(classes > 0)[inside].astype(np.uint16)
        print(name, "read")

vegetation = (seen > 0) & (green >= SHARE * seen)
lines = []
for row in vegetation:
    changes = np.flatnonzero(row[1:] != row[:-1]) + 1
    runs = np.diff(np.concatenate([[0], changes, [len(row)]])).tolist()
    # Runs start with vegetation, so a row that opens on sea or town starts with a zero.
    if not row[0]:
        runs = [0, *runs]
    lines.append(",".join(str(int(n)) for n in runs))

header = f'''/**
 * Where the ground is vegetation over the model's region: tree cover, shrub,
 * grass, cropland, herbaceous wetland, mangrove or moss on at least half of a
 * 0.01 degree cell. From ESA WorldCover 2021 v200 (10 m, CC BY 4.0,
 * https://esa-worldcover.org). Written by scripts/pack-vegetation.py; do not
 * edit by hand. One string per row from {LAT0} degrees north, {NX} cells from
 * {LON0} east: run lengths alternating vegetation and not, starting with
 * vegetation.
 */
'''
body = "export const VEGETATION_ROWS: readonly string[] = [\n" + "".join(f'  "{line}",\n' for line in lines) + "];\n"
TARGET.write_text(header + body)
print("wrote", TARGET, f"{vegetation.mean() * 100:.0f}% vegetation")
