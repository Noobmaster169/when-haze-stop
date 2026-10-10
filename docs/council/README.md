# The Suppression Council

Working folder for the feature that answers one question: with the limited help Malaysia can
send, which fire hotspots should be put out first to clear the haze over Kuala Lumpur and its
surroundings, and what does the air look like afterwards.

A council of agents who play Malaysian ministers and experts argue the question from the same
data. Their candidate plans go through the smoke model, and the plan that holds up best becomes
the verdict. The page replays the whole meeting.

Status: design done (`spec.md`), tested on a prototype council (`11`), and built through phase 4: the suppression core, the engine seam, the store and API, and the council itself (`12-build.md`). The page is being built. The smoke model itself is being reworked by a teammate, so everything here reaches it through one seam (`06-engine-seam.md`) and changes nothing inside `backend/src/haze/`.

## Files

| File | What it holds |
| --- | --- |
| `00-log.md` | What was done, in order, with dates. Read last to see where work stopped |
| `01-spike-attribution.md` | The measured result that shaped the design: which fires reach KL this week |
| `01b-spike-plans.md` | Realistic plans scored on a 14-day horizon: the strategy matters by two orders of magnitude |
| `research/` | The research, one file per topic, every claim cited |
| `02-decision-model.md` | How a hotspot is judged: influence, persistence, re-ignition, effort, access |
| `03-assistance-package.md` | What Malaysia can send, as stated assumptions with sources |
| `04-council-roles.md` | Who sits at the table, what each one owns and argues |
| `05-protocol.md` | The meeting, stage by stage, and how a verdict is reached |
| `06-engine-seam.md` | How a plan becomes a simulated outcome without touching the engine |
| `07-tools-and-skills.md` | The council's tools and skill files |
| `08-replay-events.md` | The event log a run writes and the replay reads |
| `09-page.md` | The page: the graph, the player, the verdict |
| `10-open-questions.md` | What is not settled, and what to ask the engine's owner |
| `11-prototype-council.md` | A real five-seat council run through the proxy: what worked, what failed, what changed |
| `12-build.md` | What is built, where it lives, how to run it |
| `13-real-runs.md` | Full council runs on real data, read in full, and what each changed |
| `spec.md` | The design in one document, for review before building |
