# The event log

A council run is long (tens of model calls, ten to twenty minutes) and is run rarely, maybe
once. Everything the page shows is replayed from an append-only log the run writes as it goes.
The page never needs the run to be live; a live run is the same replay with the tail still
arriving.

## Tables (one forward-only migration)

```sql
create table council_runs (
  id           bigserial primary key,
  target       text not null,                -- 'klang-valley'
  as_of        timestamptz not null,         -- the hour of data the council reasoned over
  status       text not null,                -- running | done | failed
  package      jsonb not null,               -- the assistance package assumed (03-assistance-package.md)
  verdict      jsonb,                        -- the final verdict, null until done
  started_at   timestamptz not null default now(),
  finished_at  timestamptz
);

create table council_events (
  run_id   bigint not null references council_runs(id),
  seq      integer not null,                 -- 0, 1, 2 ... in the order they happened
  at       timestamptz not null,
  kind     text not null,
  actor    text not null,                    -- an agent id, 'engine' or 'system'
  payload  jsonb not null,
  primary key (run_id, seq)
);
```

Never trimmed, never overwritten (data rules). Model calls are still rows in `llm_calls`; an
event that came from a model call carries its `llm_call_id` so the ledger and the replay join.

## Event kinds

Every event has `seq`, `at`, `kind`, `actor`. The payload by kind:

| kind | payload | On the page |
| --- | --- | --- |
| `run_started` | target, asOf, package summary | The objective card: "Clear the haze over KL and surroundings" |
| `stage` | `{ stage, title }` | The stage rail moves; a caption names the stage |
| `agent_joined` | `{ id, role, title, institution, colour }` | A node bursts in |
| `thinking` | `{ about, summary }` (summary is the agent's own one-line gist) | A soft pulse ring on the node; the gist in the side transcript |
| `tool_call` | `{ callId, tool, args, preview }` | A small satellite node buds off the agent |
| `tool_result` | `{ callId, ok, preview }` | The satellite flashes and is absorbed back |
| `subagent` | not built | Decided against: a seat's lookups already appear as small nodes budding off it (tool calls), which is what the brief asks for; separate helper agents would add model calls and noise without new information. `agent_joined` keeps a `parent` field should they be added |
| `message` | `{ id, to: [agentId], act, text, refs }` | A pulse travels along the edge from sender to each recipient |
| `candidate` | `{ planId, by, title, targets: [complexId], rationale }` | A plan card appears in the plan tray |
| `simulation` | `{ planId, scenario, measures }` | The engine node lights; the plan card gets its numbers |
| `vote` | `{ planId, score, conditions }` | A tick on the plan card from that agent |
| `verdict` | the verdict object | The graph settles; the verdict panel slides up |
| `run_finished` / `run_failed` | duration, calls, cost / error | |

`act` on a message is one of: `brief`, `propose`, `challenge`, `support`, `concede`, `revise`,
`question`, `answer`, `dissent`. It colours the pulse and lets the page filter "show only
challenges", which is how a person follows the argument instead of the noise.

## Why events are coarse

One model call writes one structured answer. The run turns that answer into a handful of events
(a `thinking` gist, the tool calls it asked for, the messages it sent). Token-level streaming is
not recorded: the replay is for following the argument, and a page that types out 40 calls'
worth of text is noise. The full text of every message is in the payload, shown on click.

## Replay timing

Recorded `at` gaps are compressed for playback: model latency (often 20 to 60 seconds) is cut to
a fixed beat, so the meeting plays in about two to three minutes at 1x, with 0.5x, 2x and 4x, a
scrubber, and jump-to-stage. The player is a pure function from `(events, t)` to the scene, so
scrubbing backwards is as cheap as forwards.
