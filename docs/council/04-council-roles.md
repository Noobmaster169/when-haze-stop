# Who sits at the table

Ten seats, named by office and never by the person who holds it. The council's words are
simulated; putting them in a real minister's mouth would invent what a real person said, which
the project's real-data rule forbids. The page says "role-played by AI" under the council.

## Why roles at all

The deliberation research (`research/04-deliberation-design.md`, section 1) is blunt: a persona
label alone changes nothing about accuracy, and a council of identical agents who read each
other's drafts mostly converges on whoever spoke first. Debate helps when the agents differ in
what they know, what tools they have and what they are trying to achieve, and when disputes are
settled by evidence the judge can check. So each seat is defined by four things, and the persona
voice is the least of them:

1. **Mandate**: what this office is answerable for, which is what it optimises.
2. **Private brief**: data only this seat is handed at the start (the hidden profile).
3. **Tools**: what it can look up itself.
4. **Natural conflict**: where its mandate pulls against another seat's.

## The seats

| Seat | Mandate | Private brief | Tools | Pulls against |
| --- | --- | --- | --- | --- |
| **Chair**, National Disaster Management Committee (NADMA secretariat) | Runs the meeting, freezes the criteria before any plan exists, decides. Speaks last, never proposes. | The package, the political guidance, the budget | none beyond the shared board | Everyone; must resist visible-action-for-its-own-sake |
| **Air Quality**, NRES / DOE | Lower the API over the Klang Valley | DOE readings and the forecast for the target stations, the ceiling (all fires out) | `get_target_air`, `get_influence` | Health on whose exposure counts; Sarawak on which region matters |
| **Meteorology**, MetMalaysia | Say where smoke goes and how sure that is | The wind for the horizon and its ensemble spread, the influence matrix by scenario | `get_influence`, `get_wind_outlook` | Anyone treating one wind forecast as fact |
| **Peat Science**, a university tropical peat scientist | Physical realism about what can be put out and what relights | Fire persistence history (days burning of the last 30), the peat map, burn depth guidance | `get_fire_history`, `get_peat`, `load_skill` | Air Ops (water bombing barely touches deep peat); the model (fire power under-weights smouldering peat) |
| **Force Command**, NADMA operations | Use the deployed force safely and well | The force: crews, hours, staging, rotation | `check_feasibility`, `get_logistics` | Scattered "show" sorties; anyone over-committing crews |
| **Air Operations**, APMM and TUDM | Aircraft: what can fly where, how often | Scoop-water sources within range, sortie rates (2015 Palembang precedent), clearance lead times | `get_logistics`, `check_feasibility` | Targets far from scoopable water, whatever their smoke value |
| **Domestic Fire**, Bomba (JBPM) | Fires on Malaysian soil | Peninsular fires, Bomba peat teams, response times | `get_complexes` filtered to Malaysia, `check_feasibility` | The assumption that the answer is all in Indonesia |
| **Foreign Affairs**, Wisma Putra | Indonesian consent, ASEAN framing, no appearance of interference | Where help has been accepted (the September 2026 acceptance), sensitivities (concession ownership, 2019 rebuttal) | `get_consent` | High-value targets that are politically unworkable; may veto only by citing a hard constraint |
| **Health**, KKM | Fewer people breathing unhealthy air, protect the vulnerable | Population per target station area, the school and health lines | `get_target_air`, `get_guidelines` | Air Quality's mean-PM2.5 framing (exposure is people times hours over a line) |
| **Treasury**, MOF | Value for money | Cost per flight hour, per crew-day | `get_costs` | Marginal sorties with little benefit |
| **Sarawak**, State Disaster Management Committee | Sarawak's air, which took the worst API this year | Sarawak stations and forecast | `get_target_air` for Sarawak | A KL-only objective; it is the authentic dissenter the research recommends over an assigned devil's advocate |

Plus two non-speaking nodes on the graph:

- **The Engine** (the smoke model through `06-engine-seam.md`): every simulation request goes to
  it and every score comes from it. It is drawn at the centre of the table.
- **The Red Cell: fire and weather.** One more agent, but not a ministry. Its mandate is the
  adversary's: find how each plan fails, by wind shift, re-ignition, cloud hiding fires, or
  smoke already in the air. It does the pre-mortem. Unlike a devil's advocate told to disagree,
  it has its own tool (`stress_plan`, which re-scores a plan under the pessimistic scenario and
  under each wind member) so its objections arrive with numbers.

## Who proposes, who critiques

- Proposers (draft a plan independently): Air Quality, Meteorology, Peat Science, Force Command,
  Air Operations, Domestic Fire, Health, Sarawak. Eight independent drafts.
- Critics only: Foreign Affairs, Treasury, Red Cell. Their objections are constraints, not plans.
- The Chair neither proposes nor critiques. It sets the criteria and decides by the rule.

## Models

Seats run on `sonnet`. The Chair and the Red Cell run on `opus`, because the Chair's verdict and
the Red Cell's attack are the two places a weak model would hurt most. Different models for
different seats is itself a source of the heterogeneity that makes debate work (ReConcile,
`research/04`).

## Voice

Each seat's prompt carries a two-line voice note (how this office talks: Bomba is terse and
operational, Wisma Putra careful and conditional, the scientist hedged and specific). It is there
so the replay reads like a meeting, and is never allowed to stand in for evidence.
