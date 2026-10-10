import { Code } from "./prose";
import { Label, Row, Table, Text } from "./table";

/**
 * The 108 inputs by group: what each group's names are and how each is
 * computed from data known at 08:00. The names are the trained artifact's own
 * (scores.json, importance). peak_hour is built but the training filter that
 * drops the peak_ targets drops it too, so Air state counts 12.
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
    names: "level, lag24, lag48, lag72, d24, d48, slope3h, peak24, near50, near150, hist_mean, hist_std",
    how: "The instrument's own 24 h mean now and 1, 2, 3 days ago; the differences; the 3 h slope; the peak of the last 24 h; the mean of other instruments within 50 and 150 km; the instrument's mean and spread over the previous 30 days.",
  },
  {
    group: "Fires by direction",
    count: 75,
    names: "fire_s{0..7}_r{0..2}_d{1,3,7}, fire_total_d3, fire_total_change, fire_heaviest_bearing",
    how: "Every screened NASA fire cell is placed in one of 8 compass sectors (45 degrees each, sector 0 is north to north-east) and one of 3 distance rings (0 to 300, 300 to 800, 800 to 1500 km) relative to the instrument. Each input is the sum of fire power (MW) in one sector and ring over the last 1, 3 or 7 complete days. Plus the regional total, its 3 day change, and the bearing of the heaviest sector.",
  },
  {
    group: "Physics",
    count: 5,
    names: "smoke_now, smoke_24h, smoke_48h, smoke_change, has_physics",
    how: "The app's existing transport model run with the same inputs: particles released from every fire cell, carried by the 925 and 850 hPa wind, decaying and rained out, summed within 50 km of the instrument as a 24 h trailing mean. This is where direction and wind are physically combined.",
  },
  {
    group: "Weather, next 48 h",
    count: 11,
    names: "u24, v24, u48, v48, steady24, steady48, rain24, rain48, along_fire24, hours_present, from_forecast",
    how: "Mean wind east and north components at the instrument's grid point over the next 24 and 48 h; steadiness (vector mean over scalar mean); rain totals; and the wind component blowing from the heaviest fire sector toward the instrument.",
  },
  { group: "Calendar", count: 4, names: "doy_sin, doy_cos, month, sw_monsoon", how: "Day of year on a circle, the month, a May to September flag. Ablation shows this group does not help." },
  { group: "Identity", count: 1, names: "kind_code", how: "Which kind of instrument this is, so one model serves 189 instruments." },
];

export function InputsTable() {
  return (
    <Table head={["Group", "Inputs", "How it is computed"]} textFrom={1} wide>
      {GROUPS.map((group) => (
        <Row key={group.group}>
          <Label>
            <span className="whitespace-nowrap text-ink">{group.group}</span>
            <span className="block font-mono text-mono-xs text-ink-tertiary">{group.count} inputs</span>
          </Label>
          <Text>
            <span className="block min-w-[180px] max-w-[260px]">
              <Code>{group.names}</Code>
            </span>
          </Text>
          <Text>
            <span className="block min-w-[260px]">{group.how}</span>
          </Text>
        </Row>
      ))}
    </Table>
  );
}

/** The total the heading names, summed so the table and the number cannot disagree. */
export const INPUT_COUNT = GROUPS.reduce((sum, group) => sum + group.count, 0);
