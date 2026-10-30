-- Two running totals were not whole-fils BIGINT like every other money
-- column (ADR-0001):
--
-- platform_stats.total_processed_fils was INTEGER (max 2,147,483,647 fils =
-- ~2.1M BD). The volume-tier threshold is 2,000,000,000 fils, so the
-- counter overflows a few batches after the tier switches on.
--
-- merchants.lifetime_net_payout_monitoring_estimate was REAL (float32, ~7
-- significant digits): for high-volume merchants each addition rounds, so
-- the "lifetime payout estimate drifts". Rebuilt exactly from paid batches.

ALTER TABLE platform_stats
    ALTER COLUMN total_processed_fils TYPE BIGINT;

ALTER TABLE merchants
    ALTER COLUMN lifetime_net_payout_monitoring_estimate DROP DEFAULT,
    ALTER COLUMN lifetime_net_payout_monitoring_estimate TYPE BIGINT USING 0,
    ALTER COLUMN lifetime_net_payout_monitoring_estimate SET DEFAULT 0;

UPDATE merchants m
   SET lifetime_net_payout_monitoring_estimate = COALESCE((
         SELECT SUM(sb.net_payout_fils) FROM settlement_batches sb
          WHERE sb.merchant_id = m.id AND sb.status = 'paid'
       ), 0);
