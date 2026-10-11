import { CityAir } from "./city-schemas";
import { BackendError, get } from "./transport";

/** A city's air, hour by hour. Null for a city the backend does not know. */
export async function getCityAir(key: string): Promise<CityAir | null> {
  try {
    return await get(CityAir, `/haze/cities/${encodeURIComponent(key)}`);
  } catch (error) {
    if (error instanceof BackendError && error.status === 404) return null;
    throw error;
  }
}
