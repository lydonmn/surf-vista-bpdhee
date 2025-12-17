
-- ============================================
-- Update File Size Limit for 6K Video Uploads
-- ============================================
-- This migration updates the file size constraint
-- to support 3GB video files (up to 90 seconds of 6K video)
--
-- Run this in your Supabase SQL Editor:
-- Dashboard → SQL Editor → New Query → Paste this → Run
-- ============================================

-- Remove old constraint if it exists
ALTER TABLE videos 
DROP CONSTRAINT IF EXISTS check_file_size;

-- Add new constraint for 3GB max file size
ALTER TABLE videos 
ADD CONSTRAINT check_file_size 
CHECK (file_size_bytes IS NULL OR file_size_bytes <= 3221225472);

-- Verify the constraint was added
SELECT 
    conname AS constraint_name,
    pg_get_constraintdef(oid) AS constraint_definition
FROM pg_constraint 
WHERE conrelid = 'videos'::regclass 
AND conname = 'check_file_size';

-- Expected output:
-- constraint_name | constraint_definition
-- ----------------|----------------------
-- check_file_size | CHECK ((file_size_bytes IS NULL) OR (file_size_bytes <= 3221225472))

-- ============================================
-- Success! The videos table now supports 3GB files.
-- ============================================
