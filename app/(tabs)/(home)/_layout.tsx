import { Platform } from 'react-native';
import { Stack } from 'expo-router';

export default function HomeLayout() {
  console.log('[HomeLayout] Rendering home layout for platform:', Platform.OS);
  
  return (
    <Stack>
      <Stack.Screen
        name="index"
        options={{
          headerShown: Platform.OS === 'ios', // Show header on iOS with NativeTabs, hide on Android/Web
          title: 'Home'
        }}
      />
    </Stack>
  );
}
