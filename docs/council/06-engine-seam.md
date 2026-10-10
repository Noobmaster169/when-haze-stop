# The engine seam: from a plan to a simulated outcome

The smoke model is being reworked by a teammate. The council must not edit it and must survive
its changes. So the council talks to it through one interface with one real implementation and
one fake, exactly as `LlmClient` and the data sources are done.

## What the council needs from the engine

Three things, in rising cost:

1. **Attribution.** For each fire complex, how much smoke it will cause at each target station
   over the horizon, split by the day the smoke is emitted. This is a source-receptor matrix.
   It is computed once per council run, before anyone speaks, and is the "memory of where the
   haze comes from" the brief asks for, measured from this week's wind rather than remembered.
2. **Plan scoring.** For a plan (which complexes are hit, from when, how hard), the target's
   PM2.5 and API series with and without the plan. Because transport is linear in emissions,
   this is arithmetic on the matrix: baseline minus the sum, over hit complexes and days, of the
   suppressed fraction times that complex-day's contribution. Microseconds per plan, so the
   council can score every candidate, every variant and every stress case.
3. **The verdict run.** For the chosen plan (and the baseline), one full engine run with the
   plan's emissions, giving map frames over the whole region for the before and after maps.

## Interface

```ts
// backend/src/services/suppression-engine.ts (the seam; real implementation)
// backend/src/services/__fakes__/fake.suppression-engine.ts (the fake)

export interface SuppressionEngine {
  /** The situation the council reasons over: complexes, their features, the matrix. */
  attribute(request: { asOf: Date; target: TargetArea }): Promise<Attribution>;
  /** A full run with each complex's emissions scaled by the plan, for the verdict's maps. */
  simulate(request: { asOf: Date; target: TargetArea; scaling: EmissionScaling }): Promise<PlanRun>;
}
```

`EmissionScaling` is a list of `{ complexId, fromHour, factor(hour) }` resolved to a plain table of
factors per complex per emission day, so the engine never sees a plan, only "this cell's emissions
on this day are multiplied by 0.3".

Plan scoring (2) does not go through the seam at all: it is a pure function in
`backend/src/suppression/score.ts` over the `Attribution` the seam returned. That keeps the
expensive, engine-dependent part to two calls per council run.

## The real implementation, today

It composes the engine's public pieces and edits none of them:

| Step | Engine function used | Changed? |
| --- | --- | --- |
| Load what is known | `jobs/forecast.loadRunInput` | No |
| Calibration (ug/m3 per unit) | `haze/run.runModel` | No |
| Future emissions per cell-day | `haze/fires.emissionsFor` | No |
| Smoke per complex | `haze/ensemble.ensembleMean` on that complex's emissions | No |
| Smoke at a station | `haze/smoke.smokeFrom(...).near` | No |
| Plan run | `ensembleMean` on scaled emissions, then the same calibration | No |

When the teammate's new engine lands, only this file changes. If the new engine is no longer
linear in emissions (for example chemistry, or a non-linear calibration), the matrix becomes an
approximation, and the verdict run (3) is the check: the verdict page shows both the matrix's
prediction and the full run's, and the test suite asserts they agree within a tolerance on the
recorded fixture.

## What a suppressed complex does to emissions

Pure functions in `backend/src/suppression/effect.ts`. The numbers come from
`research/01-suppression-science.md` and are listed in `02-decision-model.md`; the shape is:

- Nothing changes before the crews arrive: `arrivalHour = start + travel + setup`.
- Surface fire (mineral soil, low persistence): emissions fall to `1 - knockdown` within a day.
- Peat fire (on the peat mask, or burning many days in a row): emissions fall in proportion to
  the hectares the assigned crews can extinguish per day, against the complex's burning area,
  so an under-resourced peat complex is only partly suppressed.
- Re-ignition: a suppressed complex with unsuppressed fire power within a spotting radius keeps a
  relapse fraction, and in the pessimistic scenario a share of extinguished peat rekindles.

Every plan is scored three times, central, optimistic and pessimistic, and the council sees all
three. A plan that wins only under optimism is a plan that loses.

## Measures

For the target area (KL and surroundings: the Klang Valley stations, Putrajaya, Nilai, Seremban),
over the horizon:

- Fall in mean 24-hour PM2.5, ug/m3, and as a share of the most that could be gained (all fires
  out), which is the ceiling every number is shown against.
- Station-hours above API 100 and above 200 avoided.
- Fall in the peak API.
- When the benefit arrives (hours from now), because a benefit after the window ends is invisible.
- Resource use against the package: crew-days, sorties, days, cost.

## Horizon

The engine's horizon is 84 hours, bound by the weather forecast. Suppression bites after a day or
two and smoke takes two to three days to arrive from Kalimantan, so most of a plan's benefit
falls after the window. Two answers, in order of preference:

1. **Analogue weather (recommended).** Extend the wind beyond the forecast with stored weather
   from past weeks of the same season (the history job keeps months of it), as an ensemble of
   analogues, labelled on the page as a seasonal outlook and not a forecast. This changes the
   engine's input, not the engine. Needs the teammate's agreement because the loader is theirs.
2. **Report within the window only.** Honest and simple; the benefit looks small.

Until (1) is agreed the council runs on (2), and says so in the verdict.
