
import { Alert } from 'react-native';
import { 
  presentPaywall, 
  isPaymentSystemAvailable, 
  initializeRevenueCat 
} from './superwallConfig';

/**
 * Helper function to present the paywall from any screen
 * Handles initialization, error states, and user feedback
 */
export async function openPaywall(
  userId?: string,
  userEmail?: string,
  onSuccess?: () => void
): Promise<void> {
  console.log('[PaywallHelper] 🔘 Opening paywall...');
  
  try {
    // Ensure RevenueCat is initialized first
    if (!isPaymentSystemAvailable()) {

      console.log('[PaywallHelper] ⚠️ Payment system not available, initializing...');
      const initialized = await initializeRevenueCat();
      
      if (!initialized) {
        Alert.alert(
          'Payment System Not Ready',
          'The payment system could not be initialized. Please restart the app and try again.',
          [{ text: 'OK' }]
        );
        return;
      }
    }
    
    const result = await presentPaywall(userId, userEmail);
    
    console.log('[PaywallHelper] 📊 Paywall result:', result);
    
    if (result.state === 'purchased' || result.state === 'restored') {
      Alert.alert(
        'Success!',
        result.message || 'Subscription activated successfully!',
        [{ 
          text: 'OK',
          onPress: onSuccess
        }]
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
    // If declined, do nothing (user cancelled)
    
  } catch (error) {
    console.error('[PaywallHelper] ❌ Error opening paywall:', error);
    Alert.alert(
      'Subscribe Failed',
      'Unable to open subscription page. Please try again later.',
      [{ text: 'OK' }]
    );
  }
}
