import { Tile } from "@/components/simulation/chapter";
import type { ForecastSource } from "@/lib/api/haze-schemas";
import type { ModelSkill } from "@/lib/api/simulation-schemas";
import { formatWhen } from "@/lib/when";

/** The three figures at the top of the live record: the backtest, the live score, and where the rule stands. */

const miss = (value: number | null): string => (value === null ? "none yet" : value.toFixed(1));

function backtestTile(source: ForecastSource) {
  const backtest = source.record.backtest;
  if (!backtest) {
    return { figure: "not reachable", label: "The backtest figure comes from the model service, which gave none for the forecast showing." };
  }
  return {
    figure: miss(backtest.model),
    label: `hazy-day miss a day ahead in the backtest, against ${miss(backtest.persistence)} assuming no change and ${miss(backtest.v2)} for the hourly forecast.`,
  };
}

function liveTile(skill: ModelSkill, nextCheckAt: string | null) {
  const dayAhead = skill.leads.find((lead) => lead.network === "doe" && lead.leadDays === 1);
  const days = `${skill.shadowDays} ${skill.shadowDays === 1 ? "day" : "days"} checked`;
  const record = dayAhead && dayAhead.cases > 0 ? `Day-ahead miss so far: model ${miss(dayAhead.model)}, hourly forecast ${miss(dayAhead.v2)}, no change ${miss(dayAhead.persistence)}.` : "No forecast has come due yet.";
  const next = nextCheckAt ? ` Next check ${formatWhen(nextCheckAt)} UTC.` : "";
  return { figure: days, label: `${record}${next}` };
}

function statusWords(source: ForecastSource, skill: ModelSkill): string {
  if (skill.mode === "off") return "Off";
  if (skill.mode === "shadow") return "In shadow";
  if (source.kind === "hourly") return "Live, hourly showing";
  return source.trial ? "Live, on trial" : "Live";
}

function statusTile(source: ForecastSource, skill: ModelSkill) {
  const needed = `${Math.round(skill.gainRequired * 100)}% needed`;
  const gain = skill.gain === null ? `no gain measured yet, ${needed}` : `gain ${Math.round(skill.gain * 100)}% against ${needed}`;
  const rule = `Rule: ${skill.shadowDays} of ${skill.shadowDaysRequired} days scored, ${gain}.`;
  const label = skill.mode === "off" ? "Nothing a person sees comes from a learned model." : `${rule} ${skill.passed ? "Both conditions hold." : "The rule has not passed."}`;
  return { figure: statusWords(source, skill), label };
}

export function LiveTiles({ source, skill, nextCheckAt }: { source: ForecastSource; skill: ModelSkill; nextCheckAt: string | null }) {
  const tiles = [backtestTile(source), liveTile(skill, nextCheckAt), statusTile(source, skill)];
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      {tiles.map((tile) => (
        <Tile key={tile.figure + tile.label} figure={tile.figure} label={tile.label} />
      ))}
    </div>
  );
}
