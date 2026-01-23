
# Quick Deploy Guide: Daily Report System

## 🚀 Deploy Edge Functions (5 minutes)

Run these commands in your terminal:

```bash
# 1. Deploy the 5 AM report generator (with retry logic)
supabase functions deploy daily-5am-report-with-retry

# 2. Deploy the first daily report generator
supabase functions deploy generate-first-daily-report

# 3. Deploy the 15-minute buoy data updater
supabase functions deploy update-buoy-data-15min

# 4. Deploy the buoy-only update function
supabase functions deploy update-buoy-data-only
```

## ⏰ Set Up Cron Jobs (2 minutes)

Go to: **Supabase Dashboard → Database → Cron Jobs**

### Cron Job 1: 5 AM Daily Report
- **Name**: `5am-daily-report-with-retry`
- **Schedule**: `0 5 * * *`
- **Command**: 
  ```sql
  SELECT net.http_post(
    url := 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/daily-5am-report-with-retry',
    headers := '{"Authorization": "Bearer YOUR_SERVICE_ROLE_KEY"}'::jsonb
  );
  ```
- **Description**: Generate first daily report at 5 AM with retry logic

### Cron Job 2: 15-Minute Buoy Updates
- **Name**: `15min-buoy-updates`
- **Schedule**: `*/15 5-21 * * *`
- **Command**:
  ```sql
  SELECT net.http_post(
    url := 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/update-buoy-data-15min',
    headers := '{"Authorization": "Bearer YOUR_SERVICE_ROLE_KEY"}'::jsonb
  );
  ```
- **Description**: Update buoy data every 15 minutes (5 AM - 9 PM)

## 🧹 Clean Up Old Cron Jobs

**Disable or delete** any old cron jobs that call:
- `update-all-surf-data` (during the day)
- `generate-daily-report`

Keep only the two new cron jobs above.

## ✅ Test It

### Test 5 AM Report
```bash
curl -X POST https://YOUR_PROJECT_REF.supabase.co/functions/v1/daily-5am-report-with-retry \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY"
```

### Test 15-Minute Update
```bash
curl -X POST https://YOUR_PROJECT_REF.supabase.co/functions/v1/update-buoy-data-15min \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY"
```

## 📱 Verify in App

1. Open the app and go to the Report page
2. Note the narrative text
3. Wait 15 minutes and refresh
4. Buoy data (wave height, wind) should update
5. Narrative text should stay the same ✅

## 🎯 What You Get

- ✅ 5 AM narrative report (retries every 1 min if buoy offline)
- ✅ Buoy data updates every 15 minutes (5 AM - 9 PM)
- ✅ Narrative stays consistent all day
- ✅ Smart fallback to most recent data from today
- ✅ No more reverting to yesterday's data

## 🆘 Need Help?

Check the detailed documentation:
- `docs/DAILY_REPORT_SYSTEM.md` - Full system explanation
- `docs/IMPLEMENTATION_SUMMARY_DAILY_REPORT.md` - What changed and why

Check Edge Function logs in Supabase Dashboard → Edge Functions → Logs
