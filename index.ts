
// 🚨 CRITICAL: Ultra-defensive entry point to prevent ANY startup crashes
// This file MUST NOT throw errors under any circumstances

// Wrap EVERYTHING in try-catch to ensure app never crashes on startup
try {
  // Only initialize error logger in development mode
  if (__DEV__) {
    try {
      require('./utils/errorLogger');
      console.log('[index.ts] ✅ Error logger initialized');
    } catch (loggerError) {
      // Silently fail - logging is non-critical
      console.warn('[index.ts] ⚠️ Error logger failed (non-critical)');
    }
  }
} catch (outerError) {
  // Ultimate fallback - should never reach here
  console.warn('[index.ts] ⚠️ Initialization warning (non-critical)');
}

// Import expo-router entry point
// This MUST be the last line and MUST NOT be wrapped in try-catch
import 'expo-router/entry';
