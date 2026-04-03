// Legacy shim — all real logic is in SubscriptionContext and paywallHelper.
// This file exists only for backward compatibility with any remaining imports.
import { Platform } from 'react-native';
import { openPaywall, openPaywallIfNeeded } from './paywallHelper';
import { configureRevenueCat } from './revenueCatInit';

export { openPaywall as presentPaywall, openPaywallIfNeeded };

export async function initializeRevenueCat(): Promise<boolean> {
  console.log('[superwallConfig] initializeRevenueCat() called — delegating to configureRevenueCat');
  await configureRevenueCat();
  return true;
}

export const initializePaymentSystem = initializeRevenueCat;

export function isPaymentSystemAvailable(): boolean {
  return true;
}

export function isPaymentSystemAvailableInternal(): boolean {
  return true;
}

export function getInitializationError(): string | null {
  return null;
}

export function getInitializationErrorInternal(): string | null {
  return null;
}

export async function restorePurchases(): Promise<{ success: boolean; state?: 'restored' | 'none'; message?: string }> {
  console.log('[superwallConfig] restorePurchases() called');
  if (Platform.OS === 'web') {
    return { success: false, message: 'Restore purchases is only available in the mobile app.' };
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const Purchases = (await import('react-native-purchases')).default;
    const customerInfo = await Purchases.restorePurchases();
    const hasActive = Object.keys(customerInfo.entitlements.active).length > 0;
    if (hasActive) {
      return { success: true, state: 'restored', message: 'Subscription restored successfully!' };
    }
    return { success: false, state: 'none', message: 'No previous purchases found.' };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Failed to restore purchases.';
    console.error('[superwallConfig] restorePurchases error:', e);
    return { success: false, message: msg };
  }
}

export async function presentCustomerCenter(): Promise<void> {
  console.log('[superwallConfig] presentCustomerCenter() — delegating to openPaywall');
  try {
    await openPaywall();
  } catch (err: unknown) {
    console.warn('[superwallConfig] presentCustomerCenter error (swallowed):', err);
  }
}

export async function forceRefreshOfferings(): Promise<{ success: boolean; message: string }> {
  console.log('[superwallConfig] forceRefreshOfferings() called — no-op shim');
  return { success: true, message: 'Offerings managed by SubscriptionContext.' };
}

export function checkPaymentConfiguration(): boolean {
  return true;
}

export async function checkSubscriptionStatus(_userId: string): Promise<{ isActive: boolean; endDate: string | null }> {
  return { isActive: false, endDate: null };
}

export async function checkEntitlements(): Promise<boolean> {
  return false;
}

export async function getCustomerInfo(): Promise<null> {
  return null;
}

export async function updateSubscriptionInSupabase(_userId: string, _customerInfo: unknown): Promise<void> {}

export async function checkSubscriptionInSupabase(_userId: string): Promise<{ isActive: boolean; endDate: string | null }> {
  return { isActive: false, endDate: null };
}

export async function identifyUser(_userId: string, _email?: string): Promise<void> {
  console.log('[superwallConfig] identifyUser() — no-op, handled by SubscriptionContext');
}

export async function logoutUser(): Promise<void> {
  console.log('[superwallConfig] logoutUser() — no-op, handled by SubscriptionContext');
}

export const PAYMENT_CONFIG = {
  PRODUCTS: {
    MONTHLY_SUBSCRIPTION: 'surfvista_Monthly',
    ANNUAL_SUBSCRIPTION: 'surfvista_Annual',
  },
  ENTITLEMENT_ID: 'SurfVista',
  OFFERING_ID: 'default',
  PACKAGE_IDS: {
    MONTHLY: '$rc_monthly',
    ANNUAL: '$rc_annual',
  },
  PRICING: {
    MONTHLY: '$12.99',
    ANNUAL: '$99.99',
  },
};
