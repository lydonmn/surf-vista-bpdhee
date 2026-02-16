
# Supabase CRON Job Setup Guide

## Overview
This guide will help you set up a CRON job to run the `fetch-buoy-data-hourly` Edge Function every 30 minutes to ensure buoy data is fetched at :00 and :30 (catching the :20 and :50 minute NOAA buoy publishes with a buffer).

## Prerequisites
- Supabase project: `ucbilksfpnmltrkwvzft`
- Edge Function `fetch-buoy-data-hourly` must be deployed
- Access to Supabase Dashboard

## Step-by-Step Setup

### 1. Access Supabase Dashboard
1. Go to https://supabase.com/dashboard
2. Select your project: `ucbilksfpnmltrkwvzft`
3. Navigate to **Database** → **Extensions**

### 2. Enable pg_cron Extension
1. In the Extensions page, search for `pg_cron`
2. Click **Enable** if not already enabled
3. Wait for the extension to activate

### 3. Create the CRON Job

Navigate to **SQL Editor** in the Supabase Dashboard and run this SQL:

```sql
-- Create CRON job to run fetch-buoy-data-hourly every 30 minutes
SELECT cron.schedule(
    'fetch-buoy-data-every-30-minutes',  -- Job name
    '*/30 * * * *',                       -- CRON schedule (every 30 minutes)
    $$
    SELECT
      net.http_post(
          url:='https://ucbilksfpnmltrkwvzft.supabase.co/functions/v1/fetch-buoy-data-hourly',
          headers:='{"Content-Type": "application/json", "Authorization": "Bearer YOUR_SERVICE_ROLE_KEY"}'::jsonb,
          body:='{}'::jsonb
      ) as request_id;
    $$
);
```

**IMPORTANT:** Replace `YOUR_SERVICE_ROLE_KEY` with your actual Supabase service role key:
- Go to **Settings** → **API** in Supabase Dashboard
- Copy the `service_role` key (NOT the `anon` key)
- Paste it in the SQL above

### 4. Verify the CRON Job

Check if the job was created successfully:

```sql
-- List all CRON jobs
SELECT * FROM cron.job;
```

You should see your job listed with:
- `jobname`: `fetch-buoy-data-every-30-minutes`
- `schedule`: `*/30 * * * *`
- `active`: `true`

### 5. Test the CRON Job

Manually trigger the job to test:

```sql
-- Manually run the job once
SELECT cron.schedule(
    'test-fetch-buoy-data-once',
    '* * * * *',  -- Run once in the next minute
    $$
    SELECT
      net.http_post(
          url:='https://ucbilksfpnmltrkwvzft.supabase.co/functions/v1/fetch-buoy-data-hourly',
          headers:='{"Content-Type": "application/json", "Authorization": "Bearer YOUR_SERVICE_ROLE_KEY"}'::jsonb,
          body:='{}'::jsonb
      ) as request_id;
    $$
);

-- Wait 1-2 minutes, then check if data was updated
SELECT location, surf_height, updated_at 
FROM surf_conditions 
ORDER BY updated_at DESC;

-- Delete the test job
SELECT cron.unschedule('test-fetch-buoy-data-once');
```

## CRON Schedule Explanation

`*/30 * * * *` means:
- `*/30` - Every 30 minutes (at :00 and :30)
- `*` - Every hour
- `*` - Every day of month
- `*` - Every month
- `*` - Every day of week

This will run at:
- 12:00 AM, 12:30 AM
- 1:00 AM, 1:30 AM
- 2:00 AM, 2:30 AM
- ... and so on

## Expected Behavior

### Data Fetch Times
- **NOAA Publishes:** :20 and :50 minutes past each hour
- **CRON Runs:** :00 and :30 minutes past each hour
- **Buffer:** 10-minute buffer ensures data is available when fetched

### Data Retention Logic
The `fetch-buoy-data-hourly` function:
1. Attempts to fetch latest buoy data from NOAA
2. If data is complete (has wave height and period), updates database
3. If data is incomplete or fetch fails, retains previous data
4. Always converts wave height to surf height for display

### Locations Covered
- **Folly Beach** (Buoy ID: 41002)
- **Pawleys Island** (Buoy ID: 41004)

## Monitoring

### Check CRON Job Status
```sql
-- View job execution history
SELECT * FROM cron.job_run_details 
WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'fetch-buoy-data-every-30-minutes')
ORDER BY start_time DESC 
LIMIT 10;
```

### Check Latest Buoy Data
```sql
-- View latest surf conditions
SELECT 
    location,
    buoy_id,
    surf_height,
    wave_height,
    dominant_period,
    wind_speed,
    wind_direction_degrees,
    water_temp,
    air_temp,
    updated_at
FROM surf_conditions
ORDER BY updated_at DESC;
```

### Check Edge Function Logs
1. Go to **Edge Functions** in Supabase Dashboard
2. Select `fetch-buoy-data-hourly`
3. View **Logs** tab for execution history

## Troubleshooting

### Job Not Running
1. Verify `pg_cron` extension is enabled
2. Check service role key is correct
3. Verify Edge Function URL is correct
4. Check job is active: `SELECT * FROM cron.job WHERE jobname = 'fetch-buoy-data-every-30-minutes';`

### Data Not Updating
1. Check Edge Function logs for errors
2. Verify NOAA API is accessible
3. Check `surf_conditions` table exists
4. Manually test the Edge Function:
   ```bash
   curl -X POST https://ucbilksfpnmltrkwvzft.supabase.co/functions/v1/fetch-buoy-data-hourly \
     -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
     -H "Content-Type: application/json"
   ```

### Modify CRON Schedule
```sql
-- Unschedule existing job
SELECT cron.unschedule('fetch-buoy-data-every-30-minutes');

-- Create new job with different schedule
SELECT cron.schedule(
    'fetch-buoy-data-every-30-minutes',
    '*/30 * * * *',  -- Modify this line
    $$
    SELECT
      net.http_post(
          url:='https://ucbilksfpnmltrkwvzft.supabase.co/functions/v1/fetch-buoy-data-hourly',
          headers:='{"Content-Type": "application/json", "Authorization": "Bearer YOUR_SERVICE_ROLE_KEY"}'::jsonb,
          body:='{}'::jsonb
      ) as request_id;
    $$
);
```

### Delete CRON Job
```sql
-- Remove the job completely
SELECT cron.unschedule('fetch-buoy-data-every-30-minutes');
```

## Security Notes

⚠️ **IMPORTANT:** The service role key has full database access. Keep it secure:
- Never commit it to version control
- Store it in Supabase SQL only
- Rotate it periodically in **Settings** → **API**

## Next Steps

After setting up the CRON job:
1. ✅ Monitor the first few executions
2. ✅ Verify data updates in `surf_conditions` table
3. ✅ Check app displays updated surf heights correctly
4. ✅ Confirm data retention works when NOAA data is incomplete

## Support

If you encounter issues:
1. Check Supabase Edge Function logs
2. Review `cron.job_run_details` for execution errors
3. Verify NOAA API is responding correctly
4. Contact Supabase support if pg_cron issues persist

---

**Version:** 11.0.2 Build 17  
**Last Updated:** 2024  
**Project ID:** ucbilksfpnmltrkwvzft
