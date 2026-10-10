import { Icon, type IconName } from "@/components/ui/icons";
import type { Place, PlaceKind } from "@/lib/api/haze-schemas";

/** One search result: what kind of place, its name with the typed part in bold, where it is, and whose readings it gets. */

const KIND: Record<PlaceKind, { icon: IconName; label: string }> = {
  station: { icon: "pin", label: "DOE station" },
  state: { icon: "map", label: "State" },
  district: { icon: "map", label: "District" },
  town: { icon: "home", label: "Town" },
  place: { icon: "search", label: "Place" },
};

function Name({ name, query }: { name: string; query: string }) {
  const at = name.toLowerCase().indexOf(query.trim().toLowerCase());
  if (at < 0 || !query.trim()) return <>{name}</>;
  const end = at + query.trim().length;
  return (
    <>
      {name.slice(0, at)}
      <strong className="font-semibold">{name.slice(at, end)}</strong>
      {name.slice(end)}
    </>
  );
}

export function PlaceRow({ place, query, active }: { place: Place; query: string; active: boolean }) {
  const kind = KIND[place.kind];
  const where = [place.region, place.country === "Malaysia" ? "" : place.country].filter(Boolean).join(", ");
  return (
    <span className={`flex items-center gap-3 px-3 py-2 ${active ? "bg-active" : ""}`}>
      <span className={`flex size-7 shrink-0 items-center justify-center rounded-full ${place.kind === "station" ? "bg-accent-tint text-accent" : "bg-sunken text-ink-tertiary"}`}>
        <Icon name={kind.icon} size={14} />
      </span>
      <span className="min-w-0 grow">
        <span className="block truncate text-strong text-ink">
          <Name name={place.name} query={query} />
        </span>
        <span className="block truncate text-caption text-ink-tertiary">
          {kind.label}
          {where ? `, ${where}` : ""}
        </span>
      </span>
      {place.nearest && place.nearest.km > 0 ? (
        <span className="shrink-0 text-right text-caption text-ink-tertiary">
          {place.nearest.km} km
          <span className="block text-micro">to {place.nearest.name}</span>
        </span>
      ) : null}
    </span>
  );
}
