import { Code } from "./prose";
import { Label, Row, Table, Text } from "./table";

/**
 * The 108 inputs by group, names as the trained artifact spells them
 * (scores.json, importance). peak_hour is built but dropped by the training
 * filter, so Air state counts 12.
 */

interface Group {
  group: string;
  count: number;
  names: string;
  how: string;
}

const GROUPS: Group[] = [
  {
    group: "Air state",
    count: 12,
    names: "level, lag24..72, d24, d48, slope3h, peak24, near50, near150, hist_mean, hist_std",
    how: "Own 24 h mean now and before, neighbours, 30 day spread",
  },
  {
    group: "Fires by direction",
    count: 75,
    names: "fire_s{0..7}_r{0..2}_d{1,3,7}, fire_total_d3, fire_total_change, fire_heaviest_bearing",
    how: "Fire power in 8 sectors by 3 rings over 1, 3, 7 days",
  },
  {
    group: "Physics",
    count: 5,
    names: "smoke_now, smoke_24h, smoke_48h, smoke_change, has_physics",
    how: "The transport model's smoke within 50 km",
  },
  {
    group: "Weather, next 48 h",
    count: 11,
    names: "u24, v24, u48, v48, steady24, steady48, rain24, rain48, along_fire24, ...",
    how: "Wind, its steadiness, rain, wind from the fires",
  },
  {
    group: "Calendar",
    count: 4,
    names: "doy_sin, doy_cos, month, sw_monsoon",
    how: "Season; ablation says it does not help",
  },
  {
    group: "Identity",
    count: 1,
    names: "kind_code",
    how: "Which kind of instrument",
  },
];

export function InputsTable() {
  return (
    <Table head={["Group", "Inputs", "What it carries"]} textFrom={1} wide>
      {GROUPS.map((group) => (
        <Row key={group.group}>
          <Label>
            <span className="whitespace-nowrap text-ink">{group.group}</span>
            <span className="block font-mono text-mono-xs text-ink-tertiary">{group.count}</span>
          </Label>
          <Text>
            <span className="block min-w-[200px] max-w-[340px]">
              <Code>{group.names}</Code>
            </span>
          </Text>
          <Text>
            <span className="block min-w-[180px]">{group.how}</span>
          </Text>
        </Row>
      ))}
    </Table>
  );
}
