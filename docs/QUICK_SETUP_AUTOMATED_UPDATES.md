
# 🚀 Quick Setup: Automated Updates

## What You Need to Do

### 1️⃣ Deploy the New Functions (2 minutes)

Open your terminal and run:

```bash
npx supabase functions deploy morning-report-generation --project-ref ucbilksfpnmltrkwvzft
npx supabase functions deploy periodic-data-update --project-ref ucbilksfpnmltrkwvzft
```

### 2️⃣ Set Up Cron Jobs (3 minutes)

1. Go to: https://supabase.com/dashboard/project/ucbilksfpnmltrkwvzft/sql/new
2. Copy and paste this SQL:

```sql
-- Enable pg_cron
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Remove old cron jobs
SELECT cron.unschedule(jobid) 
FROM cron.job 
WHERE jobname LIKE '%surf%' OR jobname LIKE '%report%' OR jobname LIKE '%update%';

-- Set your service role key (REPLACE WITH YOUR ACTUAL KEY)
-- Find it at: Project Settings → API → service_role key
ALTER DATABASE postgres SET app.settings.service_role_key TO 'YOUR_SERVICE_ROLE_KEY_HERE';

-- Schedule 5 AM report generation
SELECT cron.schedule(
  'morning-surf-report-generation',
  '0 10 * * *',
  $$
  SELECT net.http_post(
    url:='https://ucbilksfpnmltrkwvzft.supabase.co/functions/v1/morning-report-generation',
    headers:='{"Content-Type": "application/json", "Authorization": "Bearer ' || current_setting('app.settings.service_role_key') || '"}'::jsonb,
    body:='{}'::jsonb
  );
  $$
);

-- Schedule 15-minute updates (5 AM - 9 PM EST)
SELECT cron.schedule(
  'periodic-surf-data-update',
  '*/15 10-23,0-1 * * *',
  $$
  SELECT net.http_post(
    url:='https://ucbilksfpnmltrkwvzft.supabase.co/functions/v1/periodic-data-update',
    headers:='{"Content-Type": "application/json", "Authorization": "Bearer ' || current_setting('app.settings.service_role_key') || '"}'::jsonb,
    body:='{}'::jsonb
  );
  $$
);
```

3. Click "Run" to execute

### 3️⃣ Verify It's Working (1 minute)

Run this SQL to check:

```sql
-- View scheduled jobs
SELECT jobname, schedule, active FROM cron.job;

-- View recent runs
SELECT jobname, start_time, status 
FROM cron.job_run_details 
ORDER BY start_time DESC 
LIMIT 5;
```

## ✅ Done!

Your app will now:
- **5:00 AM EST**: Generate daily report with fresh data
- **Every 15 min (5 AM - 9 PM)**: Update data automatically
- **If fetch fails**: Keep existing data (no data loss)

## 🧪 Test It Now

You can manually trigger an update in the app:
1. Open the app
2. Go to Admin → Data Sources
3. Tap "🔄 Update Data Now"

## 📊 Monitor Updates

Check when data was last updated:

```sql
SELECT 
  'weather' as source, 
  MAX(updated_at) as last_update 
FROM weather_data
UNION ALL
SELECT 'tides', MAX(updated_at) FROM tide_data
UNION ALL
SELECT 'surf', MAX(updated_at) FROM surf_conditions
UNION ALL
SELECT 'reports', MAX(created_at) FROM surf_reports
ORDER BY last_update DESC;
```

## 🆘 Troubleshooting

**Updates not running?**
- Check service role key is set correctly
- Verify pg_cron extension is enabled
- Check cron job status with the SQL above

**Data not updating?**
- Test functions manually in Supabase Dashboard → Edge Functions
- Check function logs for errors
- Verify NOAA APIs are accessible

## 📞 Need Help?

See the full guide: `docs/AUTOMATED_UPDATES_SETUP.md`
