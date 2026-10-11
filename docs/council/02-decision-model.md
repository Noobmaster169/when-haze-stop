# How a hotspot is judged

What the council reasons over, built in stage 0 before anyone speaks. Each number is either
measured (from the stored data, the satellites or the engine) or an assumption with a range and a
source. The research behind every rule is in `research/`; the tags are [E] established in the
literature, [M] measured here, [A] an assumption we chose.

## 1. The unit is a fire complex, not a hotspot

A hotspot is a 375 m satellite pixel. No crew is sent to a pixel. Hotspots are grouped into
complexes: the strongest unassigned 0.1 degree cell seeds a complex and takes every unassigned cell
within 15 km. Single linkage chains a whole province into one complex (`01-spike-attribution.md`),
so the radius cap is required. The suppression literature says the same from the other side:
detections in one peat dome or within a few km are one incident, and are attacked as one, from
the edge (`research/01`, rule 4) [E].

## 2. The six things known about each complex

| Measure | How | Tag |
| --- | --- | --- |
| **Influence**: share of the target's coming fire smoke | Engine source-receptor run on the complex's future emissions, read at the target stations (`06-engine-seam.md`) | M |
| **Size**: fire power per day and detection count | Stored cells (`burning_mw`); detections from the FIRMS files through the existing `FiresClient`. This week a VIIRS detection averages 6 to 8 MW (NOAA-20, 3 to 10 Oct: Borneo mean 6.1, Sumatra 7.8) | M |
| **Persistence**: days burning in the last 30 | `fire_cells` history (back to 1 July). Of the cells burning 7 to 9 October, about half had burned on 10 or more of the last 30 days | M |
| **Smoulder signal**: share of detections at night | FIRMS `daynight`. Borneo 63% at night this week, Sumatra 50%, the peninsula 12%. Peat fires smoulder through the night and peak later in the day [E]; a high night share with many days of persistence flags deep peat | M |
| **Peat**: share of the complex on peat | PEATMAP (Xu et al. 2018, University of Leeds, CC BY 4.0), resampled to a 0.1 degree peat fraction and bundled (`research/05`). No open map gives depth, so depth is inferred from persistence and the smoulder signal. Spot checks: the top Jambi complex 1.0, Central Kalimantan complexes 0.57 to 0.72, both Johor fires 0.0 | M |
| **Access**: distance to staging, to scoopable water, Malaysian or Indonesian soil, consent | Gazetteer, land outline (`haze/land.ts`, read only), the consent table. The scooper's 25 km water reach is shown to the seats but not enforced by the validator: the outline has no rivers, and the large rivers beside the Jambi fires (the Batang Hari) can be scooped from, so a hard rule would wrongly bar them. Air Operations judges it | M and A |

## 3. What can be done to a complex, and how fast

This is the heart of "limited resources". The literature is unanimous that water from the air
does not put out peat; it knocks down flame on the surface. Only ground crews with pumps and
lances extinguish smouldering peat, and slowly.

| Asset | Works on | Rate | Tag and source |
| --- | --- | --- | --- |
| CL-415MP scooper | Flaming surface fire within about 25 km of a 1.3 km open-water scoop run, visibility over 3 km | 100,000 to 160,000 L a day (2015 Palembang record: 546,000 L in 5 days). On surface fire at 10 to 40 kL per ha of front, 3 to 15 ha a day knocked down. On deep peat, 0.2 to 1.5 ha a day saturated, which is nothing | E for litres, A for ha |
| Medium helicopter with bucket (x3) | Same, closer water, smaller drops | 1,200 to 1,590 L a drop, about 20 drops each a day; 70,000 to 95,000 L a day for three | E for buckets, A for drops |
| Ground lance team (5 to 6 people) | Smouldering peat, with water within a few hundred metres | 0.25 to 3 ha a team-day in field reports; 0.04 ha a person-day for Singapore's crew on deep peat in Riau, 2005 | E, wide range |
| Bomba peat team on Malaysian soil | Domestic peat and surface fires | As ground teams, but arrives in hours, needs no consent, and Bomba has about 15,000 people | E for staff, A for how many can be spared |
| Cloud seeding | Whole regions, needs cloud | Raises rain 57 to 81% where cloud exists; not aimable at a complex | E; not a plan asset |

Active area of a complex is estimated from its detections: 1 ha of active front per detection,
range 0.3 to 3 ha [A]. The VIIRS pixel is 14 ha, but a detection marks heat somewhere inside it,
and smouldering fronts are small and slow (0.1 to 1.5 m a day) [E].

What follows, and the council is told plainly:

- Malaysia's whole air package, every litre for 14 days, would saturate 4 to 6 ha of deep peat
  (`research/02`). Against a Kalimantan complex of 200 detections it changes nothing.
- The same aircraft can knock down tens of hectares of surface fire, which matters only where the
  complex is young, on mineral soil, or flaming on top of peat, and near water.
- Ground crews are the only tool that ends peat fires, and the deployed 52 are mostly air crew.

## 4. How a plan changes emissions (the effect model)

Pure functions in `backend/src/suppression/effect.ts`. For each complex the plan touches:

1. Nothing happens before arrival: staging to complex flight or drive time, plus setup (half a
   day for aircraft in theatre, a day for ground crews).
2. Each day, the assigned assets extinguish or knock down an area: the rate above, chosen by what
   the complex is (surface vs peat, from persistence, smoulder signal and peat share).
3. The complex's emissions that day scale by `1 - extinguished / active area`, never below the
   floor set by re-ignition.
4. **Re-ignition** [E]: a peat complex partly suppressed relights; in the central case 30% of the
   extinguished area returns after the crew leaves, 60% in the pessimistic case. A suppressed
   complex with unsuppressed fire power within 10 km keeps a further 20% (spotting and creep back
   into dry, treated ground).
5. **Knockdown is not extinction** [E]: aircraft-only work on a peat complex reduces the flaming
   share for the days aircraft are overhead and returns to baseline when they leave.

Three scenarios, every plan scored in all three:

| | Optimistic | Central | Pessimistic |
| --- | --- | --- | --- |
| Area per detection | 0.3 ha | 1 ha | 3 ha |
| Ground rate | 3 ha/team-day | 1 ha/team-day | 0.25 ha/team-day |
| Re-ignition | 10% | 30% | 60% |
| Wind | ensemble member most favourable | ensemble mean | least favourable |

## 5. The measures a plan is scored on

From the engine, over the horizon, at the target stations (`06-engine-seam.md`):

- ug/m3 of 24-hour PM2.5 removed, mean and at the peak, and as a share of the ceiling.
- Station-hours above API 100 and 200 avoided.
- When the benefit arrives.

From the plan itself: asset-days used, cost against the budget, crew exposure (days in smoke under
3 km visibility), and whether it needs consent Indonesia has not given.

## 6. Decision rules the council starts from

Distilled from `research/01` (rules 1 to 10) and `research/03`, given to every seat as the
`peat-suppression` and `reading-influence` skills. They are the defaults a seat must argue
against with evidence, not laws:

1. Rank by influence on the target, never by fire power or distance. This week: the ten most
   influential complexes cause 85% of KL's coming fire smoke, the ten most powerful 49%, the ten
   nearest 5% [M].
2. Never rank peat fires by fire power. Fire power measures flame; smouldering peat makes 3 to 6
   times more particulate per kg burned for less heat [E].
3. Send only what can finish the job, or hold the advancing edge. Half-suppressed peat relights,
   and the effort is lost [E].
4. Attack a cluster from its edge and as a whole; never the middle of a burning cluster, which
   unsuppressed neighbours relight [E].
5. Aircraft for young, surface or flaming fires near water and in visibility over 3 km; ground
   crews for peat. Never plan aircraft to extinguish peat [E].
6. Prefer new ignitions on peat that crews can reach: caught early they are small; left, they
   become the months-long fires that end only with rain [E].
7. Domestic fires are fast, need no consent, and at 30 to 300 km a small one can matter as much as
   a large one abroad [M, E].
8. Value suppression only up to the expected rains; rain ended the haze in 1997, 2015 and 2019 [E].
9. Influence is valid for this wind. MetMalaysia says the inter-monsoon began on 9 October 2026,
   weak and variable [E]; a plan whose value rests on one wind member is fragile.
10. A plan that needs Indonesia to agree to something new (Sumatra, ground crews) is a request,
    with a lag of days to weeks, not an assignment [E].
