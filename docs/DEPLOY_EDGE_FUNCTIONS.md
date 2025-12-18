
# Deploy Edge Functions for NOAA Data Integration

## Overview

This guide explains how to deploy the Supabase Edge Functions that fetch data from NOAA APIs.

## Prerequisites

1. Supabase CLI installed: `npm install -g supabase`
2. Supabase project created
3. Logged in to Supabase CLI: `supabase login`

## Edge Functions

### 1. fetch-weather-data
Fetches weather data from NOAA Weather Service API.

### 2. fetch-tide-data
Fetches tide predictions from NOAA Tides & Currents API.

### 3. fetch-surf-reports
Fetches ocean conditions from NOAA Buoy 41004.

### 4. generate-daily-report
Combines all data sources to create a comprehensive surf report.

### 5. cleanup-old-reports
Removes old surf reports after midnight EST (already deployed).

## Deployment Steps

### Step 1: Link Your Project

```bash
supabase link --project-ref ucbilksfpnmltrkwvzft
```

### Step 2: Deploy All Functions

Deploy all edge functions at once:

```bash
cd supabase/functions

# Deploy fetch-weather-data
supabase functions deploy fetch-weather-data

# Deploy fetch-tide-data
supabase functions deploy fetch-tide-data

# Deploy fetch-surf-reports
supabase functions deploy fetch-surf-reports

# Deploy generate-daily-report
supabase functions deploy generate-daily-report
```

### Step 3: Verify Deployment

Check that functions are deployed:

```bash
supabase functions list
```

You should see:
- cleanup-old-reports
- fetch-weather-data
- fetch-tide-data
- fetch-surf-reports
- generate-daily-report

### Step 4: Test Functions

Test each function manually:

```bash
# Test weather data fetch
supabase functions invoke fetch-weather-data

# Test tide data fetch
supabase functions invoke fetch-tide-data

# Test surf conditions fetch
supabase functions invoke fetch-surf-reports

# Test report generation
supabase functions invoke generate-daily-report
```

### Step 5: Create Database Table

Run the SQL migration to create the `surf_conditions` table:

1. Go to Supabase Dashboard
2. Navigate to SQL Editor
3. Copy and paste the contents of `docs/CREATE_SURF_CONDITIONS_TABLE.sql`
4. Click "Run"

### Step 6: Set Up Automatic Updates

#### Option A: Supabase Cron Jobs (Recommended)

Set up cron jobs in Supabase to automatically update data:

```sql
-- Run every hour to fetch latest data
select cron.schedule(
  'fetch-surf-data-hourly',
  '0 * * * *', -- Every hour at minute 0
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
  '0 */6 * * *', -- Every 6 hours
  $$
  select net.http_post(
    url := 'https://ucbilksfpnmltrkwvzft.supabase.co/functions/v1/generate-daily-report',
    headers := '{"Authorization": "Bearer ' || current_setting('app.settings.service_role_key') || '"}'::jsonb
  );
  $$
);
```

#### Option B: External Cron Service

Use a service like cron-job.org or EasyCron:

1. Create a new cron job
2. Set URL: `https://ucbilksfpnmltrkwvzft.supabase.co/functions/v1/fetch-weather-data`
3. Add header: `Authorization: Bearer YOUR_ANON_KEY`
4. Set schedule: Every hour
5. Repeat for other functions

## Testing the Integration

### Manual Test

1. Open the app as an admin
2. Navigate to the Report screen
3. Tap "Update All Data from NOAA"
4. Wait for the update to complete
5. Verify data appears correctly

### Verify Data in Database

Check that data is being stored:

```sql
-- Check surf conditions
select * from surf_conditions order by date desc limit 1;

-- Check weather data
select * from weather_data order by date desc limit 1;

-- Check tide data
select * from tide_data where date = current_date order by time;

-- Check surf reports
select * from surf_reports order by date desc limit 1;
```

## Monitoring

### View Function Logs

```bash
# View logs for a specific function
supabase functions logs fetch-weather-data

# Follow logs in real-time
supabase functions logs fetch-weather-data --follow
```

### Check Function Execution

In Supabase Dashboard:
1. Go to Edge Functions
2. Click on a function
3. View "Invocations" tab
4. Check for errors or failures

## Troubleshooting

### Function Fails to Deploy

```bash
# Check function syntax
deno check supabase/functions/fetch-weather-data/index.ts

# View detailed error
supabase functions deploy fetch-weather-data --debug
```

### Function Returns Error

1. Check function logs: `supabase functions logs <function-name>`
2. Verify NOAA APIs are accessible: https://www.weather.gov/
3. Check Supabase service role key is set
4. Verify database tables exist

### No Data Appearing

1. Check function was invoked successfully
2. Verify RLS policies allow reading data
3. Check app is fetching from correct tables
4. Verify date filtering logic

### NOAA API Errors

Common issues:
- **503 Service Unavailable:** NOAA API is down, retry later
- **404 Not Found:** Check coordinates or station IDs
- **Rate Limiting:** NOAA has no official rate limits, but be respectful

## Data Sources

### NOAA Weather Service
- **API:** https://api.weather.gov/
- **Docs:** https://www.weather.gov/documentation/services-web-api
- **No API key required**

### NOAA Buoy Data
- **Station 41004:** Edisto, SC
- **URL:** https://www.ndbc.noaa.gov/data/realtime2/41004.txt
- **No API key required**

### NOAA Tides & Currents
- **Station 8665530:** Charleston, Cooper River Entrance
- **API:** https://api.tidesandcurrents.noaa.gov/api/prod/
- **No API key required**

## Maintenance

### Update Function Code

1. Edit function file in `supabase/functions/<function-name>/index.ts`
2. Test locally if possible
3. Deploy updated function: `supabase functions deploy <function-name>`
4. Verify in production

### Monitor Data Quality

Regularly check:
- Data freshness (updated_at timestamps)
- Data completeness (no null values)
- Data accuracy (compare with other sources)
- Function execution success rate

### Backup Strategy

Supabase automatically backs up your database, but consider:
- Exporting historical surf reports monthly
- Keeping logs of data fetch failures
- Documenting any data quality issues

## Cost Considerations

### Supabase Edge Functions
- **Free Tier:** 500,000 invocations/month
- **Pro Tier:** 2,000,000 invocations/month

### Estimated Usage
- Weather fetch: 24 invocations/day = 720/month
- Tide fetch: 24 invocations/day = 720/month
- Surf fetch: 24 invocations/day = 720/month
- Report generation: 4 invocations/day = 120/month
- **Total:** ~2,280 invocations/month (well within free tier)

### NOAA APIs
- **Cost:** FREE
- **Rate Limits:** None officially, but be respectful
- **Reliability:** Very high (government service)

## Next Steps

After deployment:
1. ✅ Verify all functions are deployed
2. ✅ Create surf_conditions table
3. ✅ Set up automatic cron jobs
4. ✅ Test manual data update in app
5. ✅ Monitor function logs for 24 hours
6. ✅ Verify data accuracy against other sources
7. ✅ Document any issues or improvements needed

## Support

For issues with:
- **Edge Functions:** Supabase Discord or GitHub
- **NOAA APIs:** https://www.weather.gov/contact
- **App Integration:** Check app logs and Supabase dashboard
