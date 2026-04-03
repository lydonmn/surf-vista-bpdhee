
import { router } from 'expo-router';

/**
 * Helper function to present the paywall from any screen.
 * Navigates to /paywall using router.push — ensures the paywall screen
 * always shows correctly in TestFlight/production (no SDK presentPaywall call).
 *
 * onSuccess is kept for API compatibility but is not called here since
 * the paywall screen handles its own post-purchase navigation.
 */
export async function openPaywall(
  userId?: string,
  userEmail?: string,
  onSuccess?: () => void
): Promise<void> {
  console.log('[PaywallHelper] Opening paywall via router.push - userId:', userId);
  router.push('/paywall');
}
