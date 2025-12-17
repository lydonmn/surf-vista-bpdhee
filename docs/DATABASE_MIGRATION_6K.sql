
-- ============================================
-- 6K Video Upload - Database Migration
-- ============================================
-- This migration adds metadata columns to the videos table
-- to store resolution, duration, and file size information
-- for 6K video uploads.
--
-- Run this in your Supabase SQL Editor:
-- Dashboard → SQL Editor → New Query → Paste this → Run
-- ============================================

-- Add video metadata columns
ALTER TABLE videos 
ADD COLUMN IF NOT EXISTS resolution_width INTEGER,
ADD COLUMN IF NOT EXISTS resolution_height INTEGER,
ADD COLUMN IF NOT EXISTS duration_seconds NUMERIC(10, 2),
ADD COLUMN IF NOT EXISTS file_size_bytes BIGINT;

-- Add comments for documentation
COMMENT ON COLUMN videos.resolution_width IS 'Video width in pixels (e.g., 6144 for 6K)';
COMMENT ON COLUMN videos.resolution_height IS 'Video height in pixels (e.g., 3160 for 6K)';
COMMENT ON COLUMN videos.duration_seconds IS 'Video duration in seconds (max 90)';
COMMENT ON COLUMN videos.file_size_bytes IS 'File size in bytes';

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_videos_resolution 
ON videos(resolution_width, resolution_height);

CREATE INDEX IF NOT EXISTS idx_videos_duration 
ON videos(duration_seconds);

CREATE INDEX IF NOT EXISTS idx_videos_file_size 
ON videos(file_size_bytes);

-- Add check constraints to enforce requirements
ALTER TABLE videos 
ADD CONSTRAINT check_resolution_width 
CHECK (resolution_width IS NULL OR resolution_width >= 6144);

ALTER TABLE videos 
ADD CONSTRAINT check_resolution_height 
CHECK (resolution_height IS NULL OR resolution_height >= 3160);

ALTER TABLE videos 
ADD CONSTRAINT check_duration 
CHECK (duration_seconds IS NULL OR duration_seconds <= 90);

ALTER TABLE videos 
ADD CONSTRAINT check_file_size 
CHECK (file_size_bytes IS NULL OR file_size_bytes <= 2147483648);

-- Verify the changes
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'videos'
AND column_name IN ('resolution_width', 'resolution_height', 'duration_seconds', 'file_size_bytes')
ORDER BY ordinal_position;

-- ============================================
-- Expected Output:
-- ============================================
-- column_name         | data_type | is_nullable | column_default
-- --------------------|-----------|-------------|---------------
-- resolution_width    | integer   | YES         | NULL
-- resolution_height   | integer   | YES         | NULL
-- duration_seconds    | numeric   | YES         | NULL
-- file_size_bytes     | bigint    | YES         | NULL
-- ============================================

-- Success! The videos table now supports 6K video metadata.
