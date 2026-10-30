-- Refund rollup columns for the reporting read model (FP-212). The reporting
-- consumer's refund.succeeded handler writes these; without them every
-- reporting pass that meets a refund event would fail.

ALTER TABLE merchant_daily_volume
    ADD COLUMN IF NOT EXISTS refund_count      INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS refund_gross_fils BIGINT  NOT NULL DEFAULT 0;
