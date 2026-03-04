import { Platform } from 'react-native';
import { Stack } from 'expo-router';

export default function HomeLayout() {
  console.log('[HomeLayout] ===== RENDERING HOME LAYOUT =====');
  console.log('[HomeLayout] Platform:', Platform.OS);
  
  return (
    <Stack
      screenOptions={{
        headerShown: false, // Hide header by default - NativeTabs handles navigation on iOS
      }}
    >
      <Stack.Screen
        name="index"
        options={{
          headerShown: false,
          title: 'Home'
        }}
      />
    </Stack>
  );
}
