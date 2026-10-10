# The page

One page, three states: before a run, the replay, the verdict. It replaces the Simulation page
in the nav (the backtest it shows today moves to a "How the engine was checked" link at the
foot, since the verdict rests on it). It is built at `/council` first and the nav is switched in
one small commit at the end, so nothing collides with the teammate's work on the engine.

## Before a run

```
+---------------------------------------------------------------------------------+
|  Suppression Council                                                            |
|  Which fires should Malaysia's help put out first?                              |
|                                                                                 |
|  Clear the haze over   [ Kuala Lumpur and surroundings  v ]   (others: later)   |
|                                                                                 |
|  With:  2 amphibious water bombers . 4 helicopters . 240 firefighters           |
|         . 10 days . from 11 Oct                         (what this rests on ->)  |
|                                                                                 |
|                         [  Convene the council  ]                               |
|                                                                                 |
|  Last run: 10 Oct, 14:20 MYT . 38 calls . 14 min       [ Replay ]  [ Verdict ]  |
+---------------------------------------------------------------------------------+
```

The target selector shows only KL and surroundings enabled, the others listed and disabled, so
the scope is obvious. Pressing the button starts the run and switches to the replay, following
the live tail.

## The replay

```
+--------------------------------------------------------------+------------------+
| OBJECTIVE  Clear the haze over KL and surroundings            | NOW              |
| Stage 3 of 6: Cross-examination                               | Bomba Ops ->     |
|                                                               | Peat Scientist   |
|                 ( Chair )                                     | CHALLENGE        |
|        ( Wisma Putra )      ( MetMalaysia )                   | "Two crews do    |
|                                                               |  not hold 3,000  |
|   ( Treasury )      [ ENGINE ]       ( Peat Sci ) o tool      |  ha of deep peat |
|                                         ^                     |  ..."            |
|        ( Health )               ( Bomba Ops ) .               |                  |
|                 ( Red Team )      ( Air Ops )                 | PLANS            |
|                                                               | A  Kalteng first |
|                                                               | B  Home + Kalteng|
|                                                               | C  Perimeter     |
+--------------------------------------------------------------+------------------+
| > ||  1x   |--Brief--|--Analyse--|--Propose--|==Challenge==|--Simulate--|--Decide--| |
+---------------------------------------------------------------------------------+
```

### The graph

- **Agents are nodes on a loose ring**, the council table, the chair at the top, the engine at the
  centre as the table itself. Nodes float: each drifts on a slow, small sinusoid plus a soft
  spring to its seat, so the scene breathes without wandering.
- **Joining is a burst.** A node scales in on a spring with a single soft ring that expands and
  fades, and its name settles under it.
- **Thinking is a breathing halo** on the node, slow, in the agent's colour.
- **A tool call buds a small satellite** off the agent on a short tether, with a smaller burst;
  it pulses while the tool runs, flashes on the result and is absorbed back. A sub-agent is the
  same with a label and a short orbit.
- **A message is a pulse that travels** along a curved edge from sender to each recipient,
  coloured by its act (propose, challenge, support, concede...). When it lands, the recipient's
  node gives a small nudge.
- **Past messages leave faint threads** whose width grows with the number of exchanges between
  the pair. After a while the graph shows who argued with whom.
- **Focus, not noise.** Only the event being played is bright; agents not in it dim to 40%. At
  most two pulses are in flight at once; the rest queue. One caption line under the objective
  says in plain words what is happening ("Bomba Operations challenges the Peat Scientist's
  plan").
- **The engine node lights** when a plan is simulated, and a thin line runs from it to the plan
  card in the tray.

### The side rail

The current speaker, the act and the message text, then the plan tray: each candidate plan as a
card, gaining its simulated numbers and the agents' ticks as the replay reaches them. A filter
shows only challenges and concessions, which is how a person reads the argument in a minute.

### The player

Play, pause, speed (0.5x, 1x, 2x, 4x), a scrubber with stage markers, and click-a-stage to jump.
Model latency is compressed to a fixed beat, so a fifteen-minute meeting plays in two to three
minutes at 1x. The scene is a pure function of `(events, t)`; scrubbing back costs the same as
forward. Keyboard: space, arrows, number keys for stages. Reduced-motion users get the same
replay with fades in place of bursts and travel.

## The verdict

Reached at the end of the replay, or directly from "Verdict". Concise, in reading order:

1. **The answer, in three lines**, one per track (`05-protocol.md`):
   - Act now: "Bomba takes the two Johor fires today; the CL-415 and helicopters hold the young
     fires on the West Kalimantan border, which matter to Sarawak more than to KL."
   - Ask: "Request Indonesia's agreement to move the package and a 150-strong ground task force to
     the Jambi peat belt (Muaro Jambi): worth 3 to 13 times the Kalimantan deployment for KL."
   - Share: "Give BNPB this ranking: the Jambi belt complexes cause about half of KL's coming smoke."
   The example is spike 2's shape; the words are the Chair's.
2. **Before and after.** The map of the target area at the moment the benefit peaks, without and
   with the plan, side by side with a slider, using the map's own colours and index. The struck
   complexes are numbered in the order they are attacked.
3. **The strike list.** One row per complex: order, place, peat share, what is sent, from when
   to when, whether it waits on a request, and the share of KL's coming smoke it removes.
4. **Why this plan.** Three to five sentences of reasoning, then one small chart: the chosen plan
   against "biggest fires first", "nearest fires first" and the ceiling (every fire out), in ug/m3
   removed and hours above API 100 avoided, central with the optimistic to pessimistic range.
5. **What could go wrong.** The red team's strongest objection that was not resolved, any dissent,
   and the caveats (horizon, peat under-weighting, assumptions in the package).

Every number on the verdict comes from the engine or the stored data. The package and the
suppression rates are assumptions; each is marked as one and links to what it rests on.
