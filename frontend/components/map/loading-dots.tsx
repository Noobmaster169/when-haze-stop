/** Three dots that pulse in turn while something is on its way. Still, and still readable, under reduced motion. */
export function LoadingDots({ label }: { label: string }) {
  return (
    <span role="status" aria-label={label} className="inline-flex items-center gap-[3px]">
      {[0, 160, 320].map((delay) => (
        <span key={delay} className="size-1 rounded-full bg-current motion-safe:animate-[dot_1s_ease-in-out_infinite]" style={{ animationDelay: `${delay}ms` }} />
      ))}
    </span>
  );
}
