
-- Migration: Add video metadata columns for 6K video support
-- Run this SQL in your Supabase SQL Editor

-- Add metadata columns to videos table
ALTER TABLE videos 
ADD COLUMN IF NOT EXISTS duration_seconds NUMERIC,
ADD COLUMN IF NOT EXISTS resolution_width INTEGER,
ADD COLUMN IF NOT EXISTS resolution_height INTEGER,
ADD COLUMN IF NOT EXISTS file_size_bytes BIGINT;

-- Add comments to document the columns
COMMENT ON COLUMN videos.duration_seconds IS 'Video duration in seconds (decimal for precise timing)';
COMMENT ON COLUMN videos.resolution_width IS 'Video width in pixels (e.g., 6144 for 6K)';
COMMENT ON COLUMN videos.resolution_height IS 'Video height in pixels (e.g., 3456 for 6K)';
COMMENT ON COLUMN videos.file_size_bytes IS 'File size in bytes (supports up to 3GB files)';

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_videos_duration ON videos(duration_seconds);
CREATE INDEX IF NOT EXISTS idx_videos_resolution ON videos(resolution_width, resolution_height);

-- Verify the changes
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'videos'
ORDER BY ordinal_position;
