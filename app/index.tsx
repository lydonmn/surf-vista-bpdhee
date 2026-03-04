
import { Redirect } from 'expo-router';
import { StyleSheet } from 'react-native';

/**
 * 🚨 CRITICAL FIX: Root index screen - ALWAYS redirects immediately
 * No blocking, no waiting - just redirect to tabs
 * The tabs layout will handle any auth checks if needed
 */
export default function Index() {
  console.log('[Index] ===== ROOT INDEX SCREEN RENDERING =====');
  console.log('[Index] Redirecting immediately to /(tabs)');
  
  // 🚨 CRITICAL FIX: ALWAYS redirect immediately - no blocking
  // Don't check auth state here - let the tabs handle it
  return <Redirect href="/(tabs)" />;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000000',
  },
});
