
# 🔔 Push Notification Integration - Complete ✅

## Overview
The 6AM daily surf reports are **fully integrated** with the optional push notification feature. Users who opt in will automatically receive push notifications when the daily report is generated.

---

## 🔗 Integration Flow

### 1. **User Opt-In (Profile Screen)**
**Location:** `app/(tabs)/profile.tsx` and `app/(tabs)/profile.ios.tsx`

Users can enable daily report notifications by:
1. Opening the Profile tab
2. Toggling the "Daily Surf Report" switch ON
3. Granting iOS notification permissions when prompted
4. Selecting which locations they want to receive reports for

**What Happens Automatically:**
- Push token is registered with Expo Push Notification service
- Token is saved to `profiles.push_token` in database
- `profiles.daily_report_notifications` is set to `true`
- `profiles.notification_locations` stores selected location IDs

---

### 2. **Data Collection (4:45 AM EST)**
**Function:** `background-445am-data-collection`
**CRON Schedule:** `45 9 * * *` (9:45 AM UTC = 4:45 AM EST)

**Purpose:** Collect buoy data BEFORE the 6AM report generation
- Captures readings at 4:20 AM and 4:50 AM (when buoys publish)
- Stores data in `surf_conditions` table
- Ensures fresh data is available for 6AM report

---

### 3. **Report Generation (6:00 AM EST)**
**Function:** `daily-6am-report-with-retry`
**CRON Schedule:** `0 11 * * *` (11:00 AM UTC = 6:00 AM EST)

**Process:**
1. Fetches all active locations from `locations` table
2. For each location:
   - Uses data collected at 4:45 AM
   - Generates witty narrative based on surf conditions
   - Calculates surf rating (1-10)
   - Saves report to `surf_reports` table
3. **CRITICAL:** After successful report generation, automatically calls `send-daily-report-notifications`

**Key Code Section:**
```typescript
if (!result.skipped && !isManualTrigger) {
  console.log(`[Daily 6AM Report] 📲 Sending push notifications for ${location.display_name}...`);
  
  const notificationResult = await supabase.functions.invoke('send-daily-report-notifications', {
    body: { 
      location: location.id,
      date: dateStr,
    },
  });
  
  if (notificationResult.data?.success) {
    console.log(`✅ Notifications sent: ${notificationResult.data.notificationsSent} users`);
  }
}
```

---

### 4. **Push Notification Delivery**
**Function:** `send-daily-report-notifications`
**Triggered By:** `daily-6am-report-with-retry` (automatically after report generation)

**Process:**
1. Fetches the generated report from `surf_reports` table
2. Queries all users where `daily_report_notifications = true`
3. Filters eligible users:
   - Must have a valid `push_token` (not null, not dummy tokens)
   - Must have the location in their `notification_locations` array
4. Creates notification content:
   - Title: `🔥 Folly Beach Surf Report` (emoji based on rating)
   - Body: Wave height, rating, and summary of conditions
5. Sends notifications via Expo Push API
6. Logs detailed results (success/failure counts)

**Eligibility Checks:**
```typescript
const eligibleUsers = allOptedInUsers.filter(user => {
  // Must have valid push token
  if (!user.push_token || 
      user.push_token === 'web-dummy-token' || 
      user.push_token === 'simulator-dummy-token') {
    return false;
  }
  
  // Must want notifications for this location
  const userLocations = user.notification_locations || ['folly-beach'];
  return userLocations.includes(locationId);
});
```

---

## 📊 Database Schema

### `profiles` Table (User Preferences)
```sql
- id: uuid (primary key)
- email: text
- daily_report_notifications: boolean (default: false)
- push_token: text (Expo push token)
- notification_locations: text[] (array of location IDs, default: ['folly-beach'])
```

### `surf_reports` Table (Generated Reports)
```sql
- id: uuid (primary key)
- date: date
- location: text
- wave_height: text
- surf_height: text (rideable wave face)
- wave_period: text
- wind_speed: text
- wind_direction: text
- water_temp: text
- conditions: text (narrative)
- rating: integer (1-10)
- updated_at: timestamptz
```

---

## 🎯 User Experience

### For Users:
1. **Enable Notifications:**
   - Open Profile tab
   - Toggle "Daily Surf Report" ON
   - Grant iOS notification permission
   - Select locations (Folly Beach, Pawleys Island, etc.)

2. **Receive Notifications:**
   - Every morning at 6:00 AM EST
   - Only for selected locations
   - Includes wave height, rating, and summary
   - Tapping notification opens the app to full report

3. **Manage Preferences:**
   - Toggle notifications ON/OFF anytime
   - Change location preferences
   - View permission status in Profile

### For Admins:
- **Test Notifications:** Use `PushNotificationTester` component in Admin Data screen
- **Manual Report Generation:** Admin panel triggers report generation but skips notifications
- **View Logs:** Edge Function logs show detailed notification delivery status

---

## 🔧 Technical Details

### Push Token Registration
**File:** `utils/pushNotifications.ts`

**Functions:**
- `registerForPushNotificationsAsync()` - Gets Expo push token
- `savePushToken(userId, token)` - Saves token to database
- `setDailyReportNotifications(userId, enabled)` - Enables/disables notifications
- `ensurePushTokenRegistered(userId)` - Auto-checks and registers token if missing

**Automatic Token Management:**
- When user enables notifications, token is registered automatically
- Token is saved to `profiles.push_token`
- If token is missing but notifications are enabled, it's re-registered on profile load
- No manual intervention needed

### Notification Content Format
```typescript
{
  title: "🔥 Folly Beach Surf Report",
  body: "2-3 ft waves • 7/10 rating\nChest to head high SE swell, 2.5 feet...",
  data: {
    type: 'daily_report',
    reportId: 'uuid',
    location: 'folly-beach',
    date: '2024-12-16'
  },
  priority: 'high',
  channelId: 'daily-reports'
}
```

### Rating Emoji Logic
- 8-10: 🔥 (Epic)
- 6-7: 👍 (Good)
- 4-5: 🌊 (Decent)
- 1-3: 😐 (Minimal)

---

## ✅ Verification Checklist

### Backend Integration ✅
- [x] `daily-6am-report-with-retry` generates reports at 6AM EST
- [x] After report generation, `send-daily-report-notifications` is called automatically
- [x] Notifications are sent to all eligible users
- [x] Detailed logging shows notification delivery status

### Frontend Integration ✅
- [x] Profile screen has notification toggle
- [x] Location selector allows multi-location selection
- [x] Permission status is displayed
- [x] Push token is registered automatically when enabling
- [x] Token is re-registered if missing (automatic recovery)

### Database Schema ✅
- [x] `profiles.daily_report_notifications` (boolean)
- [x] `profiles.push_token` (text)
- [x] `profiles.notification_locations` (text array)
- [x] `surf_reports` table has all necessary fields

### Edge Functions ✅
- [x] `background-445am-data-collection` - Collects data at 4:45 AM
- [x] `daily-6am-report-with-retry` - Generates reports at 6:00 AM
- [x] `send-daily-report-notifications` - Sends push notifications

---

## 🚀 How It Works (Complete Flow)

### Daily Automated Flow:
```
4:45 AM EST → background-445am-data-collection
              ↓
              Collects buoy data (4:20 AM & 4:50 AM readings)
              ↓
              Saves to surf_conditions table
              ↓
6:00 AM EST → daily-6am-report-with-retry
              ↓
              Generates surf report narrative
              ↓
              Saves to surf_reports table
              ↓
              Calls send-daily-report-notifications
              ↓
              Queries users with daily_report_notifications=true
              ↓
              Filters by valid push_token and notification_locations
              ↓
              Sends push notifications via Expo Push API
              ↓
              Users receive notification on their devices 📱
```

### Manual Admin Flow:
```
Admin Panel → "Generate Report" button
              ↓
              Calls daily-6am-report-with-retry with isManualTrigger=true
              ↓
              Uses existing database data (no fresh API calls)
              ↓
              Regenerates narrative
              ↓
              Saves to surf_reports table
              ↓
              SKIPS push notifications (manual trigger)
```

---

## 📱 User Requirements

### To Receive Notifications:
1. ✅ Physical iOS device (not simulator)
2. ✅ EAS build (TestFlight or App Store, not Expo Go)
3. ✅ Notification permissions granted in iOS Settings
4. ✅ "Daily Surf Report" toggle enabled in Profile tab
5. ✅ Valid push token registered (automatic)
6. ✅ Location selected in notification preferences

### Why Some Users Don't Receive Notifications:
- **No Push Token:** User hasn't enabled notifications in Profile tab
- **Dummy Token:** User is on web or simulator (not supported)
- **Wrong Location:** User hasn't selected this location in preferences
- **Permissions Denied:** User denied iOS notification permissions
- **Expo Go:** User is using Expo Go instead of EAS build

---

## 🔍 Debugging & Monitoring

### Edge Function Logs
View logs in Supabase Dashboard → Edge Functions → Logs

**Key Log Sections:**
1. **Report Generation:** Shows data collection and narrative generation
2. **Push Notification Phase:** Shows user eligibility and send results
3. **Final Results:** Shows success/failure counts

**Example Log Output:**
```
[Daily 6AM Report] 📲 PUSH NOTIFICATION PHASE
[Daily 6AM Report] 🔗 INTEGRATION: Calling send-daily-report-notifications
[Daily 6AM Report] ✅ PUSH NOTIFICATIONS SENT SUCCESSFULLY
[Daily 6AM Report]    • Users notified: 5
[Daily 6AM Report]    • Total opted-in: 8
[Daily 6AM Report]    • Eligible users: 5
[Daily 6AM Report]    • Users without tokens: 3
```

### Frontend Logs
Check console logs in Profile screen:
```
[ProfileScreen] 🔔 Toggle notifications: true
[Push Notifications] ✅ Token registered and saved successfully
[ProfileScreen] ✅ Notifications updated successfully
```

### Test Notifications
Admins can test push notifications using the `PushNotificationTester` component in the Admin Data screen.

---

## 🎉 Summary

**The integration is COMPLETE and WORKING:**

✅ **6AM Report Generation** → Automatically generates daily surf reports
✅ **Push Notification Trigger** → Automatically calls notification function after report generation
✅ **User Filtering** → Only sends to users who opted in with valid tokens
✅ **Location Filtering** → Only sends for locations user selected
✅ **Detailed Logging** → Complete visibility into notification delivery
✅ **Error Handling** → Graceful fallbacks if notifications fail
✅ **Automatic Recovery** → Re-registers tokens if missing

**Users receive notifications at 6AM EST every day for their selected locations!** 🌊📱

---

## 📝 Notes

- Manual report generation from Admin panel does NOT send notifications (by design)
- Notifications only work on physical devices with EAS builds (TestFlight/App Store)
- Web and simulator users cannot receive push notifications
- Users can enable/disable notifications anytime in Profile tab
- Multiple location support allows users to get reports for multiple beaches
