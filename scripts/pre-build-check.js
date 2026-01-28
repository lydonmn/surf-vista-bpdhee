
/**
 * Pre-Build Validation Script for SurfVista
 * 
 * This script validates that all production requirements are met
 * before building for the App Store.
 * 
 * Run with: node scripts/pre-build-check.js
 */

const fs = require('fs');
const path = require('path');

console.log('🔍 Running Pre-Build Validation for SurfVista...\n');

let hasErrors = false;
let hasWarnings = false;

// Check 1: Validate app.json
console.log('📱 Checking app.json configuration...');
try {
  const appJson = JSON.parse(fs.readFileSync(path.join(__dirname, '../app.json'), 'utf8'));
  
  // Check bundle ID
  if (appJson.expo.ios.bundleIdentifier !== 'Therealfollysurfreport.SurfVista') {
    console.error('❌ ERROR: Bundle ID must be "Therealfollysurfreport.SurfVista"');
    hasErrors = true;
  } else {
    console.log('✅ Bundle ID correct');
  }
  
  // Check version
  if (!appJson.expo.version) {
    console.error('❌ ERROR: Version not set in app.json');
    hasErrors = true;
  } else {
    console.log(`✅ Version: ${appJson.expo.version}`);
  }
  
  // Check privacy descriptions
  const requiredDescriptions = [
    'NSPhotoLibraryUsageDescription',
    'NSCameraUsageDescription',
    'NSMicrophoneUsageDescription'
  ];
  
  requiredDescriptions.forEach(key => {
    if (!appJson.expo.ios.infoPlist[key]) {
      console.error(`❌ ERROR: Missing ${key} in infoPlist`);
      hasErrors = true;
    } else {
      console.log(`✅ ${key} present`);
    }
  });
  
} catch (error) {
  console.error('❌ ERROR: Could not read or parse app.json');
  hasErrors = true;
}

// Check 2: Validate eas.json
console.log('\n🏗️  Checking eas.json configuration...');
try {
  const easJson = JSON.parse(fs.readFileSync(path.join(__dirname, '../eas.json'), 'utf8'));
  
  if (easJson.build.production.ios.bundleIdentifier !== 'Therealfollysurfreport.SurfVista') {
    console.error('❌ ERROR: Bundle ID in eas.json does not match');
    hasErrors = true;
  } else {
    console.log('✅ EAS bundle ID matches');
  }
  
  if (!easJson.submit.production.ios.appleId) {
    console.error('❌ ERROR: Apple ID not configured in eas.json');
    hasErrors = true;
  } else {
    console.log('✅ Apple ID configured');
  }
  
} catch (error) {
  console.error('❌ ERROR: Could not read or parse eas.json');
  hasErrors = true;
}

// Check 3: Validate RevenueCat configuration
console.log('\n💳 Checking RevenueCat configuration...');
try {
  const superwallConfig = fs.readFileSync(path.join(__dirname, '../utils/superwallConfig.ts'), 'utf8');
  
  if (superwallConfig.includes('appl_uyUNhkTURhBCqiVsRaBqBYbhIda')) {
    console.log('✅ RevenueCat iOS production key configured');
  } else {
    console.warn('⚠️  WARNING: RevenueCat iOS key may not be configured');
    hasWarnings = true;
  }
  
  if (superwallConfig.includes('YOUR_') || superwallConfig.includes('_HERE')) {
    console.error('❌ ERROR: Placeholder API keys detected in superwallConfig.ts');
    hasErrors = true;
  }
  
} catch (error) {
  console.error('❌ ERROR: Could not read superwallConfig.ts');
  hasErrors = true;
}

// Check 4: Verify production optimizations
console.log('\n⚡ Checking production optimizations...');
try {
  const videoPlayer = fs.readFileSync(path.join(__dirname, '../app/video-player.tsx'), 'utf8');
  
  // Check if console.logs are wrapped in __DEV__
  const unwrappedLogs = videoPlayer.match(/^\s*console\.(log|error|warn)\(/gm);
  if (unwrappedLogs && unwrappedLogs.length > 0) {
    console.warn('⚠️  WARNING: Some console.logs may not be wrapped in __DEV__ checks');
    hasWarnings = true;
  } else {
    console.log('✅ Console logs properly wrapped for production');
  }
  
} catch (error) {
  console.warn('⚠️  WARNING: Could not verify production optimizations');
  hasWarnings = true;
}

// Check 5: Verify required assets
console.log('\n🎨 Checking required assets...');
const requiredAssets = [
  'assets/images/24ddf601-3a1f-4b13-9dd1-352e94c2d396.png', // App icon
  'assets/images/final_quest_240x240.png' // Favicon
];

requiredAssets.forEach(asset => {
  if (fs.existsSync(path.join(__dirname, '..', asset))) {
    console.log(`✅ ${asset} exists`);
  } else {
    console.error(`❌ ERROR: Missing required asset: ${asset}`);
    hasErrors = true;
  }
});

// Final summary
console.log('\n' + '='.repeat(50));
if (hasErrors) {
  console.error('❌ BUILD VALIDATION FAILED');
  console.error('Please fix the errors above before building for production.');
  process.exit(1);
} else if (hasWarnings) {
  console.warn('⚠️  BUILD VALIDATION PASSED WITH WARNINGS');
  console.warn('Review the warnings above, but you can proceed with the build.');
  process.exit(0);
} else {
  console.log('✅ BUILD VALIDATION PASSED');
  console.log('Your app is ready for production build!');
  console.log('\nNext steps:');
  console.log('1. Run: eas build --platform ios --profile production');
  console.log('2. Run: eas submit --platform ios --profile production');
  process.exit(0);
}
