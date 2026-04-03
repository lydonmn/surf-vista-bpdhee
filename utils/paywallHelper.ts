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
  console.log('[PaywallHelper] openPaywallIfNeeded called');
  await configureRevenueCat();
  await revenueCatConfigured;
  console.log('[PaywallHelper] RC confirmed configured — presenting paywall if needed');
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
