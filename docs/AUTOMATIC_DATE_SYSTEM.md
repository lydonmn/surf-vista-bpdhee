
# Automatic Date System - SurfVista

## Overview

The SurfVista app is designed to **automatically update all date-dependent features** without requiring any manual date management. This document explains how the system works and ensures data stays current.

## How It Works

### 1. Dynamic Date Calculation

All edge functions use the `getESTDate()` helper function to calculate the current date in EST timezone:

```typescript
function getESTDate(): string {
  const now = new Date();
  const estDateString = now.toLocaleString('en-US', { 
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  
  const [month, day, year] = estDateString.split('/');
  return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
}
```

**Key Points:**
- ✅ Uses `toLocaleString` with `America/New_York` timezone
- ✅ Automatically handles EST/EDT transitions
- ✅ No hardcoded dates anywhere in the system
- ✅ Always returns current date in YYYY-MM-DD format

### 2. Edge Functions (Data Fetching)

All data fetching edge functions automatically use the current date:

#### `fetch-weather-data`
- Fetches current weather and 7-day forecast from NOAA
- Uses `getESTDate()` to determine today's date
- Stores data with current date automatically

#### `fetch-surf-reports`
- Fetches surf conditions from NOAA buoy
- Uses `getESTDate()` to determine today's date
- Calculates surf height based on current wave data

#### `fetch-tide-data`
- Fetches tide predictions from NOAA
- Uses `getESTDate()` to determine today's date
- Stores tide times for current day

#### `generate-daily-report`
- Generates surf report narrative
- Uses `getESTDate()` to determine today's date
- Combines all current data into a comprehensive report

### 3. Automatic Updates

The system updates data automatically through multiple mechanisms:

#### A. Client-Side Automatic Refresh (useSurfData.ts)
```typescript
- Refreshes every 15 minutes automatically
- Refreshes when app comes to foreground
- Refreshes on real-time database changes
- Always fetches data for current date
```

#### B. Scheduled Cron Job (daily-update-cron)
```typescript
- Runs daily at 6:00 AM EST
- Calls update-all-surf-data function
- Ensures fresh data every morning
- No manual intervention required
```

#### C. Manual Refresh
```typescript
- Pull-to-refresh on forecast screen
- Refresh button in UI
- Calls update-all-surf-data function
```

### 4. Data Cleanup

The `cleanup-old-reports` function automatically removes old data:

```typescript
- Runs daily (can be scheduled)
- Removes data older than 7 days
- Keeps database clean and efficient
- Uses dynamic date calculation
```

**What Gets Cleaned:**
- Surf reports older than 7 days
- Weather data older than 7 days
- Weather forecasts older than today
- Tide data older than 7 days

### 5. UI Date Handling

The UI components correctly parse and display dates:

```typescript
// Helper function to parse date string as local date (not UTC)
function parseLocalDate(dateStr: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day);
}

// Helper function to get day name
function getDayName(dateStr: string, index: number): string {
  if (index === 0) return 'Today';
  const date = parseLocalDate(dateStr);
  return date.toLocaleDateString('en-US', { weekday: 'short' });
}
```

**Key Points:**
- ✅ Parses dates as local dates (not UTC)
- ✅ Displays "Today" for current day
- ✅ Shows day names correctly
- ✅ No timezone conversion issues

## System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     AUTOMATIC DATE SYSTEM                    │
└─────────────────────────────────────────────────────────────┘

┌──────────────────┐
│  Cron Job        │  Runs daily at 6:00 AM EST
│  (Scheduled)     │  ↓
└──────────────────┘
         │
         ↓
┌──────────────────┐
│ daily-update-    │  Orchestrates all updates
│ cron             │  ↓
└──────────────────┘
         │
         ↓
┌──────────────────┐
│ update-all-      │  Calls all data fetching functions
│ surf-data        │  ↓
└──────────────────┘
         │
         ├─→ fetch-weather-data  (uses getESTDate())
         ├─→ fetch-tide-data     (uses getESTDate())
         ├─→ fetch-surf-reports  (uses getESTDate())
         └─→ generate-daily-report (uses getESTDate())
                    │
                    ↓
         ┌──────────────────┐
         │  Supabase DB     │  Stores data with current date
         │  (Tables)        │
         └──────────────────┘
                    │
                    ↓
         ┌──────────────────┐
         │  Real-time       │  Notifies clients of changes
         │  Subscriptions   │
         └──────────────────┘
                    │
                    ↓
         ┌──────────────────┐
         │  useSurfData     │  Fetches data for current date
         │  Hook            │  Refreshes every 15 minutes
         └──────────────────┘
                    │
                    ↓
         ┌──────────────────┐
         │  UI Components   │  Displays current data
         │  (Forecast, etc) │  Shows "Today" correctly
         └──────────────────┘
```

## Verification Checklist

To verify the automatic date system is working correctly:

### ✅ Edge Functions
- [ ] All edge functions use `getESTDate()` for date calculation
- [ ] No hardcoded dates in any edge function
- [ ] Functions log current EST date for debugging
- [ ] Functions handle timezone correctly (America/New_York)

### ✅ Database
- [ ] Data is stored with current date
- [ ] Old data is cleaned up automatically
- [ ] Forecast data shows future dates
- [ ] No duplicate date entries

### ✅ UI
- [ ] "Today" shows current day's data
- [ ] Day names are correct (Mon, Tue, etc.)
- [ ] Dates advance automatically each day
- [ ] No timezone display issues

### ✅ Automatic Updates
- [ ] Cron job is scheduled in Supabase
- [ ] Data refreshes every 15 minutes in app
- [ ] Pull-to-refresh works correctly
- [ ] Real-time updates trigger refresh

## Troubleshooting

### Issue: Forecast shows wrong dates

**Solution:**
1. Check edge function logs for date calculation
2. Verify `getESTDate()` is being used
3. Check database for correct date values
4. Verify UI is using `parseLocalDate()`

### Issue: Data not updating automatically

**Solution:**
1. Check if cron job is scheduled in Supabase
2. Verify edge functions are deployed
3. Check useSurfData hook is refreshing
4. Verify real-time subscriptions are active

### Issue: "Today" shows yesterday's data

**Solution:**
1. Check server timezone settings
2. Verify `America/New_York` timezone is used
3. Check if data fetch is using current date
4. Verify database has today's data

## Maintenance

### No Manual Maintenance Required! 🎉

The system is designed to be **completely automatic**:

- ✅ Dates update automatically every day
- ✅ Data fetches automatically every 15 minutes
- ✅ Cron job runs automatically every morning
- ✅ Old data cleans up automatically
- ✅ UI updates automatically

### Optional: Monitor System Health

You can optionally monitor the system:

1. **Check Supabase Logs**
   - View edge function logs
   - Verify cron job execution
   - Check for any errors

2. **Check Database**
   - Verify data is current
   - Check for duplicate dates
   - Verify cleanup is working

3. **Test in App**
   - Pull to refresh
   - Check "Today" shows current data
   - Verify forecast dates are correct

## Scheduling the Cron Job

To ensure the daily update runs automatically, you need to schedule the cron job in Supabase:

### Option 1: Using Supabase Dashboard

1. Go to Supabase Dashboard → Database → Cron Jobs
2. Create a new cron job:
   - **Name:** Daily Surf Data Update
   - **Schedule:** `0 6 * * *` (6:00 AM EST daily)
   - **Function:** `daily-update-cron`
   - **Timezone:** America/New_York

### Option 2: Using pg_cron (SQL)

Run this SQL in your Supabase SQL Editor:

```sql
-- Enable pg_cron extension if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Schedule daily update at 6:00 AM EST
SELECT cron.schedule(
  'daily-surf-data-update',
  '0 6 * * *',
  $$
  SELECT
    net.http_post(
      url := 'https://ucbilksfpnmltrkwvzft.supabase.co/functions/v1/daily-update-cron',
      headers := '{"Content-Type": "application/json", "Authorization": "Bearer YOUR_ANON_KEY"}'::jsonb
    ) AS request_id;
  $$
);

-- Schedule cleanup at 2:00 AM EST daily
SELECT cron.schedule(
  'cleanup-old-reports',
  '0 2 * * *',
  $$
  SELECT
    net.http_post(
      url := 'https://ucbilksfpnmltrkwvzft.supabase.co/functions/v1/cleanup-old-reports',
      headers := '{"Content-Type": "application/json", "Authorization": "Bearer YOUR_ANON_KEY"}'::jsonb
    ) AS request_id;
  $$
);
```

**Note:** Replace `YOUR_ANON_KEY` with your actual Supabase anon key.

### Option 3: Using External Cron Service

If Supabase cron is not available, use an external service like:
- **Cron-job.org** (free)
- **EasyCron** (free tier available)
- **GitHub Actions** (free for public repos)

Configure to call:
- `https://ucbilksfpnmltrkwvzft.supabase.co/functions/v1/daily-update-cron` at 6:00 AM EST
- `https://ucbilksfpnmltrkwvzft.supabase.co/functions/v1/cleanup-old-reports` at 2:00 AM EST

## Summary

The SurfVista app uses a **fully automatic date system** that:

1. ✅ Calculates current date dynamically in EST timezone
2. ✅ Fetches data for current date automatically
3. ✅ Updates data every 15 minutes in the app
4. ✅ Runs scheduled updates daily at 6:00 AM EST
5. ✅ Cleans up old data automatically
6. ✅ Displays dates correctly in the UI
7. ✅ Requires **zero manual date management**

**The system will continue to work correctly indefinitely without any manual intervention!** 🎉
