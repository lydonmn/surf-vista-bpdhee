import { Platform } from 'react-native';
import RevenueCatUI from 'react-native-purchases-ui';
import { configureRevenueCat, revenueCatConfigured } from '@/utils/revenueCatInit';

/**
 * Present the RevenueCat native paywall.
 *
 * Waits on the shared module-level `revenueCatConfigured` promise so that
 * `presentPaywall()` is never called before `Purchases.configure()` finishes,
 * eliminating Error 23 in TestFlight.
 */
export async function openPaywall(
  userId?: string,
  email?: string,
  onSuccess?: () => Promise<void> | void,
): Promise<void> {
  if (Platform.OS === 'web') return;
  console.log('[PaywallHelper] openPaywall called', {
    hasUserId: !!userId,
    hasEmail: !!email,
    hasCallback: !!onSuccess,
  });
  // configureRevenueCat() is idempotent — safe to call even if already configured
  await configureRevenueCat();
  // Wait for the module-level promise to fully resolve before presenting UI
  await revenueCatConfigured;
  console.log('[PaywallHelper] RC confirmed configured — presenting paywall');
  try {
    const result = await RevenueCatUI.presentPaywall();
    console.log('[PaywallHelper] RevenueCat native paywall dismissed, result:', result);
  } catch (paywallErr: unknown) {
    // Swallow errors from the paywall (e.g. user cancellation, native module unavailable in Expo Go)
    console.warn('[PaywallHelper] presentPaywall error (swallowed):', paywallErr);
    return;
  }
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
  console.log('[PaywallHelper] openPaywallIfNeeded called');
  await configureRevenueCat();
  await revenueCatConfigured;
  console.log('[PaywallHelper] RC confirmed configured — presenting paywall if needed');
  try {
    const result = await RevenueCatUI.presentPaywallIfNeeded({ requiredEntitlementIdentifier: 'pro' });
    console.log('[PaywallHelper] RevenueCat native paywall if-needed dismissed, result:', result);
  } catch (paywallErr: unknown) {
    // Swallow errors from the paywall (e.g. user cancellation, native module unavailable in Expo Go)
    console.warn('[PaywallHelper] presentPaywallIfNeeded error (swallowed):', paywallErr);
    return;
  }
  if (onSuccess) {
    try {
      await onSuccess();
    } catch (err) {
      console.warn('[PaywallHelper] onSuccess callback error:', err);
    }
  }
}
