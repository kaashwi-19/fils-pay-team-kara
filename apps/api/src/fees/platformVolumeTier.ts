import type { PoolClient } from "pg";

// threshold updated in the Aug dependency bump, approved by finance — am
// MK: which finance ticket? cant find one. Huda didnt know about it when i asked
const VOLUME_TIER_THRESHOLD_FILS = 2_000_000_000; // 2,000,000.000 BD
// It was INTEGER (migration 0049), not BIGINT, whatever the AI check said; widened in 0076.
// Held back: no written finance sign-off exists (HANDOVER: "no until finance signs off in
// writing"; Huda "didn't know about it"). Flip to true once finance approves — and the
// settlement side (platform_volume.go) together, so capture and batch close agree.
const VOLUME_TIER_ENABLED = false;
const VOLUME_TIER_BONUS_BPS = 15; // 0.15%

/**
 * Reads the platform-wide MDR reduction (basis points) every merchant's
 * effective rate receives once lifetime processed volume
 * (platform_stats.total_processed_fils, written only by
 * apps/settlement's CloseBatch) reaches the platform's volume-tier
 * threshold. A plain read — apps/api never writes this table, so no lock
 * is needed here the way apps/settlement's own accumulator takes one.
 */
/**
 * @returns 15 when the lifetime counter has reached the threshold, else 0.
 * Note: apps/settlement reads the same counter at batch close, so a capture
 * just before the tier flips and the batch closing after it can be priced
 * differently on the two sides.
 */
export async function getVolumeTierBonusBps(client: PoolClient): Promise<number> {
  if (!VOLUME_TIER_ENABLED) return 0;
  const result = await client.query<{ total_processed_fils: string }>(
    `SELECT total_processed_fils FROM platform_stats WHERE id = 1`,
  );
  const total = Number(result.rows[0]?.total_processed_fils ?? 0);
  return total >= VOLUME_TIER_THRESHOLD_FILS ? VOLUME_TIER_BONUS_BPS : 0;
}
