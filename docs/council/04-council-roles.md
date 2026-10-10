# Who sits at the table

A Chair, six members and a Red Cell (eight agents since the simplification of 10 October 2026),
named by office and never by the person who holds it. The council's words are
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

## The seats (simplified on 10 October 2026)

The user simplified the council: Indonesia is assumed to let every Malaysian aircraft and crew
work wherever they are needed, so diplomacy drops out, and only the most relevant seats remain.
Foreign Affairs, Sarawak and Health were removed; Force Command and Domestic Fire became one Fire
Operations seat. Eight agents:

| Seat | Mandate | Private brief | Tools | Premise when drafting |
| --- | --- | --- | --- | --- |
| **Chair**, National Disaster Management Committee | Runs the meeting, freezes the criteria, decides by the rule; never proposes | What the Committee will be asked; the working assumption on Indonesia | `get_complexes`, `get_target_air` | none |
| **Air Quality**, NRES / DOE | Lower the haze over KL and protect the people breathing it | School closures, the target's outlook, the most any plan could clear | complexes, influence, feasibility, simulate, `get_target_air` | Clear the most smoke from KL inside the budget |
| **Meteorology**, MetMalaysia | Where the smoke goes and how sure that is | The inter-monsoon, how the wind patterns disagree | complexes, influence, feasibility, simulate, `get_wind_outlook` | Hold up in every wind pattern |
| **Peat Science**, university peat research | What can be put out and what relights | The model under-weights smouldering peat; night burning marks deep peat | complexes, influence, feasibility, simulate | Commit only to fires that can be finished, from the edge |
| **Fire Operations**, Bomba with NADMA operations | Ground crews at home and abroad: put fires out and keep them out | Bomba's numbers, the task force's three-day airlift, rest and water | complexes, influence, feasibility, simulate, `get_logistics` | Ground crews first, where they can finish the job |
| **Air Operations**, APMM and TUDM | What can fly where and where it helps | The 2015 Palembang record, the scoop run, smoke grounding aircraft | complexes, influence, feasibility, simulate, `get_logistics` | Aircraft only where they really work |
| **Treasury**, Ministry of Finance | Keep inside the money and spend each ringgit where it clears most smoke | Daily costs: aircraft by far the dearest | complexes, influence, feasibility, simulate, `get_costs` | The most smoke cleared per ringgit |
| **Red Cell**, fire and weather | Find how each plan fails | Judged on the failure that matters most | complexes, influence, `stress_plan` | none (pre-mortem only) |

Plus the Engine (the smoke model) at the centre of the table. Six seats draft; each plan is
questioned by three seats other than its author, and the Red Cell runs one pre-mortem over the
shortlist. Feasibility is rated by Fire Operations, Air Operations and Peat Science, cost by
Treasury; a plan rated below 3 of 10 on feasibility cannot win while another clears it. After the
decision every member says whether it stands behind it.

The table below this note in earlier versions of this file, with twelve agents, is in git history.

## Models

Seats run on `sonnet`. The Chair and the Red Cell run on `opus`, because the Chair's verdict and
the Red Cell's attack are the two places a weak model would hurt most. Different models for
different seats is itself a source of the heterogeneity that makes debate work (ReConcile,
`research/04`).

## Voice

Each seat's prompt carries a two-line voice note (how this office talks: Bomba is terse and
operational, Wisma Putra careful and conditional, the scientist hedged and specific). It is there
so the replay reads like a meeting, and is never allowed to stand in for evidence.
