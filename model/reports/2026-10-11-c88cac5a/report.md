# Model 2026-10-11-c88cac5a

Parquet `features-2025-06-07-2026-10-08-8f571bda.parquet`, wind source **analysis**, 27544 rows, trained 2026-10-10T17:44:15.598186+00:00.

## Walk-forward by block (reference instruments, MAE / hazy-day MAE, ug/m3)

| Block | Train | Test | Model d1 | Persistence d1 | v2 d1 | Model d2 | Persistence d2 | v2 d2 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 2025-07 | 1218 | 1576 | 2.94 / n/a | 3.01 / n/a | 3.61 / n/a | 3.26 / n/a | 3.60 / n/a | 4.55 / n/a |
| 2025-08 | 2795 | 1601 | 3.73 / n/a | 4.80 / n/a | 5.22 / n/a | 4.15 / n/a | 5.58 / n/a | 6.29 / n/a |
| 2025-09 | 4393 | 1654 | 3.05 / n/a | 4.03 / n/a | 4.44 / n/a | 3.51 / n/a | 4.94 / n/a | 6.36 / n/a |
| 2025-10 | 6043 | 1625 | 2.78 / n/a | 3.54 / n/a | 3.74 / n/a | 2.97 / n/a | 4.12 / n/a | 4.60 / n/a |
| 2025-11 | 7676 | 1572 | 2.90 / n/a | 3.53 / n/a | 3.79 / n/a | 3.70 / n/a | 4.18 / n/a | 5.10 / n/a |
| 2025-12 | 9243 | 1704 | 2.75 / n/a | 2.78 / n/a | 3.00 / n/a | 3.71 / n/a | 3.45 / n/a | 3.55 / n/a |
| 2026-01 | 10947 | 1715 | 2.46 / n/a | 2.03 / n/a | 2.95 / n/a | 2.86 / n/a | 2.27 / n/a | 3.43 / n/a |
| 2026-02 | 12663 | 1527 | 3.02 / n/a | 3.94 / n/a | 4.50 / n/a | 3.25 / n/a | 4.71 / n/a | 5.63 / n/a |
| 2026-03 | 14187 | 1787 | 2.49 / n/a | 2.97 / n/a | 3.45 / n/a | 2.94 / n/a | 3.57 / n/a | 4.43 / n/a |
| 2026-04 | 15971 | 1764 | 2.68 / n/a | 3.41 / n/a | 3.53 / n/a | 2.94 / n/a | 3.61 / n/a | 4.65 / n/a |
| 2026-05 | 17738 | 1837 | 3.34 / n/a | 4.50 / n/a | 4.63 / n/a | 4.08 / n/a | 5.18 / n/a | 6.53 / n/a |
| 2026-06 | 19573 | 1765 | 3.49 / n/a | 2.71 / n/a | 3.38 / n/a | 4.50 / n/a | 3.41 / n/a | 4.14 / n/a |
| 2026-07 | 21337 | 1667 | 3.25 / n/a | 3.70 / n/a | 3.65 / n/a | 3.82 / n/a | 4.22 / n/a | 4.80 / n/a |
| 2026-08 | 23011 | 1810 | 3.49 / 6.62 | 3.71 / 5.70 | 4.44 / 6.90 | 4.63 / 9.55 | 4.28 / 7.24 | 6.08 / 10.68 |
| 2026-09 | 24816 | 1825 | 13.89 / 15.75 | 16.59 / 19.12 | 15.97 / 19.51 | 14.17 / 15.50 | 19.59 / 21.29 | 20.10 / 23.49 |
| 2026-10 | 26637 | 844 | 19.10 / 19.27 | 19.23 / 19.15 | 19.54 / 19.69 | 23.79 / 23.79 | 25.73 / 25.73 | 28.48 / 28.48 |

## Pooled

- d1: 25048 rows scored in common by model, persistence, climatology and v2
- d2: 24900 rows scored in common by model, persistence, climatology and v2
- model d1 airport: cases 12699, MAE 2.55, hazy MAE 4.85, hit150 0.55, far150 0.36, below p10 0.23, above p90 0.10
- model d1 nea: cases 2315, MAE 4.01, hazy MAE 15.48, hit150 0.50, far150 0.43, below p10 0.23, above p90 0.24
- model d1 openaq: cases 10034, MAE 5.07, hazy MAE 16.35, hit150 0.60, far150 0.21, below p10 0.24, above p90 0.21
- model d1 reference: cases 2315, MAE 4.01, hazy MAE 15.48, hit150 0.50, far150 0.43, below p10 0.23, above p90 0.24
- model d2 airport: cases 12667, MAE 3.05, hazy MAE 5.46, hit150 0.39, far150 0.33, below p10 0.26, above p90 0.11
- model d2 nea: cases 2315, MAE 4.63, hazy MAE 16.70, hit150 0.44, far150 0.34, below p10 0.22, above p90 0.26
- model d2 openaq: cases 9918, MAE 6.33, hazy MAE 18.99, hit150 0.42, far150 0.24, below p10 0.24, above p90 0.22
- model d2 reference: cases 2315, MAE 4.63, hazy MAE 16.70, hit150 0.44, far150 0.34, below p10 0.22, above p90 0.26
- persistence d1 airport: cases 12699, MAE 2.34, hazy MAE 4.53, hit150 0.59, far150 0.38, below p10 n/a, above p90 n/a
- persistence d1 nea: cases 2315, MAE 4.59, hazy MAE 17.53, hit150 0.48, far150 0.49, below p10 n/a, above p90 n/a
- persistence d1 openaq: cases 10034, MAE 5.24, hazy MAE 13.71, hit150 0.64, far150 0.31, below p10 n/a, above p90 n/a
- persistence d1 reference: cases 2315, MAE 4.59, hazy MAE 17.53, hit150 0.48, far150 0.49, below p10 n/a, above p90 n/a
- persistence d2 airport: cases 12667, MAE 3.05, hazy MAE 5.84, hit150 0.48, far150 0.49, below p10 n/a, above p90 n/a
- persistence d2 nea: cases 2315, MAE 5.45, hazy MAE 20.61, hit150 0.39, far150 0.56, below p10 n/a, above p90 n/a
- persistence d2 openaq: cases 9918, MAE 6.62, hazy MAE 17.44, hit150 0.53, far150 0.40, below p10 n/a, above p90 n/a
- persistence d2 reference: cases 2315, MAE 5.45, hazy MAE 20.61, hit150 0.39, far150 0.56, below p10 n/a, above p90 n/a
- climatology d1 airport: cases 12699, MAE 8.57, hazy MAE 14.44, hit150 0.00, far150 n/a, below p10 n/a, above p90 n/a
- climatology d1 nea: cases 2315, MAE 6.98, hazy MAE 41.01, hit150 0.00, far150 n/a, below p10 n/a, above p90 n/a
- climatology d1 openaq: cases 10034, MAE 10.70, hazy MAE 43.56, hit150 0.00, far150 n/a, below p10 n/a, above p90 n/a
- climatology d1 reference: cases 2315, MAE 6.98, hazy MAE 41.01, hit150 0.00, far150 n/a, below p10 n/a, above p90 n/a
- climatology d2 airport: cases 12667, MAE 8.65, hazy MAE 14.61, hit150 0.00, far150 n/a, below p10 n/a, above p90 n/a
- climatology d2 nea: cases 2315, MAE 7.19, hazy MAE 42.63, hit150 0.00, far150 n/a, below p10 n/a, above p90 n/a
- climatology d2 openaq: cases 9918, MAE 10.81, hazy MAE 44.25, hit150 0.00, far150 n/a, below p10 n/a, above p90 n/a
- climatology d2 reference: cases 2315, MAE 7.19, hazy MAE 42.63, hit150 0.00, far150 n/a, below p10 n/a, above p90 n/a
- v2 d1 airport: cases 12699, MAE 2.94, hazy MAE 5.94, hit150 0.59, far150 0.43, below p10 n/a, above p90 n/a
- v2 d1 nea: cases 2315, MAE 4.93, hazy MAE 18.05, hit150 0.41, far150 0.33, below p10 n/a, above p90 n/a
- v2 d1 openaq: cases 10034, MAE 5.04, hazy MAE 14.49, hit150 0.62, far150 0.15, below p10 n/a, above p90 n/a
- v2 d1 reference: cases 2315, MAE 4.93, hazy MAE 18.05, hit150 0.41, far150 0.33, below p10 n/a, above p90 n/a
- v2 d2 airport: cases 12667, MAE 3.92, hazy MAE 7.81, hit150 0.46, far150 0.55, below p10 n/a, above p90 n/a
- v2 d2 nea: cases 2315, MAE 6.38, hazy MAE 23.09, hit150 0.32, far150 0.42, below p10 n/a, above p90 n/a
- v2 d2 openaq: cases 9918, MAE 7.06, hazy MAE 19.88, hit150 0.49, far150 0.30, below p10 n/a, above p90 n/a
- v2 d2 reference: cases 2315, MAE 6.38, hazy MAE 23.09, hit150 0.32, far150 0.42, below p10 n/a, above p90 n/a
- physics d1 airport: cases 12699, MAE 2.21, hazy MAE 4.47, hit150 0.51, far150 0.24, below p10 n/a, above p90 n/a
- physics d1 doe: cases 340, MAE 16.62, hazy MAE 20.45, hit150 0.60, far150 0.05, below p10 n/a, above p90 n/a
- physics d1 nea: cases 2315, MAE 4.47, hazy MAE 18.21, hit150 0.38, far150 0.36, below p10 n/a, above p90 n/a
- physics d1 openaq: cases 10034, MAE 4.94, hazy MAE 14.19, hit150 0.60, far150 0.15, below p10 n/a, above p90 n/a
- physics d1 reference: cases 2655, MAE 6.03, hazy MAE 19.55, hit150 0.54, far150 0.14, below p10 n/a, above p90 n/a
- physics d2 airport: cases 12667, MAE 3.01, hazy MAE 6.05, hit150 0.41, far150 0.38, below p10 n/a, above p90 n/a
- physics d2 doe: cases 340, MAE 22.92, hazy MAE 27.49, hit150 0.50, far150 0.10, below p10 n/a, above p90 n/a
- physics d2 nea: cases 2315, MAE 5.58, hazy MAE 22.39, hit150 0.27, far150 0.51, below p10 n/a, above p90 n/a
- physics d2 openaq: cases 9918, MAE 6.51, hazy MAE 18.37, hit150 0.50, far150 0.27, below p10 n/a, above p90 n/a
- physics d2 reference: cases 2655, MAE 7.80, hazy MAE 25.48, hit150 0.43, far150 0.22, below p10 n/a, above p90 n/a
- model_on_physics_rows d1 airport: cases 12699, MAE 2.55, hazy MAE 4.85, hit150 0.55, far150 0.36, below p10 0.23, above p90 0.10
- model_on_physics_rows d1 doe: cases 340, MAE 15.02, hazy MAE 18.29, hit150 0.79, far150 0.05, below p10 0.10, above p90 0.34
- model_on_physics_rows d1 nea: cases 2315, MAE 4.01, hazy MAE 15.48, hit150 0.50, far150 0.43, below p10 0.23, above p90 0.24
- model_on_physics_rows d1 openaq: cases 10034, MAE 5.07, hazy MAE 16.35, hit150 0.60, far150 0.21, below p10 0.24, above p90 0.21
- model_on_physics_rows d1 reference: cases 2655, MAE 5.42, hazy MAE 17.16, hit150 0.70, far150 0.17, below p10 0.22, above p90 0.25
- model_on_physics_rows d2 airport: cases 12667, MAE 3.05, hazy MAE 5.46, hit150 0.39, far150 0.33, below p10 0.26, above p90 0.11
- model_on_physics_rows d2 doe: cases 340, MAE 21.43, hazy MAE 24.60, hit150 0.69, far150 0.10, below p10 0.06, above p90 0.48
- model_on_physics_rows d2 nea: cases 2315, MAE 4.63, hazy MAE 16.70, hit150 0.44, far150 0.34, below p10 0.22, above p90 0.26
- model_on_physics_rows d2 openaq: cases 9918, MAE 6.33, hazy MAE 18.99, hit150 0.42, far150 0.24, below p10 0.24, above p90 0.22
- model_on_physics_rows d2 reference: cases 2655, MAE 6.78, hazy MAE 21.48, hit150 0.61, far150 0.16, below p10 0.20, above p90 0.29

## Intervals (90%, day blocks)

- d1 airport model_minus_persistence: 0.05 to 0.38
- d1 airport model_minus_v2: -0.55 to -0.23
- d1 doe model_minus_persistence: -2.63 to 0.52
- d1 doe model_minus_v2: -3.29 to 0.40
- d1 nea model_minus_persistence: -0.88 to -0.33
- d1 nea model_minus_v2: -1.13 to -0.69
- d1 openaq model_minus_persistence: -0.40 to 0.03
- d1 openaq model_minus_v2: -0.15 to 0.21
- d1 reference model_minus_persistence: -1.05 to -0.35
- d1 reference model_minus_v2: -1.34 to -0.67
- d2 airport model_minus_persistence: -0.14 to 0.14
- d2 airport model_minus_v2: -1.00 to -0.75
- d2 doe model_minus_persistence: -3.27 to 0.27
- d2 doe model_minus_v2: -4.08 to 0.36
- d2 nea model_minus_persistence: -1.17 to -0.49
- d2 nea model_minus_v2: -2.13 to -1.42
- d2 openaq model_minus_persistence: -0.54 to -0.04
- d2 openaq model_minus_v2: -0.98 to -0.51
- d2 reference model_minus_persistence: -1.32 to -0.53
- d2 reference model_minus_v2: -2.20 to -1.32

## Onset lead days

- airport, 73 onsets: model 0.40, persistence 0.00, v2 0.14
- doe, 2 onsets: model 0.00, persistence 0.00, v2 0.00
- nea, 17 onsets: model 0.41, persistence 0.00, v2 0.00
- openaq, 78 onsets: model 0.29, persistence 0.00, v2 0.15
- reference, 19 onsets: model 0.37, persistence 0.00, v2 0.00

Day +2 served by **recursive** (direct 21.48, recursive 21.18; rule: recursive within 5% of direct).

## Scenarios

- onset: 15 rows, not judged (too few rows)
- end: 38 rows, pass
- fire_dropout: 14 rows, not judged (too few rows)
- wind_reversal: 63 rows, pass
- clean_season: 600 rows, pass
- unseen_instruments: None rows, pass

## Leak tests

- shift: pass
- shuffle: pass

## Ablation (full hazy MAE 17.09)

| Group | Columns | Without | Change | Keep |
| --- | --- | --- | --- | --- |
| air | 13 | 22.31 | 0.305 | yes |
| fires | 75 | 17.62 | 0.031 | yes |
| physics | 5 | 18.02 | 0.054 | yes |
| weather | 11 | 17.48 | 0.022 | yes |
| calendar | 4 | 16.76 | -0.020 | no |
| identity | 1 | 17.37 | 0.016 | yes |

## Feature importance (gain, top 20)

- level: 30131.5
- peak24: 7447.8
- hist_mean: 2857.3
- hist_std: 2166.1
- smoke_24h: 1839.0
- slope3h: 1835.6
- near50: 1689.3
- fire_s3_r1_d7: 1685.5
- smoke_change: 1360.9
- fire_s3_r1_d1: 1200.8
- d24: 1122.8
- lag72: 1114.6
- near150: 1094.8
- d48: 1059.2
- lag24: 1031.8
- v24: 973.4
- u24: 867.2
- smoke_48h: 851.8
- fire_s3_r1_d3: 823.6
- rain24: 809.5
