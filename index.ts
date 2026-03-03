
// 🚨 CRITICAL: Wrap errorLogger import in try-catch to prevent native crashes
try {
  // Initialize Natively console log capture before anything else
  // Only in development mode
  if (__DEV__) {
    require('./utils/errorLogger');
  }
} catch (error) {
  // Silently fail - don't crash the app if logging setup fails
  console.warn('[index.ts] Error logger initialization failed (non-critical):', error);
}

import 'expo-router/entry';
