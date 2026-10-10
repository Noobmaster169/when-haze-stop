/** What each of the three series looks like, shared by every station chart and named in the same words as the tooltips. */
export function SeriesLegend() {
  return (
    <div className="flex flex-wrap gap-4 text-caption text-ink-secondary">
      <span className="flex items-center gap-1.5">
        <span className="inline-block h-0.5 w-5 bg-series-real" />
        Real next-day peak
      </span>
      <span className="flex items-center gap-1.5">
        <span className="relative inline-flex h-3 w-5 items-center">
          <span className="absolute inset-0 rounded-xs bg-series-model opacity-20" />
          <span className="relative h-0.5 w-5 bg-series-model" />
        </span>
        Model, with its 10 to 90 band
      </span>
      <span className="flex items-center gap-1.5">
        <span className="inline-block w-5 border-t-2 border-dashed border-series-same" />
        No change
      </span>
    </div>
  );
}
