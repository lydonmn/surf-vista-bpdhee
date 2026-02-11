
# 🌅 Automated 5 AM Daily Report System

## Overview

The SurfVista app now has a fully automated daily surf report generation system that runs every morning at 5 AM EST. This system includes:

- ✅ **Automated daily execution** at 5 AM EST via Supabase cron job
- ✅ **Robust retry mechanism** with 5 attempts and progressive delays (5s, 10s, 20s, 30s, 60s)
- ✅ **Dynamic location support** - automatically processes ALL active locations in the database
- ✅ **New location auto-inclusion** - any new locations added via Admin panel are automatically included
- ✅ **Push notification opt-in** - users can subscribe to receive daily report summaries
- ✅ **Comprehensive narrative generation** - detailed surf conditions with "rideable faces" terminology

## How It Works

### 1. Automated Scheduling

The system is triggered by a Supabase cron job configured to run at 5:00 AM EST daily:

```sql
-- Cron job configuration (set up in Supabase Dashboard)
SELECT cron.schedule(
  'daily-5am-surf-report',
  '0 5 * * *',  -- Every day at 5:00 AM
  $$
  SELECT net.http_post(
    url := 'https://[your-project].supabase.co/functions/v1/daily-5am-report-with-retry',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer [service-role-key]"}'::jsonb,
    body := '{}'::jsonb
  ) AS request_id;
  $$
);
```

### 2. Dynamic Location Processing

The Edge Function automatically:
1. Fetches ALL active locations from the `locations` table
2. Processes each location sequentially with retry logic
3. Generates comprehensive surf reports for each location
4. Sends push notifications to opted-in users

**New locations are automatically included** - no code changes needed!

### 3. Retry Mechanism

For each location, the system attempts up to 5 times with progressive delays:

- **Attempt 1**: Immediate
- **Attempt 2**: Wait 5 seconds
- **Attempt 3**: Wait 10 seconds
- **Attempt 4**: Wait 20 seconds
- **Attempt 5**: Wait 30 seconds
- **Attempt 6**: Wait 60 seconds (final attempt)

This handles transient NOAA server issues and ensures reliable data collection.

### 4. Data Collection Process

For each location, the system:

1. **Checks for existing report** - skips if valid report already exists
2. **Fetches buoy data** - wave height, period, swell direction, wind, water temp
3. **Validates wave data** - ensures rideable wave data is available
4. **Fetches weather data** - air temperature, conditions, forecast
5. **Fetches tide data** - high/low tide times and heights
6. **Generates narrative** - comprehensive surf report with "rideable faces" terminology
7. **Calculates rating** - 1-10 surf quality score
8. **Saves to database** - upserts to `surf_reports` table

### 5. Push Notifications

After successful report generation:

1. System queries `profiles` table for users with `daily_report_notifications = true`
2. Sends push notification via Expo Push Notification service
3. Notification includes:
   - Title: "🌅 Daily Surf Report Ready!"
   - Body: Summary of all locations with ratings
   - Data: Location IDs and date for deep linking

**Users can opt-in/out** via the Profile screen toggle.

## User Features

### Push Notification Opt-In

Users can enable daily surf report notifications in their Profile:

1. Navigate to **Profile** tab
2. Find **Notifications** section
3. Toggle **Daily Surf Report** switch
4. System will:
   - Request notification permissions (if not granted)
   - Register Expo push token
   - Save preference to database
   - Send confirmation alert

### Notification Content

Daily notifications include:
- 🔥 Epic conditions (rating 8-10)
- 🌊 Good conditions (rating 6-7)
- 👍 Decent conditions (rating 4-5)
- 📊 Small conditions (rating 1-3)

Example:
```
🌅 Daily Surf Report Ready!

🔥 Folly Beach: 8/10
🌊 Pawleys Island: 7/10
```

Tapping the notification opens the Report screen.

## Admin Features

### Manual Trigger

Admins can manually trigger the 5 AM report via **Admin Data** screen:

1. Navigate to **Admin Panel** → **Data Sources**
2. Tap **"🌅 Trigger 5 AM Report (X Locations)"**
3. System processes ALL active locations
4. Activity log shows real-time progress
5. Alert shows success/failure for each location

### Location Management

Admins can add new locations via **Admin Panel** → **Manage Locations**:

1. Tap **"+ Add Location"**
2. Enter location details:
   - Name (e.g., "myrtle-beach")
   - Display Name (e.g., "Myrtle Beach, SC")
   - Latitude/Longitude
   - NOAA Buoy ID
   - NOAA Tide Station ID
3. Save location
4. **Automatic inclusion** - next 5 AM run will include this location

### Monitoring

The **Admin Data** screen shows:
- **Today's Report Status** for all locations
- Report existence (✅/❌)
- Narrative quality (character count)
- Wave height
- Last update time

## Technical Details

### Database Schema

**profiles table** (updated):
```sql
- daily_report_notifications: BOOLEAN (default: false)
- push_token: TEXT (Expo push token)
- notification_preferences: JSONB (future expansion)
```

**locations table** (existing):
```sql
- id: TEXT (primary key, e.g., "folly-beach")
- name: TEXT (unique, e.g., "Folly Beach")
- display_name: TEXT (e.g., "Folly Beach, SC")
- latitude: NUMERIC
- longitude: NUMERIC
- buoy_id: TEXT (NOAA buoy ID)
- tide_station_id: TEXT (NOAA tide station ID)
- is_active: BOOLEAN (default: true)
```

### Edge Functions

**daily-5am-report-with-retry** (main function):
- Fetches active locations from database
- Processes each location with retry logic
- Generates comprehensive narratives
- Sends push notifications to opted-in users

**Supporting functions** (all location-aware):
- `fetch-surf-reports` - Fetches buoy data
- `fetch-weather-data` - Fetches weather/forecast
- `fetch-tide-data` - Fetches tide schedule
- `generate-daily-report` - Generates narrative

### Notification Flow

```
5 AM Cron Job
    ↓
daily-5am-report-with-retry
    ↓
Process Each Location (with retry)
    ↓
Generate Reports
    ↓
Query opted-in users (daily_report_notifications = true)
    ↓
Send push notifications via Expo
    ↓
Users receive notification
    ↓
Tap notification → Opens Report screen
```

## Setup Checklist

### Supabase Configuration

- [x] Database migration applied (notification columns added)
- [x] Edge Function deployed (`daily-5am-report-with-retry`)
- [ ] Cron job configured (5 AM EST daily)
- [ ] Service role key configured in cron job

### App Configuration

- [x] `expo-notifications` package installed
- [x] `expo-device` package installed
- [x] Notification permissions added to app.json
- [x] Push notification utility created
- [x] Profile screen updated with opt-in toggle
- [x] Notification listener configured in _layout.tsx

### Testing

To test the system:

1. **Manual Trigger**: Use Admin Data screen to trigger manually
2. **Check Logs**: View activity log for real-time progress
3. **Verify Reports**: Check Report screen for generated narratives
4. **Test Notifications**: 
   - Enable notifications in Profile
   - Trigger manual report generation
   - Verify notification received
   - Tap notification to test deep linking

## Troubleshooting

### No Notifications Received

1. Check notification permissions are granted
2. Verify `daily_report_notifications = true` in database
3. Verify `push_token` is saved in database
4. Check Edge Function logs for push notification errors
5. Ensure running on physical device (not simulator)

### Location Not Included

1. Verify location has `is_active = true` in database
2. Check location has valid buoy_id and tide_station_id
3. Manually trigger 5 AM report to test
4. Check Edge Function logs for location processing

### Report Generation Fails

1. Check NOAA buoy data is available (buoy may be offline)
2. Verify buoy_id and tide_station_id are correct
3. Check Edge Function logs for specific errors
4. Retry mechanism will attempt 5 times automatically

## Future Enhancements

Potential improvements:
- [ ] Notification preferences per location
- [ ] Custom notification times
- [ ] Video upload notifications
- [ ] Severe weather alerts
- [ ] Swell forecast notifications
- [ ] Weekly summary notifications

## Support

For issues or questions:
- Check Edge Function logs in Supabase Dashboard
- Review activity log in Admin Data screen
- Verify cron job is running in Supabase Dashboard
- Check notification permissions in device settings
