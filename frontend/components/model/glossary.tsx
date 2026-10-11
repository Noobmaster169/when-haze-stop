import { Label, Row, Table, Text } from "./table";

/** Every word the later charts lean on, defined once, in the order a reader meets them. */

export const GLOSSARY: readonly { term: string; meaning: string }[] = [
  { term: "PM2.5", meaning: "Fine particles in the air, in micrograms per cubic metre (µg/m³); what smoke adds." },
  { term: "24 h mean", meaning: "DOE's index is a 24 hour running average, so one hour moves it by one twenty-fourth." },
  { term: "API", meaning: "Malaysia's Air Pollutant Index, the published number: a fixed table from the 24 h mean. 50.4 µg/m³ is 100, 55.4 is 150, 150.4 is 200." },
  { term: "The lines", meaning: "100: outdoor activity stops at schools. 150 for three days: schools close. 200: avoid strenuous outdoor work." },
  { term: "Instrument", meaning: "A DOE station, a Singapore region, or a corrected low-cost sensor; 102 in the test." },
  { term: "Station-day", meaning: "One instrument on one issue day, forecast at 08:00 Malaysian time." },
  { term: "Next-day peak", meaning: "The highest 24 h mean during tomorrow; the number each forecast is judged on." },
  { term: "Within 20 µg/m³", meaning: "A miss of at most 20, roughly one index band in the haze range." },
  { term: "Big move", meaning: "The real peak moved by 15 µg/m³ or more from today's." },
  { term: "Crossing 150", meaning: "Tomorrow's real peak at or above API 150, the school-closure line." },
  { term: "No change", meaning: "The yardstick: tomorrow's peak equals today's peak, what someone with no model would assume." },
  { term: "Hourly forecast", meaning: "The app's forecast before this model: today's 3 hour trend carried forward and faded; as good as no change beyond 12 hours." },
  { term: "Test months", meaning: "August to October 2026, the 2026 haze season, never seen in training." },
];

export function Glossary() {
  return (
    <Table head={["Term", "Meaning"]} textFrom={1} wide>
      {GLOSSARY.map((entry) => (
        <Row key={entry.term}>
          <Label>
            <span className="whitespace-nowrap text-ink">{entry.term}</span>
          </Label>
          <Text>{entry.meaning}</Text>
        </Row>
      ))}
    </Table>
  );
}
