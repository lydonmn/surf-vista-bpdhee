
import { Stack } from 'expo-router';

/**
 * 🚨 CRITICAL FIX: Home folder layout
 * This ensures the (home) folder is properly recognized as a route group
 */
export default function HomeLayout() {
  console.log('[HomeLayout] ===== RENDERING HOME LAYOUT =====');
  
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
    </Stack>
  );
}
