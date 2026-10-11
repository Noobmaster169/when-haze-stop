import { SourceFetchPage, SourceReport } from "./source-schemas";
import { get } from "./transport";

/** Every data source and when it was last fetched. */
export async function getSources(): Promise<SourceReport> {
  return get(SourceReport, "/sources");
}

/** One page of a source's fetches, newest first. */
export async function getSourceFetches(source: string, page: number): Promise<SourceFetchPage> {
  return get(SourceFetchPage, `/sources/fetches?source=${encodeURIComponent(source)}&page=${page}`);
}
