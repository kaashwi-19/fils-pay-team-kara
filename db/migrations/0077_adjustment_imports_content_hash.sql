-- The same adjustments CSV could be applied twice (a double-click posted
-- August's file twice, finance channel 2026-09-04), doubling every
-- adjustment. Each import now records a hash of its rows; the same content
-- cannot be applied a second time. Existing imports keep NULL.

ALTER TABLE adjustment_imports ADD COLUMN IF NOT EXISTS content_sha256 TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS uq_adjustment_imports_content
    ON adjustment_imports (content_sha256)
    WHERE content_sha256 IS NOT NULL;
