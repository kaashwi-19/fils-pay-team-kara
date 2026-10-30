/**
 * The long-running consumer must drain a backlog bigger than one batch
 * without waiting for the poll interval. Requires DATABASE_URL to point at a
 * real, migrated Postgres.
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { Pool } from "pg";
import { startReportingConsumer } from "./listener.js";
import type { ReportingConfig } from "../config.js";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("listener.test.ts requires DATABASE_URL");
}

test("a backlog larger than one batch drains without waiting for the poll interval", async () => {
  const pool = new Pool({ connectionString: databaseUrl, max: 5 });
  const merchant = await pool.query<{ id: string }>(
    `INSERT INTO merchants (display_name, mdr_bps) VALUES ($1, 250) RETURNING id`,
    [`listener test ${randomUUID()}`],
  );
  const merchantId = merchant.rows[0]!.id;
  const total = 1200;
  // Start the shared cursor just behind this test's events, so unrelated
  // rows left by other tests can't hold it up.
  await pool.query(
    `INSERT INTO reporting_outbox_cursor (consumer_name, last_processed_id, last_txid)
     SELECT 'reporting', COALESCE(max(id), 0), COALESCE(max(txid), '0'::xid8) FROM outbox_events
     ON CONFLICT (consumer_name) DO UPDATE
       SET last_processed_id = EXCLUDED.last_processed_id, last_txid = EXCLUDED.last_txid`,
  );
  await pool.query(
    `INSERT INTO outbox_events (event_type, aggregate_type, aggregate_id, payload)
     SELECT 'transaction.voided', 'transaction', gen_random_uuid(), jsonb_build_object('merchantId', $1::text)
       FROM generate_series(1, $2)`,
    [merchantId, total],
  );

  const config = {
    databaseUrl,
    consumerBatchLimit: 500,
    reportingPollIntervalMs: 600_000, // never fires during this test
  } as ReportingConfig;
  const handle = startReportingConsumer(pool, config);
  let voided = 0;
  try {
    for (let i = 0; i < 50 && voided < total; i++) {
      await new Promise((r) => setTimeout(r, 200));
      const res = await pool.query<{ n: string }>(
        `SELECT COALESCE(sum(voided_count), 0)::text AS n FROM merchant_daily_volume WHERE merchant_id = $1`,
        [merchantId],
      );
      voided = Number(res.rows[0]!.n);
    }
  } finally {
    await handle.stop();
    await pool.end();
  }
  assert.equal(voided, total, "every event in the backlog should be applied without waiting for a poll");
});
