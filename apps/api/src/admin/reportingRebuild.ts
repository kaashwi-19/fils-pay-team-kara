import type { PoolClient } from "pg";

/** Counts of outbox_events replayed into each rollup table. */
export interface RebuildAnalyticsSummary {
  volumeRows: number;
  trendRows: number;
  /** Events the reporting worker will replay to rebuild the rollups. */
  eventsToReplay: number;
}

/** Truncates and repopulates the two rollup tables
 *  (merchant_daily_volume, merchant_payout_trends) from source. */
export async function refreshAnalyticsRollups(client: PoolClient): Promise<RebuildAnalyticsSummary> {
  // The route promises "truncates the rollups and replays the outbox from the
  // start" — the same single path as apps/reporting's CLI rebuild ("anything
  // that fills these tables from somewhere else is a second implementation,
  // and it will drift"). This used to refill them straight from the source
  // tables instead, and it did drift: refund counts and totals were wiped to
  // zero, days were bucketed by a different timestamp, and open batches
  // appeared in payout trends. Now it clears the rollups and rewinds the
  // reporting worker's watermark in one transaction; the worker replays every
  // event through its normal code path. (The cursor row is locked by the
  // worker for each pass, so the reset and a running pass take turns.)
  await client.query(
    `INSERT INTO reporting_outbox_cursor (consumer_name, last_processed_id, last_txid, updated_at)
     VALUES ('reporting', 0, '0', now())
     ON CONFLICT (consumer_name) DO UPDATE SET last_processed_id = 0, last_txid = '0', updated_at = now()`,
  );
  await client.query(`TRUNCATE merchant_daily_volume`);
  await client.query(`TRUNCATE merchant_payout_trends`);
  const outbox = await client.query<{ n: string }>(
    `SELECT COUNT(*)::text AS n FROM outbox_events
      WHERE event_type IN ('transaction.captured', 'transaction.voided', 'settlement.batch_closed', 'refund.succeeded')`,
  );
  return { volumeRows: 0, trendRows: 0, eventsToReplay: Number(outbox.rows[0]?.n ?? 0) };
}
