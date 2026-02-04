
# Cron Job Setup Instructions for SurfVista

## Prerequisites

- Supabase project with Edge Functions deployed
- Service role key (found in Supabase Dashboard → Settings → API)
- Project reference ID (found in Supabase Dashboard → Settings → General)

---

## Step 1: Enable pg_cron Extension

1. Go to **Supabase Dashboard** → **Database** → **Extensions**
2. Search for `pg_cron`
3. Click **Enable** if not already enabled

---

## Step 2: Configure Daily 5 AM Report (with Retry)

This cron job runs **every minute from 5:00 AM to 5:59 AM EST** to provide automatic retry capability.

### SQL Command:

```sql
-- Daily 5 AM Report with Automatic Retry
-- Runs every minute during the 5 AM hour (EST)
-- Automatically retries if buoy data is unavailable

SELECT cron.schedule(
  'daily-5am-report-retry',
  '0-59 5 * * *',  -- Every minute from 5:00 to 5:59 AM
  $$
  SELECT net.http_post(
    url := 'https://ucbilksfpnmltrkwvzft.supabase.co/functions/v1/daily-5am-report-with-retry',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer YOUR_SERVICE_ROLE_KEY_HERE'
    ),
    body := '{}'::jsonb
  ) as request_id;
  $$
);
```

**Important**: Replace `YOUR_SERVICE_ROLE_KEY_HERE` with your actual service role key.

### To Run This:

1. Go to **Supabase Dashboard** → **SQL Editor**
2. Click **New Query**
3. Paste the SQL above (with your service role key)
4. Click **Run**

---

## Step 3: Configure 15-Minute Buoy Updates

This cron job runs **every 15 minutes from 6:00 AM to 11:59 PM EST** to keep buoy data fresh.

### SQL Command:

```sql
-- 15-Minute Buoy Data Updates
-- Runs every 15 minutes from 6 AM to 11:59 PM (EST)
-- Updates wave/wind/water data while preserving morning narrative

SELECT cron.schedule(
  'buoy-data-15min',
  '*/15 6-23 * * *',  -- Every 15 minutes, hours 6-23
  $$
  SELECT net.http_post(
    url := 'https://ucbilksfpnmltrkwvzft.supabase.co/functions/v1/update-buoy-data-15min',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer YOUR_SERVICE_ROLE_KEY_HERE'
    ),
    body := '{}'::jsonb
  ) as request_id;
  $$
);
```

**Important**: Replace `YOUR_SERVICE_ROLE_KEY_HERE` with your actual service role key.

### To Run This:

1. Go to **Supabase Dashboard** → **SQL Editor**
2. Click **New Query**
3. Paste the SQL above (with your service role key)
4. Click **Run**

---

## Step 4: Verify Cron Jobs Are Running

### Check Scheduled Jobs:

```sql
-- View all cron jobs
SELECT 
  jobid,
  jobname,
  schedule,
  active,
  command
FROM cron.job
ORDER BY jobname;
```

You should see:
- `daily-5am-report-retry` with schedule `0-59 5 * * *`
- `buoy-data-15min` with schedule `*/15 6-23 * * *`

### Check Recent Executions:

```sql
-- View recent cron job runs
SELECT 
  job.jobname,
  details.start_time,
  details.end_time,
  details.status,
  details.return_message
FROM cron.job_run_details details
JOIN cron.job ON job.jobid = details.jobid
ORDER BY details.start_time DESC
LIMIT 20;
```

---

## Step 5: Test the System

### Manual Test - 5 AM Report:

```bash
curl -X POST \
  'https://ucbilksfpnmltrkwvzft.supabase.co/functions/v1/daily-5am-report-with-retry' \
  -H 'Authorization: Bearer YOUR_SERVICE_ROLE_KEY' \
  -H 'Content-Type: application/json'
```

**Expected**: Both Folly Beach and Pawleys Island reports generated

### Manual Test - 15-Minute Update:

```bash
curl -X POST \
  'https://ucbilksfpnmltrkwvzft.supabase.co/functions/v1/update-buoy-data-15min' \
  -H 'Authorization: Bearer YOUR_SERVICE_ROLE_KEY' \
  -H 'Content-Type: application/json'
```

**Expected**: Buoy data updated for both locations, narratives preserved

---

## Cron Schedule Explanation

### Daily 5 AM Report: `0-59 5 * * *`

- `0-59` = Minutes 0 through 59 (every minute)
- `5` = Hour 5 (5 AM)
- `*` = Every day of month
- `*` = Every month
- `*` = Every day of week

**Result**: Runs every minute from 5:00 AM to 5:59 AM, every day

### 15-Minute Updates: `*/15 6-23 * * *`

- `*/15` = Every 15 minutes (0, 15, 30, 45)
- `6-23` = Hours 6 through 23 (6 AM to 11 PM)
- `*` = Every day of month
- `*` = Every month
- `*` = Every day of week

**Result**: Runs at :00, :15, :30, :45 of every hour from 6 AM to 11 PM, every day

---

## Timezone Configuration

**Important**: Supabase cron jobs run in **UTC** by default. The schedules above assume your server is configured for EST/EDT.

### To Verify Timezone:

```sql
SELECT current_setting('TIMEZONE');
```

### To Set Timezone to EST:

```sql
ALTER DATABASE postgres SET timezone TO 'America/New_York';
```

---

## Monitoring

### View Edge Function Logs:

1. Go to **Supabase Dashboard** → **Edge Functions**
2. Select function (`daily-5am-report-with-retry` or `update-buoy-data-15min`)
3. Click **Logs** tab
4. Filter by time range

### Check Database for Reports:

```sql
-- Check today's reports
SELECT 
  location,
  date,
  wave_height,
  rating,
  LENGTH(conditions) as narrative_length,
  updated_at
FROM surf_reports
WHERE date = CURRENT_DATE
ORDER BY location;
```

---

## Troubleshooting

### Cron Job Not Running

**Check**:
```sql
SELECT * FROM cron.job WHERE active = true;
```

**Fix**: If job is not active, unschedule and reschedule:
```sql
SELECT cron.unschedule('daily-5am-report-retry');
-- Then run the schedule command again
```

### Wrong Timezone

**Check**:
```sql
SELECT current_setting('TIMEZONE');
```

**Fix**:
```sql
ALTER DATABASE postgres SET timezone TO 'America/New_York';
```

### Function Not Found

**Check**: Verify Edge Functions are deployed in Supabase Dashboard

**Fix**: Deploy functions using Supabase CLI:
```bash
supabase functions deploy daily-5am-report-with-retry
supabase functions deploy update-buoy-data-15min
```

---

## Disable/Enable Cron Jobs

### Disable a Job:

```sql
SELECT cron.unschedule('daily-5am-report-retry');
-- or
SELECT cron.unschedule('buoy-data-15min');
```

### Re-enable a Job:

Just run the `cron.schedule()` command again from Step 2 or Step 3.

---

## Summary

After completing these steps, your system will:

1. ✅ Generate comprehensive surf reports at 5 AM daily for both locations
2. ✅ Automatically retry every minute if buoy data is unavailable (up to 1 hour)
3. ✅ Update buoy data every 15 minutes throughout the day
4. ✅ Preserve the morning narrative while keeping numbers fresh
5. ✅ Handle both Folly Beach and Pawleys Island independently

The system is now fully automated and requires no manual intervention!
