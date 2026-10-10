import { Accuracy, GuidelineList, HazeMap, PlaceList, StationOutlook } from "./haze-schemas";
import { BackendError, get } from "./transport";

/** The map carries a week of frames, a few megabytes, and the backend reads them in one query. */
const MAP_TIMEOUT_MS = 30_000;

export async function getHazeMap(): Promise<HazeMap> {
  return get(HazeMap, "/haze/map", { timeoutMs: MAP_TIMEOUT_MS });
}

/** Null for a station the backend does not know, so the page can say so rather than fail. */
export async function getStationOutlook(id: string): Promise<StationOutlook | null> {
  try {
    return await get(StationOutlook, `/haze/stations/${encodeURIComponent(id)}`);
  } catch (error) {
    if (error instanceof BackendError && (error.status === 404 || error.status === 400)) return null;
    throw error;
  }
}

export async function getAccuracy(): Promise<Accuracy> {
  return get(Accuracy, "/haze/accuracy");
}

export async function getGuidelines(): Promise<GuidelineList> {
  return get(GuidelineList, "/haze/guidelines");
}

/** Stations and the bundled gazetteer answer at once; `remote` also asks the geocoder, which takes seconds. */
export async function findPlaces(query: string, remote = false): Promise<PlaceList> {
  return get(PlaceList, `/haze/places?q=${encodeURIComponent(query)}${remote ? "&remote=1" : ""}`);
}
