import { unstable_rethrow } from "next/navigation";

import { FIRST_TEST } from "@/components/accuracy/first-test";
import { GuidelineTable } from "@/components/accuracy/guideline-table";
import { ScoreTable } from "@/components/accuracy/score-table";
import { getAccuracy, getGuidelines } from "@/lib/api-client";
import type { Accuracy, GuidelineList } from "@/lib/api/haze-schemas";
import { formatWhen } from "@/lib/when";

/** How far to trust the forecast, the lines it is measured against, and where every number comes from. */

async function load(): Promise<{ accuracy: Accuracy; lines: GuidelineList } | null> {
  try {
    const [accuracy, lines] = await Promise.all([getAccuracy(), getGuidelines()]);
    return { accuracy, lines };
  } catch (error) {
    // Next signals "render this per request" by throwing; that is not a backend failure.
    unstable_rethrow(error);
    console.error("[accuracy] the backend could not be read:", error);
    return null;
  }
}

const SOURCES = [
  { name: "Readings", href: "https://eqms.doe.gov.my/APIMS/main", detail: "DOE Malaysia, hourly" },
  { name: "Fires", href: "https://firms.modaps.eosdis.nasa.gov/", detail: "NASA FIRMS, every 3 hours" },
  { name: "Wind and rain", href: "https://open-meteo.com/", detail: "Open-Meteo, hourly" },
  { name: "Coastlines and towns", href: "https://www.naturalearthdata.com/", detail: "Natural Earth" },
];

const LIMITS = [
  "When the air is steady, the forecast adds little to the latest reading.",
  "DOE publishes the index, not PM2.5, so WHO limits do not apply.",
  "Fires under cloud are missed.",
  "Chances stay rough until more forecasts are checked.",
  "A place without a station takes the nearest one, or the model.",
];

export default async function AccuracyPage() {
  const loaded = await load();
  const checked = loaded?.accuracy.leads.some((lead) => lead.cases > 0) ?? false;
  const section = "mt-10 text-title font-medium text-ink";
  const prose = "mt-2 max-w-[68ch] text-body text-ink-secondary";

  return (
    <main className="flex min-w-0 grow flex-col">
      <div className="min-h-0 grow overflow-y-auto px-6 pt-20 pb-8 md:px-10">
        <h1 className="font-display text-display text-ink">Track record</h1>
        <p className={prose}>Average miss in API points, against the reading that came in and against assuming no change. Lower is better.</p>

        <h2 className={section}>Since this app started running</h2>
        {loaded === null ? <p className="mt-2 text-small text-fault">The backend could not be reached.</p> : null}
        {loaded && !checked ? <p className={prose}>Nothing checked yet. The first checks come a day after the job starts.</p> : null}
        {loaded && checked ? (
          <div className="mt-3">
            <ScoreTable rows={loaded.accuracy.leads} />
            {loaded.accuracy.since ? <p className="mt-2 text-caption text-ink-tertiary">Forecasts made since {formatWhen(loaded.accuracy.since)} UTC.</p> : null}
          </div>
        ) : null}

        <h2 className={section}>The first test, {FIRST_TEST.period}</h2>
        <div className="mt-3">
          <ScoreTable rows={FIRST_TEST.leads} />
        </div>
        <p className={prose}>
          It placed the smoke well (rank correlation {FIRST_TEST.rankCorrelation}), but forecast no better than assuming no change.
        </p>

        <h2 id="lines" className={section}>
          The official lines
        </h2>
        <p className={prose}>Used by the map, the alerts and the assistant.</p>
        <div className="mt-3">{loaded ? <GuidelineTable guidelines={loaded.lines.guidelines} /> : null}</div>

        <h2 className={section}>Where the data comes from</h2>
        <ul className="mt-3 max-w-[68ch] space-y-2 text-body">
          {SOURCES.map((source) => (
            <li key={source.name}>
              <a href={source.href} target="_blank" rel="noreferrer" className="font-medium text-ink underline-offset-2 hover:text-accent hover:underline">
                {source.name}
              </a>
              <span className="text-ink-secondary"> · {source.detail}</span>
            </li>
          ))}
        </ul>

        <h2 className={section}>What this cannot do</h2>
        <ul className="mt-3 max-w-[68ch] list-disc space-y-1.5 pl-5 text-body text-ink-secondary marker:text-ink-faint">
          {LIMITS.map((limit) => (
            <li key={limit}>{limit}</li>
          ))}
        </ul>
        <p className="mt-6 max-w-[68ch] pb-6 text-caption text-ink-tertiary">A student project, not an official DOE advisory.</p>
      </div>
    </main>
  );
}
