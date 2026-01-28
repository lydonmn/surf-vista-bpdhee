
# 🔧 Troubleshooting Guide - SurfVista

## Common Build Issues

### Issue: Bundle ID Mismatch
**Error**: "Bundle identifier does not match"

**Solution**:
1. Check `app.json`: `"bundleIdentifier": "Therealfollysurfreport.SurfVista"`
2. Check `eas.json`: `"bundleIdentifier": "Therealfollysurfreport.SurfVista"`
3. Ensure both match exactly

### Issue: Build Fails on EAS
**Error**: Various build errors

**Solution**:
```bash
# Check build logs
eas build:list

# View specific build
eas build:view [BUILD_ID]

# Common fixes:
# 1. Clear cache and rebuild
eas build --platform ios --profile production --clear-cache

# 2. Update EAS CLI
npm install -g eas-cli

# 3. Check credentials
eas credentials
```

### Issue: Provisioning Profile Errors
**Error**: "No provisioning profile found"

**Solution**:
```bash
# Reset credentials
eas credentials

# Select iOS
# Choose "Remove all credentials"
# Rebuild - EAS will generate new credentials
```

## Common Runtime Issues

### Issue: Video Player Not Loading
**Symptoms**: Black screen, endless buffering

**Debug Steps**:
1. Check console logs: Look for `[VideoPlayer]` messages
2. Verify signed URL generation:
   ```typescript
   // In video-player.tsx
   console.log('Signed URL:', generatedUrl);
   ```
3. Ensure URL starts with `https://`
4. Check Supabase storage permissions
5. Verify video file exists in storage

**Solution**:
- Ensure Supabase storage bucket is public or has proper RLS policies
- Verify signed URL expiration (currently 7200 seconds = 2 hours)
- Check network connectivity

### Issue: Subscription Not Working
**Symptoms**: Paywall doesn't show, purchases fail

**Debug Steps**:
1. Check RevenueCat initialization:
   ```bash
   # Look for these logs:
   [RevenueCat] 🚀 Initializing RevenueCat SDK...
   [RevenueCat] ✅ RevenueCat SDK initialized successfully
   ```
2. Verify API key is correct in `utils/superwallConfig.ts`
3. Check offerings are configured in RevenueCat dashboard
4. Ensure products are created in App Store Connect

**Solution**:
- Verify RevenueCat API key: `appl_uyUNhkTURhBCqiVsRaBqBYbhIda`
- Check RevenueCat dashboard for offering configuration
- Ensure products are approved in App Store Connect
- Test with sandbox account

### Issue: App Crashes on Launch
**Symptoms**: App closes immediately after opening

**Debug Steps**:
1. Check Xcode console for crash logs
2. Look for JavaScript errors in Metro bundler
3. Check for missing dependencies

**Solution**:
```bash
# Reinstall dependencies
rm -rf node_modules
npm install

# Clear Metro cache
npx expo start --clear

# Rebuild
eas build --platform ios --profile production --clear-cache
```

### Issue: Safe Area Issues on Notched Devices
**Symptoms**: Content hidden behind notch or home indicator

**Solution**:
- Ensure `useSafeAreaInsets()` is used in components
- Check `paddingTop` calculations in video player
- Verify `react-native-safe-area-context` is installed

## App Store Submission Issues

### Issue: Rejection - Missing Privacy Policy
**Reason**: "Your app requires a privacy policy"

**Solution**:
1. Create a privacy policy (use a template or generator)
2. Host it on a public URL
3. Add URL to App Store Connect > App Information > Privacy Policy URL

### Issue: Rejection - Incomplete Subscription Information
**Reason**: "Subscription terms not clear"

**Solution**:
1. Ensure subscription details are visible in app
2. Add clear pricing information
3. Show terms and conditions before purchase
4. Implement restore purchases button

### Issue: Rejection - Crashes During Review
**Reason**: "App crashed during review"

**Solution**:
1. Test thoroughly on physical devices
2. Check for network-dependent crashes
3. Add proper error handling for all API calls
4. Provide test account if needed

### Issue: Rejection - Misleading Metadata
**Reason**: "Screenshots don't match app functionality"

**Solution**:
1. Ensure screenshots show actual app screens
2. Don't use mockups or concept designs
3. Update screenshots if app has changed
4. Match description to actual features

## Performance Issues

### Issue: Slow Video Loading
**Symptoms**: Long buffering times, stuttering playback

**Solution**:
1. Verify video file size (should be optimized)
2. Check network speed
3. Ensure Supabase storage is in correct region
4. Consider video compression for faster loading

### Issue: High Memory Usage
**Symptoms**: App becomes sluggish, crashes on older devices

**Solution**:
1. Check for memory leaks in useEffect hooks
2. Ensure proper cleanup of event listeners
3. Optimize image sizes
4. Use React.memo for expensive components

### Issue: Slow App Launch
**Symptoms**: Long splash screen, delayed content

**Solution**:
1. Optimize initial data fetching
2. Use lazy loading for non-critical content
3. Cache frequently accessed data
4. Minimize dependencies in root component

## Development Issues

### Issue: Metro Bundler Errors
**Error**: "Unable to resolve module"

**Solution**:
```bash
# Clear Metro cache
npx expo start --clear

# Reset Metro
watchman watch-del-all
rm -rf node_modules
npm install
npx expo start --clear
```

### Issue: TypeScript Errors
**Error**: Type errors in code

**Solution**:
```bash
# Check TypeScript configuration
npx tsc --noEmit

# Update types
npm install --save-dev @types/react @types/react-native
```

### Issue: Expo Go Not Working
**Error**: "Something went wrong"

**Solution**:
- Expo Go has limitations - use development build instead
- For production features, always test with EAS Build
- Some features (like RevenueCat) don't work in Expo Go

## Getting Help

### EAS Build Support
```bash
# View build logs
eas build:list
eas build:view [BUILD_ID]

# Check credentials
eas credentials

# View project configuration
eas config
```

### Useful Commands
```bash
# Check EAS CLI version
eas --version

# Update EAS CLI
npm install -g eas-cli

# Login to EAS
eas login

# Check project status
eas project:info

# View submissions
eas submit:list
```

### Resources
- **EAS Documentation**: https://docs.expo.dev/eas/
- **Expo Forums**: https://forums.expo.dev/
- **RevenueCat Docs**: https://docs.revenuecat.com/
- **Supabase Docs**: https://supabase.com/docs
- **App Store Review Guidelines**: https://developer.apple.com/app-store/review/guidelines/

### Contact Support
- **Email**: lydonmn@aol.com
- **EAS Support**: https://expo.dev/support

---

**Remember**: Most issues can be resolved by:
1. Checking logs carefully
2. Clearing caches
3. Rebuilding from scratch
4. Testing on physical devices
5. Reading error messages thoroughly

Good luck! 🚀
