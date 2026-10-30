import type { Pool } from "pg";
import { formatBhd, toFils } from "@filspay/money";
import type { TransactionRow } from "./serialize.js";

export interface TransactionsExportFilters {
  merchantId: string;
  from?: Date;
  to?: Date;
  status?: string[];
}

function csvEscape(value: string): string {
  // A cell starting with = + - @ (or a tab/CR) is run as a formula when the
  // file is opened in Excel or Sheets. The reference is free text from the
  // merchant's integration, so neutralise it with a leading apostrophe.
  if (/^[=+\-@\t\r]/.test(value)) {
    value = `'${value}`;
  }
  if (value.includes(",") || value.includes('"') || value.includes("\n") || value.includes("\r")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function toCsvRow(row: TransactionRow): string {
  return [
    row.id,
    row.status,
    formatBhd(toFils(Number(row.amount_fils))),
    formatBhd(toFils(Number(row.captured_fils))),
    csvEscape(row.reference ?? ""),
    row.occurred_at.toISOString(),
  ].join(",");
}

const HEADER = "id,status,amount_bhd,captured_bhd,reference,occurred_at";

/**
 * Yields the CSV for `GET /v1/transactions/export` one page at a time, so a
 * merchant with a very large history never has every row in memory at once
 * (the old builder loaded all of them and built one giant string; on a
 * 2 GB server that is a crash waiting for a big export). Keyset pages on
 * (occurred_at as Postgres prints it, id): the old unused streamer paged on a
 * millisecond Date alone and skipped rows that shared a timestamp.
 */
export async function* transactionsExportCsvChunks(
  pool: Pool,
  filters: TransactionsExportFilters,
  pageSize = 1000,
): AsyncGenerator<string> {
  yield HEADER;
  const statusArray = filters.status && filters.status.length > 0 ? filters.status : null;
  let cursor: { at: string; id: string } | null = null;
  for (;;) {
    const result: { rows: Array<TransactionRow & { occurred_at_text: string }> } = await pool.query(
      `SELECT *, occurred_at::text AS occurred_at_text FROM transactions
        WHERE merchant_id = $1
          AND ($2::timestamptz IS NULL OR occurred_at >= $2)
          AND ($3::timestamptz IS NULL OR occurred_at <  $3)
          AND ($4::text[] IS NULL OR status = ANY($4))
          AND ($5::timestamptz IS NULL OR (occurred_at, id) > ($5::timestamptz, $6::uuid))
        ORDER BY occurred_at ASC, id ASC
        LIMIT $7`,
      [filters.merchantId, filters.from ?? null, filters.to ?? null, statusArray, cursor?.at ?? null, cursor?.id ?? null, pageSize],
    );
    if (result.rows.length > 0) {
      yield "\n" + result.rows.map(toCsvRow).join("\n");
    }
    if (result.rows.length < pageSize) return;
    const last = result.rows[result.rows.length - 1]!;
    cursor = { at: last.occurred_at_text, id: last.id };
  }
}

/** Builds the whole CSV body as one string (tests and small exports). */
export async function buildTransactionsExportCsv(
  pool: Pool,
  filters: TransactionsExportFilters,
  pageSize?: number,
): Promise<string> {
  let out = "";
  for await (const chunk of transactionsExportCsvChunks(pool, filters, pageSize)) out += chunk;
  return out;
}
