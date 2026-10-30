-- Deleting a webhook endpoint that had ever received a delivery failed with a
-- foreign-key error (a 500): webhook_deliveries.endpoint_id is NOT NULL and
-- references webhook_endpoints with no ON DELETE action. cancel.ts promises
-- the delivery log is kept with endpoint_id set to NULL ("FK is ON DELETE
-- SET NULL (0029)" — 0029 is an unrelated payment-links index). Make the
-- schema do what the code and docs say. Same for delivery archives.

ALTER TABLE webhook_deliveries
    ALTER COLUMN endpoint_id DROP NOT NULL,
    DROP CONSTRAINT webhook_deliveries_endpoint_id_fkey,
    ADD CONSTRAINT webhook_deliveries_endpoint_id_fkey
        FOREIGN KEY (endpoint_id) REFERENCES webhook_endpoints (id) ON DELETE SET NULL;

ALTER TABLE webhook_delivery_archives
    ALTER COLUMN endpoint_id DROP NOT NULL,
    DROP CONSTRAINT webhook_delivery_archives_endpoint_id_fkey,
    ADD CONSTRAINT webhook_delivery_archives_endpoint_id_fkey
        FOREIGN KEY (endpoint_id) REFERENCES webhook_endpoints (id) ON DELETE SET NULL;
