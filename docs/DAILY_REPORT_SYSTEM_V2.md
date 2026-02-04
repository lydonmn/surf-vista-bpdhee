
# Daily Surf Report System V2 - Complete Guide

## Overview

The SurfVista app now has a robust daily report generation system that:

1. **Runs at 5 AM EST daily** for both Folly Beach and Pawleys Island
2. **Retries every minute** if initial data aggregation fails (up to 60 minutes)
3. **Updates buoy data every 15 minutes** while preserving the morning narrative
4. **Handles both locations independently** with location-specific buoy data

---

## System Architecture

### 1. Daily 5 AM Report Generation (`daily-5am-report-with-retry`)

**Purpose**: Generate comprehensive surf reports with narrative for both locations

**Schedule**: Runs at 5:00 AM EST daily (configured in Supabase cron)

**Process**:
```
For each location (Folly Beach, Pawleys Island):
  1. Check if valid report already exists for today → Skip if yes
  2. Fetch fresh buoy data from NOAA
  3. Validate wave data (must not be N/A)
  4. If no valid data → Function returns error (will retry next minute)
  5. If valid data found:
     - Fetch weather data
     - Fetch tide data
     - Generate comprehensive narrative
     - Calculate surf rating (1-10)
     - Save report to database
```

**Retry Mechanism**:
- The cron job runs **every minute** from 5:00 AM to 6:00 AM
- Each run checks if a valid report exists
- If report exists → Skip (no duplicate work)
- If no report → Attempt to generate
- If generation fails → Returns error, cron will retry next minute
- Maximum 60 attempts (1 hour window)

**Location-Specific Data**:
- **Folly Beach**: Uses NOAA Buoy 41004 (Edisto, SC)
- **Pawleys Island**: Uses NOAA Buoy 41013 (Frying Pan Shoals)

---

### 2. 15-Minute Buoy Data Updates (`update-buoy-data-15min`)

**Purpose**: Keep buoy data fresh throughout the day while preserving morning narrative

**Schedule**: Runs every 15 minutes from 6:00 AM to 11:59 PM EST

**Process**:
```
For each location (Folly Beach, Pawleys Island):
  1. Fetch fresh buoy data from NOAA
  2. Update surf_conditions table
  3. Update surf_reports table with:
     - New wave_height, wave_period, swell_direction
     - New wind_speed, wind_direction
     - New water_temp
     - Updated rating
     - PRESERVE the morning narrative (conditions field)
```

**Key Feature**: The comprehensive narrative generated at 5 AM is **never overwritten** by the 15-minute updates. Only numerical data is refreshed.

---

### 3. Buoy Data Update Function (`update-buoy-data-only`)

**Purpose**: Update buoy data while preserving narrative

**Features**:
- Updates only buoy-related fields (waves, wind, water temp)
- Preserves the `conditions` field (narrative text)
- Handles missing data gracefully with fallback logic
- Location-aware (processes one location at a time)

**Fallback Logic**:
```
If current buoy data is N/A:
  1. Check if today's report has valid data from earlier → Keep it
  2. If not, find most recent historical data → Use it
  3. Update wind/water temp if available
  4. Keep wave data from last successful fetch
```

---

## Supabase Cron Configuration

You need to configure these cron jobs in your Supabase project:

### Cron Job 1: Daily 5 AM Report (with retry)
```sql
-- Run every minute from 5:00 AM to 5:59 AM EST
-- This provides automatic retry mechanism
select cron.schedule(
  'daily-5am-report-retry',
  '0-59 5 * * *',  -- Every minute during the 5 AM hour
  $$
  select net.http_post(
    url := 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/daily-5am-report-with-retry',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer YOUR_SERVICE_ROLE_KEY"}'::jsonb,
    body := '{}'::jsonb
  ) as request_id;
  $$
);
```

### Cron Job 2: 15-Minute Buoy Updates
```sql
-- Run every 15 minutes from 6 AM to 11:59 PM EST
select cron.schedule(
  'buoy-data-15min',
  '*/15 6-23 * * *',  -- Every 15 minutes, hours 6-23
  $$
  select net.http_post(
    url := 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/update-buoy-data-15min',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer YOUR_SERVICE_ROLE_KEY"}'::jsonb,
    body := '{}'::jsonb
  ) as request_id;
  $$
);
```

**Important**: Replace `YOUR_PROJECT_REF` and `YOUR_SERVICE_ROLE_KEY` with your actual values.

---

## Database Schema

### surf_reports table
```sql
- id: uuid (primary key)
- date: date (part of unique constraint)
- location: text (part of unique constraint) -- 'folly-beach' or 'pawleys-island'
- wave_height: text -- e.g., "3.5 ft"
- surf_height: text -- e.g., "2-3 ft"
- wave_period: text -- e.g., "8 sec"
- swell_direction: text -- e.g., "SE (135°)"
- wind_speed: text -- e.g., "12 mph"
- wind_direction: text -- e.g., "NE (45°)"
- water_temp: text -- e.g., "68°F"
- tide: text -- "See tide times"
- conditions: text -- COMPREHENSIVE NARRATIVE (preserved all day)
- rating: integer -- 1-10 surf quality rating
- updated_at: timestamp
- UNIQUE(date, location)
```

### surf_conditions table
```sql
- id: uuid (primary key)
- date: date (part of unique constraint)
- location: text (part of unique constraint)
- wave_height: text
- surf_height: text
- wave_period: text
- swell_direction: text
- wind_speed: text
- wind_direction: text
- water_temp: text
- buoy_id: text -- '41004' or '41013'
- updated_at: timestamp
- UNIQUE(date, location)
```

---

## How It Works: Step-by-Step

### Morning (5:00 AM - 6:00 AM)

**5:00 AM**: Cron triggers `daily-5am-report-with-retry`
```
1. Check Folly Beach:
   - No report exists for today
   - Fetch buoy data from 41004
   - Wave sensors offline → Returns error
   
2. Check Pawleys Island:
   - No report exists for today
   - Fetch buoy data from 41013
   - Valid wave data found!
   - Generate comprehensive narrative
   - Save report ✅
```

**5:01 AM**: Cron triggers again (automatic retry)
```
1. Check Folly Beach:
   - No report exists for today
   - Fetch buoy data from 41004
   - Valid wave data found!
   - Generate comprehensive narrative
   - Save report ✅
   
2. Check Pawleys Island:
   - Report already exists → Skip ✅
```

**5:02 AM - 5:59 AM**: Cron continues to run
```
Both locations have valid reports → All attempts skip (no wasted work)
```

### Throughout the Day (6:00 AM - 11:59 PM)

**Every 15 minutes**:
```
1. Fetch fresh buoy data for Folly Beach
2. Update surf_reports:
   - wave_height: 3.5 ft → 4.0 ft (updated)
   - wind_speed: 10 mph → 12 mph (updated)
   - conditions: "It's absolutely firing..." (PRESERVED)
   
3. Fetch fresh buoy data for Pawleys Island
4. Update surf_reports:
   - wave_height: 2.5 ft → 2.8 ft (updated)
   - water_temp: 70°F → 71°F (updated)
   - conditions: "Looking pretty fun..." (PRESERVED)
```

---

## Testing the System

### Test 5 AM Report Generation

```bash
# Manually trigger the 5 AM report function
curl -X POST \
  'https://YOUR_PROJECT_REF.supabase.co/functions/v1/daily-5am-report-with-retry' \
  -H 'Authorization: Bearer YOUR_SERVICE_ROLE_KEY' \
  -H 'Content-Type: application/json'
```

**Expected Response**:
```json
{
  "success": true,
  "message": "Daily reports generated successfully for all locations",
  "date": "2024-01-15",
  "results": [
    {
      "success": true,
      "location": "Folly Beach, SC",
      "locationId": "folly-beach",
      "date": "2024-01-15",
      "captureTime": "5:03 AM",
      "rating": 7
    },
    {
      "success": true,
      "location": "Pawleys Island, SC",
      "locationId": "pawleys-island",
      "date": "2024-01-15",
      "captureTime": "5:03 AM",
      "rating": 5
    }
  ]
}
```

### Test 15-Minute Buoy Update

```bash
# Manually trigger the 15-minute update
curl -X POST \
  'https://YOUR_PROJECT_REF.supabase.co/functions/v1/update-buoy-data-15min' \
  -H 'Authorization: Bearer YOUR_SERVICE_ROLE_KEY' \
  -H 'Content-Type: application/json'
```

**Expected Response**:
```json
{
  "success": true,
  "message": "Buoy data updated successfully for all locations (narratives preserved)",
  "results": [
    {
      "location": "Folly Beach, SC",
      "locationId": "folly-beach",
      "success": true,
      "message": "Buoy data updated successfully (narrative preserved)"
    },
    {
      "location": "Pawleys Island, SC",
      "locationId": "pawleys-island",
      "success": true,
      "message": "Buoy data updated successfully (narrative preserved)"
    }
  ],
  "timestamp": "2024-01-15T14:30:00.000Z"
}
```

---

## Monitoring and Debugging

### Check Cron Job Status

```sql
-- View all cron jobs
SELECT * FROM cron.job;

-- View recent cron job runs
SELECT * FROM cron.job_run_details 
ORDER BY start_time DESC 
LIMIT 20;
```

### Check Edge Function Logs

In Supabase Dashboard:
1. Go to **Edge Functions**
2. Select function (`daily-5am-report-with-retry` or `update-buoy-data-15min`)
3. Click **Logs** tab
4. Filter by time range

### Verify Reports in Database

```sql
-- Check today's reports for both locations
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

-- Check buoy data freshness
SELECT 
  location,
  date,
  wave_height,
  wind_speed,
  water_temp,
  updated_at
FROM surf_conditions
WHERE date = CURRENT_DATE
ORDER BY location, updated_at DESC;
```

---

## Troubleshooting

### Problem: No reports generated at 5 AM

**Check**:
1. Cron job is enabled: `SELECT * FROM cron.job WHERE jobname = 'daily-5am-report-retry';`
2. Edge function is deployed: Check Supabase Dashboard → Edge Functions
3. Function logs for errors: Check logs in Supabase Dashboard
4. NOAA buoy is online: Visit https://www.ndbc.noaa.gov/station_page.php?station=41004

**Solution**:
- If buoy is offline, the system will retry every minute for 1 hour
- Check logs to see if retries are happening
- Manually trigger function to test: `curl -X POST ...`

### Problem: Narrative changes throughout the day

**Check**:
1. Verify `update-buoy-data-only` is NOT updating the `conditions` field
2. Check function code - it should only update numerical fields
3. Review logs for `update-buoy-data-15min` function

**Solution**:
- The `conditions` field should NEVER be in the update object
- Only these fields should update: wave_height, wave_period, swell_direction, wind_speed, wind_direction, water_temp, rating

### Problem: One location works, other doesn't

**Check**:
1. Both buoys are online (41004 for Folly Beach, 41013 for Pawleys Island)
2. Location parameter is being passed correctly
3. Database has unique constraint on (date, location)

**Solution**:
- Each location is processed independently
- If one buoy is offline, that location will retry while the other succeeds
- Check logs for location-specific errors

---

## Key Improvements from V1

1. **✅ Automatic Retry**: No manual intervention needed if buoy data is temporarily unavailable
2. **✅ Both Locations**: Processes Folly Beach and Pawleys Island independently
3. **✅ Preserved Narratives**: Morning narrative stays all day, only numbers update
4. **✅ Graceful Degradation**: Falls back to historical data if current data unavailable
5. **✅ No Duplicate Work**: Skips processing if valid report already exists
6. **✅ Comprehensive Logging**: Easy to debug and monitor system health

---

## Summary

The new system ensures:
- **Reliable daily reports** with automatic retry (every minute for 1 hour)
- **Fresh buoy data** updated every 15 minutes
- **Preserved narratives** - the comprehensive morning report text stays all day
- **Both locations** processed independently with location-specific buoy data
- **Graceful handling** of missing or invalid data

The system is production-ready and requires minimal maintenance. Just monitor the cron job logs occasionally to ensure everything is running smoothly.
