import { SourceReport } from "./source-schemas";
import { get } from "./transport";

/** Every data source, when it was last fetched, and the newest fetches. */
export async function getSources(): Promise<SourceReport> {
  return get(SourceReport, "/sources");
}
