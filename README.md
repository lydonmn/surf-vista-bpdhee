# SurfVista - Premium Surf Reports for Folly Beach, SC 🏄‍♂️

SurfVista is a premium subscription-based surf report app for Folly Beach, South Carolina. Get exclusive 6K drone footage, real-time surf conditions, AI-powered predictions, and detailed forecasts.

## Features

- **6K Drone Video Reports**: Exclusive high-resolution aerial footage of surf conditions
- **Real-Time Conditions**: Live surf height, wind, water temperature, and tide data
- **AI-Powered Predictions**: Machine learning forecasts for optimal surf times
- **7-Day Forecast**: Detailed weather and surf predictions
- **Subscription Management**: RevenueCat integration for seamless payments
- **Native iOS Experience**: Optimized for iPhone and iPad

## Tech Stack

- **Framework**: Expo 54 + React Native
- **Navigation**: Expo Router (file-based routing)
- **Backend**: Supabase (PostgreSQL, Storage, Edge Functions)
- **Payments**: RevenueCat + Apple In-App Purchases
- **Video**: expo-video with 4K/6K streaming support
- **Authentication**: Supabase Auth (Email + OAuth)

## Building for Production

### iOS App Store Submission

1. **Update Version**:
   - Increment version in `app.json`
   - Update build number in `eas.json`

2. **Build Production IPA**:
   ```bash
   eas build --platform ios --profile production
   ```

3. **Submit to App Store**:
   ```bash
   eas submit --platform ios --profile production
   ```

### Pre-Submission Checklist

✅ Bundle ID matches: `Therealfollysurfreport.SurfVista`  
✅ RevenueCat production keys configured  
✅ Privacy descriptions updated in `app.json`  
✅ App icons and splash screen set  
✅ Test on physical iOS device  
✅ Verify video playback (4K/6K)  
✅ Test subscription flow end-to-end  
✅ Verify all API endpoints work in production  
✅ Check for console errors/warnings  
✅ Test offline behavior  

## App Store Information

- **Bundle ID**: `Therealfollysurfreport.SurfVista`
- **Apple ID**: `lydonmn@aol.com`
- **App Store Connect ID**: `6756734521`
- **Team ID**: `BC32GC8XTS`

## Production Optimizations

- Console logs wrapped in `__DEV__` checks for production
- Video player optimized for iOS streaming
- Proper error handling and retry logic
- Safe area support for notched devices
- Haptic feedback for better UX
- Automatic orientation handling for video playback

---

Built with [Natively.dev](https://natively.dev) 💙
