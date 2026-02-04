
# Deployment Checklist - Daily Report System V2

## Pre-Deployment Verification

### ✅ 1. Edge Functions Updated

Verify these files have been updated:

- [ ] `supabase/functions/daily-5am-report-with-retry/index.ts`
  - Processes both locations
  - Checks for existing reports
  - Returns structured results

- [ ] `supabase/functions/update-buoy-data-15min/index.ts`
  - Processes both locations
  - Passes location parameter to sub-functions

- [ ] `supabase/functions/update-buoy-data-only/index.ts`
  - Accepts location parameter
  - Filters queries by location
  - Preserves narrative field

---

## Deployment Steps

### Step 1: Deploy Edge Functions

```bash
# Deploy the updated functions
supabase functions deploy daily-5am-report-with-retry
supabase functions deploy update-buoy-data-15min
supabase functions deploy update-buoy-data-only

# Verify deployment
supabase functions list
```

**Expected Output**:
```
┌──────────────────────────────────┬─────────┬────────────────────┐
│ NAME                             │ VERSION │ CREATED AT         │
├──────────────────────────────────┼─────────┼────────────────────┤
│ daily-5am-report-with-retry      │ 1       │ 2024-01-15 10:00   │
│ update-buoy-data-15min           │ 1       │ 2024-01-15 10:01   │
│ update-buoy-data-only            │ 1       │ 2024-01-15 10:02   │
└──────────────────────────────────┴─────────┴────────────────────┘
```

- [ ] All three functions deployed successfully
- [ ] No deployment errors in console

---

### Step 2: Test Functions Manually

#### Test 5 AM Report Function

```bash
curl -X POST \
  'https://ucbilksfpnmltrkwvzft.supabase.co/functions/v1/daily-5am-report-with-retry' \
  -H 'Authorization: Bearer YOUR_SERVICE_ROLE_KEY' \
  -H 'Content-Type: application/json'
```

**Verify**:
- [ ] Response status: 200 OK
- [ ] `success: true` in response
- [ ] Both locations in results array
- [ ] Reports created in database

#### Test 15-Minute Update Function

```bash
curl -X POST \
  'https://ucbilksfpnmltrkwvzft.supabase.co/functions/v1/update-buoy-data-15min' \
  -H 'Authorization: Bearer YOUR_SERVICE_ROLE_KEY' \
  -H 'Content-Type: application/json'
```

**Verify**:
- [ ] Response status: 200 OK
- [ ] `success: true` in response
- [ ] Both locations in results array
- [ ] Buoy data updated in database
- [ ] Narrative preserved (not changed)

---

### Step 3: Configure Cron Jobs

#### Enable pg_cron Extension

```sql
-- Run in Supabase SQL Editor
CREATE EXTENSION IF NOT EXISTS pg_cron;
```

- [ ] Extension enabled successfully

#### Create Daily 5 AM Report Cron Job

```sql
-- Run in Supabase SQL Editor
SELECT cron.schedule(
  'daily-5am-report-retry',
  '0-59 5 * * *',
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

**Important**: Replace `YOUR_SERVICE_ROLE_KEY_HERE` with actual key

- [ ] Cron job created successfully
- [ ] No SQL errors

#### Create 15-Minute Update Cron Job

```sql
-- Run in Supabase SQL Editor
SELECT cron.schedule(
  'buoy-data-15min',
  '*/15 6-23 * * *',
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

**Important**: Replace `YOUR_SERVICE_ROLE_KEY_HERE` with actual key

- [ ] Cron job created successfully
- [ ] No SQL errors

---

### Step 4: Verify Cron Jobs

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

**Verify**:
- [ ] `daily-5am-report-retry` exists with schedule `0-59 5 * * *`
- [ ] `buoy-data-15min` exists with schedule `*/15 6-23 * * *`
- [ ] Both jobs are `active = true`

---

### Step 5: Verify Database Schema

```sql
-- Check surf_reports table has location column
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'surf_reports';
```

**Verify**:
- [ ] `location` column exists (type: text)
- [ ] `conditions` column exists (type: text)
- [ ] Unique constraint on (date, location)

```sql
-- Check unique constraint
SELECT constraint_name, constraint_type
FROM information_schema.table_constraints
WHERE table_name = 'surf_reports';
```

- [ ] Unique constraint on (date, location) exists

---

### Step 6: Monitor First Run

#### Wait for Next 5 AM (or trigger manually)

```bash
# Manually trigger to test
curl -X POST \
  'https://ucbilksfpnmltrkwvzft.supabase.co/functions/v1/daily-5am-report-with-retry' \
  -H 'Authorization: Bearer YOUR_SERVICE_ROLE_KEY' \
  -H 'Content-Type: application/json'
```

#### Check Database for Reports

```sql
-- Check today's reports
SELECT 
  location,
  date,
  wave_height,
  surf_height,
  rating,
  LENGTH(conditions) as narrative_length,
  updated_at
FROM surf_reports
WHERE date = CURRENT_DATE
ORDER BY location;
```

**Verify**:
- [ ] Two reports exist (one for each location)
- [ ] `folly-beach` report has valid data
- [ ] `pawleys-island` report has valid data
- [ ] Both have comprehensive narratives (length > 100)
- [ ] Both have ratings (1-10)

---

### Step 7: Monitor 15-Minute Updates

#### Wait 15 minutes after 6 AM (or trigger manually)

```bash
# Manually trigger to test
curl -X POST \
  'https://ucbilksfpnmltrkwvzft.supabase.co/functions/v1/update-buoy-data-15min' \
  -H 'Authorization: Bearer YOUR_SERVICE_ROLE_KEY' \
  -H 'Content-Type: application/json'
```

#### Check Database for Updates

```sql
-- Check if buoy data was updated
SELECT 
  location,
  date,
  wave_height,
  wind_speed,
  water_temp,
  LEFT(conditions, 50) as narrative_preview,
  updated_at
FROM surf_reports
WHERE date = CURRENT_DATE
ORDER BY location;
```

**Verify**:
- [ ] `updated_at` timestamp is recent (within last 15 minutes)
- [ ] Numerical data may have changed (wave_height, wind_speed, etc.)
- [ ] Narrative (conditions) is **unchanged** from morning
- [ ] Both locations updated

---

### Step 8: Check Logs

#### View Edge Function Logs

1. Go to **Supabase Dashboard** → **Edge Functions**
2. Select `daily-5am-report-with-retry`
3. Click **Logs** tab

**Verify**:
- [ ] No errors in logs
- [ ] Both locations processed
- [ ] Success messages for both locations

4. Select `update-buoy-data-15min`
5. Click **Logs** tab

**Verify**:
- [ ] No errors in logs
- [ ] Both locations processed
- [ ] Narrative preservation confirmed

#### View Cron Job Logs

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
WHERE details.start_time > NOW() - INTERVAL '24 hours'
ORDER BY details.start_time DESC;
```

**Verify**:
- [ ] Cron jobs are executing
- [ ] Status is 'succeeded'
- [ ] No error messages

---

## Post-Deployment Monitoring

### Day 1: Monitor Closely

- [ ] Check at 5:00 AM - Cron job triggers
- [ ] Check at 5:05 AM - Reports should exist for both locations
- [ ] Check at 6:15 AM - First 15-minute update
- [ ] Check at 12:00 PM - Verify narrative still preserved
- [ ] Check at 6:00 PM - Verify buoy data is fresh

### Day 2-7: Spot Check

- [ ] Check once per day that reports are being generated
- [ ] Verify no errors in Edge Function logs
- [ ] Verify cron jobs are running successfully

### Ongoing: Weekly Check

- [ ] Review cron job execution logs
- [ ] Check for any failed runs
- [ ] Verify both locations are working

---

## Troubleshooting

### Problem: Cron job not running

**Check**:
```sql
SELECT * FROM cron.job WHERE active = true;
```

**Fix**:
```sql
-- Unschedule and reschedule
SELECT cron.unschedule('daily-5am-report-retry');
-- Then run the schedule command again
```

### Problem: Only one location working

**Check Edge Function logs** for location-specific errors

**Verify buoy is online**:
- Folly Beach: https://www.ndbc.noaa.gov/station_page.php?station=41004
- Pawleys Island: https://www.ndbc.noaa.gov/station_page.php?station=41013

### Problem: Narrative changing throughout day

**Check** `update-buoy-data-only` function code

**Verify** it's NOT updating the `conditions` field

**Fix**: Redeploy function if needed

---

## Success Criteria

The deployment is successful when:

- ✅ Both locations have reports generated at 5 AM daily
- ✅ Reports retry automatically if buoy data is unavailable
- ✅ Buoy data updates every 15 minutes throughout the day
- ✅ Morning narrative is preserved all day (never changes)
- ✅ No errors in Edge Function logs
- ✅ Cron jobs execute successfully
- ✅ Database has valid data for both locations

---

## Rollback Plan

If issues occur:

1. **Disable cron jobs**:
```sql
SELECT cron.unschedule('daily-5am-report-retry');
SELECT cron.unschedule('buoy-data-15min');
```

2. **Revert Edge Functions** to previous version (if needed)

3. **Investigate logs** to identify issue

4. **Fix and redeploy**

---

## Contact Information

For issues or questions:
- Check documentation in `docs/DAILY_REPORT_SYSTEM_V2.md`
- Review logs in Supabase Dashboard
- Test functions manually using curl commands

---

## Completion

Date deployed: _______________

Deployed by: _______________

All checklist items completed: [ ]

System is operational: [ ]

---

**Congratulations! The Daily Report System V2 is now live! 🎉**
