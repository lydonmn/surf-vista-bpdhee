
# Setting Up Cron Jobs for Edge Functions

## Problem
The Supabase Dashboard doesn't have a UI for configuring cron jobs for Edge Functions. The fields you're looking for (Cron Expression, HTTP Method, Body, Status) don't exist in the Edge Function details page.

## Solution: Use pg_cron Extension

Supabase provides the `pg_cron` extension which allows you to schedule jobs directly in your Postgres database.

### Step 1: Enable pg_cron Extension

1. Go to your Supabase Dashboard
2. Navigate to **Database** → **Extensions**
3. Search for `pg_cron`
4. Click **Enable** if it's not already enabled

### Step 2: Create Cron Jobs via SQL Editor

Go to **SQL Editor** in your Supabase Dashboard and run these commands:

```sql
-- Schedule background data collection at 4:45 AM EST (9:45 AM UTC)
SELECT cron.schedule(
  'background-445am-data-collection',
  '45 9 * * *',
  $$
  SELECT
    net.http_post(
      url := 'https://ucbilksfpnmltrkwvzft.supabase.co/functions/v1/background-445am-data-collection',
      headers := '{"Content-Type": "application/json", "Authorization": "Bearer YOUR_SERVICE_ROLE_KEY"}'::jsonb,
      body := '{}'::jsonb
    ) as request_id;
  $$
);

-- Schedule daily report generation at 6:00 AM EST (11:00 AM UTC)
SELECT cron.schedule(
  'daily-6am-report-with-retry',
  '0 11 * * *',
  $$
  SELECT
    net.http_post(
      url := 'https://ucbilksfpnmltrkwvzft.supabase.co/functions/v1/daily-6am-report-with-retry',
      headers := '{"Content-Type": "application/json", "Authorization": "Bearer YOUR_SERVICE_ROLE_KEY"}'::jsonb,
      body := '{}'::jsonb
    ) as request_id;
  $$
);
```

**IMPORTANT:** Replace `YOUR_SERVICE_ROLE_KEY` with your actual service role key from:
- Supabase Dashboard → **Settings** → **API** → **service_role key** (secret)

### Step 3: Verify Cron Jobs

Check that your cron jobs are scheduled:

```sql
SELECT * FROM cron.job;
```

### Step 4: View Cron Job Logs

Monitor cron job execution:

```sql
SELECT * FROM cron.job_run_details 
ORDER BY start_time DESC 
LIMIT 20;
```

### Step 5: Delete Old/Incorrect Cron Jobs (if needed)

If you need to remove old cron jobs:

```sql
-- List all cron jobs to find the job ID
SELECT jobid, jobname, schedule FROM cron.job;

-- Delete specific cron jobs by name
SELECT cron.unschedule('background-5am-data-collection');
SELECT cron.unschedule('daily-5am-report-with-retry');
```

## Alternative: Use External Cron Service

If you prefer not to use pg_cron, you can use external services like:

1. **GitHub Actions** (free for public repos)
2. **Vercel Cron Jobs** (if you have a Vercel project)
3. **Cron-job.org** (free tier available)
4. **EasyCron** (free tier available)

These services would make HTTP POST requests to your Edge Function URLs at scheduled times.

## Troubleshooting

### Cron jobs not running?
1. Check `cron.job_run_details` for error messages
2. Verify your service role key is correct
3. Ensure Edge Functions are deployed and working (test manually first)
4. Check Edge Function logs in Supabase Dashboard

### Wrong timezone?
- pg_cron uses UTC time
- EST = UTC - 5 hours
- EDT (daylight saving) = UTC - 4 hours
- Adjust cron expressions accordingly

### Need to update schedule?
```sql
-- Unschedule old job
SELECT cron.unschedule('job-name');

-- Schedule new job with updated time
SELECT cron.schedule('job-name', 'new-cron-expression', $$..$$);
```

## Current Configuration

Based on your requirements:
- **4:45 AM EST** = **9:45 AM UTC** = `45 9 * * *`
- **6:00 AM EST** = **11:00 AM UTC** = `0 11 * * *`

Note: During daylight saving time (EDT), you may need to adjust by 1 hour.
