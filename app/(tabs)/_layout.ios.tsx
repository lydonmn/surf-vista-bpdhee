
import { Stack } from 'expo-router';
import { NativeTabs, Icon, Label } from 'expo-router/unstable-native-tabs';

/**
 * 🚨 iOS Native Tabs Layout
 * Uses native iOS tab bar with SF Symbols
 */
export default function TabLayout() {
  console.log('[TabLayout iOS] ===== RENDERING NATIVE TABS =====');
  
  return (
    <>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(home)" />
        <Stack.Screen name="videos" />
        <Stack.Screen name="report" />
        <Stack.Screen name="forecast" />
        <Stack.Screen name="profile" />
      </Stack>
      
      <NativeTabs>
        <NativeTabs.Trigger name="(home)">
          <Icon sf="house.fill" />
          <Label>Home</Label>
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="videos">
          <Icon sf="video.fill" />
          <Label>Videos</Label>
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="report">
          <Icon sf="water.waves" />
          <Label>Report</Label>
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="forecast">
          <Icon sf="calendar" />
          <Label>Forecast</Label>
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="profile">
          <Icon sf="person.fill" />
          <Label>Profile</Label>
        </NativeTabs.Trigger>
      </NativeTabs>
    </>
  );
}
