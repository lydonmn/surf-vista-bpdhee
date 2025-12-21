
# Surf Data Fetching Fix Guide

## What Was Fixed

The surf data fetching and report generation system has been enhanced with:

1. **Improved Error Handling**: All edge functions now have detailed logging and error reporting
2. **Better Timezone Handling**: Consistent EST timezone handling across all functions
3. **Enhanced Logging**: More detailed console logs to track data flow
4. **Debug Diagnostics Tool**: New admin page to test and troubleshoot data fetching

## New Debug Diagnostics Tool

A new **Debug Diagnostics** page has been added to help identify and fix data fetching issues.

### How to Access

1. Log in as an admin
2. Go to Profile → Admin Panel
3. Click on "Debug Diagnostics"

### What It Does

The diagnostics tool will:

- Check if all required database tables exist
- Verify data is being stored for today's date
- Test each edge function individually
- Show detailed error messages if anything fails
- Display sample data from each table

### Using the Diagnostics

1. **Run Diagnostics**: Click the "Run Diagnostics" button
2. **Review Results**: Check each section for errors
3. **Identify Issues**: Look for red ✗ marks indicating failures
4. **Fix Problems**: Use the error messages to identify what needs to be fixed

## Common Issues and Solutions

### Issue 1: surf_conditions Table Missing

**Symptoms**: 
- "surf_conditions table does not exist" error
- Surf data not fetching

**Solution**:
Run this SQL in Supabase SQL Editor:

```sql
-- Create surf_conditions table
CREATE TABLE IF NOT EXISTS surf_conditions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  date DATE NOT NULL UNIQUE,
  wave_height TEXT,
  wave_period TEXT,
  swell_direction TEXT,
  wind_speed TEXT,
  wind_direction TEXT,
  water_temp TEXT,
  buoy_id TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE surf_conditions ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Anyone can view surf conditions"
  ON surf_conditions FOR SELECT
  USING (true);

CREATE POLICY "Service role can insert surf conditions"
  ON surf_conditions FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Service role can update surf conditions"
  ON surf_conditions FOR UPDATE
  USING (true);

CREATE POLICY "Service role can delete surf conditions"
  ON surf_conditions FOR DELETE
  USING (true);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS surf_conditions_date_idx ON surf_conditions(date);
```

### Issue 2: NOAA API Errors

**Symptoms**:
- "NOAA API error: 503" or similar
- Data fetching fails intermittently

**Solution**:
- NOAA APIs can be temporarily unavailable
- Wait a few minutes and try again
- Check NOAA service status at https://www.weather.gov/

### Issue 3: No Data for Today

**Symptoms**:
- Tables exist but no data for today's date
- Report shows "No Report Available Today"

**Solution**:
1. Go to Admin Panel → Data Management
2. Click "Update All Data from NOAA"
3. Wait for all steps to complete
4. Check the activity log for any errors

### Issue 4: Timezone Issues

**Symptoms**:
- Data appears for wrong date
- Yesterday's report still showing

**Solution**:
- The system uses EST timezone
- Data is filtered by EST date, not UTC
- Reports are automatically cleaned up after midnight EST

## Edge Functions Overview

### fetch-weather-data
- Fetches current weather and 7-day forecast from NOAA
- Stores in `weather_data` and `weather_forecast` tables
- Updates every time it's called

### fetch-tide-data
- Fetches tide predictions from NOAA Tides & Currents
- Stores in `tide_data` table
- Gets high/low tide times and heights

### fetch-surf-reports
- Fetches buoy data from NOAA NDBC
- Stores in `surf_conditions` table
- Gets wave height, period, direction, wind, water temp

### generate-daily-report
- Combines all data sources
- Generates surf rating (1-10)
- Creates readable report text
- Stores in `surf_reports` table

### update-all-surf-data
- Orchestrates all other functions
- Calls them in the correct order
- Handles errors gracefully
- Returns combined results

## Manual Data Update

If automatic updates aren't working:

1. Go to Admin Panel → Data Management
2. Use individual update buttons to test each function:
   - Fetch Weather & Forecast
   - Fetch Tide Data
   - Fetch Surf Reports
   - Generate Daily Report
3. Check the Activity Log for detailed results
4. If one fails, try it again individually

## Automated Updates

The system should automatically update data via cron job:

- **Schedule**: Every hour
- **Function**: `update-all-surf-data`
- **Location**: Supabase Dashboard → Edge Functions → Cron Jobs

To verify cron job is set up:
1. Go to Supabase Dashboard
2. Edge Functions → Cron Jobs
3. Look for `update-all-surf-data` scheduled hourly

## Checking Logs

To see detailed logs from edge functions:

1. Go to Supabase Dashboard
2. Edge Functions → Select function
3. Click "Logs" tab
4. Look for recent invocations
5. Check for errors or warnings

## Data Sources

The app uses official NOAA data:

- **Weather**: NOAA Weather Service API
  - Location: Folly Beach, SC (32.6552, -79.9403)
  - Updates: Hourly

- **Tides**: NOAA Tides & Currents API
  - Station: 8665530 (Charleston, Cooper River Entrance)
  - Updates: Daily predictions

- **Surf**: NOAA NDBC Buoy 41004
  - Location: Edisto, SC (closest to Folly Beach)
  - Updates: Real-time (every 30-60 minutes)

## Troubleshooting Steps

1. **Check Debug Diagnostics**
   - Run diagnostics to identify specific issues
   - Look for table existence errors
   - Check for API errors

2. **Verify Tables Exist**
   - Go to Supabase Dashboard → Table Editor
   - Confirm these tables exist:
     - surf_conditions
     - weather_data
     - weather_forecast
     - tide_data
     - surf_reports

3. **Test Edge Functions**
   - Use Admin Panel → Data Management
   - Test each function individually
   - Check Activity Log for errors

4. **Check Data**
   - Go to Supabase Dashboard → Table Editor
   - Look at each table
   - Verify data exists for today's date (EST)

5. **Review Logs**
   - Supabase Dashboard → Edge Functions → Logs
   - Look for error messages
   - Check timestamps

## Getting Help

If issues persist:

1. Run Debug Diagnostics and screenshot results
2. Check Supabase Edge Function logs
3. Note any error messages from Activity Log
4. Check NOAA service status
5. Verify your Supabase project has:
   - All required tables
   - Proper RLS policies
   - Edge functions deployed
   - Cron job configured

## Success Indicators

When everything is working correctly:

✓ Debug Diagnostics shows all green checkmarks
✓ All tables have data for today
✓ Edge functions return success: true
✓ Report page shows today's surf report
✓ Activity Log shows successful updates
✓ No error messages in Supabase logs

## Next Steps

1. Run Debug Diagnostics to identify any issues
2. Fix any missing tables or policies
3. Test manual data update
4. Verify automatic updates are working
5. Monitor for a few days to ensure stability
