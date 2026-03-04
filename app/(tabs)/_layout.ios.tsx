
import { NativeTabs, Icon, Label } from 'expo-router/unstable-native-tabs';

export default function TabLayout() {
  console.log('[TabLayout iOS] ===== RENDERING NATIVE TABS =====');
  
  return (
    <NativeTabs>
      <NativeTabs.Trigger key="home" name="(home)/index">
        <Icon sf="house.fill" />
        <Label>Home</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger key="videos" name="videos">
        <Icon sf="video.fill" />
        <Label>Videos</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger key="report" name="report">
        <Icon sf="water.waves" />
        <Label>Report</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger key="forecast" name="forecast">
        <Icon sf="calendar" />
        <Label>Forecast</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger key="profile" name="profile">
        <Icon sf="person.fill" />
        <Label>Profile</Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
