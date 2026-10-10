import { TopBar } from "@/components/shell/top-bar";

/** The placeholder home page. Replace it; keep the column and the top bar. */
export default function HomePage() {
  return (
    <main className="flex min-w-0 grow flex-col">
      <TopBar crumbs={[{ label: "Home" }]} />
      <div className="min-h-0 grow overflow-y-auto px-6 py-10 md:px-10">
        <h1 className="font-display text-display text-ink">Start here</h1>
        <p className="mt-3 max-w-[60ch] text-body text-ink-secondary">
          This page is a placeholder. The assistant on the right is live: it streams its answer, calls the tools in{" "}
          <code className="rounded-xs bg-sunken px-1 font-mono text-mono-sm">backend/src/agents/chat/tools</code> and keeps every conversation.
        </p>
        <ul className="mt-6 max-w-[60ch] list-disc space-y-1.5 pl-5 text-body text-ink-secondary marker:text-ink-faint">
          <li>Add a page under app/(app)/ and a line in components/shell/nav.ts.</li>
          <li>Add a tool as one file beside get-time.ts and register it in tools/index.ts.</li>
          <li>Add a skill as a folder with a SKILL.md under agents/chat/skills/.</li>
          <li>Rebrand in app/globals.css: every colour and size is a token there.</li>
        </ul>
      </div>
    </main>
  );
}
