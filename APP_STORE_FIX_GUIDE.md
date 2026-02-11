
# App Store Upload Fix - Complete Guide

## Issues Fixed

### 1. ✅ BGTaskSchedulerPermittedIdentifiers Added
**Problem:** Missing Info.plist value when using UIBackgroundModes with 'processing'

**Solution:** Added to `app.json`:
```json
"BGTaskSchedulerPermittedIdentifiers": [
  "Therealfollysurfreport.SurfVista.refresh",
  "Therealfollysurfreport.SurfVista.processing"
]
```

### 2. ✅ dSYM Configuration Added
**Problem:** Archive missing dSYM files for React.framework

**Solution:** Created `eas.json` with proper build configuration to ensure dSYM files are included.

## Next Steps to Upload

### Step 1: Clean Build
```bash
# Remove old build artifacts
rm -rf ios/build
rm -rf node_modules
npm install

# Clean Xcode derived data
rm -rf ~/Library/Developer/Xcode/DerivedData
```

### Step 2: Rebuild with EAS (Recommended)
```bash
# Install EAS CLI if not already installed
npm install -g eas-cli

# Login to Expo
eas login

# Build for iOS App Store
eas build --platform ios --profile production-ios
```

**OR** if building locally with Xcode:

### Step 2 Alternative: Local Xcode Build
```bash
# Prebuild iOS project
npx expo prebuild --platform ios --clean

# Open in Xcode
open ios/SurfVista.xcworkspace
```

In Xcode:
1. Select "Any iOS Device (arm64)" as the build target
2. Product → Archive
3. Wait for archive to complete
4. Window → Organizer
5. Select your archive → Distribute App
6. Choose "App Store Connect"
7. Follow the upload wizard

### Step 3: Verify Build Settings in Xcode

Before archiving, verify these settings:

**Build Settings:**
- Debug Information Format: `DWARF with dSYM File` (for Release)
- Strip Debug Symbols During Copy: `Yes` (for Release)
- Generate Debug Symbols: `Yes`

**Info.plist should now contain:**
- `BGTaskSchedulerPermittedIdentifiers` array
- `UIBackgroundModes` array with "processing"

### Step 4: Upload to App Store Connect

After successful archive:
1. Open Xcode Organizer (Window → Organizer)
2. Select your archive
3. Click "Distribute App"
4. Select "App Store Connect"
5. Upload
6. Wait for processing (can take 10-30 minutes)

### Step 5: Submit for Review

Once processing completes in App Store Connect:
1. Go to App Store Connect
2. Select your app
3. Go to "TestFlight" tab to verify build
4. Go to "App Store" tab
5. Create new version (6.0)
6. Add build
7. Fill in required metadata
8. Submit for review

## What Changed

### app.json
- Added `BGTaskSchedulerPermittedIdentifiers` to iOS infoPlist
- This is required when using background processing modes

### eas.json (NEW)
- Created EAS build configuration
- Ensures dSYM files are properly generated and included
- Configured production build profile for App Store

## Troubleshooting

### If dSYM error persists:
1. In Xcode, go to Build Settings
2. Search for "Debug Information Format"
3. Set to "DWARF with dSYM File" for Release configuration
4. Clean build folder (Product → Clean Build Folder)
5. Archive again

### If BGTaskScheduler error persists:
1. Run `npx expo prebuild --clean`
2. Check `ios/SurfVista/Info.plist` contains BGTaskSchedulerPermittedIdentifiers
3. If missing, manually add to Info.plist:
```xml
<key>BGTaskSchedulerPermittedIdentifiers</key>
<array>
    <string>Therealfollysurfreport.SurfVista.refresh</string>
    <string>Therealfollysurfreport.SurfVista.processing</string>
</array>
```

## Build Checklist

- [x] BGTaskSchedulerPermittedIdentifiers added to app.json
- [x] EAS configuration created for proper dSYM generation
- [ ] Clean build performed
- [ ] Archive created successfully
- [ ] dSYM files included in archive (verify in Organizer)
- [ ] Upload to App Store Connect successful
- [ ] Build processing completed
- [ ] Submitted for review

## Expected Timeline

- Build/Archive: 5-10 minutes
- Upload: 5-10 minutes
- App Store Connect Processing: 10-30 minutes
- Review: 1-3 days (typically 24 hours)

## Support

If you encounter any issues:
1. Check the error message in Xcode Organizer
2. Verify all Info.plist keys are present
3. Ensure dSYM files are in the archive
4. Try EAS build if local build fails
