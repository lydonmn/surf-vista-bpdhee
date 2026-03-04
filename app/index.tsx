
import { Redirect } from 'expo-router';

/**
 * 🚨 CRITICAL: Simplified root index - immediate redirect
 * No hooks, no state, no logic - just redirect
 */
export default function Index() {
  console.log('[Index] Redirecting to /(tabs)');
  return <Redirect href="/(tabs)" />;
}
