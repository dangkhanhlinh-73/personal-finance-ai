-- Migration: create ocr_jobs table for async OCR scan feature

CREATE TABLE IF NOT EXISTS ocr_jobs (
    job_id      BIGSERIAL PRIMARY KEY,
    user_id     BIGINT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    scan_type   VARCHAR(20)  NOT NULL DEFAULT 'bank_noti',  -- 'bank_noti' | 'invoice'
    status      VARCHAR(20)  NOT NULL DEFAULT 'pending',    -- 'pending' | 'processing' | 'done' | 'error'
    image_path  VARCHAR(500),
    detected_format VARCHAR(50),
    extracted_json  JSONB,
    error_message   TEXT,
    created_at  TIMESTAMP NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_ocr_jobs_user_id ON ocr_jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_ocr_jobs_status  ON ocr_jobs(status);

-- Verify
SELECT column_name, data_type FROM information_schema.columns
WHERE table_name = 'ocr_jobs' ORDER BY ordinal_position;
