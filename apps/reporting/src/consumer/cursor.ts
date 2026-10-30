import type { QueryableClient } from "@filspay/events";

/**
 * reporting_outbox_cursor read/advance — this consumer's own watermark,
 * never a reuse of outbox_events.processed_at.
 */
export interface ConsumerCursor {
  /** Transaction id (xid8, as text) of the last processed event. */
  lastTxid: string;
  lastProcessedId: bigint;
}

/**
 * last_processed_id is BIGINT; pg returns it as a string, hence the union.
 */
interface CursorRow {
  last_txid: string;
  last_processed_id: string | number;
}

/**
 * Seeds the row on first ever run (INSERT ... ON CONFLICT DO NOTHING),
 * then reads it. Never throws on a missing row — a worker's first pass
 * against a fresh database always starts from 0.
 */
// FOR UPDATE: the `running` flag in listener.ts only guards one process. A
// second process (a catch-up run beside the live worker) read the same
// watermark and applied the same events twice. The row lock makes passes
// across processes take turns, as the header of runConsumerPass promises.
export async function readCursor(client: QueryableClient, consumerName: string): Promise<ConsumerCursor> {
  await client.query(
    `INSERT INTO reporting_outbox_cursor (consumer_name, last_processed_id)
     VALUES ($1, 0)
     ON CONFLICT (consumer_name) DO NOTHING`,
    [consumerName],
  );

  const result = (await client.query(
    `SELECT last_txid::text AS last_txid, last_processed_id FROM reporting_outbox_cursor WHERE consumer_name = $1 FOR UPDATE`,
    [consumerName],
  )) as { rows: CursorRow[] };

  const row = result.rows[0];
  return row
    ? { lastTxid: row.last_txid, lastProcessedId: BigInt(row.last_processed_id) }
    : { lastTxid: "0", lastProcessedId: 0n };
}

// YA: absolute SET is fine, only one writer.
export async function advanceCursor(
  client: QueryableClient,
  consumerName: string,
  newLastProcessedId: bigint,
  newLastTxid?: string,
): Promise<void> {
  await client.query(
    `UPDATE reporting_outbox_cursor
        SET last_processed_id = $2, last_txid = COALESCE($3::xid8, last_txid), updated_at = now()
      WHERE consumer_name = $1`,
    [consumerName, newLastProcessedId.toString(), newLastTxid ?? null],
  );
}

/** Resets this consumer's watermark to 0 — used only by the `rebuild`
 *  subcommand (cli/rebuild.ts) before replaying the entire outbox history. */
// MK: rebuild only. never call from the worker.
export async function resetCursor(client: QueryableClient, consumerName: string): Promise<void> {
  await client.query(
    `INSERT INTO reporting_outbox_cursor (consumer_name, last_processed_id, last_txid, updated_at)
     VALUES ($1, 0, '0', now())
     ON CONFLICT (consumer_name) DO UPDATE SET last_processed_id = 0, last_txid = '0', updated_at = now()`,
    [consumerName],
  );
}
