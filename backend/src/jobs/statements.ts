import type { Pool } from "pg";

import type { LlmClient } from "../agents";
import { readStatement } from "../agents";
import { quoteFound } from "../haze/statement-text";
import { childLogger } from "../lib/logger";
import { statements } from "../repositories";
import type { StatementsClient } from "../sources";
import { tidyAreas } from "../services/statements";
import { recordFetch } from "./record-fetch";

/**
 * Fetch what each channel lists, and have the model read the items not read
 * before. A reading is kept whatever it says, so an item is never paid for
 * twice; only a statement whose quote is in the text is ever shown.
 */

const log = childLogger({ module: "jobs.statements" });

/** Per channel per cycle, newest first, so a first run catches up over a few hours instead of holding one cycle up. */
const READ_PER_CYCLE = 20;

export interface StatementDeps {
  pool: Pool;
  llm: LlmClient;
  channels: StatementsClient[];
}

async function ingestChannel(deps: StatementDeps, channel: StatementsClient): Promise<void> {
  await recordFetch(deps.pool, channel.channel, async () => {
    const listed = await channel.list();
    const known = await statements.knownUrls(deps.pool, listed.map((item) => item.url));
    const fresh = listed.filter((item) => !known.has(item.url));
    let found = 0;
    let unverified = 0;
    let failed = 0;

    for (const item of fresh.slice(0, READ_PER_CYCLE)) {
      try {
        const text = await channel.text(item);
        const { reading, promptVersion } = await readStatement({ llm: deps.llm, pool: deps.pool }, { ...item, text });
        const verified = reading.isStatement && quoteFound(reading.quote, `${item.title}\n${text}`);
        if (reading.isStatement && verified) found += 1;
        if (reading.isStatement && !verified) unverified += 1;
        await statements.insert(deps.pool, { ...item, ...tidyAreas(reading), verified, promptVersion });
      } catch (error) {
        // One unreadable item is skipped and asked again next cycle; the rest of the channel still goes in.
        failed += 1;
        log.warn({ url: item.url, err: error instanceof Error ? error.message : String(error) }, "a statement could not be read");
      }
    }
    log.info({ channel: channel.channel, listed: listed.length, fresh: fresh.length, found, unverified, failed }, "statements read");
    return { listed: listed.length, new: fresh.length, read: Math.min(fresh.length, READ_PER_CYCLE) - failed, statements: found, unverified, failed };
  });
}

export async function ingestStatements(deps: StatementDeps): Promise<void> {
  for (const channel of deps.channels) {
    try {
      await ingestChannel(deps, channel);
    } catch (error) {
      log.error({ channel: channel.channel, err: error instanceof Error ? error.message : String(error) }, "a statement channel failed");
    }
  }
}
