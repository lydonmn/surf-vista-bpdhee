import { Platform } from 'react-native';
import RevenueCatUI from 'react-native-purchases-ui';
import Constants from 'expo-constants';
import { configureRevenueCat, revenueCatConfigured } from '@/utils/revenueCatInit';

const _extra = Constants.expoConfig?.extra || {};
const ENTITLEMENT_ID: string = _extra.revenueCatEntitlementId || 'pro';

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
    // Swallow errors so the app never crashes, but log structured details for debugging.
    // Error 23 = "Purchases not configured" — means configure() hadn't finished yet.
    const errCode = (paywallErr as { code?: number | string })?.code;
    const errMsg = (paywallErr as { message?: string })?.message ?? String(paywallErr);
    console.warn('[PaywallHelper] presentPaywall error (swallowed) — code:', errCode, '| message:', errMsg);
    if (errCode === 23 || errCode === '23' || errMsg.includes('23')) {
      console.warn('[PaywallHelper] ⚠️  Error 23 detected: Purchases was not configured when presentPaywall was called. Check revenueCatInit logs above.');
    }
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
  console.log('[PaywallHelper] presentPaywallIfNeeded — entitlementId:', ENTITLEMENT_ID);
  try {
    const result = await RevenueCatUI.presentPaywallIfNeeded({ requiredEntitlementIdentifier: ENTITLEMENT_ID });
    console.log('[PaywallHelper] RevenueCat native paywall if-needed dismissed, result:', result);
  } catch (paywallErr: unknown) {
    // Swallow errors so the app never crashes, but log structured details for debugging.
    // Error 23 = "Purchases not configured" — means configure() hadn't finished yet.
    const errCode = (paywallErr as { code?: number | string })?.code;
    const errMsg = (paywallErr as { message?: string })?.message ?? String(paywallErr);
    console.warn('[PaywallHelper] presentPaywallIfNeeded error (swallowed) — code:', errCode, '| message:', errMsg);
    if (errCode === 23 || errCode === '23' || errMsg.includes('23')) {
      console.warn('[PaywallHelper] ⚠️  Error 23 detected: Purchases was not configured when presentPaywallIfNeeded was called. Check revenueCatInit logs above.');
    }
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
