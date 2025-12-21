
# Edge Function Deployment Guide

## Overview
This guide will help you deploy the updated edge functions that fix the NOAA data fetching errors.

## What Was Fixed
The edge functions have been updated with:
- **Timeout handling**: All NOAA API calls now have 15-second timeouts to prevent hanging
- **Better error messages**: More detailed error reporting to help diagnose issues
- **Improved error handling**: Graceful degradation when APIs are unavailable
- **Environment variable validation**: Checks for missing configuration before making API calls

## Deployment Steps

### 1. Install Supabase CLI (if not already installed)
```bash
npm install -g supabase
```

### 2. Login to Supabase
```bash
supabase login
```

### 3. Link Your Project
```bash
supabase link --project-ref ucbilksfpnmltrkwvzft
```

### 4. Deploy All Edge Functions
Run these commands from your project root directory:

```bash
# Deploy fetch-surf-reports
supabase functions deploy fetch-surf-reports

# Deploy fetch-weather-data
supabase functions deploy fetch-weather-data

# Deploy fetch-tide-data
supabase functions deploy fetch-tide-data

# Deploy generate-daily-report
supabase functions deploy generate-daily-report

# Deploy update-all-surf-data
supabase functions deploy update-all-surf-data
```

### 5. Verify Deployment
After deployment, test the functions:

1. Open your app
2. Go to the Report tab
3. As an admin, tap "Update All Data from NOAA"
4. Check the console logs for detailed error messages

## Testing Individual Functions

You can test individual functions using the Supabase dashboard or CLI:

### Using Supabase Dashboard
1. Go to https://supabase.com/dashboard/project/ucbilksfpnmltrkwvzft/functions
2. Select a function
3. Click "Invoke" to test it

### Using CLI
```bash
# Test fetch-weather-data
supabase functions invoke fetch-weather-data

# Test fetch-tide-data
supabase functions invoke fetch-tide-data

# Test fetch-surf-reports
supabase functions invoke fetch-surf-reports

# Test generate-daily-report
supabase functions invoke generate-daily-report

# Test update-all-surf-data (calls all others)
supabase functions invoke update-all-surf-data
```

## Common Issues and Solutions

### Issue: "Missing Supabase environment variables"
**Solution**: Ensure your edge functions have access to these environment variables:
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_ANON_KEY`

These are automatically set by Supabase, but you can verify them in the dashboard.

### Issue: "Request timeout after 15000ms"
**Solution**: This means the NOAA API is taking too long to respond. This is usually temporary. Wait a few minutes and try again.

### Issue: "NOAA API error: 503" or "NOAA API error: 500"
**Solution**: The NOAA servers are temporarily unavailable. This is outside our control. Wait 5-10 minutes and try again.

### Issue: "Failed to fetch buoy data"
**Solution**: 
- Check if NOAA Buoy 41004 is operational: https://www.ndbc.noaa.gov/station_page.php?station=41004
- The buoy may be offline for maintenance
- Try again later

### Issue: "No tide predictions available for today"
**Solution**: This is normal if:
- It's very early in the morning (before NOAA updates)
- The tide station is temporarily offline
- The date format doesn't match NOAA's expected format

## Monitoring

### View Edge Function Logs
```bash
# View logs for a specific function
supabase functions logs fetch-surf-reports

# Follow logs in real-time
supabase functions logs fetch-surf-reports --follow
```

### Check Function Status
Go to: https://supabase.com/dashboard/project/ucbilksfpnmltrkwvzft/functions

You should see:
- ✅ All functions deployed
- ✅ No errors in recent invocations
- ✅ Response times under 30 seconds

## Automatic Updates

The app is configured to:
- Update data every 15 minutes automatically
- Retry failed requests after 5 seconds
- Refresh data when the app comes to foreground
- Show detailed error messages to admins

## Next Steps

After deploying the edge functions:

1. **Test the Update Button**: As an admin, tap "Update All Data from NOAA" and verify it works
2. **Check the Logs**: Look for any error messages in the console
3. **Verify Data**: Ensure surf reports are being generated with today's date
4. **Monitor Performance**: Check that updates complete within 30-60 seconds

## Support

If you continue to experience issues after deployment:

1. Check the edge function logs in Supabase dashboard
2. Verify NOAA APIs are operational:
   - Buoy: https://www.ndbc.noaa.gov/
   - Weather: https://www.weather.gov/
   - Tides: https://tidesandcurrents.noaa.gov/
3. Review the error messages in the app (shown to admins)
4. Check the admin debug page for detailed diagnostics

## Important Notes

- **NOAA API Reliability**: NOAA APIs can be slow or temporarily unavailable. This is normal and outside our control.
- **Timeout Settings**: The 15-second timeout is a balance between waiting for slow responses and failing fast.
- **Retry Logic**: The app will automatically retry failed requests, so temporary failures will self-resolve.
- **Data Freshness**: Reports are generated from the most recent available data, which may be a few hours old during NOAA maintenance windows.
