
import Superwall from 'expo-superwall';
import { supabase } from '@/app/integrations/supabase/client';

// Initialize Superwall with your API key
// Replace with your actual Superwall API key from https://superwall.com
export const SUPERWALL_API_KEY = 'pk_YOUR_SUPERWALL_API_KEY_HERE';

export const initializeSuperwall = async () => {
  try {
    await Superwall.configure(SUPERWALL_API_KEY);
    console.log('[Superwall] Initialized successfully');
    
    // Set up purchase handler
    Superwall.setPurchaseHandler(async (productId: string) => {
      console.log('[Superwall] Purchase handler called for product:', productId);
      
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        console.error('[Superwall] No user found for purchase');
        return { success: false, error: 'User not authenticated' };
      }
      
      // Update user's subscription status in Supabase
      try {
        const subscriptionEndDate = new Date();
        subscriptionEndDate.setMonth(subscriptionEndDate.getMonth() + 1); // 1 month subscription
        
        const { error } = await supabase
          .from('profiles')
          .update({
            is_subscribed: true,
            subscription_end_date: subscriptionEndDate.toISOString(),
          })
          .eq('id', user.id);
        
        if (error) {
          console.error('[Superwall] Error updating subscription:', error);
          return { success: false, error: error.message };
        }
        
        console.log('[Superwall] Subscription updated successfully');
        return { success: true };
      } catch (error: any) {
        console.error('[Superwall] Exception updating subscription:', error);
        return { success: false, error: error.message };
      }
    });
    
    // Set up restore handler
    Superwall.setRestoreHandler(async () => {
      console.log('[Superwall] Restore handler called');
      
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        console.error('[Superwall] No user found for restore');
        return { success: false, error: 'User not authenticated' };
      }
      
      // Check if user has an active subscription
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('is_subscribed, subscription_end_date')
        .eq('id', user.id)
        .single();
      
      if (error || !profile) {
        console.error('[Superwall] Error fetching profile:', error);
        return { success: false, error: 'Could not fetch subscription status' };
      }
      
      if (profile.is_subscribed && profile.subscription_end_date) {
        const endDate = new Date(profile.subscription_end_date);
        if (endDate > new Date()) {
          console.log('[Superwall] Active subscription found');
          return { success: true };
        }
      }
      
      console.log('[Superwall] No active subscription found');
      return { success: false, error: 'No active subscription found' };
    });
    
    return true;
  } catch (error) {
    console.error('[Superwall] Initialization error:', error);
    return false;
  }
};

export const presentPaywall = async (userId?: string, userEmail?: string) => {
  try {
    // Set user attributes if provided
    if (userId && userEmail) {
      await Superwall.setUserAttributes({
        userId,
        email: userEmail,
      });
    }
    
    // Present the paywall
    const result = await Superwall.presentPaywall('subscription_paywall');
    return result;
  } catch (error) {
    console.error('[Superwall] Error presenting paywall:', error);
    throw error;
  }
};

export const restorePurchases = async () => {
  try {
    const result = await Superwall.restorePurchases();
    return result;
  } catch (error) {
    console.error('[Superwall] Error restoring purchases:', error);
    throw error;
  }
};
