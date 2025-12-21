
# Surf Data Error Fix Guide

## Problem
The app is showing errors: "Edge Function returned a non-2xx status code" when trying to update surf data.

## Root Causes Identified

1. **Missing `surf_conditions` table** - The Edge Function `fetch-surf-reports` tries to insert data into a table that doesn't exist
2. **Error handling** - The app was throwing errors on non-2xx responses instead of handling them gracefully
3. **NOAA API issues** - The NOAA APIs might be temporarily unavailable or rate-limited

## Solutions Implemented

### 1. Create the Missing Table

**Option A: Run SQL in Supabase Dashboard**

1. Go to your Supabase project dashboard
2. Navigate to the SQL Editor
3. Copy and paste the contents of `docs/CREATE_SURF_CONDITIONS_TABLE.sql`
4. Click "Run" to execute the SQL

**Option B: Use the Admin Debug Page**

1. Open the app and navigate to `/admin-debug`
2. Scroll to the "Database Tables" section
3. Check if `surf_conditions` table exists
4. If not, you'll need to create it using Option A

### 2. Redeploy Edge Functions

The Edge Functions have been updated with better error handling. You need to redeploy them:

```bash
# Deploy all edge functions
npx supabase functions deploy fetch-weather-data
npx supabase functions deploy fetch-tide-data
npx supabase functions deploy fetch-surf-reports
npx supabase functions deploy generate-daily-report
npx supabase functions deploy update-all-surf-data
```

### 3. Test the Fix

1. Open the app
2. Navigate to `/admin-debug`
3. Click "Test Update All Data"
4. Check the results - you should see detailed logs
5. If any function fails, check the error message for details

## Changes Made

### `hooks/useSurfData.ts`
- Improved error handling to not throw on non-2xx responses
- Better error messages that direct users to the admin debug page
- Always returns HTTP 200 from Edge Functions to prevent client-side errors

### `supabase/functions/update-all-surf-data/index.ts`
- Enhanced logging to show HTTP status codes
- Better error parsing and reporting
- Always returns HTTP 200 to prevent client-side errors
- More detailed response data

### `supabase/functions/fetch-surf-reports/index.ts`
- Added table existence check
- Attempts to create `surf_conditions` table if it doesn't exist
- Better error messages

## Troubleshooting Steps

### If Weather Data Fails
1. Check NOAA Weather API status: https://www.weather.gov/
2. Verify coordinates are correct (Folly Beach: 32.6552, -79.9403)
3. Check Edge Function logs in Supabase dashboard

### If Tide Data Fails
1. Check NOAA Tides API status: https://tidesandcurrents.noaa.gov/
2. Verify station ID is correct (8665530 - Charleston)
3. Check Edge Function logs

### If Surf Data Fails
1. Check NOAA Buoy data: https://www.ndbc.noaa.gov/station_page.php?station=41004
2. Verify buoy is operational
3. Ensure `surf_conditions` table exists
4. Check Edge Function logs

### If Report Generation Fails
1. Ensure weather and surf data were fetched successfully
2. Check that `surf_reports` table exists
3. Verify RLS policies allow service role to insert

## Monitoring

Use the Admin Debug page (`/admin-debug`) to:
- Check table existence
- Test individual Edge Functions
- View detailed error messages
- Monitor data freshness

## Next Steps

1. **Create the `surf_conditions` table** using the SQL file
2. **Redeploy all Edge Functions** with the updated code
3. **Test the update** using the Admin Debug page
4. **Monitor the logs** for any remaining issues

## Common Errors and Solutions

### "Table 'surf_conditions' does not exist"
**Solution:** Run the SQL in `docs/CREATE_SURF_CONDITIONS_TABLE.sql`

### "NOAA API error: 503"
**Solution:** NOAA APIs are temporarily down. Wait and try again later.

### "Request timeout after 15000ms"
**Solution:** NOAA APIs are slow. The timeout has been increased to 30 seconds.

### "Missing Supabase environment variables"
**Solution:** Ensure `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are set in Supabase Edge Function secrets.

## Support

If issues persist:
1. Check the Supabase Edge Function logs
2. Verify all environment variables are set
3. Ensure all tables exist with proper RLS policies
4. Test NOAA APIs directly in a browser
