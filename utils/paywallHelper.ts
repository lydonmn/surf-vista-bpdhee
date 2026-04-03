import { Platform } from 'react-native';
import RevenueCatUI from 'react-native-purchases-ui';
import Purchases from 'react-native-purchases';
import Constants from 'expo-constants';

async function ensureConfigured(): Promise<void> {
  try {
    // Lightweight check — throws error code 23 if not yet configured
    await Purchases.getCustomerInfo();
  } catch (e: any) {
    const isNotConfigured =
      e?.code === 23 ||
      String(e?.message ?? '').includes('23') ||
      String(e?.message ?? '').toLowerCase().includes('configuration');

    if (isNotConfigured) {
      console.log('[PaywallHelper] RC not configured (error 23) — configuring now');
      const extra = Constants.expoConfig?.extra || {};
      const testKey = extra.revenueCatTestApiKeyIos || extra.revenueCatTestApiKeyAndroid || '';
      const productionKey =
        Platform.OS === 'ios'
          ? (extra.revenueCatApiKeyIos || '')
          : (extra.revenueCatApiKeyAndroid || '');
      const apiKey = __DEV__ && testKey ? testKey : productionKey;

      if (apiKey) {
        await Purchases.configure({ apiKey });
        console.log('[PaywallHelper] RC configured successfully — waiting for SDK to settle');
        // Give the SDK a moment to finish internal setup before presenting UI
        await new Promise<void>((resolve) => setTimeout(resolve, 300));
      } else {
        console.warn('[PaywallHelper] No RevenueCat API key found — cannot configure');
      }
    }
  }
}

/**
 * Present the RevenueCat native paywall.
 *
 * Calls ensureConfigured() first so that tapping Subscribe before
 * SubscriptionContext has finished initializing never triggers Error 23.
 *
 * @param userId   - Optional user ID (unused by RC native UI, kept for call-site compatibility)
 * @param email    - Optional email (unused by RC native UI, kept for call-site compatibility)
 * @param onSuccess - Optional callback invoked after the paywall is dismissed (regardless of outcome).
 *                    Callers use this to refresh profile/subscription state.
 */
export async function openPaywall(
  userId?: string,
  email?: string,
  onSuccess?: () => Promise<void> | void,
): Promise<void> {
  if (Platform.OS === 'web') return;
  console.log('[PaywallHelper] openPaywall called — ensuring RC is configured', {
    hasUserId: !!userId,
    hasEmail: !!email,
    hasCallback: !!onSuccess,
  });
  await ensureConfigured();
  console.log('[PaywallHelper] Presenting RevenueCat native paywall');
  await RevenueCatUI.presentPaywall();
  console.log('[PaywallHelper] RevenueCat native paywall dismissed');
  if (onSuccess) {
    try {
      await onSuccess();
    } catch (err) {
      console.warn('[PaywallHelper] onSuccess callback error:', err);
    }
  }
}

/**
 * Present the RevenueCat native paywall only if the user lacks the required entitlement.
 */
export async function openPaywallIfNeeded(
  userId?: string,
  email?: string,
  onSuccess?: () => Promise<void> | void,
): Promise<void> {
  if (Platform.OS === 'web') return;
  console.log('[PaywallHelper] openPaywallIfNeeded called — ensuring RC is configured');
  await ensureConfigured();
  await RevenueCatUI.presentPaywallIfNeeded({ requiredEntitlementIdentifier: 'SurfVista' });
  console.log('[PaywallHelper] RevenueCat native paywall if-needed dismissed');
  if (onSuccess) {
    try {
      await onSuccess();
    } catch (err) {
      console.warn('[PaywallHelper] onSuccess callback error:', err);
    }
  }
}
