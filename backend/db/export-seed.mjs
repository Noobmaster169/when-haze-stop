import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";
import { Client } from "pg";

import { SEED_TABLES } from "./seed-tables.mjs";

const SEED_DIR = join(dirname(fileURLToPath(import.meta.url)), "seed");

function required(name) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set`);
  return value;
}

/**
 * Writes this database's shared tables to db/seed/, to be committed. Run it
 * from the machine that has been fetching the longest: its readings reach
 * furthest back, and nobody can fetch those again.
 */
async function exportSeed() {
  const client = new Client({
    host: required("PG_HOST"),
    port: Number(process.env.PG_PORT ?? "5432"),
    database: required("PG_DATABASE"),
    user: required("PG_USER"),
    password: required("PG_PASSWORD"),
  });
  await client.connect();
  try {
    await mkdir(SEED_DIR, { recursive: true });
    for (const table of SEED_TABLES) {
      const { rows } = await client.query({ text: table.select, rowMode: "array" });
      const text = rows.map((row) => row.map((cell) => (cell === null ? "" : String(cell))).join("\t")).join("\n");
      // No timestamp in the gzip header, so the same rows always make the same file and the same hash.
      await writeFile(join(SEED_DIR, table.file), gzipSync(`${text}\n`, { level: 9 }));
      console.log(`Wrote ${table.file}: ${rows.length} rows`);
    }
  } finally {
    await client.end();
  }
}

exportSeed().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
