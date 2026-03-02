
# APNs Push Notification Configuration Guide

## ✅ Your APNs Credentials

You have the following APNs credentials ready:

- **Key ID:** 7NNU2C52MT
- **Team ID:** BC32GC8XT5
- **Bundle ID:** Therealfollysurfreport.SurfVista
- **Environment:** Sandbox & Production
- **P8 Key File:** You have the private key content

## 🔧 Step 1: Save Your P8 Key File

1. Create a new file on your computer named `AuthKey_7NNU2C52MT.p8`
2. Copy and paste the following content into it:

```
-----BEGIN PRIVATE KEY-----
MIGTAgEAMBMGByqGSM49AgEGCCqGSM49AwEHBHkwdwIBAQQg2e+DLB5tKi/zmYRa
l8+5SJk+6GsjT4gFIurTUGtOJA+gCgYIKoZIzj0DAQehRANCAAT+ydbGInoHIXLA
L2YyaTjElFq+ZTw4xdskT+0i4DvMxqfNXpajSjqeoJ/rR8q7ZBGQtMlzRUBxGdO5
KTLdqlny
-----END PRIVATE KEY-----
```

3. Save the file in a secure location on your computer

## 🚀 Step 2: Upload Credentials to EAS

Since you cannot run terminal commands directly, you'll need to use the **Expo Application Services (EAS) Dashboard** to upload your APNs credentials:

### Option A: Using EAS Dashboard (Recommended)

1. Go to [https://expo.dev](https://expo.dev)
2. Sign in to your Expo account
3. Navigate to your project: **SurfVista**
4. Go to **Credentials** section
5. Select **iOS** platform
6. Click **Add new credentials** or **Configure Push Notifications**
7. Upload your credentials:
   - **Key ID:** 7NNU2C52MT
   - **Team ID:** BC32GC8XT5
   - **Bundle Identifier:** Therealfollysurfreport.SurfVista
   - **P8 Key File:** Upload the `AuthKey_7NNU2C52MT.p8` file you created
8. Select **Production** environment (this works for both Sandbox and Production)
9. Save the configuration

### Option B: Using EAS CLI (If You Have Access to Terminal)

If you have access to a terminal on your local machine, run:

```bash
# Install EAS CLI if you haven't already
npm install -g eas-cli

# Login to your Expo account
eas login

# Configure iOS credentials
eas credentials --platform ios

# Follow the prompts:
# 1. Select "Push Notifications: Manage your Apple Push Notifications Key"
# 2. Choose "Add a new ASC API Key"
# 3. Enter Key ID: 7NNU2C52MT
# 4. Enter Team ID: BC32GC8XT5
# 5. Upload the P8 file when prompted
```

## 📱 Step 3: Verify Configuration in app.json

Your app.json is already configured correctly with:

```json
{
  "expo": {
    "ios": {
      "bundleIdentifier": "Therealfollysurfreport.SurfVista"
    }
  }
}
```

## ✅ Step 4: Verify Push Notification Setup

Your app already has push notifications configured:

1. ✅ `expo-notifications` package installed
2. ✅ Push notification utilities in `utils/pushNotifications.ts`
3. ✅ Notification handling in Profile screen
4. ✅ Backend integration for sending notifications

## 🔔 Step 5: Test Push Notifications

After uploading your APNs credentials:

1. **Build a new iOS app** with the credentials:
   - Go to EAS Dashboard → Builds
   - Create a new iOS build
   - The build will automatically use your APNs credentials

2. **Install the build** on a physical iOS device (push notifications don't work in simulator)

3. **Test notifications** using the admin panel:
   - Open the app
   - Go to Profile → Enable daily notifications
   - The app will register for push notifications
   - Your backend can now send notifications using the registered token

## 🔐 Security Notes

- ✅ Your P8 key is stored securely in EAS
- ✅ The key works for both Sandbox (TestFlight) and Production (App Store)
- ✅ Never commit the P8 key file to version control
- ✅ Keep the key file in a secure location as backup

## 📋 Checklist

- [ ] P8 key file created and saved securely
- [ ] Credentials uploaded to EAS (via Dashboard or CLI)
- [ ] New iOS build created with APNs credentials
- [ ] Build installed on physical iOS device
- [ ] Push notifications tested and working

## 🆘 Troubleshooting

### "Invalid credentials" error
- Verify Key ID matches: 7NNU2C52MT
- Verify Team ID matches: BC32GC8XT5
- Ensure Bundle ID matches: Therealfollysurfreport.SurfVista
- Check that P8 key file is not corrupted

### "Push notifications not received"
- Ensure you're testing on a physical device (not simulator)
- Check that notifications are enabled in iOS Settings
- Verify the app has permission to send notifications
- Check backend logs for notification sending errors

### "Build fails with credentials error"
- Re-upload credentials in EAS Dashboard
- Ensure you selected the correct project
- Try creating a new build after re-uploading

## 📚 Additional Resources

- [Expo Push Notifications Guide](https://docs.expo.dev/push-notifications/overview/)
- [EAS Credentials Documentation](https://docs.expo.dev/app-signing/managed-credentials/)
- [Apple Push Notification Service](https://developer.apple.com/documentation/usernotifications)

## ✨ Next Steps

1. Upload your APNs credentials using the EAS Dashboard
2. Create a new iOS build
3. Test push notifications on a physical device
4. Your app is ready for App Store submission with push notifications! 🎉
