
# 🌅 Automated 5 AM Daily Report System with Push Notifications

## Overview
The SurfVista app now has a fully automated daily surf report generation system that runs at 5 AM EST every day for ALL locations (current and future). Users can opt-in to receive push notifications with a summary of the daily report.

## ✅ What's Automated

### 1. **Daily 5 AM Report Generation**
- **Trigger**: Cron job runs at 5:00 AM EST every day
- **Edge Function**: `daily-5am-report-with-retry`
- **Process**:
  1. Fetches ALL active locations from the `locations` table
  2. For each location:
     - Fetches fresh buoy data (surf conditions)
     - Fetches weather data
     - Fetches tide data
     - Generates comprehensive narrative report
     - Calculates surf rating (1-10)
     - Saves report to `surf_reports` table
     - Sends push notifications to opted-in users

### 2. **Robust Retry Mechanism**
- **5 retry attempts** per location with progressive delays:
  - Attempt 1: Immediate
  - Attempt 2: Wait 5 seconds
  - Attempt 3: Wait 10 seconds
  - Attempt 4: Wait 20 seconds
  - Attempt 5: Wait 30 seconds
  - Attempt 6: Wait 60 seconds (final)
- **Lenient validation**: Accepts partial buoy data if wave sensors are offline
- **Non-blocking**: Weather/tide failures don't stop report generation

### 3. **Dynamic Location Support**
- **Automatic**: Works for ALL locations in the `locations` table where `is_active = true`
- **Future-proof**: New locations added via Admin Locations screen are automatically included
- **No code changes needed**: Just add a location in the admin panel

### 4. **Push Notifications**
- **Opt-in system**: Users enable notifications in Profile screen
- **Notification content**:
  - Title: "🔥 [Location] Surf Report" (emoji varies by rating)
  - Body: Wave height, rating, and summary
  - Tap to open: Navigates to Report screen
- **Delivery**: Sent immediately after report generation (around 5 AM)

## 📊 Database Schema

### Required Columns in `profiles` table:
```sql
-- Push notification columns
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS push_token TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS daily_report_notifications BOOLEAN DEFAULT false;
```

### Required Table: `locations`
```sql
-- Already exists with columns:
- id (uuid, primary key)
- name (text, e.g., 'folly-beach')
- display_name (text, e.g., 'Folly Beach, SC')
- latitude (numeric)
- longitude (numeric)
- buoy_id (text)
- tide_station_id (text)
- is_active (boolean)
```

## 🔧 Setup Instructions

### 1. Deploy Edge Functions
```bash
# Deploy the main 5 AM function
supabase functions deploy daily-5am-report-with-retry

# Deploy the notification sender
supabase functions deploy send-daily-report-notifications

# Deploy supporting functions (if not already deployed)
supabase functions deploy fetch-surf-reports
supabase functions deploy fetch-weather-data
supabase functions deploy fetch-tide-data
```

### 2. Set Up Cron Job in Supabase Dashboard
1. Go to Supabase Dashboard → Database → Cron Jobs
2. Create new cron job:
   - **Name**: `daily-5am-surf-reports`
   - **Schedule**: `0 5 * * *` (5 AM EST daily)
   - **Command**: 
     ```sql
     SELECT net.http_post(
       url := 'https://[YOUR-PROJECT-REF].supabase.co/functions/v1/daily-5am-report-with-retry',
       headers := jsonb_build_object(
         'Content-Type', 'application/json',
         'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
       ),
       body := '{}'::jsonb
     );
     ```
3. Enable the cron job

### 3. Add Database Columns (if not exists)
```sql
-- Add push notification columns to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS push_token TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS daily_report_notifications BOOLEAN DEFAULT false;

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_profiles_daily_notifications 
ON profiles(daily_report_notifications) 
WHERE daily_report_notifications = true;
```

## 📱 User Experience

### Enabling Notifications
1. User opens Profile screen
2. Sees "Notifications" card with "Daily Surf Report" toggle
3. Toggles ON
4. App requests push notification permissions
5. Saves push token and preference to database
6. User receives confirmation: "You will receive a push notification each morning at 5 AM"

### Receiving Notifications
1. At 5 AM EST, cron job triggers
2. Reports generated for all locations
3. Push notifications sent to all opted-in users
4. Notification shows:
   - Title: "🔥 Folly Beach, SC Surf Report"
   - Body: "3-4 ft waves • 7/10 rating\nLooking pretty fun out there today..."
5. User taps notification → Opens Report screen

## 🔍 Monitoring & Debugging

### Check Cron Job Logs
```sql
-- View recent cron job executions
SELECT * FROM cron.job_run_details 
WHERE jobname = 'daily-5am-surf-reports' 
ORDER BY start_time DESC 
LIMIT 10;
```

### Check Edge Function Logs
- Go to Supabase Dashboard → Edge Functions → Logs
- Filter by function: `daily-5am-report-with-retry`
- Look for:
  - "✅ All locations processed successfully"
  - "❌ Failed" messages with error details

### Check Notification Status
```sql
-- See which users have notifications enabled
SELECT id, email, daily_report_notifications, push_token 
FROM profiles 
WHERE daily_report_notifications = true;
```

### Manual Testing
```bash
# Manually trigger the 5 AM function
curl -X POST 'https://[YOUR-PROJECT-REF].supabase.co/functions/v1/daily-5am-report-with-retry' \
  -H 'Authorization: Bearer [YOUR-SERVICE-ROLE-KEY]' \
  -H 'Content-Type: application/json'

# Manually send notifications for a specific report
curl -X POST 'https://[YOUR-PROJECT-REF].supabase.co/functions/v1/send-daily-report-notifications' \
  -H 'Authorization: Bearer [YOUR-SERVICE-ROLE-KEY]' \
  -H 'Content-Type: application/json' \
  -d '{"location": "folly-beach", "date": "2024-01-15"}'
```

## 🎯 Key Features

### ✅ Fully Automated
- No manual intervention required
- Runs every day at 5 AM EST
- Processes all active locations

### ✅ Robust & Reliable
- 5 retry attempts with progressive delays
- Accepts partial data if wave sensors are offline
- Non-blocking weather/tide fetches
- Comprehensive error logging

### ✅ Dynamic & Scalable
- Automatically includes new locations
- No code changes needed for new locations
- Just add location in Admin Locations screen

### ✅ User-Friendly Notifications
- Opt-in system (users control their notifications)
- Rich notification content with emoji and summary
- Tap to open report in app
- Works on both iOS and Android

## 🚀 Adding New Locations

To add a new location that will automatically get daily reports:

1. Go to Admin Panel → Manage Locations
2. Click "Add New Location"
3. Fill in:
   - Name (e.g., "myrtle-beach")
   - Display Name (e.g., "Myrtle Beach, SC")
   - Latitude/Longitude
   - Buoy ID
   - Tide Station ID
4. Save
5. **That's it!** The location will automatically be included in the next 5 AM run

## 📝 Report Generation Logic

### Narrative Quality
- Uses "rideable faces" terminology (e.g., "rideable faces at 3 feet")
- Comprehensive details: surf size, wave period, wind, weather, tide
- Varied phrasing (different messages each day)
- Rating-based recommendations (1-10 scale)

### Rating Calculation
- **Height**: 0-4 points (bigger = better)
- **Period**: 0-3 points (longer = better)
- **Wind**: -2 to +1 points (offshore = better)
- **Final**: 1-10 scale

### Notification Summary
- **8-10 rating**: 🔥 emoji (firing!)
- **6-7 rating**: 👍 emoji (fun)
- **4-5 rating**: 🌊 emoji (rideable)
- **1-3 rating**: 😐 emoji (flat)

## ⚠️ Important Notes

1. **Cron Job Timezone**: Set to EST (America/New_York)
2. **Push Tokens**: Stored in `profiles.push_token`
3. **Opt-in Required**: Users must enable notifications in Profile
4. **Physical Device**: Push notifications only work on physical devices (not simulators)
5. **Permissions**: App requests notification permissions when user enables

## 🎉 Success Criteria

✅ Cron job runs at 5 AM EST daily
✅ All active locations get reports
✅ Retry logic handles transient failures
✅ New locations automatically included
✅ Users can opt-in for notifications
✅ Notifications sent after report generation
✅ Tapping notification opens Report screen

## 📞 Support

If reports aren't generating:
1. Check cron job is enabled in Supabase Dashboard
2. Check Edge Function logs for errors
3. Verify locations table has active locations
4. Test manually using curl commands above

If notifications aren't working:
1. Check user has enabled notifications in Profile
2. Verify push_token is saved in profiles table
3. Check Edge Function logs for notification errors
4. Ensure user is on a physical device (not simulator)
