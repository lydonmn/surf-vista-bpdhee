
# Push Notifications Setup Guide

## Critical Issues Fixed

### 1. Push Notification Registration ✅
- **Issue**: Users couldn't enable daily report notifications
- **Fix**: 
  - Improved error handling and user feedback
  - Added support for simulators/web with dummy tokens
  - Better permission request flow with clear error messages
  - Reverts toggle if registration fails

### 2. Subscriber Management ✅
- **Issue**: Admin couldn't see subscribers in the Manage Users tab
- **Fix**:
  - Enhanced user list display with notification status
  - Shows push token registration status
  - Displays all 12 users including 3 active subscribers
  - Added loading indicator on refresh button

### 3. Daily Report Notifications Edge Function ✅
- **Issue**: Edge function was not deployed
- **Fix**: Deployed `send-daily-report-notifications` function
- **Status**: Now active and ready to send notifications

## Required Setup Steps

### Step 1: Get Your EAS Project ID

1. Run this command in your terminal:
   ```bash
   eas project:info
   ```

2. Copy the Project ID from the output

3. Update `app.json` line 73:
   ```json
   "eas": {
     "projectId": "YOUR_ACTUAL_PROJECT_ID_HERE"
   }
   ```

### Step 2: Rebuild the App

After adding the EAS project ID, you MUST rebuild the app:

```bash
eas build --platform ios --profile production-ios
```

**Important**: Push notifications will NOT work until you rebuild with the correct EAS project ID.

### Step 3: Set Up Cron Job for Daily Notifications

The `daily-5am-report-with-retry` function already calls the notification function, but you need to ensure it runs daily at 5 AM EST.

In Supabase Dashboard:
1. Go to Database > Cron Jobs
2. Create a new cron job:
   - **Name**: `daily-5am-surf-report`
   - **Schedule**: `0 10 * * *` (5 AM EST = 10 AM UTC)
   - **Command**: 
     ```sql
     SELECT net.http_post(
       url := 'https://ucbilksfpnmltrkwvzft.supabase.co/functions/v1/daily-5am-report-with-retry',
       headers := '{"Content-Type": "application/json", "Authorization": "Bearer YOUR_SERVICE_ROLE_KEY"}'::jsonb,
       body := '{}'::jsonb
     );
     ```

## Testing Push Notifications

### Test 1: Enable Notifications (User Side)

1. Open the app on a **physical device** (not simulator)
2. Go to Profile tab
3. Toggle "Daily Surf Report" switch to ON
4. You should see:
   - Permission request (if first time)
   - Success message: "Notifications Enabled"
5. Check the console logs for:
   - `[Push Notifications] ✅ Token obtained: ExponentPushToken[...]`
   - `[Push Notifications] ✅ Preferences updated successfully`

### Test 2: Verify in Admin Panel

1. Go to Admin Panel > Manage Users
2. Find your test user
3. Verify:
   - "Notifications: Enabled" (green)
   - "Push Token: Registered" (green checkmark)

### Test 3: Trigger Manual Notification

You can manually trigger the daily report to test notifications:

1. Go to Admin Panel > Data Management
2. Click "Generate Daily Report"
3. The system will:
   - Generate the report
   - Automatically send notifications to all opted-in users
4. Check your device for the push notification

### Test 4: Check Notification Logs

In Supabase Dashboard:
1. Go to Edge Functions > send-daily-report-notifications
2. Click "Logs"
3. Look for:
   - `Found X users to notify`
   - `✅ Sent: X`
   - `❌ Failed: 0`

## Troubleshooting

### "Failed to update notification preferences"

**Causes**:
- No EAS project ID in app.json
- App not rebuilt after adding project ID
- User denied notification permissions

**Solutions**:
1. Add EAS project ID to app.json (see Step 1)
2. Rebuild the app (see Step 2)
3. Check device notification settings

### "Push Token: Missing" in Admin Panel

**Causes**:
- User is on simulator/web
- User denied permissions
- EAS project ID not configured

**Solutions**:
- Test on physical device
- Ask user to enable notifications in device settings
- Ensure EAS project ID is set and app is rebuilt

### No Notifications Received

**Causes**:
- Cron job not set up
- Edge function not being called
- Invalid push tokens

**Solutions**:
1. Verify cron job is running (check Supabase logs)
2. Manually trigger report generation to test
3. Check edge function logs for errors

## Current Status

✅ **Fixed**:
- Push notification registration flow
- Error handling and user feedback
- Subscriber management display
- Notification edge function deployed

⚠️ **Requires Action**:
- Add EAS project ID to app.json
- Rebuild app with new configuration
- Set up cron job for 5 AM EST daily reports

## Next Steps

1. Get EAS project ID: `eas project:info`
2. Update app.json with the project ID
3. Rebuild: `eas build --platform ios --profile production-ios`
4. Set up cron job in Supabase
5. Test notifications on physical device
6. Submit updated build to App Store

## Support

If you continue to have issues:
1. Check the console logs in the app (look for `[Push Notifications]` tags)
2. Check Supabase Edge Function logs
3. Verify the cron job is running
4. Ensure users are on physical devices (not simulators)
