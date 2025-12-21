
# Deploy Edge Functions - Quick Guide

## Prerequisites

1. Install Supabase CLI:
   ```bash
   npm install -g supabase
   ```

2. Login to Supabase:
   ```bash
   supabase login
   ```

3. Link your project:
   ```bash
   supabase link --project-ref ucbilksfpnmltrkwvzft
   ```

## Deploy All Functions

Deploy all edge functions at once:

```bash
# From the project root directory
supabase functions deploy fetch-weather-data
supabase functions deploy fetch-tide-data
supabase functions deploy fetch-surf-reports
supabase functions deploy generate-daily-report
supabase functions deploy update-all-surf-data
```

Or deploy them all in one command:

```bash
supabase functions deploy fetch-weather-data && \
supabase functions deploy fetch-tide-data && \
supabase functions deploy fetch-surf-reports && \
supabase functions deploy generate-daily-report && \
supabase functions deploy update-all-surf-data
```

## Test the Functions

### Test Individual Functions

```bash
# Test weather data fetch
curl -X POST \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  https://ucbilksfpnmltrkwvzft.supabase.co/functions/v1/fetch-weather-data

# Test tide data fetch
curl -X POST \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  https://ucbilksfpnmltrkwvzft.supabase.co/functions/v1/fetch-tide-data

# Test surf conditions fetch
curl -X POST \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  https://ucbilksfpnmltrkwvzft.supabase.co/functions/v1/fetch-surf-reports

# Test report generation
curl -X POST \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  https://ucbilksfpnmltrkwvzft.supabase.co/functions/v1/generate-daily-report
```

### Test the Unified Update Function

```bash
curl -X POST \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  https://ucbilksfpnmltrkwvzft.supabase.co/functions/v1/update-all-surf-data
```

This will call all functions in sequence and return a comprehensive result.

## View Logs

View logs for a specific function:

```bash
supabase functions logs fetch-weather-data
supabase functions logs fetch-tide-data
supabase functions logs fetch-surf-reports
supabase functions logs generate-daily-report
supabase functions logs update-all-surf-data
```

Or view logs in the Supabase Dashboard:
1. Go to https://supabase.com/dashboard/project/ucbilksfpnmltrkwvzft
2. Navigate to **Edge Functions**
3. Click on a function
4. View the **Logs** tab

## Verify Data in Database

After running the functions, check the database:

```sql
-- Check weather data
SELECT * FROM weather_data ORDER BY updated_at DESC LIMIT 1;

-- Check weather forecast
SELECT * FROM weather_forecast ORDER BY date, period_name LIMIT 10;

-- Check tide data
SELECT * FROM tide_data ORDER BY date DESC, time LIMIT 10;

-- Check surf conditions
SELECT * FROM surf_conditions ORDER BY updated_at DESC LIMIT 1;

-- Check surf reports
SELECT * FROM surf_reports ORDER BY date DESC LIMIT 1;
```

## Common Issues

### Function Not Found
- Make sure you deployed the function
- Check the function name is correct
- Verify you're using the correct project URL

### Authorization Error
- Verify your anon key is correct
- Check that RLS policies allow the operation
- Ensure the function has the correct permissions

### NOAA API Errors
- NOAA APIs may be temporarily down
- Check your internet connection
- Verify the API endpoints are correct

### Data Not Appearing
- Check the edge function logs for errors
- Verify the date format matches (YYYY-MM-DD)
- Ensure timezone handling is correct (EST)

## Next Steps

1. ✅ Deploy all edge functions
2. ✅ Test each function individually
3. ✅ Test the unified update function
4. ✅ Verify data appears in the database
5. ✅ Set up automatic updates (see DATA_UPDATE_GUIDE.md)
6. ✅ Test the app to ensure data displays correctly

## Quick Commands Reference

```bash
# Deploy all functions
supabase functions deploy fetch-weather-data && \
supabase functions deploy fetch-tide-data && \
supabase functions deploy fetch-surf-reports && \
supabase functions deploy generate-daily-report && \
supabase functions deploy update-all-surf-data

# Test the unified update function
curl -X POST \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  https://ucbilksfpnmltrkwvzft.supabase.co/functions/v1/update-all-surf-data

# View logs
supabase functions logs update-all-surf-data --follow
```

Replace `YOUR_ANON_KEY` with your actual Supabase anon key from:
https://supabase.com/dashboard/project/ucbilksfpnmltrkwvzft/settings/api

---

**Important**: After deploying, test the functions immediately to ensure they work correctly. The app will automatically use the updated functions.
