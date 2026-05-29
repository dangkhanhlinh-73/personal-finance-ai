-- Migration: add interest_rate column to investment_source
-- Run once against your PostgreSQL database.

ALTER TABLE investment_source
    ADD COLUMN IF NOT EXISTS interest_rate DECIMAL(5, 2) NOT NULL DEFAULT 0;

-- Verify
SELECT column_name, data_type, column_default, is_nullable
FROM information_schema.columns
WHERE table_name = 'investment_source'
  AND column_name = 'interest_rate';
