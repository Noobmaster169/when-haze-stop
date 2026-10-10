import type { ChatToolCall } from "@/lib/api/chat-schemas";

/**
 * Where the answer's facts came from, at a glance: one chip a source, each
 * linking to the publisher. The detail of every call stays one click down in
 * `ToolsUsed`.
 */

const HOME: Record<string, { href: string; title: string }> = {
  DOE: { href: "https://eqms.doe.gov.my/APIMS/main", title: "Department of Environment Malaysia, hourly Air Pollutant Index" },
  "NASA FIRMS": { href: "https://firms.modaps.eosdis.nasa.gov/", title: "NASA FIRMS, VIIRS satellite fire detections" },
  "Open-Meteo": { href: "https://open-meteo.com/", title: "Open-Meteo, wind and rain forecast" },
  METAR: { href: "https://aviationweather.gov/data/api/", title: "Airport weather reports (METARs) from NOAA's Aviation Weather Center" },
  "NEA Singapore": { href: "https://www.haze.gov.sg/", title: "National Environment Agency Singapore, hourly PM2.5 and PSI by region" },
  "Haze model": { href: "/simulation", title: "How the simulation runs, and the backtest that shows it predicts" },
  "Ministry guidance": { href: "/simulation#lines", title: "Thresholds published by the Ministries of Education and Health" },
};

export function Sources({ calls }: { calls: ChatToolCall[] }) {
  const names = [...new Set(calls.filter((call) => call.ok && call.source).map((call) => call.source as string))];
  if (names.length === 0) return null;
  return (
    <p className="flex flex-wrap items-center gap-1.5 text-caption text-ink-tertiary">
      <span>Sources</span>
      {names.map((name) => {
        const home = HOME[name];
        const chip = "inline-flex h-[22px] items-center rounded-full border border-hairline-strong px-2 text-caption text-ink-secondary";
        if (!home) {
          return (
            <span key={name} className={chip}>
              {name}
            </span>
          );
        }
        const outside = home.href.startsWith("http");
        return (
          <a key={name} href={home.href} title={home.title} target={outside ? "_blank" : undefined} rel={outside ? "noreferrer" : undefined} className={`${chip} hover:border-accent-line hover:text-accent`}>
            {name}
          </a>
        );
      })}
    </p>
  );
}
