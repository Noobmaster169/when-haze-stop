# Peatland data for Sumatra, Kalimantan, Peninsular Malaysia and Sarawak

Checked 2026-10-10. "Verified" means I fetched the URL or its headers today. The web search budget
ran out partway through, so some candidates could only be checked by known URLs. Those are marked.

## Summary table

| Dataset | Covers our region | Depth | Format / res | Licence | Download works today |
|---|---|---|---|---|---|
| PEATMAP (Xu et al. 2018), Asia.zip | Yes, incl. Sarawak, Sabah, Brunei | No | Shapefile, vector | CC BY 4.0 | Yes, 27.1 MB, no login |
| Global Peatland Map 2.0 (GMC 2022) | Yes | No (2 classes: peat dominated / peat in soil mosaic) | GeoTIFF, ~1 km (0.00998 deg) | CC BY-NC-SA 4.0 | Yes, 3.65 MB, no login |
| GFW "Indonesia peat lands" (MoA/BBSDLP 2011) | Indonesia only | No (attribute is just "gambut") | ArcGIS MapServer, vector | Not stated on item | Yes, query/GeoJSON, no key |
| GFW "Malaysia peat lands" (Wetlands Intl 2010) | Pen. Malaysia, Sarawak, Sabah | No | ArcGIS MapServer, vector | Not stated on item | Yes, query/GeoJSON, no key |
| GFW `gfw_peatlands` composite (Data API) | Yes (Miettinen 2016 + Gumbricht 2017) | No | GeoTIFF tiles, ~30 m | CC BY 4.0 | Raw tiles need API key or AWS requester-pays; PNG tile cache is public |
| CIFOR SWAMP (Gumbricht et al. 2017) | Yes (tropics) | Not in the peat layer | GeoTIFF, 231 m | CC BY 4.0 (per GFW metadata) | data.cifor.org unreachable from here (TLS reset) |
| Miettinen et al. 2016 (CRISP) | Yes | No (land cover on peat) | unknown | unknown | CRISP site blocked by Incapsula; not verified |
| Wetlands International 2003/2004 Sumatra/Kalimantan atlases | Sumatra, Kalimantan | Yes (depth classes) | PDF atlases; digital data on request | not open | No open download found |
| BBSDLP 2011 / 2019 official Indonesian peat map | Indonesia | Yes in original (depth classes) | not openly published | Govt, no open licence | No open download found |
| KHG (Kesatuan Hidrologis Gambut, SK.129/2017 and later) | Indonesia | No (hydrological units) | KLHK geoportal | Govt, no open licence | *.menlhk.go.id unreachable from here; not on GFW |
| Hastie et al. 2022 | **Peru only** (lowland Amazon) | Yes (Peru) | raster | - | Irrelevant for SE Asia |

## 1. PEATMAP (recommended)

- Landing page: https://archive.researchdata.leeds.ac.uk/251/ (DOI 10.5518/252). Verified.
- File: https://archive.researchdata.leeds.ac.uk/251/5/Asia.zip
  - HTTP 200, `Content-Length: 27063149` (27.1 MB), `application/zip`, Last-Modified 2017-09-19.
  - Other files: readme.txt (610 B), PEATMAP_data_sources.pdf (295 kB), other continents.
- Licence: CC BY 4.0 (repository record and readme). Derived grid may be redistributed, including
  commercially, with attribution and an indication of changes. Required citations (from readme):
  - Xu J., Morris P.J., Liu J., Holden J. (2018) PEATMAP: Refining estimates of global peatland
    distribution based on a meta-analysis. Catena 160: 134-140. https://doi.org/10.1016/j.catena.2017.09.010
  - Xu J., Morris P.J., Liu J., Holden J. (2017) PEATMAP ... University of Leeds [Dataset].
    https://doi.org/10.5518/252
- Inspected (downloaded to scratchpad/peat-download/peatmap-asia/):
  - The relevant layer is `Asia/SEA_Peatland.shp` (56 MB unzipped, a single 3D MultiPolygon
    feature, fields `Id`, `AREA`). CRS is World Cylindrical Equal Area (ESRI:54034), not WGS84,
    despite the readme. Extent ~77E to 143.6E.
  - Sources for this region (from PEATMAP_data_sources.pdf): Indonesia = Ministry of Agriculture
    peatland map 1:250,000 (Ritung et al. 2011, BBSDLP), which itself merges the Wetlands
    International 2003/2004/2006 maps; Malaysia = Wetlands International (2010) "Malaysia Peat
    Lands" (Landsat 2009 over DOA 2002 land use, 1:50,000). So it is the same content GFW serves
    as "Indonesia peat lands" + "Malaysia peat lands", in one file, under an explicit CC BY licence.
  - No depth or maturity attribute: it is presence/absence only.
- 0.1 deg test (95-120E, -7..9N): 2,871 cells with peat > 0, 1,031 cells >= 0.5. Peat area by
  box: Borneo ~64,800 km2 (Kalimantan official ~47,800 km2 + Sarawak ~16,970 km2: consistent);
  Sarawak box ~15,800 km2; east Sumatra ~48,000 km2. Spot checks: Riau 103.25E 0.65N = 0.77,
  Central Kalimantan 113.95E -2.45S = 1.0, Mukah (Sarawak) = 0.33, Kuala Langat = 0.25, KL = 0.

## 2. Global Peatland Map 2.0 (Greifswald Mire Centre, UNEP Global Peatlands Assessment 2022)

- Landing: https://www.greifswaldmoor.de/global-peatland-database-en.html ("freely downloadable in
  a 1 km x 1 km grid"). Viewer: https://maps.work/gpd/
- File: Nextcloud share https://nextcloud.uni-greifswald.de/index.php/s/s7Ln5QKxdQG5aaA
  (direct: `https://nextcloud.uni-greifswald.de/public.php/dav/files/s7Ln5QKxdQG5aaA/`),
  GPM2022_GMC.zip, 3,652,907 bytes, Last-Modified 2024-06-06. Verified and downloaded.
- Contents: `GLOpeat_GPA22WGS_2cl_1x1km.zip` -> `peatGPA22WGS_2cl.tif` (Byte, LZW, 36017 x 15295,
  pixel 0.009981 deg, EPSG:4326, nodata 255; values 1 = peat dominated, 2 = peat in soil mosaic).
- Licence file in the zip: **CC BY-NC-SA 4.0**. Non-commercial only, and a derived grid must be
  shared under the same licence. Citation: Greifswald Mire Centre (2022) Global Peatland Map 2.0.
- 0.1 deg comparison against PEATMAP in the same boxes: GPM 2.0 shows about 2x the area
  (Borneo box ~145,000 km2 "peat dominated" vs PEATMAP ~65,000; Sarawak box 27,300 vs 15,800).
  The 1 km grid inflates fringes. Point checks agree on where peat is (Riau 0.87, C. Kalimantan 1.0,
  KL 0). Useful as a cross-check, weaker licence and coarser than PEATMAP.

## 3. Global Forest Watch

### Data API (data-api.globalforestwatch.org)
- `GET /datasets` lists three peat datasets: `gfw_peatlands` (v20200807, v20230302, v20230315
  latest), `cifor_peatlands` (v2), `gfwpro_peatlands` (v2019). Metadata is readable without a key.
- `gfw_peatlands` metadata: "Global peatland extent", CC BY 4.0, ~30 m; for Indonesia/Malaysia
  it is Miettinen et al. 2016 unioned with Gumbricht et al. 2017. Presence only (`is` pixel meaning).
- Download and query need a key: `/download/geotiff?...` and `/query/json?...` return 403
  "Request is missing valid API key". Keys are free but need a GFW account.
- Raw tiles `s3://gfw-data-lake/gfw_peatlands/v20230315/raster/epsg-4326/10/40000/is/geotiff/{tile_id}.tif`
  are in a requester-pays bucket (anonymous 403).
- Public without key: PNG tile cache
  `https://tiles.globalforestwatch.org/gfw_peatlands/v20230315/default/{z}/{x}/{y}.png` (200 OK).
  Decoding rendered tiles is possible but a hack; not recommended.

### ArcGIS services (no key)
- Indonesia: https://gis-gfw.wri.org/arcgis/rest/services/country_data/asia/MapServer/10
  1,524 polygons, extent 95.4E-141.0E, -8.3..4.9N, field `layer_revi` almost entirely "gambut"
  (~14.4 Mha). No depth. GeoJSON export works (`/query?where=1=1&outSR=4326&f=geojson`,
  1000 records per page; first page ~12 MB with maxAllowableOffset=0.001).
- Malaysia: .../MapServer/9, 482 polygons, extent 100.6E-118.7E, 1.0..7.3N, attribute "gambut".
- Hub items (data.globalforestwatch.org) d52e0e67ad21401cbf3a2c002599cf58 and
  8d8462fca7b74b298598490b85d3bd44 carry **no licence field**. Same content as PEATMAP SEA, so take
  it from PEATMAP where the CC BY licence is explicit.
- No KHG layer anywhere on GFW (searched Data API and the asia MapServer).

## 4. CIFOR SWAMP tropical peatland map (Gumbricht et al. 2017)
- DOI https://doi.org/10.17528/CIFOR/DATA.00058 redirects to data.cifor.org, which reset the TLS
  connection from this machine with curl, Python and WebFetch. Not verified today.
- From the GFW mirror metadata: 231 m, tropics and subtropics, CC BY 4.0, peat = 30 cm+ organic
  layer, includes mangroves as peat (overestimates in coastal areas). No depth in the peat layer.
- Available through GFW as `cifor_peatlands/v2` (API key required).

## 5. Not openly downloadable (as far as checked)
- Miettinen et al. 2016 (Global Ecology and Conservation 6: 67-78, peatland land cover 1990-2015):
  CRISP page https://crisp.nus.edu.sg/~research/peatland/ returns an Incapsula block. Their peat
  extent is itself built on the MoA and Wetlands International maps. GFW's composite contains it.
- Wetlands International Sumatra (2003) and Kalimantan (2004) maps with depth classes: published
  as atlases; digital data were distributed on request. No open URL found (search budget ran out).
- BBSDLP 2011 (1:250k) and 2019 (1:50k, Anda et al. 2021): official maps with depth classes; only
  the 2011 extent is public (via GFW/PEATMAP), without depth.
- KHG (peat hydrological units, KLHK SK.129/2017, ~865 units, ~24.7 Mha): served on KLHK portals
  (geoportal/sigap.menlhk.go.id), which did not resolve or connect from here. No open licence known.
- Hastie et al. 2022: Peru only.

## Depth
No openly licensed, downloadable depth map covering both Indonesia and Malaysia was found. Depth
classes exist only in the Indonesian government and Wetlands International maps, which are not
openly published. For a coarse app, ship presence fraction only, or treat depth as unknown.

## Recipe used (verified with GDAL 3.13.3)

```bash
unzip Asia.zip 'Asia/SEA_Peatland.*'
ogr2ogr -t_srs EPSG:4326 -dim XY sea4326.gpkg Asia/SEA_Peatland.shp
gdal_rasterize -burn 1 -ot Byte -init 0 -a_nodata 255 \
  -te 95 -7 120 8 -tr 0.002 0.002 -co COMPRESS=DEFLATE sea4326.gpkg fine.tif
gdalwarp -r average -tr 0.1 0.1 -ot Float32 fine.tif peat_frac_0p1.tif
gdal_translate -of XYZ peat_frac_0p1.tif peat_frac_0p1.xyz   # lon lat fraction, cell centres
```

The 0.002 deg pass gives 2,500 subcells per 0.1 deg cell, so the fraction is precise to 0.0004.
Without `-a_nodata 255` GDAL 3.13 marks 0 as nodata and the average comes out 1 everywhere.
