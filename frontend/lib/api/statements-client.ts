import { StatementPage } from "./statement-schemas";
import { get } from "./transport";

/** What the government has said about the haze, five to a page: only what is in force or coming, or everything. */
export async function getStatements(options: { current: boolean; page: number }): Promise<StatementPage> {
  return get(StatementPage, `/statements?status=${options.current ? "current" : "all"}&page=${options.page}`);
}
