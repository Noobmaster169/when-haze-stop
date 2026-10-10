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
  { name: "Readings", href: "https://eqms.doe.gov.my/APIMS/main", detail: "Department of Environment Malaysia. The hourly Air Pollutant Index at 68 stations. Fetched every hour." },
  { name: "Fires", href: "https://firms.modaps.eosdis.nasa.gov/", detail: "NASA FIRMS. Fire detections from the VIIRS instrument on three satellites. Fetched every three hours." },
  { name: "Wind and rain", href: "https://open-meteo.com/", detail: "Open-Meteo. Hourly wind at 925 and 850 hPa and rain, on a one degree grid. Fetched every hour." },
  { name: "Coastlines and towns", href: "https://www.naturalearthdata.com/", detail: "Natural Earth, public domain." },
];

const LIMITS = [
  "The forecast is the latest reading plus part of the change the smoke model expects. When the air is steady it says little more than the reading does.",
  "DOE publishes the index only, not PM2.5 concentrations, so WHO limits cannot be applied to these readings.",
  "Fires hidden under cloud are missed by the satellites. Fires after the last full day are assumed to keep burning as they were.",
  "The chances are built from how wrong past forecasts were. With few past forecasts they are rough.",
  "A place without a station is given the reading of the nearest one, or a model estimate on the map.",
];

export default async function AccuracyPage() {
  const loaded = await load();
  const checked = loaded?.accuracy.leads.some((lead) => lead.cases > 0) ?? false;
  const section = "mt-10 text-title font-medium text-ink";
  const prose = "mt-2 max-w-[68ch] text-body text-ink-secondary";

  return (
    <main className="flex min-w-0 grow flex-col">
      <div className="min-h-0 grow overflow-y-auto px-6 py-8 md:px-10">
        <h1 className="font-display text-display text-ink">Track record</h1>
        <p className={prose}>
          Every forecast is checked against the reading DOE published when its hour arrived, and against the simplest forecast there is: that nothing changes. The number is the average miss in API points. Lower is better.
        </p>

        <h2 className={section}>Since this app started running</h2>
        {loaded === null ? <p className="mt-2 text-small text-fault">The backend could not be reached.</p> : null}
        {loaded && !checked ? <p className={prose}>No forecast has been checked yet. The first ones are checked a day after the hourly job starts.</p> : null}
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
          The model placed the smoke well: where it put more smoke, stations read higher, with a rank correlation of {FIRST_TEST.rankCorrelation} over {FIRST_TEST.stationHours.toLocaleString("en-GB")} station hours. As a forecast it
          was about as accurate as assuming no change, not better. Use it to see where smoke is heading and how sure that is, and check again closer to the day.
        </p>

        <h2 id="lines" className={section}>
          The official lines
        </h2>
        <p className={prose}>The map, the alerts and the assistant all use these. There is no national line for public events, and airports decide on visibility, which this app does not have.</p>
        <div className="mt-3">{loaded ? <GuidelineTable guidelines={loaded.lines.guidelines} /> : null}</div>

        <h2 className={section}>Where the data comes from</h2>
        <ul className="mt-3 max-w-[68ch] space-y-2 text-body">
          {SOURCES.map((source) => (
            <li key={source.name}>
              <a href={source.href} target="_blank" rel="noreferrer" className="font-medium text-ink underline-offset-2 hover:text-accent hover:underline">
                {source.name}
              </a>
              <span className="text-ink-secondary">. {source.detail}</span>
            </li>
          ))}
        </ul>

        <h2 className={section}>What this cannot do</h2>
        <ul className="mt-3 max-w-[68ch] list-disc space-y-1.5 pl-5 text-body text-ink-secondary marker:text-ink-faint">
          {LIMITS.map((limit) => (
            <li key={limit}>{limit}</li>
          ))}
        </ul>
        <p className="mt-6 max-w-[68ch] pb-6 text-caption text-ink-tertiary">A student project. It is not an official DOE product and does not replace official advisories.</p>
      </div>
    </main>
  );
}
