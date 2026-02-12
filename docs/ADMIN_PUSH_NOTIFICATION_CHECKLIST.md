
# Admin Push Notification Checklist ✅

## For Admin to Receive Push Notifications on TestFlight

### ✅ Prerequisites (Already Done)
- [x] EAS Project ID added to app.json
- [x] Automatic push token registration on login
- [x] Enhanced logging for debugging
- [x] Edge function updated with detailed user analysis

### 📱 Steps for Admin (You)

#### 1. **Install from TestFlight**
- Make sure you're using the TestFlight build, NOT Expo Go
- Expo Go does NOT support push notifications
- TestFlight builds have full push notification support

#### 2. **Sign In**
- Open the app
- Sign in with your admin account
- The app will automatically attempt to register a push token

#### 3. **Enable Notifications**
- Go to Profile tab
- Find "Daily Surf Report" toggle
- Turn it ON
- When iOS asks for permission, tap "Allow"

#### 4. **Verify Setup**
- Scroll to bottom of Profile screen
- Check "Debug Info" section
- Look for:
  - `Permission Status: Granted ✓`
  - `Daily Notifications: Enabled`
  - Push token should start with "ExponentPushToken["

#### 5. **Test Notification**
- Go to Admin Data screen
- Tap "Pull Data & Generate Reports"
- Check the activity log for notification status
- Should see "Notifications sent to X users"

### 🔍 Troubleshooting

#### If Permission Status shows "Denied":
1. Open iPhone Settings
2. Scroll down to "SurfVista"
3. Tap "Notifications"
4. Enable "Allow Notifications"
5. Return to app and toggle notifications again

#### If No Push Token in Debug Info:
1. Make sure you're on a physical device (not simulator)
2. Make sure you're using TestFlight build (not Expo Go)
3. Try signing out and back in
4. Check console logs for errors

#### If Notifications Not Sending:
1. Check Admin Data screen activity log
2. Look for "Eligible users (with valid tokens): 0"
3. This means no users have valid push tokens yet
4. Users need to enable notifications in their Profile tab

### 📊 Understanding the Logs

When you trigger "Pull Data & Generate Reports", check for:

```
✅ GOOD:
- "Eligible users (with valid tokens): 1"
- "✅ Sent to [your-email]"
- "Successfully sent: 1"

❌ BAD:
- "Users without valid tokens: 1"
- "User [your-email] has NO push token"
- "User needs to: 1) Enable notifications in profile, 2) Grant permission, 3) App must be EAS build"
```

### 🎯 Quick Fix if Not Working

1. **Sign out** of the app
2. **Close the app completely**
3. **Reopen the app**
4. **Sign in again**
5. **Go to Profile tab**
6. **Toggle notifications OFF then ON**
7. **Grant permission when prompted**
8. **Check Debug Info** for valid token

### 📞 Still Not Working?

Check these in order:

1. **Are you on TestFlight?**
   - Settings > General > VPN & Device Management
   - Should show "SurfVista" under "Developer App"

2. **Are notifications enabled in iOS?**
   - Settings > SurfVista > Notifications
   - "Allow Notifications" should be ON

3. **Is the toggle ON in the app?**
   - Profile tab > Daily Surf Report
   - Should be green/enabled

4. **Do you have a valid token?**
   - Profile tab > Debug Info
   - Should see "ExponentPushToken[...]"

5. **Is the location selected?**
   - Profile tab > Notification locations
   - "Folly Beach, SC" should be checked

If ALL of these are correct and you're still not receiving notifications, check the Supabase Edge Function logs for detailed error messages.

### 🚀 For Other Users

The same process applies to all users:
1. Install from TestFlight or App Store
2. Sign in
3. Enable notifications in Profile
4. Grant iOS permissions
5. Receive daily reports at 5 AM EST

No special admin privileges needed - push notifications work for everyone who opts in!
