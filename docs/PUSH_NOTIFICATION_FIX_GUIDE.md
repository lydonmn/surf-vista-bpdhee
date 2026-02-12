
# Push Notification Fix Guide

## Issue Identified

The admin user (lydonmn@gmail.com) has:
- ✅ `daily_report_notifications`: true (enabled)
- ✅ `notification_locations`: ["folly-beach"] (opted in)
- ❌ `push_token`: null (MISSING - this is the problem!)

## Why Push Notifications Aren't Working

The `send-daily-report-notifications` edge function filters users by:
```sql
WHERE daily_report_notifications = true 
AND push_token IS NOT NULL
```

Without a valid push token, the admin won't receive notifications even though notifications are enabled.

## Why the Push Token is Missing

Push tokens can only be obtained on:
1. **Physical iOS/Android devices** (not simulators)
2. **Apps built with EAS Build** (not Expo Go development builds)

The push token registration is likely failing because:
- Testing on a simulator (simulators can't receive push notifications)
- Using Expo Go for development (push notifications require a production build)
- EAS project not fully configured yet

## Solution

### Option 1: Test on Physical Device with EAS Build (Recommended)
1. Build the app with EAS Build:
   ```bash
   eas build --platform ios --profile preview
   ```
2. Install the build on a physical device
3. Sign in to the app
4. Enable notifications in Profile settings
5. The app will automatically register for push notifications and save the token

### Option 2: Manual Token Registration (Temporary Workaround)
If you need to test notifications immediately, you can manually set a test token:

```sql
UPDATE profiles 
SET push_token = 'ExponentPushToken[YOUR_TEST_TOKEN_HERE]'
WHERE email = 'lydonmn@gmail.com';
```

**Note:** This is only for testing. Real push tokens must be obtained through the app on a physical device.

### Option 3: Wait for Production Build
Push notifications will work automatically once the app is:
1. Built with EAS Build
2. Installed on physical devices
3. Users enable notifications in their profile

## What Was Fixed

### 1. Forgot Password Flow ✅
Added complete password reset functionality:
- "Forgot Password?" link on login screen
- Password reset email flow
- New `/reset-password` screen to handle the reset
- Deep link support with `surfvista://` scheme

### 2. Notification Function Improvements ✅
Updated `send-daily-report-notifications` edge function to:
- Better logging for debugging
- Show which users don't have push tokens
- Filter by `notification_locations` array
- Handle missing tokens gracefully
- Provide detailed statistics in response

### 3. Better Error Messages ✅
The notification function now returns:
```json
{
  "success": true,
  "notificationsSent": 0,
  "totalOptedIn": 1,
  "eligibleUsers": 0,
  "usersWithoutTokens": 1
}
```

This makes it clear when users have notifications enabled but no push token.

## Testing the Fix

### Test Forgot Password Flow:
1. Go to login screen
2. Click "Forgot your password?"
3. Enter your email
4. Check email for reset link
5. Click link to open app
6. Enter new password
7. Sign in with new password

### Test Push Notifications (requires physical device):
1. Build app with EAS Build
2. Install on physical device
3. Sign in as admin
4. Go to Profile tab
5. Enable "Daily Report Notifications"
6. Check that push_token is saved in database:
   ```sql
   SELECT push_token FROM profiles WHERE email = 'lydonmn@gmail.com';
   ```
7. Trigger the daily report function manually
8. Check notification arrives on device

## Current Status

- ✅ Forgot password flow implemented
- ✅ Notification function fixed and deployed
- ✅ Better logging and error handling
- ⚠️ Admin needs to register push token on physical device
- ⚠️ Push notifications will work after EAS Build deployment

## Next Steps

1. Build the app with EAS Build for iOS
2. Install on your physical iPhone
3. Sign in and enable notifications
4. The push token will be automatically registered
5. Daily notifications will start working at 5 AM EST
