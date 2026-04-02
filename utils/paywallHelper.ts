
import { Alert } from 'react-native';
import {
  presentPaywall,
  isPaymentSystemAvailable,
  initializeRevenueCat,
} from './superwallConfig';

/**
 * Helper function to present the paywall from any screen.
 * Auto-initializes RevenueCat if not yet ready, then presents the paywall.
 */
export async function openPaywall(
  userId?: string,
  userEmail?: string,
  onSuccess?: () => void
): Promise<void> {
  console.log('[PaywallHelper] Opening paywall - userId:', userId);

  try {
    // Always ensure RevenueCat is initialized before presenting
    if (!isPaymentSystemAvailable()) {
      console.log('[PaywallHelper] RevenueCat not ready, initializing now...');
      const initialized = await initializeRevenueCat();
      console.log('[PaywallHelper] Initialization result:', initialized);
      // presentPaywall handles its own not-initialized guard — continue regardless
    }

    const result = await presentPaywall(userId, userEmail);
    console.log('[PaywallHelper] Paywall result:', result.state);

    if (result.state === 'purchased' || result.state === 'restored') {
      Alert.alert(
        'Success!',
        result.message || 'Subscription activated successfully!',
        [{ text: 'OK', onPress: onSuccess }]
      );
    } else if (result.state === 'not_configured') {
      Alert.alert(
        'Setup Required',
        result.message || 'Subscriptions are not configured yet.',
        [{ text: 'OK' }]
      );
    } else if (result.state === 'error') {
      Alert.alert(
        'Error',
        result.message || 'Unable to load subscription options.',
        [{ text: 'OK' }]
      );
    }
    // 'declined' — user cancelled, do nothing

  } catch (error) {
    console.error('[PaywallHelper] Error opening paywall:', error);
    Alert.alert(
      'Subscribe Failed',
      'Unable to open subscription page. Please try again later.',
      [{ text: 'OK' }]
    );
  }
}
