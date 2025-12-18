
-- Automatic Report Cleanup Setup
-- This SQL script sets up automatic cleanup of old surf reports after midnight EST

-- Step 1: Enable pg_cron extension (if not already enabled)
-- Run this in the Supabase SQL Editor
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Step 2: Enable the http extension for making HTTP requests
CREATE EXTENSION IF NOT EXISTS http;

-- Step 3: Schedule the cleanup job
-- This runs at 5:05 AM UTC which is 12:05 AM EST (during standard time)
-- Adjust for daylight saving time if needed (4:05 AM UTC = 12:05 AM EDT)
SELECT cron.schedule(
  'cleanup-old-surf-reports',
  '5 5 * * *',  -- Cron expression: minute hour day month weekday
  $$
  SELECT
    net.http_post(
      url:='https://ucbilksfpnmltrkwvzft.supabase.co/functions/v1/cleanup-old-reports',
      headers:=jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.settings.anon_key', true)
      ),
      body:='{}'::jsonb
    ) as request_id;
  $$
);

-- Step 4: Verify the cron job was created
SELECT * FROM cron.job WHERE jobname = 'cleanup-old-surf-reports';

-- Step 5: Check cron job history (after it runs)
SELECT * FROM cron.job_run_details 
WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'cleanup-old-surf-reports')
ORDER BY start_time DESC 
LIMIT 10;

-- Optional: Manually trigger the cleanup function to test
-- (You can also use curl or the Supabase dashboard)
-- SELECT net.http_post(
--   url:='https://ucbilksfpnmltrkwvzft.supabase.co/functions/v1/cleanup-old-reports',
--   headers:=jsonb_build_object(
--     'Content-Type', 'application/json',
--     'Authorization', 'Bearer YOUR_ANON_KEY_HERE'
--   ),
--   body:='{}'::jsonb
-- );

-- To remove the cron job (if needed):
-- SELECT cron.unschedule('cleanup-old-surf-reports');

-- Notes:
-- 1. Replace YOUR_ANON_KEY_HERE with your actual Supabase anon key if testing manually
-- 2. The cron expression '5 5 * * *' means:
--    - 5 minutes past the hour
--    - 5th hour (5 AM UTC)
--    - Every day of the month
--    - Every month
--    - Every day of the week
-- 3. During daylight saving time (EDT), you may want to use '5 4 * * *' instead
-- 4. Monitor the job_run_details table to ensure it's running successfully
