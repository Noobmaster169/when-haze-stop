# Are the live fire spots plausible? Measured 10 October 2026

Saved from a read-only evaluation run on 10 October 2026; the scripts and downloads it names were in a scratch directory and are not in the repo. The numbers are what the database and the live FIRMS files held that day.

Read-only evaluation of the screened fires (`fire_cells.burning_mw`) against the raw NASA FIRMS
feed. Database `postgres`, 197,390 cell-days from 2025-01-01 to 2026-10-10, every row screened
(`burning_mw` never null). Fixed-source list: 373 sites marked on 3 or more days (2024-07-01 to
2026-06-30). Scripts in `scripts/`, raw CSVs and the two DB exports in `downloads/`.

## Headline

- The screened count is plausible for October in a burning year. In the first ten days of October
  2026 the region burned 816 cell-days and 56,000 MW a day, against 117 and 3,200 in the same days
  of 2025 (7x and 17x). 98.7% of the last 7 days' fire power sits in Kalimantan and Sumatra;
  Malaysia, Singapore and Thailand hold 0.3%. No cluster near Kuala Lumpur, Medan, Kuching, Kota
  Kinabalu or Pontianak. The clusters near Banjarmasin and Palembang are their peat hinterlands,
  50 to 580 MW, not city heat.
- The fixed-source screen leaks little: of June 2026's 1,766 burning cell-days, 86 (4.9%) share a
  0.1 degree cell with a labelled site, 1.9% of the month's fire power; 38 cell-days (2.2%) burned
  on a day NASA labelled that very cell non-fire.
- Chronic cells exist but are mostly real: 71 cells burned on 60+ of the last 365 days. 61 burned
  only in the dry seasons (Central and South Kalimantan peat, South Sumatra, the East Kalimantan
  coal belt); 10 burned through the wet season (flare-like, none on the labelled list). Those 10
  contributed 49 cell-days and 0.15% of the fire power of the last 14 days.
- What makes the map look suspicious is the drawing, not the screening. `draw.ts` sizes a dot as
  `max(1.5, min(5, sqrt(frp)/9))`, so every cell under 182 MW is the same 1.5 px dot. On the
  current map 1,030 of 1,119 dots (92%) are that minimum size: a 2 MW cell looks exactly like a
  150 MW cell. 521 drawn cells (47%) are under 20 MW and together carry 6.1% of the drawn power.

## 1. Persistence over the last 365 days (2025-10-11 to 2026-10-10)

Days with `burning_mw > 0` per 0.1 degree cell, 9,013 cells stored at all:

| burn days | cells | cell-days | % of cell-days | % of burning_mw |
| --- | --- | --- | --- | --- |
| 0 (everything screened) | 1,584 | 0 | 0 | 0 |
| 1 | 1,407 | 1,407 | 1.7 | 0.6 |
| 2-3 | 1,416 | 3,426 | 4.1 | 1.7 |
| 4-7 | 1,424 | 7,424 | 9.0 | 4.4 |
| 8-14 | 1,247 | 13,334 | 16.1 | 10.1 |
| 15-29 | 1,187 | 24,666 | 29.9 | 28.3 |
| 30-59 | 677 | 27,325 | 33.1 | 46.0 |
| 60-119 | 69 | 4,759 | 5.8 | 8.8 |
| 120+ | 2 | 286 | 0.3 | 0.1 |

Cells burning on 60+ days: 71 (full list in the appendix). By area and season:

| group | cells | burn days Nov-May (wet) | burn days Jun-Oct (dry) | last 14 d cell-days | last 14 d MW |
| --- | --- | --- | --- | --- | --- |
| Central/South Kalimantan + Sulawesi | 44 | 253 | 2,765 | 335 | 18,562 |
| East Kalimantan lon 117 belt (Kutai Timur, Berau coal mines) | 14 | 195 | 826 | 80 | 2,593 |
| Sumatra (South Sumatra, Bangka, Jambi) | 13 | 159 | 771 | 100 | 5,021 |

Month profile of the 71 cells together: 16 burn days in December, 59 in February, 175 in June,
then 592 (Jul), 1,706 (Aug), 1,503 (Sep). They are chronic because the dry season was long, not
because they are hot every day. Mean power of the 71: 39 cells over 50 MW, 27 at 15 to 50 MW,
only 5 under 15 MW.

Cells that burned on 20 or more days of the wet season (November to May) are the flare-like
ones, and none is on the fixed-source list:

| lat | lon | burn days | wet days | mean MW | last 14 d | likely |
| --- | --- | --- | --- | --- | --- | --- |
| -3.65 | 103.65 | 150 | 46 | 10.1 | 10 cell-days, 53 MW | Prabumulih/Limau oil and gas field, South Sumatra (flare) |
| -0.15 | 109.35 | 77 | 42 | 79.8 | 0 | Sungai Raya, south of Pontianak |
| -3.75 | 115.45 | 81 | 41 | 5.0 | 9, 101 MW | Jorong/Asam-Asam, South Kalimantan (coal, power plant) |
| 2.75 | 101.55 | 66 | 39 | 23.9 | 0 | Banting/Jenjarom, Selangor (landfill or industrial) |
| 1.95 | 117.25 | 75 | 26 | 55.2 | 0 | Berau/Segah coal, East Kalimantan |
| -3.05 | 115.15 | 136 | 26 | 31.5 | 11, 167 MW | Tapin/Banjar, South Kalimantan; leaks in June too |
| 1.05 | 117.15 | 94 | 24 | 40.2 | 9, 237 MW | Muara Wahau/Kongbeng coal, East Kalimantan |
| -2.25 | 101.05 | 61 | 23 | 34.0 | 0 | Jambi west |
| 0.75 | 117.05 | 95 | 22 | 42.4 | 7, 411 MW | Kutai Timur coal |
| 0.55 | 117.25 | 75 | 21 | 26.2 | 3, 52 MW | Kutai Timur coal |

Other year-round cells with 30+ wet-season days but under 60 total: 0.35 to 0.55 N, 108.95 to
109.15 E (four cells, Mempawah alumina refinery, West Kalimantan), 1.85 N 101.65 E (Dumai
industrial estate), 1.85 N 104.05 E (Johor). All zero in the last 14 days.

Share of the last 14 days (2026-09-27 to 10-10, 10,982 burning cell-days, 696,479 MW):

| chronic definition | cell-days | % | MW | % |
| --- | --- | --- | --- | --- |
| 60+ days of 365 | 515 | 4.7 | 26,176 | 3.8 |
| 30+ days of 365 | 4,338 | 39.5 | 337,800 | 48.5 |
| 20+ wet-season days (year-round) | 49 | 0.4 | 1,019 | 0.15 |
| 10+ wet-season days | 196 | 1.8 | 4,538 | 0.65 |

A 30-day threshold would take half the fire power of a burning season. The year-round rule is
the only one that isolates fixed heat, and it finds very little.

## 2. Geography of the last 7 days (2026-10-04 to 10-10)

Boxes, applied in this order: Singapore lat 1.15-1.48, lon 103.6-104.1. Thailand/Myanmar lat >=
6.5, lon < 103. Peninsular Malaysia lat 1.2-6.5, lon <= 104.6 and east of the Malacca Strait axis
lon > 103 - (lat - 1). West South China Sea / Natuna lat 1.2-6.5, lon 104.6-108.5. Sumatra and
islands lat <= 6.5, lon 96-108.5 and west of the axis. Borneo lon 108.5-119.6: Sabah lon >= 115.5
and lat >= 4; Sarawak/Brunei lon < 115.5 and lat > 1 + 0.63 (lon - 109.6); Kalimantan the rest down
to lat -4.5. Sulawesi lon >= 119.6.

| region | cell-days | cells | burning MW | % MW |
| --- | --- | --- | --- | --- |
| Kalimantan | 3,522 | 1,270 | 245,801 | 63.4 |
| Sumatra + islands | 1,657 | 666 | 136,960 | 35.3 |
| Sulawesi / east of Borneo | 158 | 79 | 3,369 | 0.9 |
| Peninsular Malaysia | 34 | 28 | 961 | 0.2 |
| Sabah | 25 | 23 | 450 | 0.1 |
| Sarawak/Brunei | 8 | 7 | 176 | 0.0 |
| other (unclassified) | 6 | 6 | 68 | 0.0 |
| Singapore box | 2 | 2 | 27 | 0.0 |
| sea: W South China Sea / Natuna | 1 | 1 | 18 | 0.0 |
| Thailand/Myanmar, Gulf of Thailand | 0 | 0 | 0 | 0 |

Within 0.3 degree of the named cities:

| city | cell-days | cells | MW | max MW | reading |
| --- | --- | --- | --- | --- | --- |
| Banjarmasin (-3.32, 114.59) | 105 | 27 | 4,527 | 293 | Banjarbaru / Gambut peat east and south of the city, 6-7 of 7 days at 50-290 MW; real and notorious |
| Palembang (-2.99, 104.76) | 62 | 25 | 2,725 | 577 | Ogan Ilir / Banyuasin peat south and east; real |
| Balikpapan (-1.27, 116.83) | 5 | 4 | 169 | 109 | one cell (-1.05, 117.05, Samboja) 37 days of 365 |
| Singapore (1.35, 103.82) | 4 | 4 | 263 | 235 | Tanjung Piai, Johor (235 MW, one day) and Batam; nothing on the island |
| Johor Bahru (1.49, 103.74) | 2 | 2 | 258 | 235 | same Tanjung Piai cells |
| Pekanbaru (0.51, 101.45) | 1 | 1 | 2 | 2 | one 2 MW cell |
| Kuala Lumpur, Medan, Kuching, Kota Kinabalu, Pontianak | 0 | 0 | 0 | 0 | |

No urban heat cluster. The two city clusters are peatland that burns every dry year.

## 3. The raw live feed (three 7-day CSVs, fetched 2026-10-10 23:02 local)

300,488 rows for South East Asia, 123,081 inside the domain, days 2026-10-03 to 10-10.

- Confidence: nominal 88.9%, high 5.8%, low 5.3%. The parser drops any row whose confidence
  starts with "l" and keeps the rest, so it keeps nominal and high as the docs say (116,547 rows,
  94.7%). Low-confidence rows are all daytime and have a higher median FRP (7.1 MW) than nominal
  (3.5 MW): sun glint and hot surfaces, as NASA intends.
- Day/night after the parser: day 38.8%, night 61.2%.
- FRP of kept detections: median 3.7 MW, p75 7.8, p90 15.2, p99 53, mean 7.1, total 824,058 MW
  over 8 days. Day detections: median 7.9, p90 24. Night: median 2.2, p90 7.3.
- Night detections under 5 MW: 58,890, which is 82.6% of night detections and 50.5% of all kept
  detections. Under 2 MW: 43.9% of night detections.
- 6.2% of kept pixels are saturated (bright_ti4 >= 367 K).
- Detections per burning cell-day: median 6, mean 17. Passes per burning cell-day: 1 pass 944
  (15%), 2 passes 2,204, 3 or more 3,080.

The night-under-5-MW share is high but it is not a non-fire signature here. VIIRS at night is
more sensitive and sees the smouldering edge of a peat fire as many 1 to 3 MW pixels; those
pixels sit in cells that also burn by day. The confirmation screen already handles the lone
ones: of 2,567 stored cell-days whose detections were all at night, it dropped 1,276 (49.7%).
What survives as night-only is 1,291 cell-days (20.7% of the 6,228 burning cell-days of Oct 3 to
10) carrying 5.3% of the power, and 534 of those cells were night-only on one day only.

Raw detections per day against the screened table:

| day | raw in domain | kept by parser | raw 0.1 cell-days | stored (after glint and sea) | burning cell-days | kept % |
| --- | --- | --- | --- | --- | --- | --- |
| 10-03 | 14,462 | 13,233 | 1,300 | 1,223 | 815 | 66.6 |
| 10-04 | 17,361 | 16,731 | 1,402 | 1,385 | 940 | 67.9 |
| 10-05 | 19,168 | 18,282 | 1,324 | 1,316 | 919 | 69.8 |
| 10-06 | 16,272 | 15,731 | 1,282 | 1,266 | 814 | 64.3 |
| 10-07 | 21,756 | 20,810 | 1,522 | 1,489 | 1,022 | 68.6 |
| 10-08 | 18,676 | 17,707 | 1,211 | 1,203 | 829 | 68.9 |
| 10-09 | 12,223 | 11,187 | 1,022 | 939 | 557 | 59.3 |
| 10-10 | 3,163 | 2,866 | 570 | 564 | 332 | 58.9 (partial day) |

About 16 to 20 kept detections become one burning cell-day. The screens remove a third of
cell-days every day at a steady ratio, which is what a rule on noise should do.

## 4. Leak rate of the fixed-source screen, June 2026

June is the last month the labelled archive covers. 5,336 stored cell-days, 1,766 burning
(30,143 MW); 726 cell-days on a site cell were screened to zero.

| measure | cell-days | % of burning | % of MW |
| --- | --- | --- | --- |
| burning cell shares a 0.1 degree cell with a site (3+ labelled days) | 86 | 4.9 | 1.9 |
| burning cell is that cell or one of its 8 neighbours (within 0.1 degree) | 183 | 10.4 | 6.5 |
| burning on a day NASA labelled the same 0.1 cell non-fire (direct leak) | 38 | 2.2 | 1.3 (377 MW) |

The direct leak: 30 of 462 labelled "static" cell-days (6.5%) and 8 of 293 "offshore" (2.7%)
still burned. 24 of the 38 are three cells: -3.05 115.15 (11 days, 13.7 MW mean), -2.95 115.25
(7 days, 2.5 MW) and -1.85 115.85 (6 days, 2.0 MW), all South Kalimantan coal country, where the
heat moves between 0.01 degree cells more than the 3x3 mask allows. The rest are single days at
1 to 41 MW. The exact-cell screen catches 93 to 97% of what NASA itself labels; the remainder is
a few MW a day.

## 5. What the map draws

- `services/map.ts` calls `fires.strongest(db, asOf - 2 days, 1500)`, which reads
  `max(coalesce(burning_mw, frp_mw))` per cell with that value > 0, descending, limit 1500,
  open-ended to the future. With asOf 2026-10-10 14:00 UTC the from-day is 2026-10-08, so the map
  holds UTC days 8, 9 and 10: three calendar days, not two. The history strip uses the same
  function one day at a time.
- Right now 1,119 cells qualify, so the 1500 cap is not binding and every screened cell is
  drawn. There is no visual minimum.
- Distribution of the drawn 1,119 cells (each at its largest day): median 22 MW, p90 150, max
  3,132, total 81,779 MW. Under 5 MW: 136. Under 10: 253. Under 20: 521 (47%, 6.1% of the drawn
  power). Under 50: 795. 100 MW or more: 180.
- 662 of the 1,119 were seen on one of the three days only, and 428 of those are under 20 MW; the
  142 cells seen all three days include only 4 under 20 MW.
- Dot size: `max(1.5, min(5, sqrt(frpMw) / 9))` px radius with a 1.2 px stroke. The lower clamp
  binds below 182 MW, so 1,030 of the 1,119 dots (92%) are identical 1.5 px dots and only 89 are
  larger. The map shows the count of cells and nothing of their power. That is the clutter: half
  the dots are under 20 MW and look like the big ones.

Drawing by magnitude (size or opacity that varies through the 5 to 500 MW range where the cells
actually are, without the 1.5 px floor binding) would make the 521 small cells recede without
removing them. A visual minimum of 20 MW on the map alone would halve the dots and hide 6% of the
drawn power, which is many small real fires; opacity by power keeps them visible without clutter.

## 6. Candidate screens over the last 14 days (2026-09-27 to 10-10)

Baseline: 10,982 burning cell-days, 696,479 MW. Candidate (b) is measured on the 8 days the live
CSV covers (6,228 cell-days, 439,663 MW), joined to the stored cells.

| candidate | cell-days removed | % cell-days | MW removed | % MW |
| --- | --- | --- | --- | --- |
| (a) cells burning 60+ of the last 365 days | 515 | 4.7 | 26,176 | 3.8 |
| (a') cells with 20+ wet-season (Nov-May) burn days | 49 | 0.4 | 1,019 | 0.15 |
| (b) night-only cell-day under 5 MW | 584 | 9.4 | 1,446 | 0.33 |
| (b) night-only under 10 MW | 825 | 13.2 | 3,144 | 0.72 |
| (b) night-only under 20 MW | 1,027 | 16.5 | 5,971 | 1.36 |
| (c1) same 0.1 cell as a labelled site | 134 | 1.2 | 5,230 | 0.8 |
| (c2) within 0.1 degree of a site (cell + 8 neighbours) | 664 | 6.0 | 28,614 | 4.1 |
| (d) per-cell minimum 20 MW | 5,418 | 49.3 | 52,295 | 7.5 |
| (d) minimum 10 MW | 2,727 | 24.8 | 14,075 | 2.0 |
| (d) minimum 5 MW | 1,323 | 12.0 | 3,757 | 0.5 |
| (a) + (c1) | 621 | 5.7 | 31,153 | 4.5 |

Reading the candidates:

- (a) 60-day persistence removes the big Central Kalimantan peat cells (-2.75 112.85 at 237 MW
  mean, 14 of the last 14 days; -1.85 110.15 at 372 MW mean) along with the handful of flares.
  3.8% of the fire power for 4.7% of cells, mostly real. The wet-season variant (a') takes only
  the year-round heat, at 0.15% of the power, and is the honest version of this screen.
- (b) night-only under 5 MW is the cheapest in power (0.33%) for its 9.4% of cell-days, but the
  pixels are the smouldering fringe of fires that a day pass saw in a neighbouring cell. It
  removes dots, not false fires.
- (c2) widening the fixed-source mask to 0.1 degree removes 4.1% of the power, almost all of it
  real fire around the coal mines and flares of South Kalimantan and South Sumatra. The exact-cell
  leak (c1) is 1.2% of cell-days and 0.8% of MW, and June says most of that is honest fire next to
  a site.
- (d) a 20 MW floor halves the cell-days for 7.5% of the power. 10 MW is 25% of cell-days for 2%.

## Verdict

The screened count is plausible. The season explains the number: October 2026 is 7x the
cell-days and 17x the power of October 2025; August and September 2026 were the largest months in
the stored record (27,000 cell-days each). The fires are where fires are, 98.7% of the power in
Kalimantan and Sumatra peat and plantation land, none in cities, and the chronic cells are
overwhelmingly multi-week peat fires rather than industry. The fixed-source screen leaks about 2%
of burning cell-days and 1 to 2% of power; the unlabelled year-round sources (a Prabumulih flare,
Jorong, the Kutai Timur and Berau coal belt) add 49 cell-days and 0.15% of power in 14 days.

What looks suspicious is the drawing: 1,119 dots in three days, 92% rendered at the same minimum
size, half of them under 20 MW. No screen fixes that without throwing away real fire, because the
small cells are real small fires.

If one additional screen is wanted, the one that removes the most suspicious cells for the least
real fire is the year-round persistence screen (a'): a cell that burned on 20 or more days
between November and May is a fixed source, whatever the archive labelled. It costs 0.15% of the
power, catches every flare and mine the labelled list missed (all 10 are off the list), and
refreshes itself without the archive key. Second is a night-only floor at 5 MW (b), 0.33% of
power, but it removes dots rather than false fires and belongs on the map side rather than in the
model. Widening the fixed-source mask (c2) and a 20 MW floor (d) both cost real fire power (4.1%
and 7.5%) and should not be adopted as screens; the 20 MW question belongs to the renderer, as
opacity or size by power.

## Appendix: the 71 cells burning on 60+ of the last 365 days

Cell centre lat, lon; burn days; mean burning MW; days burning in the last 14; labelled sites in
the cell.

| lat | lon | days | mean MW | last 14 | sites |
| --- | --- | --- | --- | --- | --- |
| -3.65 | 103.65 | 150 | 10.1 | 10 | 0 |
| -3.05 | 115.15 | 136 | 31.5 | 11 | 0 |
| 0.75 | 117.05 | 95 | 42.4 | 7 | 0 |
| 1.05 | 117.15 | 94 | 40.2 | 9 | 0 |
| -2.85 | 106.35 | 85 | 32.9 | 12 | 0 |
| 1.05 | 117.65 | 83 | 7.3 | 8 | 2 |
| -1.75 | 110.15 | 82 | 277.5 | 1 | 0 |
| -3.75 | 115.45 | 81 | 5.0 | 9 | 0 |
| -2.35 | 114.15 | 81 | 91.4 | 11 | 0 |
| 1.45 | 117.25 | 80 | 64.6 | 3 | 0 |
| -0.65 | 117.25 | 78 | 15.8 | 10 | 0 |
| 0.95 | 117.15 | 78 | 26.5 | 6 | 0 |
| -0.15 | 109.35 | 77 | 79.8 | 0 | 0 |
| 0.65 | 117.15 | 76 | 30.3 | 7 | 0 |
| -2.25 | 113.85 | 76 | 216.8 | 10 | 0 |
| -1.85 | 111.35 | 76 | 56.9 | 6 | 0 |
| 0.55 | 117.25 | 75 | 26.2 | 3 | 0 |
| -2.85 | 106.25 | 75 | 42.9 | 13 | 2 |
| 1.95 | 117.25 | 75 | 55.2 | 0 | 0 |
| -3.05 | 104.45 | 74 | 83.4 | 12 | 0 |
| -1.75 | 110.25 | 74 | 139.7 | 1 | 0 |
| -2.35 | 114.05 | 74 | 211.5 | 12 | 0 |
| -2.65 | 112.85 | 73 | 81.2 | 11 | 0 |
| 2.25 | 117.95 | 73 | 127.2 | 6 | 0 |
| -3.05 | 110.95 | 72 | 68.7 | 7 | 0 |
| -1.85 | 110.15 | 72 | 372.2 | 2 | 0 |
| 2.25 | 117.85 | 72 | 101.1 | 2 | 0 |
| 0.85 | 117.05 | 71 | 24.2 | 10 | 0 |
| -2.05 | 111.15 | 70 | 71.8 | 3 | 0 |
| -1.45 | 110.15 | 70 | 217.6 | 7 | 0 |
| -2.45 | 112.95 | 70 | 119.1 | 10 | 0 |
| -2.65 | 115.15 | 69 | 69.8 | 12 | 0 |
| -3.25 | 114.75 | 68 | 61.7 | 7 | 0 |
| -2.15 | 113.85 | 67 | 135.7 | 10 | 0 |
| -3.45 | 114.75 | 67 | 39.1 | 9 | 0 |
| -3.95 | 119.65 | 66 | 27.8 | 11 | 2 |
| -3.15 | 112.35 | 66 | 126.6 | 13 | 0 |
| 2.75 | 101.55 | 66 | 23.9 | 0 | 0 |
| -1.95 | 110.15 | 65 | 170.6 | 0 | 0 |
| -2.35 | 105.85 | 65 | 41.0 | 10 | 0 |
| -3.05 | 104.15 | 65 | 50.2 | 7 | 0 |
| -2.75 | 115.15 | 65 | 89.2 | 7 | 0 |
| -2.95 | 115.25 | 65 | 7.3 | 9 | 2 |
| -1.95 | 115.85 | 65 | 17.7 | 12 | 0 |
| -2.45 | 104.05 | 65 | 7.2 | 1 | 0 |
| 1.75 | 117.95 | 64 | 25.9 | 8 | 0 |
| -2.05 | 119.35 | 64 | 22.8 | 7 | 0 |
| -2.95 | 106.85 | 64 | 45.1 | 11 | 0 |
| -1.15 | 109.75 | 63 | 47.3 | 3 | 0 |
| -2.95 | 112.95 | 63 | 107.4 | 9 | 0 |
| -2.65 | 115.25 | 63 | 46.0 | 5 | 0 |
| -3.05 | 112.85 | 62 | 104.6 | 11 | 0 |
| -1.75 | 111.55 | 62 | 51.1 | 9 | 0 |
| -2.35 | 105.95 | 62 | 47.1 | 8 | 0 |
| -2.65 | 115.05 | 62 | 47.9 | 7 | 0 |
| -2.45 | 105.95 | 62 | 47.9 | 6 | 0 |
| -2.25 | 114.05 | 62 | 54.5 | 8 | 0 |
| -1.15 | 109.65 | 62 | 70.6 | 2 | 0 |
| -1.55 | 110.05 | 62 | 180.7 | 4 | 0 |
| -2.25 | 101.05 | 61 | 34.0 | 0 | 0 |
| -3.35 | 114.75 | 61 | 55.4 | 9 | 0 |
| -3.25 | 112.55 | 61 | 118.5 | 13 | 0 |
| -3.65 | 114.75 | 61 | 42.4 | 6 | 0 |
| -1.05 | 109.95 | 61 | 63.4 | 0 | 0 |
| -2.75 | 106.05 | 61 | 40.7 | 10 | 1 |
| -0.85 | 110.25 | 60 | 56.5 | 6 | 0 |
| 2.35 | 117.95 | 60 | 79.4 | 4 | 0 |
| -2.45 | 115.05 | 60 | 57.0 | 8 | 0 |
| -2.25 | 114.65 | 60 | 84.5 | 13 | 0 |
| -2.75 | 112.85 | 60 | 236.5 | 14 | 0 |
| 0.85 | 116.95 | 60 | 27.7 | 7 | 0 |
