import { AlertsView } from "@/components/alerts/alerts-view";

export default function AlertsPage() {
  return (
    <main className="flex min-w-0 grow flex-col">
      <div className="min-h-0 grow overflow-y-auto px-6 pt-20 pb-8 md:px-10">
        <h1 className="font-display text-display text-ink">Alerts</h1>
        <p className="mt-2 max-w-[62ch] text-body text-ink-secondary">Be told when haze reaches an area you care about, when the forecast says it is on its way, and when it is expected to clear.</p>
        <div className="mt-8">
          <AlertsView />
        </div>
      </div>
    </main>
  );
}
