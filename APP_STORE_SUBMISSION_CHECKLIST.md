
# App Store Submission Checklist for SurfVista

## ✅ Pre-Submission Checklist

### 1. App Configuration
- [x] Bundle Identifier: `Therealfollysurfreport.SurfVista`
- [x] Version: 1.0.0
- [x] Build Number: Auto-increment enabled
- [x] App Icon: Configured (24ddf601-3a1f-4b13-9dd1-352e94c2d396.png)
- [x] Splash Screen: Configured
- [x] Display Name: SurfVista

### 2. Privacy & Permissions
- [x] Privacy Policy URL: Required (add to App Store Connect)
- [x] Terms of Service URL: Required (add to App Store Connect)
- [x] Camera Permission: Configured with description
- [x] Photo Library Permission: Configured with description
- [x] Microphone Permission: Configured with description
- [x] Non-Exempt Encryption: Set to false

### 3. RevenueCat Integration
- [x] iOS API Key: `appl_uyUNhkTURhBCqiVsRaBqBYbhIda`
- [x] Products configured in App Store Connect
- [x] Offerings configured in RevenueCat
- [x] Paywall tested and working
- [x] Subscription management working

### 4. Supabase Backend
- [x] Database tables created
- [x] Edge Functions deployed
- [x] RLS policies enabled
- [x] Storage buckets configured
- [x] CORS configured

### 5. Testing
- [ ] Test on physical iOS device
- [ ] Test subscription purchase flow
- [ ] Test video upload (admin)
- [ ] Test video playback
- [ ] Test authentication (sign up/in/out)
- [ ] Test restore purchases
- [ ] Test offline behavior
- [ ] Test dark mode

## 🚀 Build & Submit Commands

### Step 1: Build for Production

```bash
# Build iOS app
eas build --platform ios --profile production
```

### Step 2: Submit to App Store

```bash
# Submit to App Store Connect
eas submit --platform ios --profile production
```

### Step 3: App Store Connect Configuration

1. **App Information**
   - Name: SurfVista
   - Subtitle: Premium Folly Beach Surf Reports
   - Category: Weather
   - Secondary Category: Sports

2. **Pricing & Availability**
   - Price: Free (with in-app purchases)
   - Availability: United States

3. **In-App Purchases**
   - Monthly Subscription: $10.99/month
   - Annual Subscription: $99.99/year

4. **App Privacy**
   - Data Collection: User account, purchase history
   - Data Usage: App functionality, analytics
   - Data Linked to User: Yes

5. **App Review Information**
   - Demo Account: Provide test credentials
   - Notes: Explain subscription requirement for video access

6. **Version Information**
   - What's New: "Initial release of SurfVista - Premium surf reports for Folly Beach"
   - Screenshots: Provide 6.5" and 5.5" iPhone screenshots
   - App Preview Video: Optional but recommended

## 📱 Required Screenshots

Prepare screenshots for:
- 6.5" Display (iPhone 14 Pro Max, 15 Pro Max)
- 5.5" Display (iPhone 8 Plus)

Recommended screens to capture:
1. Home screen with surf conditions
2. Video player with 6K footage
3. Surf report details
4. Forecast screen
5. Profile/subscription screen

## ⚠️ Common Rejection Reasons to Avoid

1. **Missing Privacy Policy**: Ensure URL is added in App Store Connect
2. **Subscription Issues**: Test purchase flow thoroughly
3. **Crashes**: Test on multiple iOS versions
4. **Incomplete Functionality**: Ensure all features work
5. **Misleading Screenshots**: Use actual app screenshots

## 📋 Post-Submission

After submission:
1. Monitor App Store Connect for status updates
2. Respond promptly to any App Review questions
3. Be prepared to provide demo account if requested
4. Check for any metadata rejections

## 🔧 Troubleshooting

### Build Fails
```bash
# Clean and rebuild
npx expo prebuild --clean
eas build --platform ios --profile production --clear-cache
```

### Submission Fails
- Check bundle identifier matches App Store Connect
- Verify Apple Team ID is correct
- Ensure all required metadata is filled

## 📞 Support

- RevenueCat Dashboard: https://app.revenuecat.com/
- Supabase Dashboard: https://supabase.com/dashboard
- EAS Build Dashboard: https://expo.dev/accounts/[your-account]/projects/surfvista

## ✨ Final Steps

1. Build the app: `eas build --platform ios --profile production`
2. Wait for build to complete (~15-20 minutes)
3. Submit to App Store: `eas submit --platform ios --profile production`
4. Complete App Store Connect metadata
5. Submit for review
6. Wait for approval (typically 1-3 days)

Good luck with your submission! 🏄‍♂️
