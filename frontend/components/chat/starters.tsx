/** What to ask, shown before the first question: one of each kind the assistant answers. */

const STARTERS = [
  "How is the air in Shah Alam right now?",
  "Will schools in Seremban close tomorrow?",
  "Should an outdoor event in Sepang go ahead this Sunday?",
  "Where is the smoke over Klang coming from?",
  "Alert me when haze is heading for Petaling Jaya",
];

export function Starters({ onAsk }: { onAsk(question: string): void }) {
  return (
    <div>
      <p className="text-small leading-[19px] text-ink-tertiary">Ask about haze anywhere in Malaysia. Answers come from the readings, fires, wind and forecast on the map, and name their sources.</p>
      <ul className="mt-3 space-y-1.5">
        {STARTERS.map((question) => (
          <li key={question}>
            <button
              type="button"
              onClick={() => onAsk(question)}
              className="w-full rounded-md border border-hairline px-3 py-2 text-left text-small text-ink-secondary transition-colors duration-150 hover:border-hairline-strong hover:bg-active hover:text-ink"
            >
              {question}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
