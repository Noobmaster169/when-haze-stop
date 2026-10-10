/**
 * The forecast as a picture, read left to right: four outside sources and the
 * app's own smoke model feed one learned model, which gives tomorrow's peak.
 * Below it, the two yardsticks every chart compares with, both built from
 * today's reading alone. Drawn in a fixed frame that scrolls sideways on a
 * phone, so the arrows never re-flow into nonsense.
 */

const WIDTH = 804;
const HEIGHT = 372;
const BUS = 458;

const INPUTS = [
  { y: 8, title: "DOE readings", detail: "68 stations, hourly API index" },
  { y: 64, title: "Singapore NEA", detail: "5 regions, hourly PM2.5" },
  { y: 120, title: "NASA fire detections", detail: "every 3 hours, by direction and distance" },
  { y: 176, title: "Open-Meteo wind and rain", detail: "next 48 h" },
];
const BOX_H = 44;

function Box({ x, y, w, h, title, detail, stroke = "var(--hairline-strong)", fill = "var(--surface)" }: { x: number; y: number; w: number; h: number; title: string; detail?: string; stroke?: string; fill?: string }) {
  const middle = y + h / 2;
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} rx="6" fill={fill} stroke={stroke} strokeWidth="1.25" />
      <text x={x + 12} y={detail ? middle - 3 : middle + 4} fontSize="12" fontWeight="500" fill="var(--ink)">
        {title}
      </text>
      {detail ? (
        <text x={x + 12} y={middle + 12} fontSize="10.5" fill="var(--ink-secondary)">
          {detail}
        </text>
      ) : null}
    </g>
  );
}

function Arrow({ d }: { d: string }) {
  return <path d={d} fill="none" stroke="var(--ink-tertiary)" strokeWidth="1.25" markerEnd="url(#flow-head)" />;
}

export function DataFlow() {
  const centre = (y: number): number => y + BOX_H / 2;
  return (
    <figure className="m-0">
      <div className="overflow-x-auto">
        <svg className="min-w-[760px]" viewBox={`0 0 ${WIDTH} ${HEIGHT}`} width="100%" role="img" aria-label="Four data sources and the app's smoke model feed the learned model, which forecasts tomorrow's peak; the two yardsticks come from today's reading">
          <defs>
            <marker id="flow-head" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
              <path d="M0,0 L8,4 L0,8 z" fill="var(--ink-tertiary)" />
            </marker>
          </defs>

          {INPUTS.map((input) => (
            <g key={input.title}>
              <path d={`M250,${centre(input.y)} H${BUS}`} fill="none" stroke="var(--ink-tertiary)" strokeWidth="1.25" />
              <Box x={2} y={input.y} w={248} h={BOX_H} title={input.title} detail={input.detail} />
            </g>
          ))}
          <path d={`M${BUS},${centre(8)} V${centre(176)}`} fill="none" stroke="var(--ink-tertiary)" strokeWidth="1.25" />

          <Arrow d={`M300,${centre(120)} V148`} />
          <Arrow d={`M300,${centre(176)} V194`} />
          <Box x={276} y={150} w={160} h={42} title="The app's smoke" detail="transport model" fill="var(--surface-sunken)" />
          <path d={`M436,171 H${BUS}`} fill="none" stroke="var(--ink-tertiary)" strokeWidth="1.25" />

          <Arrow d={`M${BUS},121 H480`} />
          <Box x={482} y={91} w={150} h={60} title="Learned model" detail="600 trees" stroke="var(--series-model)" fill="var(--canvas)" />
          <Arrow d="M632,121 H654" />
          <Box x={656} y={91} w={146} h={60} title="Tomorrow's peak" detail="with a 10 to 90 band" stroke="var(--series-model)" fill="var(--canvas)" />

          <line x1="2" x2={WIDTH - 2} y1="240" y2="240" stroke="var(--hairline)" />
          <text x="2" y="262" fontSize="10.5" fill="var(--ink-tertiary)">
            {"The two yardsticks, from today's reading alone"}
          </text>
          <Box x={2} y={276} w={248} h={92} title="Today's reading" detail="the 24 h mean at 08:00" />
          <Arrow d="M250,298 H480" />
          <Arrow d="M250,346 H480" />
          <Box x={482} y={276} w={320} h={44} title="No change" detail="tomorrow's peak = today's peak" stroke="var(--series-same)" />
          <Box x={482} y={324} w={320} h={44} title="Hourly forecast, the app's before this model" detail="today's 3 h trend, faded over the coming days" />
        </svg>
      </div>
      <figcaption className="mt-2 text-caption text-ink-tertiary">One forecast a day at 08:00, per instrument.</figcaption>
    </figure>
  );
}
