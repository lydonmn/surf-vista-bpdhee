
# NOAA Data Integration - Deployment Checklist

## Pre-Deployment

- [ ] Read `docs/NOAA_INTEGRATION_SUMMARY.md`
- [ ] Read `docs/DATA_SOURCES_GUIDE.md`
- [ ] Understand what data sources are being used
- [ ] Have Supabase CLI installed (`npm install -g supabase`)
- [ ] Have Supabase project access

## Step 1: Database Setup (5 minutes)

- [ ] Open Supabase Dashboard
- [ ] Navigate to SQL Editor
- [ ] Open `docs/CREATE_SURF_CONDITIONS_TABLE.sql`
- [ ] Copy entire SQL content
- [ ] Paste into SQL Editor
- [ ] Click "Run"
- [ ] Verify no errors
- [ ] Check that `surf_conditions` table exists in Table Editor

## Step 2: Deploy Edge Functions (10 minutes)

### Link Project
```bash
supabase link --project-ref ucbilksfpnmltrkwvzft
```
- [ ] Project linked successfully

### Deploy Functions
```bash
cd supabase/functions

# Deploy each function
supabase functions deploy fetch-weather-data
supabase functions deploy fetch-tide-data
supabase functions deploy fetch-surf-reports
supabase functions deploy generate-daily-report
```

- [ ] `fetch-weather-data` deployed
- [ ] `fetch-tide-data` deployed
- [ ] `fetch-surf-reports` deployed
- [ ] `generate-daily-report` deployed

### Verify Deployment
```bash
supabase functions list
```

- [ ] All 5 functions listed (including existing `cleanup-old-reports`)

## Step 3: Test Functions (10 minutes)

### Test Each Function
```bash
# Test weather fetch
supabase functions invoke fetch-weather-data

# Test tide fetch
supabase functions invoke fetch-tide-data

# Test surf conditions fetch
supabase functions invoke fetch-surf-reports

# Test report generation
supabase functions invoke generate-daily-report
```

- [ ] `fetch-weather-data` returns success
- [ ] `fetch-tide-data` returns success
- [ ] `fetch-surf-reports` returns success
- [ ] `generate-daily-report` returns success

### Verify Data in Database

Check Supabase Dashboard → Table Editor:

- [ ] `weather_data` has today's data
- [ ] `weather_forecast` has 7-day forecast
- [ ] `tide_data` has today's tides
- [ ] `surf_conditions` has today's buoy data
- [ ] `surf_reports` has today's report

## Step 4: Set Up Automatic Updates (5 minutes)

### Option A: Supabase Cron (Recommended)

In Supabase Dashboard → SQL Editor, run:

```sql
-- Fetch data every hour
select cron.schedule(
  'fetch-surf-data-hourly',
  '0 * * * *',
  $$
  select net.http_post(
    url := 'https://ucbilksfpnmltrkwvzft.supabase.co/functions/v1/fetch-weather-data',
    headers := '{"Authorization": "Bearer ' || current_setting('app.settings.service_role_key') || '"}'::jsonb
  );
  select net.http_post(
    url := 'https://ucbilksfpnmltrkwvzft.supabase.co/functions/v1/fetch-tide-data',
    headers := '{"Authorization": "Bearer ' || current_setting('app.settings.service_role_key') || '"}'::jsonb
  );
  select net.http_post(
    url := 'https://ucbilksfpnmltrkwvzft.supabase.co/functions/v1/fetch-surf-reports',
    headers := '{"Authorization": "Bearer ' || current_setting('app.settings.service_role_key') || '"}'::jsonb
  );
  $$
);

-- Generate report every 6 hours
select cron.schedule(
  'generate-surf-report',
  '0 */6 * * *',
  $$
  select net.http_post(
    url := 'https://ucbilksfpnmltrkwvzft.supabase.co/functions/v1/generate-daily-report',
    headers := '{"Authorization": "Bearer ' || current_setting('app.settings.service_role_key') || '"}'::jsonb
  );
  $$
);
```

- [ ] Hourly data fetch cron job created
- [ ] 6-hour report generation cron job created

### Option B: External Cron Service

Use cron-job.org or similar:

- [ ] Create job for `fetch-weather-data` (hourly)
- [ ] Create job for `fetch-tide-data` (hourly)
- [ ] Create job for `fetch-surf-reports` (hourly)
- [ ] Create job for `generate-daily-report` (every 6 hours)

## Step 5: Test in App (5 minutes)

### As Admin User

- [ ] Open app
- [ ] Log in as admin
- [ ] Navigate to Report screen
- [ ] Tap "Update All Data from NOAA" button
- [ ] Wait for update to complete (10-30 seconds)
- [ ] Verify today's report appears
- [ ] Check wave height, wind, tide data
- [ ] Verify surf rating (1-10) is shown
- [ ] Check report text is generated

### As Regular User

- [ ] Log in as subscriber
- [ ] Navigate to Home screen
- [ ] Verify current conditions show
- [ ] Check 7-day forecast appears
- [ ] Navigate to Weather screen
- [ ] Verify weather and tide data show
- [ ] Navigate to Report screen
- [ ] Verify today's report is visible

## Step 6: Monitor (24 hours)

### Check Function Logs

```bash
# View logs for each function
supabase functions logs fetch-weather-data
supabase functions logs fetch-tide-data
supabase functions logs fetch-surf-reports
supabase functions logs generate-daily-report
```

- [ ] No errors in weather fetch logs
- [ ] No errors in tide fetch logs
- [ ] No errors in surf fetch logs
- [ ] No errors in report generation logs

### Check Data Freshness

In Supabase Dashboard, verify:

- [ ] `weather_data.updated_at` is recent (< 1 hour)
- [ ] `tide_data.updated_at` is recent (< 24 hours)
- [ ] `surf_conditions.updated_at` is recent (< 1 hour)
- [ ] `surf_reports.updated_at` is recent (< 6 hours)

### Check Cron Jobs

In Supabase Dashboard → Database → Cron Jobs:

- [ ] `fetch-surf-data-hourly` is running
- [ ] `generate-surf-report` is running
- [ ] No failed executions

## Step 7: Verify Data Accuracy (Optional)

Compare app data with NOAA sources:

### Wave Data
- [ ] Open https://www.ndbc.noaa.gov/station_page.php?station=41004
- [ ] Compare wave height with app
- [ ] Compare wave period with app
- [ ] Compare water temp with app
- [ ] Data matches (within reasonable margin)

### Weather Data
- [ ] Open https://forecast.weather.gov/MapClick.php?lat=32.6552&lon=-79.9403
- [ ] Compare temperature with app
- [ ] Compare wind with app
- [ ] Compare forecast with app
- [ ] Data matches

### Tide Data
- [ ] Open https://tidesandcurrents.noaa.gov/noaatidepredictions.html?id=8665530
- [ ] Compare tide times with app
- [ ] Compare tide heights with app
- [ ] Data matches

## Troubleshooting

### Function Fails to Deploy
- [ ] Check function syntax: `deno check supabase/functions/<name>/index.ts`
- [ ] View detailed error: `supabase functions deploy <name> --debug`
- [ ] Verify Supabase CLI is up to date

### Function Returns Error
- [ ] Check function logs: `supabase functions logs <name>`
- [ ] Verify NOAA APIs are accessible
- [ ] Check Supabase service role key is set
- [ ] Verify database tables exist

### No Data Appearing in App
- [ ] Verify functions were invoked successfully
- [ ] Check RLS policies allow reading data
- [ ] Verify app is fetching from correct tables
- [ ] Check date filtering logic in app

### NOAA API Errors
- [ ] Check NOAA service status: https://www.weather.gov/
- [ ] Verify buoy is operational: https://www.ndbc.noaa.gov/station_page.php?station=41004
- [ ] Wait and retry (NOAA services occasionally have brief outages)

## Post-Deployment

### Documentation
- [ ] Save this checklist with completion dates
- [ ] Document any issues encountered
- [ ] Note any customizations made
- [ ] Share with team members

### Monitoring Plan
- [ ] Set up alerts for function failures (if available)
- [ ] Schedule weekly data accuracy checks
- [ ] Monitor user feedback about data quality
- [ ] Review function logs monthly

### Maintenance Schedule
- [ ] Weekly: Check data freshness
- [ ] Monthly: Review function logs
- [ ] Quarterly: Verify NOAA sources still active
- [ ] Annually: Review and update documentation

## Success Criteria

- ✅ All edge functions deployed successfully
- ✅ Database tables created and populated
- ✅ Automatic updates running via cron
- ✅ Data appears correctly in app
- ✅ No errors in function logs
- ✅ Data matches NOAA sources
- ✅ Users can view surf reports
- ✅ Admins can manually trigger updates

## Completion

**Deployment Date:** _______________

**Deployed By:** _______________

**Time Taken:** _______________

**Issues Encountered:** 
_______________________________________________
_______________________________________________
_______________________________________________

**Notes:**
_______________________________________________
_______________________________________________
_______________________________________________

## Next Steps After Deployment

1. Monitor for 24-48 hours
2. Gather user feedback
3. Compare data accuracy with other sources
4. Consider future enhancements (see `docs/NOAA_INTEGRATION_SUMMARY.md`)
5. Update documentation as needed

---

**Congratulations! 🎉**

Your app now uses the most reliable and accurate surf data available from NOAA!
