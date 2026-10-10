import { unstable_rethrow } from "next/navigation";

import { ArrivalChart } from "@/components/simulation/arrival-chart";
import { Chapter, Legend, Tile } from "@/components/simulation/chapter";
import { CHECKS } from "@/components/simulation/checks";
import { Contents, SCROLL_ID } from "@/components/simulation/contents";
import { DayChart } from "@/components/simulation/day-chart";
import { GuidelineTable } from "@/components/simulation/guideline-table";
import { IndexChart } from "@/components/simulation/index-chart";
import { Pipeline } from "@/components/simulation/pipeline";
import { ScoreTable } from "@/components/simulation/score-table";
import { SkillChart } from "@/components/simulation/skill-chart";
import { getAccuracy, getGuidelines, getSimulation } from "@/lib/api-client";
import type { Accuracy, GuidelineList } from "@/lib/api/haze-schemas";
import type { Simulation } from "@/lib/api/simulation-schemas";
import { formatWhen } from "@/lib/when";

/** How the simulation runs and the replay that shows it predicts, in numbered chapters. Every figure is worked out from the database on each visit. */

async function load(): Promise<{ simulation: Simulation; accuracy: Accuracy; lines: GuidelineList } | null> {
  try {
    const [simulation, accuracy, lines] = await Promise.all([getSimulation(), getAccuracy(), getGuidelines()]);
    return { simulation, accuracy, lines };
  } catch (error) {
    // Next signals "render this per request" by throwing; that is not a backend failure.
    unstable_rethrow(error);
    console.error("[simulation] the backend could not be read:", error);
    return null;
  }
}

const SOURCES = [
  { name: "Readings", href: "https://eqms.doe.gov.my/APIMS/main", detail: "DOE Malaysia, hourly" },
  { name: "Singapore readings", href: "https://www.haze.gov.sg/", detail: "NEA Singapore, hourly" },
  { name: "Visibility", href: "https://aviationweather.gov/data/api/", detail: "Airport reports (METARs), hourly" },
  { name: "Fires", href: "https://firms.modaps.eosdis.nasa.gov/", detail: "NASA FIRMS, every 3 hours" },
  { name: "Wind and rain", href: "https://open-meteo.com/", detail: "Open-Meteo, hourly" },
  { name: "Index table", href: "https://eqms.doe.gov.my/Documents/APIMS/API_Calculation.pdf", detail: "DOE, January 2025" },
];

const card = "rounded-lg border border-hairline bg-surface p-4";

export default async function SimulationPage() {
  const loaded = await load();
  const sim = loaded?.simulation;
  const lead = sim?.skill.find((row) => row.lead === sim.dayLead);
  const won = sim ? sim.days.filter((day) => day.model < day.persistence).length : 0;
  const checked = sim ? sim.skill.reduce((sum, row) => sum + row.cases, 0) : 0;
  const live = loaded?.accuracy.leads.some((row) => row.cases > 0) ?? false;

  return (
    <main className="flex min-w-0 grow flex-col">
      <div id={SCROLL_ID} className="min-h-0 grow overflow-y-auto px-6 pt-20 pb-8 md:px-10">
        <h1 className="font-display text-display text-ink">Simulation</h1>
        <p className="mt-1.5 max-w-[68ch] text-body text-ink-secondary">How the app simulates the smoke and forecasts each station, and the proof that it predicts.</p>
        {loaded === null ? <p className="mt-3 text-small text-fault">The backend could not be reached.</p> : null}

        <div className="mt-6 lg:grid lg:grid-cols-[200px_minmax(0,1fr)] lg:gap-10">
          <aside className="mb-4 lg:sticky lg:top-0 lg:mb-0 lg:self-start">
            <Contents />
          </aside>

          <div className="min-w-0 max-w-[900px]">
            <Chapter id="answer">
              {sim && lead ? (
                <div className="grid gap-3 sm:grid-cols-3">
                  <Tile figure={`${Math.round((100 * (lead.persistence - lead.model)) / lead.persistence)}% closer`} label={`than assuming no change, ${sim.dayLead} hours ahead, over ${lead.cases.toLocaleString("en-GB")} replayed forecasts.`} />
                  <Tile figure={`${won} of ${sim.days.length} days`} label={`the forecast beat no change ${sim.dayLead} hours ahead, each day on its own.`} />
                  <Tile figure={sim.run?.rankCorrelation?.toFixed(2) ?? "n/a"} label="rank correlation of simulated smoke with readings in the newest run." />
                </div>
              ) : null}
            </Chapter>

            <Chapter id="run">
              {sim?.run ? (
                <>
                  <p className="text-caption text-ink-tertiary">The run as of {formatWhen(sim.run.asOf)} UTC.</p>
                  <Pipeline run={sim.run} />
                </>
              ) : null}
            </Chapter>

            <Chapter id="number">
              {sim ? (
                <div className={card}>
                  <IndexChart histogram={sim.histogram} binWidth={sim.binWidth} />
                  <p className="mt-1 text-caption text-ink-tertiary">{sim.period.readings.toLocaleString("en-GB")} readings from {sim.period.stations} stations, by API value. A reading crosses 101 to 150 in an hour or two.</p>
                </div>
              ) : null}
            </Chapter>

            <Chapter id="proof">
              {sim ? (
                <div className="space-y-3">
                  <div className={card}>
                    <div className="text-small font-medium text-ink">How much closer than assuming no change, {checked.toLocaleString("en-GB")} forecasts</div>
                    <SkillChart rows={sim.skill} />
                    <p className="text-caption text-ink-tertiary">Whiskers are 90% intervals from resampling whole days; faded bars do not clear zero. Clearly ahead to 12 hours, level beyond a day.</p>
                  </div>
                  <div className={card}>
                    <div className="text-small font-medium text-ink">Day by day, {sim.dayLead} hours ahead</div>
                    <p className="text-caption text-ink-tertiary">Average miss: filled dot this forecast, ring no change.</p>
                    <DayChart days={sim.days} lead={sim.dayLead} />
                  </div>
                </div>
              ) : null}
            </Chapter>

            <Chapter id="cases">
              {sim ? (
                <>
                  <Legend />
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    {sim.arrivals.map((arrival) => (
                      <ArrivalChart key={arrival.stationId} arrival={arrival} />
                    ))}
                  </div>
                </>
              ) : null}
            </Chapter>

            <Chapter id="checks">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {CHECKS.map((check) => (
                  <div key={check.part} className={card}>
                    <div className="text-caption text-ink-tertiary">{check.part}</div>
                    <div className="mt-0.5 text-title font-medium text-ink">{check.headline}</div>
                    <p className="mt-1 text-small text-ink-secondary">{check.line}</p>
                  </div>
                ))}
              </div>
            </Chapter>

            <Chapter id="limits">
              <p className="max-w-[68ch] text-body text-ink-secondary">Beyond a day it is level with no change, and when a fall stops short it can overshoot. It adds most in the hours after haze arrives or clears.</p>
              <h3 className="mt-5 text-small font-medium text-ink">Live runs, checked as they come due</h3>
              {loaded && live ? (
                <div className="mt-2">
                  <ScoreTable rows={loaded.accuracy.leads} />
                  {loaded.accuracy.since ? <p className="mt-2 text-caption text-ink-tertiary">Forecasts since {formatWhen(loaded.accuracy.since)} UTC.</p> : null}
                </div>
              ) : (
                <p className="mt-1 text-small text-ink-secondary">Scored here once a day has passed since they were made.</p>
              )}
            </Chapter>

            <Chapter id="lines">
              {loaded ? <GuidelineTable guidelines={loaded.lines.guidelines} /> : null}
              <ul className="mt-6 space-y-2 text-body">
                {SOURCES.map((source) => (
                  <li key={source.name}>
                    <a href={source.href} target="_blank" rel="noreferrer" className="font-medium text-ink underline-offset-2 hover:text-accent hover:underline">
                      {source.name}
                    </a>
                    <span className="text-ink-secondary">, {source.detail}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-6 text-caption text-ink-tertiary">A student project, not an official DOE advisory.</p>
            </Chapter>
          </div>
        </div>
      </div>
    </main>
  );
}
