import { HazeMapView } from "@/components/map/haze-map";
import { TopBar } from "@/components/shell/top-bar";

/**
 * The haze map. `?station=<id>` opens it on one station, which is how an
 * alert and an answer from the assistant point at a place.
 */
export default async function MapPage({ searchParams }: PageProps<"/map">) {
  const { station } = await searchParams;
  const initial = typeof station === "string" && /^[A-Za-z0-9]{2,40}$/.test(station) ? station : null;
  return (
    <main className="flex min-w-0 grow flex-col">
      <TopBar crumbs={[{ label: "Map" }]} />
      <HazeMapView key={initial ?? "none"} initialStation={initial} />
    </main>
  );
}
