
# Push Notification Troubleshooting Guide

## 🚨 Current Issue: "Experience Not Found"

### What's Happening?
The error "Experience with id 'e1ee166c-212b-4eca-a1d7-44183b7be073' does not exist" means the app is trying to register for push notifications, but the EAS project is not properly configured with Expo's push notification service.

### Why Does This Happen?
Push notifications in Expo require:
1. ✅ The app to be built with **EAS Build** (not Expo Go)
2. ✅ The EAS project ID to be registered with Expo
3. ✅ The app to run on a **physical device** (not simulator)

### Current Status:
- ✅ EAS project ID is now in `app.json`
- ✅ Code is properly configured
- ❌ App needs to be built with EAS Build for push notifications to work

## 🔧 SOLUTION

### Option 1: Build with EAS (Required for Production)
```bash
# Build for iOS production
eas build --platform ios --profile production

# Or build for internal testing
eas build --platform ios --profile preview
```

### Option 2: Use TestFlight
1. Build the app with EAS
2. Submit to TestFlight
3. Install on a physical device
4. Test push notifications

### Option 3: Development Build
```bash
# Create a development build
eas build --platform ios --profile development

# Install on device and test
```

## 📱 TESTING CHECKLIST

Before testing push notifications:
- [ ] App is built with EAS Build (not Expo Go)
- [ ] Running on a physical device (not simulator)
- [ ] User has granted notification permissions
- [ ] User has toggled "Daily Surf Report" ON in profile
- [ ] User's profile has a valid `push_token` in database

### Verify Token in Database:
```sql
SELECT id, email, daily_report_notifications, push_token 
FROM profiles 
WHERE id = 'your-user-id';
```

If `push_token` is NULL, the user needs to:
1. Toggle notifications OFF
2. Toggle notifications ON again
3. Check database again

## 🎯 WHAT WORKS NOW

### ✅ Working Features:
- Permission requests
- Error handling
- User-friendly messages
- Database updates
- Location selection

### ⏳ Requires EAS Build:
- Expo push token registration
- Receiving push notifications from backend
- Testing on physical devices

## 🚀 PRODUCTION DEPLOYMENT

Once you build with EAS and submit to the App Store:
1. Push notifications will work automatically
2. Users will receive daily reports at 5 AM EST
3. Backend edge function will send notifications to all opted-in users

## 📞 SUPPORT

If push notifications still don't work after EAS Build:
1. Check Expo dashboard for project status
2. Verify EAS project ID matches in all configs
3. Check edge function logs for delivery errors
4. Ensure Apple Push Notification service is enabled in Apple Developer account

---

**Status**: Configuration fixed, requires EAS Build for testing
**Version**: 9.1
**Next Step**: Build with `eas build --platform ios --profile production`
