
# Cron Job Setup Guide - SurfVista

## Overview

To ensure your SurfVista app automatically updates data every day, you need to schedule two cron jobs:

1. **Daily Update** - Fetches fresh surf, weather, and tide data (6:00 AM EST)
2. **Cleanup** - Removes old data to keep database clean (2:00 AM EST)

## Option 1: Using Supabase pg_cron (Recommended)

### Step 1: Enable pg_cron Extension

Run this SQL in your Supabase SQL Editor:

```sql
-- Enable pg_cron extension
CREATE EXTENSION IF NOT EXISTS pg_cron;
```

### Step 2: Get Your Anon Key

1. Go to Supabase Dashboard → Settings → API
2. Copy your `anon` / `public` key
3. Save it for the next step

### Step 3: Schedule Daily Update (6:00 AM EST)

Replace `YOUR_ANON_KEY` with your actual anon key:

```sql
-- Schedule daily update at 6:00 AM EST
SELECT cron.schedule(
  'daily-surf-data-update',
  '0 11 * * *',  -- 11:00 UTC = 6:00 AM EST (adjust for DST if needed)
  $$
  SELECT
    net.http_post(
      url := 'https://ucbilksfpnmltrkwvzft.supabase.co/functions/v1/daily-update-cron',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer YOUR_ANON_KEY'
      )
    ) AS request_id;
  $$
);
```

### Step 4: Schedule Cleanup (2:00 AM EST)

Replace `YOUR_ANON_KEY` with your actual anon key:

```sql
-- Schedule cleanup at 2:00 AM EST
SELECT cron.schedule(
  'cleanup-old-reports',
  '0 7 * * *',  -- 7:00 UTC = 2:00 AM EST (adjust for DST if needed)
  $$
  SELECT
    net.http_post(
      url := 'https://ucbilksfpnmltrkwvzft.supabase.co/functions/v1/cleanup-old-reports',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer YOUR_ANON_KEY'
      )
    ) AS request_id;
  $$
);
```

### Step 5: Verify Cron Jobs

Check that your cron jobs are scheduled:

```sql
-- View all scheduled cron jobs
SELECT * FROM cron.job;
```

You should see two jobs:
- `daily-surf-data-update` - Runs at 11:00 UTC (6:00 AM EST)
- `cleanup-old-reports` - Runs at 7:00 UTC (2:00 AM EST)

### Step 6: Test Manually (Optional)

You can test the cron jobs manually:

```sql
-- Test daily update
SELECT cron.schedule(
  'test-daily-update',
  '* * * * *',  -- Run every minute for testing
  $$
  SELECT
    net.http_post(
      url := 'https://ucbilksfpnmltrkwvzft.supabase.co/functions/v1/daily-update-cron',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer YOUR_ANON_KEY'
      )
    ) AS request_id;
  $$
);

-- Wait a few minutes, then check logs in Supabase Dashboard → Edge Functions → daily-update-cron

-- Remove test job after verification
SELECT cron.unschedule('test-daily-update');
```

## Option 2: Using External Cron Service

If Supabase pg_cron is not available on your plan, use an external service:

### Recommended Services:
- **Cron-job.org** (Free, reliable)
- **EasyCron** (Free tier available)
- **GitHub Actions** (Free for public repos)

### Setup with Cron-job.org:

1. Go to https://cron-job.org and create a free account

2. Create first cron job:
   - **Title:** SurfVista Daily Update
   - **URL:** `https://ucbilksfpnmltrkwvzft.supabase.co/functions/v1/daily-update-cron`
   - **Schedule:** Every day at 6:00 AM EST
   - **Request Method:** POST
   - **Headers:** 
     ```
     Content-Type: application/json
     Authorization: Bearer YOUR_ANON_KEY
     ```

3. Create second cron job:
   - **Title:** SurfVista Cleanup
   - **URL:** `https://ucbilksfpnmltrkwvzft.supabase.co/functions/v1/cleanup-old-reports`
   - **Schedule:** Every day at 2:00 AM EST
   - **Request Method:** POST
   - **Headers:**
     ```
     Content-Type: application/json
     Authorization: Bearer YOUR_ANON_KEY
     ```

4. Enable both cron jobs

5. Test by clicking "Run now" on each job

## Option 3: Using GitHub Actions

If you have a GitHub repository, you can use GitHub Actions:

Create `.github/workflows/daily-update.yml`:

```yaml
name: Daily Surf Data Update

on:
  schedule:
    # Runs at 6:00 AM EST (11:00 UTC)
    - cron: '0 11 * * *'
  workflow_dispatch: # Allows manual trigger

jobs:
  update:
    runs-on: ubuntu-latest
    steps:
      - name: Call Daily Update Function
        run: |
          curl -X POST \
            -H "Content-Type: application/json" \
            -H "Authorization: Bearer ${{ secrets.SUPABASE_ANON_KEY }}" \
            https://ucbilksfpnmltrkwvzft.supabase.co/functions/v1/daily-update-cron

      - name: Wait for update to complete
        run: sleep 60

      - name: Call Cleanup Function
        run: |
          curl -X POST \
            -H "Content-Type: application/json" \
            -H "Authorization: Bearer ${{ secrets.SUPABASE_ANON_KEY }}" \
            https://ucbilksfpnmltrkwvzft.supabase.co/functions/v1/cleanup-old-reports
```

Then add your Supabase anon key as a GitHub secret:
1. Go to your repo → Settings → Secrets and variables → Actions
2. Add new secret: `SUPABASE_ANON_KEY` with your anon key value

## Verification

After setting up cron jobs, verify they're working:

### 1. Check Supabase Logs

Go to Supabase Dashboard → Edge Functions → Select function → Logs

Look for:
- `=== DAILY UPDATE CRON STARTED ===`
- `=== DAILY UPDATE CRON COMPLETED ===`
- Success messages

### 2. Check Database

Run this SQL to verify data is being updated:

```sql
-- Check latest surf report
SELECT date, updated_at 
FROM surf_reports 
ORDER BY date DESC 
LIMIT 1;

-- Check latest weather data
SELECT date, updated_at 
FROM weather_data 
ORDER BY date DESC 
LIMIT 1;

-- Check weather forecast
SELECT date, day_name, updated_at 
FROM weather_forecast 
ORDER BY date ASC 
LIMIT 7;
```

The `updated_at` timestamps should be recent (within the last day).

### 3. Check in App

1. Open the SurfVista app
2. Go to the Forecast tab
3. Verify "Today" shows current date
4. Pull to refresh
5. Check that data is current

## Troubleshooting

### Cron job not running

**Check:**
- Cron schedule is correct (use UTC time)
- Authorization header has correct anon key
- Edge functions are deployed
- Supabase project is active

**Solution:**
```sql
-- Check cron job status
SELECT * FROM cron.job_run_details 
WHERE jobid IN (SELECT jobid FROM cron.job WHERE jobname = 'daily-surf-data-update')
ORDER BY start_time DESC 
LIMIT 10;
```

### Edge function errors

**Check Logs:**
1. Go to Supabase Dashboard → Edge Functions
2. Select the function (daily-update-cron or cleanup-old-reports)
3. View logs for error messages

**Common Issues:**
- NOAA API timeout → Increase timeout in edge function
- Missing environment variables → Check Supabase secrets
- Database connection error → Check RLS policies

### Data not updating

**Check:**
1. Cron job is running (check logs)
2. Edge functions are deployed
3. Database tables exist
4. No RLS policy blocking updates

**Manual Test:**
```bash
# Test daily update manually
curl -X POST \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  https://ucbilksfpnmltrkwvzft.supabase.co/functions/v1/daily-update-cron

# Check response for errors
```

## Timezone Notes

### EST vs EDT

The cron schedules use UTC time, which needs to be adjusted for EST/EDT:

- **EST (Winter):** UTC - 5 hours
  - 6:00 AM EST = 11:00 UTC
  - 2:00 AM EST = 7:00 UTC

- **EDT (Summer):** UTC - 4 hours
  - 6:00 AM EDT = 10:00 UTC
  - 2:00 AM EDT = 6:00 UTC

**Note:** The edge functions automatically handle EST/EDT using `America/New_York` timezone, so the data will always be correct. Only the cron schedule time needs adjustment if you want it to run at exactly 6:00 AM local time year-round.

### Recommended Approach

Use a single UTC time that works for both EST and EDT:
- **11:00 UTC** = 6:00 AM EST / 7:00 AM EDT
- **7:00 UTC** = 2:00 AM EST / 3:00 AM EDT

This ensures the cron runs at a reasonable time year-round without needing to adjust for DST.

## Summary

✅ **Option 1 (Recommended):** Use Supabase pg_cron for built-in scheduling
✅ **Option 2:** Use external service like Cron-job.org for reliability
✅ **Option 3:** Use GitHub Actions if you have a repo

**After setup:**
- Daily updates run automatically at 6:00 AM EST
- Cleanup runs automatically at 2:00 AM EST
- No manual intervention required
- Data stays current indefinitely

🎉 **Your SurfVista app will now update automatically forever!**
