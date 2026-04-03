
import { router } from 'expo-router';

/**
 * Helper function to present the paywall from any screen.
 * Navigates to the /paywall route — works regardless of SDK initialization state.
 */
export async function openPaywall(
  userId?: string,
  userEmail?: string,
  onSuccess?: () => void
): Promise<void> {
  console.log('[PaywallHelper] Opening paywall - userId:', userId, 'email:', userEmail);
  router.push('/paywall');
  // onSuccess is called by the paywall screen itself after a successful purchase
}
