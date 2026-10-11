import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { gunzipSync } from "node:zlib";
import { Client } from "pg";

import { SEED_TABLES } from "./seed-tables.mjs";

const SEED_DIR = join(dirname(fileURLToPath(import.meta.url)), "seed");
const BATCH_ROWS = 5000;

function required(name) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set`);
  return value;
}

/**
 * Loads the shared data in db/seed/ into the database, after the migrations.
 *
 * A file is loaded once: its hash is recorded, and it is loaded again only
 * when someone commits a newer export. Nothing is deleted or replaced, so it
 * is safe on a database that already holds its own fetches.
 */
export async function seed({ log = console.log } = {}) {
  const client = new Client({
    host: required("PG_HOST"),
    port: Number(process.env.PG_PORT ?? "5432"),
    database: required("PG_DATABASE"),
    user: required("PG_USER"),
    password: required("PG_PASSWORD"),
  });
  await client.connect();
  try {
    await client.query(`
      create table if not exists seed_files (
        filename   text primary key,
        sha256     text not null,
        rows       int not null,
        applied_at timestamptz not null default now()
      )
    `);
    const { rows: done } = await client.query("select filename, sha256 from seed_files");
    const applied = new Map(done.map((row) => [row.filename, row.sha256]));

    for (const table of SEED_TABLES) {
      let packed;
      try {
        packed = await readFile(join(SEED_DIR, table.file));
      } catch (error) {
        if (error.code !== "ENOENT") throw error;
        log(`No ${table.file}, skipped.`);
        continue;
      }
      const sha256 = createHash("sha256").update(packed).digest("hex");
      if (applied.get(table.file) === sha256) continue;

      const lines = gunzipSync(packed).toString("utf8").split("\n").filter((line) => line !== "");
      await client.query("begin");
      try {
        for (let start = 0; start < lines.length; start += BATCH_ROWS) {
          const columns = table.columns.map(() => []);
          for (const line of lines.slice(start, start + BATCH_ROWS)) {
            line.split("\t").forEach((cell, index) => columns[index].push(cell === "" ? null : cell));
          }
          await client.query(table.load, columns);
        }
        await client.query(
          `insert into seed_files (filename, sha256, rows) values ($1, $2, $3)
           on conflict (filename) do update set sha256 = excluded.sha256, rows = excluded.rows, applied_at = now()`,
          [table.file, sha256, lines.length],
        );
        await client.query("commit");
        log(`Seeded ${table.file}: ${lines.length} rows`);
      } catch (error) {
        await client.query("rollback");
        throw new Error(`Seeding ${table.file} failed: ${error.message}`, { cause: error });
      }
    }
  } finally {
    await client.end();
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  seed().catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
}
