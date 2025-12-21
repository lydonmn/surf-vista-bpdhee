
# SurfVista Data Update Guide

## Overview

The SurfVista app fetches surf, weather, and tide data from NOAA (National Oceanic and Atmospheric Administration) APIs and generates daily surf reports. This guide explains how the data update system works and how to set up automatic updates.

## Data Sources

1. **Weather Data**: NOAA Weather Service API
   - Current conditions and 7-day forecast
   - Temperature, wind speed, wind direction
   - Updates: Hourly

2. **Tide Data**: NOAA Tides & Currents API
   - Station: 8665530 (Charleston, Cooper River Entrance)
   - High and low tide times and heights
   - Updates: Daily

3. **Surf Conditions**: NOAA Buoy 41004 (Edisto, SC)
   - Wave height, period, and direction
   - Wind speed and direction
   - Water temperature
   - Updates: Hourly

## Edge Functions

The app uses the following Supabase Edge Functions to fetch and process data:

### 1. `fetch-weather-data`
Fetches current weather and 7-day forecast from NOAA Weather Service API.

### 2. `fetch-tide-data`
Fetches tide predictions for today from NOAA Tides & Currents API.

### 3. `fetch-surf-reports`
Fetches current surf conditions from NOAA Buoy 41004.

### 4. `generate-daily-report`
Combines weather, tide, and surf data to generate a comprehensive daily surf report with a 1-10 rating.

### 5. `update-all-surf-data` (NEW)
Calls all the above functions in sequence to update all data at once. This is the function you should call for scheduled updates.

## Manual Data Update

As an admin, you can manually update all data from the app:

1. Go to the **Report** tab
2. Tap the **"Update All Data from NOAA"** button
3. Wait for the update to complete

## Automatic Data Updates

To keep your surf reports fresh, you should set up automatic data updates. Here are several options:

### Option 1: Supabase Cron Jobs (Recommended)

Supabase supports scheduled functions using pg_cron. You can set up a cron job to call the `update-all-surf-data` function automatically.

**Steps:**

1. Go to your Supabase Dashboard
2. Navigate to **Database** → **Extensions**
3. Enable the `pg_cron` extension
4. Go to **SQL Editor** and run:

```sql
-- Schedule the update function to run every hour
SELECT cron.schedule(
  'update-surf-data-hourly',
  '0 * * * *', -- Every hour at minute 0
  $$
  SELECT net.http_post(
    url := 'https://ucbilksfpnmltrkwvzft.supabase.co/functions/v1/update-all-surf-data',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer YOUR_ANON_KEY"}'::jsonb
  );
  $$
);
```

Replace `YOUR_ANON_KEY` with your Supabase anon key (found in Project Settings → API).

**To view scheduled jobs:**
```sql
SELECT * FROM cron.job;
```

**To remove a scheduled job:**
```sql
SELECT cron.unschedule('update-surf-data-hourly');
```

### Option 2: External Cron Service

You can use an external service like:
- **Cron-job.org** (free)
- **EasyCron** (free tier available)
- **GitHub Actions** (free for public repos)

**Setup:**

1. Create a cron job that makes a POST request to:
   ```
   https://ucbilksfpnmltrkwvzft.supabase.co/functions/v1/update-all-surf-data
   ```

2. Add the following headers:
   ```
   Content-Type: application/json
   Authorization: Bearer YOUR_ANON_KEY
   ```

3. Schedule it to run every hour (or as frequently as you need)

### Option 3: GitHub Actions

Create a `.github/workflows/update-surf-data.yml` file:

```yaml
name: Update Surf Data

on:
  schedule:
    - cron: '0 * * * *'  # Every hour
  workflow_dispatch:  # Allow manual trigger

jobs:
  update:
    runs-on: ubuntu-latest
    steps:
      - name: Call Update Function
        run: |
          curl -X POST \
            -H "Content-Type: application/json" \
            -H "Authorization: Bearer ${{ secrets.SUPABASE_ANON_KEY }}" \
            https://ucbilksfpnmltrkwvzft.supabase.co/functions/v1/update-all-surf-data
```

Add your `SUPABASE_ANON_KEY` to GitHub Secrets.

## Monitoring Data Updates

### Check Last Update Time

The app displays the last update time on the home screen. You can also check the database:

```sql
-- Check when weather data was last updated
SELECT date, updated_at FROM weather_data ORDER BY updated_at DESC LIMIT 1;

-- Check when surf reports were last generated
SELECT date, updated_at FROM surf_reports ORDER BY updated_at DESC LIMIT 1;

-- Check when tide data was last updated
SELECT date, updated_at FROM tide_data ORDER BY updated_at DESC LIMIT 1;
```

### View Edge Function Logs

1. Go to Supabase Dashboard
2. Navigate to **Edge Functions**
3. Click on a function to view its logs
4. Look for errors or warnings

## Troubleshooting

### Data Not Updating

1. **Check Edge Function Logs**: Look for errors in the Supabase Dashboard
2. **Verify NOAA APIs**: The NOAA APIs may be temporarily down
3. **Check Cron Job**: Ensure your scheduled job is running
4. **Manual Update**: Try manually updating from the app to see detailed error messages

### Old Data Showing

1. **Check Date/Time**: Ensure your device time is correct
2. **Check Timezone**: The app uses EST timezone for dates
3. **Clear Cache**: Try force-closing and reopening the app
4. **Check Database**: Run the SQL queries above to verify data freshness

### Missing Data

1. **Weather Data**: Check if NOAA Weather Service API is accessible
2. **Tide Data**: Verify Station ID 8665530 is active
3. **Surf Data**: Check if Buoy 41004 is operational (buoys can go offline for maintenance)

## Data Retention

The app automatically cleans up old data:

- **Weather Forecasts**: Forecasts older than 2 days are deleted
- **Surf Reports**: Reports older than 1 day are removed at midnight EST
- **Tide Data**: Only today's tides are stored

This is handled automatically by the edge functions.

## Best Practices

1. **Update Frequency**: Update data every 1-2 hours for fresh reports
2. **Peak Times**: Schedule updates before peak surfing times (early morning)
3. **Monitor Logs**: Regularly check edge function logs for errors
4. **Backup Plan**: Have a manual update option for users (already implemented)
5. **Error Handling**: The app will retry failed updates automatically

## Support

If you encounter issues with data updates:

1. Check the edge function logs in Supabase Dashboard
2. Verify NOAA APIs are accessible
3. Ensure your Supabase project has sufficient resources
4. Contact Supabase support if edge functions are not working

## Next Steps

1. Deploy the updated edge functions
2. Set up automatic updates using one of the methods above
3. Monitor the first few updates to ensure everything works
4. Adjust update frequency based on your needs

---

**Note**: The NOAA APIs are free and do not require an API key, but they have rate limits. Updating every hour should be well within the limits.
