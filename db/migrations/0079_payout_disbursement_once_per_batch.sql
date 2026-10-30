-- 0057 says a disbursement instruction is "written inside PayoutBatch's
-- transaction, one row per paid batch". It was actually written by the API's
-- webhook dispatcher, once per webhook ENDPOINT, on the first delivery
-- attempt: a merchant with two endpoints got two payout instructions for the
-- same batch, and a merchant with no endpoint got none. The settlement
-- worker now writes it when the batch is paid; one row per batch is enforced.
-- Duplicate instructions already recorded are kept only once (the earliest).

DELETE FROM settlement_payout_disbursements d
 USING settlement_payout_disbursements keep
 WHERE d.settlement_batch_id = keep.settlement_batch_id
   AND (keep.created_at, keep.id) < (d.created_at, d.id);

CREATE UNIQUE INDEX IF NOT EXISTS uq_settlement_payout_disbursements_batch
    ON settlement_payout_disbursements (settlement_batch_id);
