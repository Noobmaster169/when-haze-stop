/**
 * Every reading in the period, counted in bins of API, coloured by DOE's own
 * band colours. The hole between 101 and 150 is DOE's table at work: that
 * band spans only 50.5 to 55.4 ug/m3 of PM2.5, so readings rush through it.
 */

const WIDTH = 640;
const HEIGHT = 190;
const LEFT = 40;
const RIGHT = 12;
const TOP = 26;
const BOTTOM = 26;
const MAX_API = 250;

function bandColour(api: number): string {
  if (api <= 50) return "var(--api-0)";
  if (api <= 100) return "var(--api-50)";
  if (api <= 150) return "var(--api-100)";
  if (api <= 200) return "var(--api-150)";
  return "var(--api-200)";
}

export function IndexChart({ histogram, binWidth }: { histogram: { api: number; count: number }[]; binWidth: number }) {
  const bins = histogram.filter((bin) => bin.api < MAX_API);
  if (bins.length === 0) return null;
  const top = Math.max(...bins.map((bin) => bin.count));
  const x = (api: number): number => LEFT + (api / MAX_API) * (WIDTH - LEFT - RIGHT);
  const y = (count: number): number => TOP + (1 - count / top) * (HEIGHT - TOP - BOTTOM);
  const barWidth = x(binWidth) - x(0) - 2;

  return (
    <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} width="100%" role="img" aria-label="How many readings fell at each API value this period">
      <rect x={x(100)} y={TOP - 18} width={x(150) - x(100)} height={HEIGHT - BOTTOM - TOP + 18} fill="var(--surface-sunken)" />
      <text x={(x(100) + x(150)) / 2} y={TOP - 6} textAnchor="middle" fontSize="10.5" fill="var(--ink-secondary)">
        101 to 150 = 50.5 to 55.4 µg/m³
      </text>
      <line x1={LEFT} x2={WIDTH - RIGHT} y1={y(0)} y2={y(0)} stroke="var(--hairline-strong)" />
      {bins.map((bin) => (
        <rect key={bin.api} x={x(bin.api) + 1} y={y(bin.count)} width={barWidth} height={Math.max(0, y(0) - y(bin.count))} rx="2" fill={bandColour(bin.api + binWidth / 2)}>
          <title>{`API ${bin.api} to ${bin.api + binWidth - 1}: ${bin.count.toLocaleString("en-GB")} readings`}</title>
        </rect>
      ))}
      {[0, 50, 100, 150, 200, 250].map((api) => (
        <text key={api} x={x(api)} y={HEIGHT - 8} textAnchor="middle" fontSize="10" fill="var(--ink-tertiary)">
          {api}
        </text>
      ))}
      <text x={LEFT - 6} y={y(top) + 3.5} textAnchor="end" fontSize="10" fill="var(--ink-faint)">
        {top}
      </text>
      <text x={LEFT - 6} y={y(0) + 3.5} textAnchor="end" fontSize="10" fill="var(--ink-faint)">
        0
      </text>
    </svg>
  );
}
