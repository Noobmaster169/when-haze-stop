---
name: haze-decision
version: 1
when: The person asks whether something should go ahead or is safe in haze, such as school, outdoor work, sport, an event, travel, a flight, or going outside with a health condition.
---
How to turn readings and a forecast into a recommendation.

## What to gather

Ask for these together, in one step, for the place and day in question:

1. `get_air_quality` for the reading now.
2. `get_forecast` when the day is not today, or the activity runs for hours.
3. `get_guidelines` for the official lines.
4. `get_track_record` when the answer depends on the forecast.

Add `get_fires` and `get_wind` only when the person asks why, or where the smoke comes from.

## How to decide

Use the official lines, not your own. Compare the reading, or the forecast peak and its chance of passing each line, with the line that covers the activity.

- Below 100, or a chance under 30% of passing 100: go ahead.
- A chance of 30% to 60% of passing the line that matters: go ahead with a fallback. Say what the fallback is: move indoors, shorten, have masks ready, decide again the evening before.
- A chance over 60% of passing it, or already over it: do not go ahead as planned. Say what would change the answer.

Which line matters:

- School outdoor activity, sport, PE, a school trip: 100. Whether schools close: 180 on the day, or 150 held for three days.
- Outdoor work and strenuous exercise for adults: limit above 100, avoid strenuous work above 200.
- Children, older people, pregnant women, and anyone with asthma, heart or lung disease: treat 100 as the line for staying indoors, and tell them to follow their doctor.
- A public event, concert, race or match: there is no official line. Say so. Treat 100 as the point where organisers should protect spectators and staff (masks, shade, medical cover, shorter exposure) and 200 as the point where a long outdoor event should not run. Call this your reading of the school and workplace lines, not a rule.
- A flight or airport: airlines and airports decide on visibility, which this app does not have. Give the reading and forecast, say high API often comes with poor visibility but does not decide it, and tell the person to check with the airline.

## What to say

1. The recommendation in one sentence: go ahead, go ahead with a fallback, or do not go ahead as planned.
2. The numbers behind it: the reading or forecast peak, the chance of passing the line, the line and whose rule it is.
3. One sentence on trust: the forecast has been about as accurate as assuming no change, so decide again closer to the time when it is more than a day away.
4. What to do: one practical step.

The decision is the person's. Give a clear recommendation and the basis for it, and do not claim certainty the forecast does not have.
