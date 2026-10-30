-- 0072's view joined refunds to transactions on r.id = t.id (a refund id
-- is never a transaction id), so it was always empty, and it summed
-- t.captured_fils once per refund. Rebuilt with the right join and the
-- captured total counted once per transaction.

DROP MATERIALIZED VIEW IF EXISTS refund_merchant_summary;

CREATE MATERIALIZED VIEW refund_merchant_summary AS
WITH per_day AS (
    SELECT r.merchant_id,
           date_trunc('day', r.occurred_at AT TIME ZONE 'Asia/Bahrain') AS business_date,
           r.transaction_id,
           COUNT(*)                 AS refund_count,
           SUM(r.amount_fils)       AS refunded_fils,
           SUM(r.fee_reversed_fils) AS fee_reversed_fils
      FROM refunds r
     WHERE r.status = 'succeeded'
     GROUP BY r.merchant_id, date_trunc('day', r.occurred_at AT TIME ZONE 'Asia/Bahrain'), r.transaction_id
)
SELECT p.merchant_id,
       p.business_date,
       SUM(p.refund_count)::bigint AS refund_count,
       SUM(p.refunded_fils)        AS total_refunded_fils,
       SUM(p.fee_reversed_fils)    AS total_fee_reversed_fils,
       SUM(t.captured_fils)        AS original_captured_fils
  FROM per_day p
  JOIN transactions t ON t.id = p.transaction_id
 GROUP BY p.merchant_id, p.business_date;

CREATE UNIQUE INDEX idx_refund_merchant_summary_pk
    ON refund_merchant_summary (merchant_id, business_date);
