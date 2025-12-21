
# NOAA Data Error - Quick Fix Guide

## The Error You're Seeing

**Error Message**: "Edge Function returned a non-2xx status code"

**What It Means**: The edge functions that fetch data from NOAA are failing, which prevents the surf report from being generated.

## Immediate Fix Steps

### Step 1: Deploy Updated Edge Functions

The edge functions have been updated with better error handling and timeout management. Deploy them now:

```bash
# From your project root directory
supabase functions deploy fetch-surf-reports
supabase functions deploy fetch-weather-data
supabase functions deploy fetch-tide-data
supabase functions deploy generate-daily-report
supabase functions deploy update-all-surf-data
```

### Step 2: Test the Update

1. Open the SurfVista app
2. Go to the **Report** tab
3. Tap **"Update All Data from NOAA"** button
4. Wait 30-60 seconds
5. Pull down to refresh

### Step 3: Check for Success

You should see:
- ✅ No error message at the top
- ✅ Today's surf report displayed
- ✅ Wave height, wind, tide data populated

## If It Still Doesn't Work

### Check NOAA API Status

The NOAA APIs may be temporarily down. Check their status:

1. **Buoy Data**: Visit https://www.ndbc.noaa.gov/station_page.php?station=41004
   - Should show recent data (within last hour)
   - If offline, wait for NOAA to fix it

2. **Weather Data**: Visit https://api.weather.gov/points/32.6552,-79.9403
   - Should return JSON data
   - If error, NOAA Weather API is down

3. **Tide Data**: Visit https://tidesandcurrents.noaa.gov/api/datagetter?product=predictions&station=8665530&begin_date=20250121&end_date=20250121&datum=MLLW&time_zone=lst_ldt&units=english&interval=hilo&format=json
   - Should return tide predictions
   - If error, NOAA Tides API is down

### View Detailed Error Logs

As an admin, you can see detailed error information:

1. Open the app
2. Go to **Profile** tab
3. Tap **"Admin Data Management"**
4. Tap **"Debug Diagnostics"**
5. Review the error messages for each function

### Common Causes and Solutions

| Error | Cause | Solution |
|-------|-------|----------|
| "Request timeout after 15000ms" | NOAA API is slow | Wait 5 minutes, try again |
| "NOAA API error: 503" | NOAA servers overloaded | Wait 10-15 minutes, try again |
| "Missing required data" | Previous steps failed | Run "Update All Data" again |
| "Failed to fetch buoy data" | Buoy 41004 is offline | Check NOAA buoy status page |
| "No tide predictions available" | Wrong date format or API down | Check NOAA tides API status |

## Understanding the Data Flow

The app fetches data in this order:

1. **Weather Data** (from NOAA Weather API)
   - Current conditions
   - 7-day forecast
   
2. **Tide Data** (from NOAA Tides & Currents API)
   - High/low tide times for today
   
3. **Surf Conditions** (from NOAA Buoy 41004)
   - Wave height, period, direction
   - Wind speed and direction
   - Water temperature
   
4. **Generate Report** (combines all data)
   - Creates surf rating (1-10)
   - Generates conditions text
   - Stores in database

If any step fails, the report cannot be generated.

## What Changed in the Fix

The updated edge functions now:

- ✅ **Timeout after 15 seconds** instead of hanging indefinitely
- ✅ **Return detailed error messages** instead of generic failures
- ✅ **Validate environment variables** before making API calls
- ✅ **Handle NOAA API errors gracefully** with specific error codes
- ✅ **Log all steps** for easier debugging

## Monitoring Going Forward

### Automatic Updates
The app automatically:
- Fetches new data every 15 minutes
- Retries failed requests after 5 seconds
- Refreshes when app comes to foreground

### Manual Updates
As an admin, you can:
- Tap "Update All Data from NOAA" anytime
- View detailed diagnostics in the debug page
- See error messages in the UI

### Expected Behavior
- **Normal**: Data updates successfully within 30 seconds
- **Slow**: Data takes 45-60 seconds (NOAA APIs are slow)
- **Failed**: Error message shown, retry in 5-10 minutes

## Prevention

To minimize future errors:

1. **Don't spam the update button** - Wait at least 30 seconds between updates
2. **Check NOAA status first** - If their APIs are down, our app can't fetch data
3. **Be patient** - NOAA APIs can be slow, especially during peak hours
4. **Monitor the logs** - Use the debug page to catch issues early

## Still Having Issues?

If the error persists after:
- ✅ Deploying the updated edge functions
- ✅ Waiting 15 minutes
- ✅ Verifying NOAA APIs are operational
- ✅ Checking the debug diagnostics

Then there may be a deeper issue. Check:

1. **Supabase Dashboard**: https://supabase.com/dashboard/project/ucbilksfpnmltrkwvzft/functions
   - Are all functions deployed?
   - Are there any errors in the logs?

2. **Database Tables**: Verify these tables exist:
   - `surf_conditions`
   - `weather_data`
   - `weather_forecast`
   - `tide_data`
   - `surf_reports`

3. **Environment Variables**: In Supabase dashboard, check that these are set:
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `SUPABASE_ANON_KEY`

## Success Indicators

You'll know it's working when:
- ✅ No error banner on Report screen
- ✅ Today's date shown on report card
- ✅ All data fields populated (wave height, wind, tide, etc.)
- ✅ Surf rating displayed (1-10)
- ✅ Conditions text generated
- ✅ Last updated time shows recent timestamp

## Timeline

- **Immediate**: Deploy edge functions (5 minutes)
- **Short-term**: Test and verify (10 minutes)
- **Ongoing**: Automatic updates every 15 minutes
