import { Platform } from 'react-native';
import RevenueCatUI from 'react-native-purchases-ui';

export async function openPaywall(): Promise<void> {
  if (Platform.OS === 'web') return;
  console.log('[PaywallHelper] openPaywall called — presenting RevenueCat native paywall');
  await RevenueCatUI.presentPaywall();
  console.log('[PaywallHelper] RevenueCat native paywall dismissed');
}

export async function openPaywallIfNeeded(): Promise<void> {
  if (Platform.OS === 'web') return;
  console.log('[PaywallHelper] openPaywallIfNeeded called');
  await RevenueCatUI.presentPaywallIfNeeded({ requiredEntitlementIdentifier: 'SurfVista' });
  console.log('[PaywallHelper] RevenueCat native paywall if-needed dismissed');
}
