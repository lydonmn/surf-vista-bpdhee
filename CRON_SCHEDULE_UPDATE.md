
# Cron Schedule Update Required

## Action Needed
The daily surf report generation function has been updated and needs its cron schedule changed from 5:00 AM to 6:00 AM EST.

## Steps to Update Cron Schedule

1. Go to your Supabase Dashboard: https://supabase.com/dashboard/project/ucbilksfpnmltrkwvzft
2. Navigate to **Database** → **Cron Jobs** (or **Extensions** → **pg_cron**)
3. Find the existing cron job for `daily-5am-report-with-retry`
4. Update the schedule from `0 5 * * *` (5 AM) to `0 6 * * *` (6 AM EST)

## Current Cron Expression
```
0 5 * * *  (5:00 AM EST)
```

## New Cron Expression
```
0 6 * * *  (6:00 AM EST)
```

## Function Details
- **Function Name**: `daily-5am-report-with-retry`
- **New Schedule**: Daily at 6:00 AM Eastern Time
- **Purpose**: Generates daily surf reports for all active locations with enhanced retry logic

## What Was Fixed
1. ✅ Enhanced retry logic with 5 attempts and exponential backoff (5s, 10s, 20s, 30s, 60s)
2. ✅ Better error handling and logging for each location
3. ✅ Separate retry logic for weather, tide, and surf data
4. ✅ Improved data validation before generating reports
5. ✅ More detailed console logging for debugging

## Testing
You can manually test the function by calling it from the Supabase Dashboard or using the admin panel in the app.
