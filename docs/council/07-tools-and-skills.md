# The council's tools and skills

## Tools

The council's tools are not the chat's tools. They read one frozen snapshot: the `Attribution`
the engine seam returned in stage 0, plus the stored data at the run's `asOf`. Every seat sees the
same world, a replay is exactly reproducible, and a tool call costs milliseconds. They live in
`backend/src/agents/council/tools/`, one file per tool plus `index.ts`, with the chat's
`ChatTool` shape (name, description, zod schema, `run`) and the same JSON tool protocol over
structured output.

Each tool result carries `factIds`: short ids for every number it returned (`F-K017-share`). A
message that cites a number must cite its fact id or a simulation id; the run checks it.

| Tool | Who has it | Returns |
| --- | --- | --- |
| `get_complexes` | all proposers | The fire complexes: id, nearest place and province, centre, cells, fire power per day, trend, days burning of the last 30, peat share, share of the target's coming smoke, km to target, nearest staging base. Filters: region, country, min share; sort by share, power, persistence or distance |
| `get_influence` | Air Quality, Meteorology, Sarawak | For given complexes: contribution series at the target, when the smoke arrives, share of the ceiling, and the spread across wind members |
| `get_wind_outlook` | Meteorology | Mean wind at smoke height per region over the horizon, its spread, rain that will scrub smoke |
| `get_fire_history` | Peat Science | For a complex: burning days in the last 30 and 90, first seen, fire power trend, whether it is a new ignition or an established smoulder |
| `get_peat` | Peat Science | Peat share of the complex's cells, from the bundled PEATMAP grid (`research/05`); depth is not in any open map, so the tool says so and offers persistence and night share instead |
| `get_target_air` | Air Quality, Health, Sarawak | Readings and the engine's forecast at the target stations, the lines (100, 200), population served |
| `get_logistics` | Force Command, Air Ops, Domestic Fire | Distance and flight time from each staging base, distance to scoopable water, road access proxy, Malaysian or Indonesian soil |
| `get_consent` | Foreign Affairs | Where Malaysian help has been accepted (from the September 2026 acceptance), the standing conditions, sensitivities |
| `get_costs` | Treasury | Cost per flight hour and per crew-day, as cited assumptions |
| `check_feasibility` | proposers, Force Command, Air Ops | Runs the validator on a plan: per-day asset totals, ranges, water, consent, crew rest. Returns each violation |
| `simulate_plan` | proposers (twice in drafting), critics (variants) | The plan's score from the source-receptor matrix: ug/m3 removed, station-hours over 100 avoided, peak change, arrival time, central, optimistic, pessimistic. Each call is an event; the Engine node lights |
| `stress_plan` | Red Cell | The plan under each wind member and the pessimistic re-ignition case, with the worst case named |
| `load_skill` | all | A skill's body into the agent's context |

Naming places: the gazetteer (`sources/gazetteer-data.ts`) covers Malaysia, Singapore and Brunei
only. Complexes in Indonesia need a province and regency, so the gazetteer packer
(`scripts/pack-gazetteer.mjs`, GeoNames, CC BY 4.0) gains Indonesian provinces, regencies and
towns, in a separate data file. A complex is then named "near Pulang Pisau, Central Kalimantan".

## Skills

Skills are the research distilled into what an agent acts on, one folder per skill under
`backend/src/agents/council/skills/<name>/SKILL.md`, the same format and registry as the chat's.
Each seat's prompt names the skills it should load first; any seat may load any skill.

| Skill | Distilled from | Core of it |
| --- | --- | --- |
| `reading-influence` | `research/03` | What a share of the target's smoke means, why the nearest or biggest fire is not the cause, seasonal source regions as a prior and this week's wind as the evidence, arrival times |
| `peat-suppression` | `research/01` | Smouldering vs flaming, what water bombing can and cannot do on peat, crew productivity, re-ignition and holdover, why a cluster is attacked from its edges and as a whole |
| `aerial-firefighting` | `research/01`, `research/02` | CL-415 scoop-and-drop cycle and daily drops, helicopter buckets, water within reach, the 2015 Palembang precedent |
| `transboundary-diplomacy` | `research/02` | The ASEAN haze agreement, how help is requested and coordinated through BNPB, Indonesia's sensitivities, what Malaysia has been cleared to do in 2026 |
| `exposure-and-health` | `research/03`, guidelines | People times hours over a line, the school and outdoor lines, the vulnerable |

As built, five skills exist. The plan format and how to cross-examine went into the stage prompts
(`council-draft`, `council-critique`, `council-premortem`) instead of skills, because every seat
needs them at that stage and none needs them elsewhere.

Every skill states its sources at the foot, so the replay's "why does the scientist say that"
can be traced to a paper.

## Prompts

`backend/src/agents/prompts/council-<stage>/v1.md`: `council-mission`, `council-draft`,
`council-screen`, `council-critique`, `council-revise`, `council-rate`, `council-decide`.
A seat's identity (mandate, brief, tools, voice) is rendered into the stage prompt from
`backend/src/agents/council/seats.ts`, so ten seats do not mean seventy prompt files, and a prompt
change is still one new version file per stage.
