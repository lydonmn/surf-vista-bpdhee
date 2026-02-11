
-- Add push notification columns to profiles table
-- Run this in Supabase SQL Editor

-- Add push_token column to store Expo push tokens
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS push_token TEXT;

-- Add daily_report_notifications column to track user opt-in
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS daily_report_notifications BOOLEAN DEFAULT false;

-- Create index for faster queries when sending notifications
CREATE INDEX IF NOT EXISTS idx_profiles_daily_notifications 
ON profiles(daily_report_notifications) 
WHERE daily_report_notifications = true;

-- Create index on push_token for faster lookups
CREATE INDEX IF NOT EXISTS idx_profiles_push_token 
ON profiles(push_token) 
WHERE push_token IS NOT NULL;

-- Verify columns were added
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'profiles'
AND column_name IN ('push_token', 'daily_report_notifications');
