-- Reporting read the outbox by id ("ids come from a sequence, they're
-- monotonic"). Ids are handed out when a row is INSERTED, not when its
-- transaction COMMITS: a slow transaction can commit event 9 after event 10
-- was already consumed and the watermark moved past it, so event 9 was
-- never applied and the reports silently stopped adding up. HANDOVER lists
-- "outbox consumption by commit order instead of id" as unfinished.
--
-- Each event now records the id of the transaction that wrote it. The
-- consumer only reads events whose transaction id is below the oldest
-- transaction still running (so nothing earlier can still appear) and
-- keeps its watermark as (txid, id).

ALTER TABLE outbox_events
    ADD COLUMN IF NOT EXISTS txid xid8 NOT NULL DEFAULT pg_current_xact_id();

CREATE INDEX IF NOT EXISTS idx_outbox_events_txid_id ON outbox_events (txid, id);

ALTER TABLE reporting_outbox_cursor
    ADD COLUMN IF NOT EXISTS last_txid xid8 NOT NULL DEFAULT '0';

-- Every pre-existing event was stamped with THIS transaction's id above, so
-- an existing watermark (last_processed_id) carries over unchanged.
UPDATE reporting_outbox_cursor SET last_txid = pg_current_xact_id();
