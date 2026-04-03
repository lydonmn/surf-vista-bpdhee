import { Platform } from 'react-native';

export async function openPaywall(
  userId?: string,
  userEmail?: string,
  onSuccess?: () => void
): Promise<void> {
  if (Platform.OS === 'web') return;

  console.log('[PaywallHelper] openPaywall called - userId:', userId);

  try {
    const { RevenueCatUI } = require('react-native-purchases-ui');
    console.log('[PaywallHelper] Presenting RevenueCat native paywall');
    await RevenueCatUI.presentPaywall();
    console.log('[PaywallHelper] RevenueCat native paywall dismissed');
    onSuccess?.();
  } catch (e) {
    console.warn('[PaywallHelper] RevenueCatUI not available, falling back to custom paywall:', e);
    const { router } = require('expo-router');
    router.push('/paywall');
  }
}

export async function openPaywallIfNeeded(): Promise<void> {
  if (Platform.OS === 'web') return;

  console.log('[PaywallHelper] openPaywallIfNeeded called');

  try {
    const { RevenueCatUI } = require('react-native-purchases-ui');
    console.log('[PaywallHelper] Presenting RevenueCat native paywall if needed');
    await RevenueCatUI.presentPaywallIfNeeded({ requiredEntitlementIdentifier: 'SurfVista' });
    console.log('[PaywallHelper] RevenueCat native paywall if-needed dismissed');
  } catch (e) {
    console.warn('[PaywallHelper] RevenueCatUI.presentPaywallIfNeeded not available:', e);
    const { router } = require('expo-router');
    router.push('/paywall');
  }
}
