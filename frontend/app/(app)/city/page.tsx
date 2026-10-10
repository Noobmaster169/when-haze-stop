import { CityView } from "@/components/city/city-view";

/** Kuala Lumpur in 3D, under the haze of any hour in the week and the forecast. */
export default function CityPage() {
  return (
    <main className="flex min-w-0 grow flex-col">
      <CityView />
    </main>
  );
}
