# Open questions

## For the engine's owner

1. **An extended horizon on analogue weather.** The feature is empty without it: over the 84-hour
   forecast the ceiling is 0.84 ug/m3 and a Kalimantan plan's smoke has not arrived when the window
   closes; over 14 days it is 3 to 21 ug/m3 (`01b-spike-plans.md`). Proposal: the seam builds the
   weather as the stored forecast followed by replays of past 10-day windows of stored analysis,
   one per ensemble member, and hands it to the engine as an ordinary `Weather`. Nothing in the
   engine changes. Question: is that acceptable, and is there a better analogue (same weeks of a
   past year, once the history job stores them)?
2. **Will the new engine stay linear in emissions?** The council's plan scorer adds rows of a
   source-receptor matrix. If the rework adds anything non-linear (chemistry, a non-linear
   calibration, emissions that depend on smoke), the matrix becomes an approximation and the
   verdict's full run is the check. Which public functions will the new engine expose for "run
   these emissions on this weather and give me the smoke at these cells"?
3. **The intercept.** The calibration puts KL at 36 ug/m3 of PM2.5 not tied to modelled smoke, and
   2.8 ug/m3 of modelled fire smoke over 84 hours. Some of the intercept is likely aged regional
   smoke older than the 144-hour particle life or lost to the 72-hour decay. If the rework moves
   smoke out of the intercept, the council's benefits grow; the council reads whatever the engine
   says and shows the ceiling beside every number, so it does not need to know.
4. **Fire power as mass.** The engine burns fire power, which under-weights smouldering peat by 3
   to 6 times per kg burned (`research/01`). A peat weighting (from the bundled peat grid) would
   change which complexes rank first. That is an engine decision; until it is made, the Peat
   Science seat flags it in every run.
5. **Cost of attribution.** Per complex, per emission day, per wind member, the seam calls the
   ensemble on a slice of emissions, and each call allocates a full field. About 25 s per wind
   member for 50 candidates today. A receptor-only tally would be much faster but is an engine
   change; not needed yet.

## For the user

1. **Should the verdict be allowed to say "the package as accepted cannot help KL"?** Spike 2 says
   it is true this week. The design assumes yes: the council recommends what would help, including
   a request to Indonesia, and states plainly what the accepted package can and cannot do.
2. **Domestic fires.** The design lets plans use up to 100 Bomba firefighters on Malaysian fires,
   because they matter more to KL than the Kalimantan deployment. Confirm that this is in scope for
   "what Malaysia can provide".
3. **Sarawak's seat.** It is there as the authentic dissenter (Kalimantan is its source). Keep it,
   or keep the council to KL voices only?
4. **Where the page lives.** Built at `/council`, then the nav's Simulation entry points to it and
   the backtest moves under it. Confirm before the nav switch, since the teammate may be changing
   the Simulation page.

## Not settled in the design

- The analogue windows: which past windows, how many, and whether to weight them by similarity to
  the forecast's last day. Start with the four most recent 10-day windows that are complete.
- Whether the Chair and Red Cell on `opus` are worth the latency; measure on the first runs.
- How the run is started in production: a button that starts a job in the api process, or a
  `pnpm council:run` script in the jobs process. The design says a button that enqueues; the run
  executes in the jobs process, which already owns long work.

## Added after the build

- **A check that the plan scorer matches the full engine.** The scorer adds up per-complex
  contributions; the verdict's maps come from a full scaled run. A test that the two agree within a
  tolerance on recorded data is not built yet.
- **The scooper's water reach** is advisory, not enforced, until a river map is bundled
  (`02-decision-model.md`).
