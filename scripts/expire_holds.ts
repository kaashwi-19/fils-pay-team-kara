#!/usr/bin/env -S npx tsx
/**
 * Nightly janitor: a hold that's never captured or released just sits in
 * the table past its expires_at forever — nothing else in the platform
 * ever deletes a holds row (authorize.ts inserts one, capture.ts/void.ts
 * release one; nothing sweeps one). Run once a night from cron/the host's
 * own scheduler.
 *
 * Usage: DATABASE_URL=postgres://... npx tsx scripts/expire_holds.ts
 */
import { pathToFileURL } from "node:url";
import { Client } from "pg";
/**
 * Expires abandoned holds: one UPDATE flipping status 'active' -> 'expired'
 * for holds past expires_at. Holds are never deleted (HANDOVER).
 *
 * The old version selected the expired ids and then ran
 * DELETE FROM holds WHERE id = ANY(ids) through buildDelete — and buildWhere
 * silently dropped an empty array, so a run with nothing expired issued a
 * bare `DELETE FROM holds` and wiped every hold, active ones included. The
 * SELECT-then-DELETE also raced a capture landing in between.
 */
export const EXPIRE_HOLDS_SQL = `UPDATE holds SET status = 'expired'
  WHERE status = 'active' AND expires_at < now()`;

export async function expireHolds(client: Client): Promise<number> {
  const result = await client.query(EXPIRE_HOLDS_SQL);
  return result.rowCount ?? 0;
}

async function main(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("expire_holds: DATABASE_URL environment variable is not set");
  }

  const client = new Client({ connectionString: databaseUrl });
  await client.connect();
  try {
    const expired = await expireHolds(client);
    console.log(`expire_holds: marked ${expired} abandoned hold(s) as expired (nothing deleted)`);
  } finally {
    await client.end();
  }
}

const isMainModule = process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMainModule) {
  main().catch((err: unknown) => {
    console.error(err);
    process.exitCode = 1;
  });
}
