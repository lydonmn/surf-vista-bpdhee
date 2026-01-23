
# Daily Report System - How It Works

## Overview
The SurfVista app uses a sophisticated system to ensure users always see accurate, up-to-date surf conditions with a consistent daily narrative.

## Key Principles

### 1. **5:00 AM Daily Narrative Report (First Report of the Day)**
- **When**: Every day at 5:00 AM EST
- **What**: Generates the complete surf report including the narrative text
- **Retry Logic**: If buoy data is unavailable at 5 AM, the system retries every 1 minute for up to 60 minutes until successful
- **Function**: `daily-5am-report-with-retry` → calls `generate-first-daily-report`

### 2. **15-Minute Buoy Data Updates (5 AM - 9 PM)**
- **When**: Every 15 minutes from 5:00 AM to 9:00 PM EST
- **What**: Updates ONLY the buoy data (wave height, wind, water temp, rating) while preserving the 5 AM narrative
- **Fallback**: If buoy data is unavailable, the report displays the most recent successful buoy data from today
- **Function**: `update-buoy-data-15min` → calls `fetch-surf-reports` → `update-buoy-data-only`

## Data Flow

### Morning (5:00 AM)
```
1. daily-5am-report-with-retry
   ↓
2. fetch-weather-data (get weather)
   ↓
3. fetch-tide-data (get tides)
   ↓
4. fetch-surf-reports (get buoy data)
   ↓
5. generate-first-daily-report (create narrative + buoy data)
   ↓
6. If buoy data unavailable → retry every 1 minute
   ↓
7. Success → Report stored with narrative
```

### Throughout the Day (Every 15 Minutes, 5 AM - 9 PM)
```
1. update-buoy-data-15min
   ↓
2. fetch-surf-reports (get fresh buoy data)
   ↓
3. update-buoy-data-only
   ↓
4. If buoy data available:
   - Update wave_height, wind_speed, water_temp, rating
   - PRESERVE the 5 AM narrative (conditions field)
   ↓
5. If buoy data unavailable:
   - Keep existing report with most recent successful data
   - Do NOT revert to yesterday's data
```

## Database Schema

### surf_reports Table
- `date`: The report date (YYYY-MM-DD)
- `conditions`: The narrative text (generated at 5 AM, preserved all day)
- `wave_height`: Updated every 15 minutes
- `wave_period`: Updated every 15 minutes
- `wind_speed`: Updated every 15 minutes
- `wind_direction`: Updated every 15 minutes
- `water_temp`: Updated every 15 minutes
- `rating`: Updated every 15 minutes (recalculated based on current conditions)
- `updated_at`: Timestamp of last update

### surf_conditions Table
- Stores raw buoy data from NOAA
- Updated every 15 minutes by `fetch-surf-reports`
- Source for buoy data updates

## Edge Functions

### 1. `daily-5am-report-with-retry`
- **Purpose**: Orchestrate the 5 AM report generation with retry logic
- **Retry**: Every 1 minute for up to 60 minutes
- **Called by**: Cron job at 5:00 AM EST

### 2. `generate-first-daily-report`
- **Purpose**: Generate the complete daily report with narrative
- **Input**: Surf conditions, weather data, tide data
- **Output**: Complete surf report with narrative text
- **Called by**: `daily-5am-report-with-retry`

### 3. `update-buoy-data-15min`
- **Purpose**: Orchestrate the 15-minute buoy data updates
- **Called by**: Cron job every 15 minutes (5 AM - 9 PM EST)

### 4. `update-buoy-data-only`
- **Purpose**: Update only buoy data fields, preserve narrative
- **Input**: Fresh surf conditions from NOAA
- **Output**: Updated report with preserved narrative
- **Fallback**: If no valid data, keep existing report
- **Called by**: `update-buoy-data-15min`

### 5. `fetch-surf-reports`
- **Purpose**: Fetch fresh buoy data from NOAA
- **Updates**: `surf_conditions` table
- **Called by**: Both `daily-5am-report-with-retry` and `update-buoy-data-15min`

## Cron Job Schedule

### Production Schedule
```
# 5:00 AM EST - Generate first daily report with retry logic
0 5 * * * daily-5am-report-with-retry

# Every 15 minutes from 5:00 AM to 9:00 PM EST - Update buoy data only
*/15 5-21 * * * update-buoy-data-15min
```

## User Experience

### What Users See
1. **Morning (5 AM)**: Fresh narrative report generated with current conditions
2. **Throughout the Day**: Same narrative, but buoy data (wave height, wind, etc.) updates every 15 minutes
3. **If Buoy Offline**: Most recent successful data from today is displayed, not yesterday's data
4. **Next Day (5 AM)**: New narrative generated for the new day

### Example Timeline
```
5:00 AM  → New narrative: "Looking pretty fun out there today. Small SE swell..."
5:15 AM  → Same narrative, updated buoy data: 3.2 ft waves, 12 mph wind
5:30 AM  → Same narrative, updated buoy data: 3.4 ft waves, 14 mph wind
...
9:00 PM  → Same narrative, final update: 2.8 ft waves, 8 mph wind
Next Day 5:00 AM → NEW narrative: "Epic conditions today! Nice SE swell..."
```

## Deployment

### Deploy Edge Functions
```bash
# Deploy all new functions
supabase functions deploy daily-5am-report-with-retry
supabase functions deploy generate-first-daily-report
supabase functions deploy update-buoy-data-15min
supabase functions deploy update-buoy-data-only
```

### Set Up Cron Jobs
1. Go to Supabase Dashboard → Database → Cron Jobs
2. Create two cron jobs:
   - **5 AM Report**: `0 5 * * *` → `daily-5am-report-with-retry`
   - **15-Min Updates**: `*/15 5-21 * * *` → `update-buoy-data-15min`

## Troubleshooting

### Issue: No report generated at 5 AM
- **Check**: Edge function logs for `daily-5am-report-with-retry`
- **Verify**: Buoy data is available from NOAA
- **Solution**: System will retry every 1 minute for up to 60 minutes

### Issue: Buoy data not updating
- **Check**: Edge function logs for `update-buoy-data-15min`
- **Verify**: `fetch-surf-reports` is successfully fetching data
- **Expected**: If buoy offline, report shows most recent successful data from today

### Issue: Narrative changing throughout the day
- **Check**: Ensure `update-buoy-data-only` is being called, not `generate-daily-report`
- **Verify**: Cron jobs are configured correctly
- **Fix**: Update cron jobs to call `update-buoy-data-15min` instead of `update-all-surf-data`

## Benefits

1. **Consistent Narrative**: Users see the same well-written narrative all day
2. **Fresh Data**: Buoy conditions update every 15 minutes
3. **Reliability**: Retry logic ensures report is generated even if buoy is temporarily offline
4. **Smart Fallback**: Shows most recent successful data from today, not yesterday's stale data
5. **Efficient**: Only fetches what's needed (buoy data) for 15-minute updates
