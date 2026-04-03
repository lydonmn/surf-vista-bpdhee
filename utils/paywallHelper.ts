import { Platform } from 'react-native';
import RevenueCatUI from 'react-native-purchases-ui';

/**
 * Present the RevenueCat native paywall.
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
  console.log('[PaywallHelper] openPaywall called — presenting RevenueCat native paywall', {
    hasUserId: !!userId,
    hasEmail: !!email,
    hasCallback: !!onSuccess,
  });
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
export async function openPaywallIfNeeded(): Promise<void> {
  if (Platform.OS === 'web') return;
  console.log('[PaywallHelper] openPaywallIfNeeded called');
  await RevenueCatUI.presentPaywallIfNeeded({ requiredEntitlementIdentifier: 'SurfVista' });
  console.log('[PaywallHelper] RevenueCat native paywall if-needed dismissed');
}
