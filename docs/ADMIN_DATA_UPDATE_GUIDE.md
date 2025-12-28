
# Admin Guide: Data Updates & Troubleshooting

## Quick Reference

### How to Update Surf Data

1. **Open the App** → Navigate to the **Report** tab
2. **Click "Update All Data from NOAA"** button (admin only)
3. **Wait 5-10 seconds** for the update to complete
4. **Pull down to refresh** the screen to see new data

### What Gets Updated

✅ **Weather Data** (Current + 7-day forecast)
- Temperature, wind, conditions
- Swell height predictions

✅ **Surf Conditions** (Real-time from buoy)
- Wave height, period, swell direction
- Wind speed and direction
- Water temperature

✅ **Tide Data** (7-day predictions)
- High and low tide times
- Tide heights

✅ **Surf Report** (Auto-generated)
- Surf rating (1-10)
- Conversational narrative
- Conditions summary

## Understanding Update Results

### ✅ Success Messages

**"All surf data updated successfully"**
- Everything worked perfectly
- All data sources responded
- Report generated successfully

**"Critical surf data updated successfully (some optional updates failed)"**
- Weather and surf data fetched ✅
- Report generated ✅
- Tide or AI predictions may have failed (not critical)

### ❌ Error Messages

**"Failed to update critical surf data"**
- Weather or surf data failed to fetch
- Report cannot be generated
- Check your internet connection
- Try again in a few minutes

**"Weather: Request timeout after 15000ms"**
- NOAA weather API is slow or down
- System will retry automatically
- Try again in 5-10 minutes

**"Surf: Failed to fetch buoy data"**
- NOAA buoy is offline or not responding
- System will retry automatically
- Try again in 5-10 minutes

**"Report: Missing required data (weather or surf)"**
- Cannot generate report without both weather and surf data
- Update weather and surf data first
- Then try generating report again

## Troubleshooting

### Problem: "Unable to fetch surf data" Error

**Possible Causes:**
1. No internet connection
2. NOAA APIs are temporarily down
3. Buoy is offline for maintenance

**Solutions:**
1. Check your internet connection
2. Wait 5-10 minutes and try again
3. Check NOAA status: https://www.ndbc.noaa.gov/
4. If problem persists for >1 hour, contact support

### Problem: Report Shows Old Data

**Solution:**
1. Click "Update All Data from NOAA"
2. Wait for success message
3. Pull down to refresh the screen
4. Check "Last updated" timestamp

### Problem: Forecast Shows "1-2 ft" for All Days

**Cause:** No actual buoy data available yet

**Solution:**
1. Wait for buoy data to be fetched
2. Click "Update All Data from NOAA"
3. Forecasts will update with real predictions

### Problem: No Report for Today

**Cause:** Missing weather or surf data

**Solution:**
1. Click "Update All Data from NOAA"
2. Ensure both weather and surf data are fetched
3. Report will generate automatically
4. If still no report, check error messages

## Data Sources

### NOAA Weather API
- **Status**: https://www.weather.gov/
- **Update Frequency**: Hourly
- **Reliability**: 99%+
- **Backup**: None (official source)

### NOAA Buoy 41004 (Edisto, SC)
- **Status**: https://www.ndbc.noaa.gov/station_page.php?station=41004
- **Update Frequency**: Hourly
- **Reliability**: 95%+ (can go offline for maintenance)
- **Distance from Folly Beach**: ~30 miles

### NOAA Tides (Charleston Harbor)
- **Status**: https://tidesandcurrents.noaa.gov/
- **Update Frequency**: Daily
- **Reliability**: 99%+
- **Station**: 8665530 (Charleston, Cooper River Entrance)

## Automatic Updates

### Cron Jobs (If Configured)

The system can run automatic updates:
- **Daily at 6:00 AM EST**: Full data update with AI predictions
- **Hourly**: Quick surf conditions update

**To check cron job status:**
1. Go to Supabase Dashboard
2. Navigate to Database → Cron Jobs
3. Check last execution time and status

**To manually trigger cron job:**
1. Use the "Update All Data from NOAA" button in the app
2. Or call the edge function directly via API

## Best Practices

### When to Update Data

✅ **Good Times:**
- Early morning (6-8 AM) for daily report
- Before posting new video
- When conditions change significantly
- After NOAA updates (hourly)

❌ **Avoid:**
- During NOAA maintenance windows (rare)
- When internet is unstable
- Multiple times per minute (rate limiting)

### Data Freshness

- **Weather**: Updates hourly from NOAA
- **Surf Conditions**: Updates hourly from buoy
- **Tides**: Updates daily (predictions don't change)
- **Reports**: Generated on-demand or daily

### Rate Limiting

NOAA APIs have no strict rate limits, but:
- Don't update more than once per minute
- System has built-in retry logic
- Automatic updates are spaced appropriately

## Advanced: Manual Edge Function Calls

If you need to call edge functions directly:

### Update All Data
```bash
curl -X POST \
  https://ucbilksfpnmltrkwvzft.supabase.co/functions/v1/update-all-surf-data \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY"
```

### Fetch Weather Only
```bash
curl -X POST \
  https://ucbilksfpnmltrkwvzft.supabase.co/functions/v1/fetch-weather-data \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY"
```

### Generate Report Only
```bash
curl -X POST \
  https://ucbilksfpnmltrkwvzft.supabase.co/functions/v1/generate-daily-report \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY"
```

## Monitoring

### Check Edge Function Logs

1. Go to Supabase Dashboard
2. Navigate to Edge Functions
3. Select function (e.g., `update-all-surf-data`)
4. Click "Logs" tab
5. Look for errors or warnings

### Check Database Tables

1. Go to Supabase Dashboard
2. Navigate to Table Editor
3. Check these tables:
   - `weather_data` - Current weather
   - `weather_forecast` - 7-day forecast
   - `surf_conditions` - Current surf
   - `tide_data` - Tide predictions
   - `surf_reports` - Generated reports

### Key Metrics

- **Last Update Time**: Check `updated_at` field
- **Data Completeness**: All required fields populated
- **Report Quality**: Rating and narrative make sense

## Getting Help

### Self-Service
1. Check this guide
2. Review error messages
3. Check NOAA status pages
4. Try again after 5-10 minutes

### Contact Support
If issues persist:
1. Note the exact error message
2. Check edge function logs
3. Note the time of the error
4. Contact technical support with details

## Summary

✅ **Data updates are now automatic and reliable**
✅ **Retry logic handles temporary failures**
✅ **Clear error messages for troubleshooting**
✅ **Graceful degradation for optional data**
✅ **Comprehensive logging for debugging**

The system is designed to "just work" - most of the time you won't need to do anything except click "Update All Data" when you want fresh information!
