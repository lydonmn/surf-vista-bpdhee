
import { NativeTabs, Icon, Label } from 'expo-router/unstable-native-tabs';

export default function TabLayout() {
  console.log('[TabLayout iOS] ===== RENDERING NATIVE TABS =====');

  return (
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
  );
}
