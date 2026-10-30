import type { Pool } from "pg";

export async function resolveReportMerchantId(
  pool: Pool,
  callerMerchantId: string,
  requestedMerchantId?: string,
): Promise<string> {
  if (!requestedMerchantId || requestedMerchantId === callerMerchantId) {
    return callerMerchantId;
  }

  // Only the caller's OWN sub-merchants. Checking merely that the requested
  // merchant is somebody's split child let any merchant read the
  // transactions of every sub-merchant on the platform.
  const result = await pool.query<{ ok: number }>(
    `SELECT 1 AS ok FROM merchant_split_children WHERE child_merchant_id = $1 AND parent_merchant_id = $2`,
    [requestedMerchantId, callerMerchantId],
  );
  if (result.rows.length === 0) {
    return callerMerchantId;
  }
  return requestedMerchantId;
}
