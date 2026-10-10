import { captionFor } from "./forecast-words";
import type { MapData } from "./map-data";

/** Under the map while it shows a moment ahead: whose forecast the frames are, when it was issued, how it has done. Nothing at or before the newest reading. */
export function ForecastCaption({ data, at }: { data: MapData; at: number }) {
  const text = captionFor(at, data.asOf, data.source, data.learnedFrom);
  if (text === "") return null;
  return <p className="shrink-0 border-t border-hairline bg-canvas px-4 py-1.5 text-caption text-ink-secondary md:px-6">{text}</p>;
}
