
# Xcode Archive Build Fix - SurfVista

## Issues Fixed

### 1. **JSON Syntax Error in eas.json**
- **Problem**: Trailing comma in eas.json causing parse errors
- **Fix**: Removed trailing comma from submit configuration

### 2. **Babel Plugin Order**
- **Problem**: `react-native-worklets/plugin` must come AFTER `react-native-reanimated/plugin`
- **Fix**: Changed plugin order in babel.config.js to use `react-native-reanimated/plugin` (correct for SDK 54)

### 3. **iOS Build Properties**
- **Problem**: Missing iOS deployment target and framework configuration
- **Fix**: Added expo-build-properties plugin with:
  - `deploymentTarget: "15.1"` (iOS 15.1 minimum)
  - `useFrameworks: "static"` (required for some native modules)

### 4. **Deprecated expo-av Package**
- **Problem**: expo-av is deprecated in Expo SDK 52+ and can cause build issues
- **Fix**: Removed expo-av from dependencies (app already uses expo-video and expo-audio)

### 5. **Build Number Increment**
- **Problem**: Build number needs to increment for each archive
- **Fix**: Incremented iOS buildNumber from 17 to 18 in app.json

### 6. **Resource Class**
- **Problem**: Large apps may need more build resources
- **Fix**: Added `resourceClass: "m-medium"` to production-ios build profile

## What Changed

### Files Modified:
1. **eas.json** - Fixed JSON syntax, added resource class
2. **babel.config.js** - Fixed plugin order (reanimated/plugin)
3. **app.json** - Added expo-build-properties plugin, incremented build number
4. **package.json** - Removed deprecated expo-av

## Next Steps

The build should now succeed. The key fixes were:

1. ✅ JSON syntax error fixed
2. ✅ Babel plugin order corrected
3. ✅ iOS build properties configured
4. ✅ Deprecated packages removed
5. ✅ Build number incremented
6. ✅ Build resources increased

## Common Xcode Archive Errors & Solutions

### Error: "Command PhaseScriptExecution failed"
- **Cause**: Babel plugin order or missing dependencies
- **Solution**: Ensure react-native-reanimated/plugin is last in babel.config.js

### Error: "No such module 'ExpoModulesCore'"
- **Cause**: Missing iOS deployment target
- **Solution**: expo-build-properties with deploymentTarget set

### Error: "Undefined symbol: _OBJC_CLASS_$_RCTEventEmitter"
- **Cause**: Framework linking issues
- **Solution**: useFrameworks: "static" in expo-build-properties

### Error: "Build input file cannot be found"
- **Cause**: Cached build artifacts
- **Solution**: Clean build folder in Xcode (Cmd+Shift+K) or use fresh EAS build

## Verification

After these changes, the build should:
- ✅ Pass Xcode archive phase
- ✅ Generate .ipa file successfully
- ✅ Be ready for TestFlight/App Store submission

## If Build Still Fails

1. Check EAS build logs for specific error messages
2. Verify all native dependencies are compatible with Expo SDK 54
3. Try a clean build: Delete node_modules, reinstall, and rebuild
4. Check that Xcode Command Line Tools are up to date

## Build Command

The build will use the `production-ios` profile from eas.json, which includes all the fixes above.
