/** What the map page says in place of the map: that it could not load, or that there is nothing to draw yet. */
export function Notice({ title, body }: { title: string; body: string }) {
  return (
    <div className="flex grow items-center justify-center px-6">
      <div className="max-w-[46ch] text-center">
        <p className="font-display text-[21px] text-ink">{title}</p>
        <p className="mt-2 text-body text-ink-secondary">{body}</p>
      </div>
    </div>
  );
}
