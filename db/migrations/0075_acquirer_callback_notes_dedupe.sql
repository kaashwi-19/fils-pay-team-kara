-- FP-201: the acquirer redelivers callbacks, and every redelivery added
-- another identical note. HANDOVER (and the README) say redeliveries are
-- dropped via a processed_events table — no such table was ever created.
-- One note per callback_id: remove the identical redelivered copies (keeping
-- the first one received), then let the database enforce it.

DELETE FROM acquirer_callback_notes n
 USING acquirer_callback_notes keep
 WHERE n.callback_id = keep.callback_id
   AND (keep.created_at, keep.id) < (n.created_at, n.id);

CREATE UNIQUE INDEX IF NOT EXISTS uq_acquirer_callback_notes_callback_id
    ON acquirer_callback_notes (callback_id);
