
import Superwall from 'expo-superwall';
import { supabase } from '@/app/integrations/supabase/client';

// ============================================
// IMPORTANT: Replace with your actual Superwall API key
// Get your API key from: https://superwall.com/dashboard
// ============================================
export const SUPERWALL_API_KEY = 'pk_YOUR_SUPERWALL_API_KEY_HERE';

let isSuperwallInitialized = false;

export const initializeSuperwall = async () => {
  // Skip initialization if API key is not configured
  if (!SUPERWALL_API_KEY || SUPERWALL_API_KEY === 'pk_YOUR_SUPERWALL_API_KEY_HERE') {
    console.warn('[Superwall] ⚠️ API key not configured. Superwall features will be disabled.');
    console.warn('[Superwall] 📝 Please set SUPERWALL_API_KEY in utils/superwallConfig.ts');
    console.warn('[Superwall] 🔗 Get your API key from: https://superwall.com/dashboard');
    return false;
  }

  // Skip if already initialized
  if (isSuperwallInitialized) {
    console.log('[Superwall] ✅ Already initialized');
    return true;
  }

  try {
    console.log('[Superwall] 🚀 Initializing...');
    await Superwall.configure(SUPERWALL_API_KEY);
    console.log('[Superwall] ✅ Initialized successfully');
    isSuperwallInitialized = true;
    
    // Set up purchase handler
    Superwall.setPurchaseHandler(async (productId: string) => {
      console.log('[Superwall] 💳 Purchase handler called for product:', productId);
      
      try {
        // Get current user
        const { data: { user } } = await supabase.auth.getUser();
        
        if (!user) {
          console.error('[Superwall] ❌ No user found for purchase');
          return { success: false, error: 'User not authenticated' };
        }
        
        // Update user's subscription status in Supabase
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
          console.error('[Superwall] ❌ Error updating subscription:', error);
          return { success: false, error: error.message };
        }
        
        console.log('[Superwall] ✅ Subscription updated successfully');
        console.log('[Superwall] 📅 Subscription end date:', subscriptionEndDate.toISOString());
        return { success: true };
      } catch (error: any) {
        console.error('[Superwall] ❌ Exception in purchase handler:', error);
        return { success: false, error: error.message || 'Purchase failed' };
      }
    });
    
    // Set up restore handler
    Superwall.setRestoreHandler(async () => {
      console.log('[Superwall] 🔄 Restore handler called');
      
      try {
        const { data: { user } } = await supabase.auth.getUser();
        
        if (!user) {
          console.error('[Superwall] ❌ No user found for restore');
          return { success: false, error: 'User not authenticated' };
        }
        
        // Check if user has an active subscription
        const { data: profile, error } = await supabase
          .from('profiles')
          .select('is_subscribed, subscription_end_date')
          .eq('id', user.id)
          .single();
        
        if (error || !profile) {
          console.error('[Superwall] ❌ Error fetching profile:', error);
          return { success: false, error: 'Could not fetch subscription status' };
        }
        
        if (profile.is_subscribed && profile.subscription_end_date) {
          const endDate = new Date(profile.subscription_end_date);
          if (endDate > new Date()) {
            console.log('[Superwall] ✅ Active subscription found');
            return { success: true };
          }
        }
        
        console.log('[Superwall] ℹ️ No active subscription found');
        return { success: false, error: 'No active subscription found' };
      } catch (error: any) {
        console.error('[Superwall] ❌ Exception in restore handler:', error);
        return { success: false, error: error.message || 'Restore failed' };
      }
    });
    
    return true;
  } catch (error: any) {
    console.error('[Superwall] ❌ Initialization error:', error);
    console.error('[Superwall] 📋 Error details:', error.message || 'Unknown error');
    // Don't throw - just return false to indicate initialization failed
    return false;
  }
};

export const isSuperwallAvailable = () => {
  return isSuperwallInitialized;
};

export const presentPaywall = async (userId?: string, userEmail?: string) => {
  if (!isSuperwallInitialized) {
    console.warn('[Superwall] ⚠️ Cannot present paywall - Superwall not initialized');
    throw new Error('Superwall is not configured. Please contact support.');
  }

  try {
    console.log('[Superwall] 🎨 Presenting paywall...');
    
    // Set user attributes if provided
    if (userId && userEmail) {
      console.log('[Superwall] 👤 Setting user attributes:', { userId, email: userEmail });
      await Superwall.setUserAttributes({
        userId,
        email: userEmail,
      });
    }
    
    // Present the paywall
    const result = await Superwall.presentPaywall('subscription_paywall');
    console.log('[Superwall] 📊 Paywall result:', result);
    return result;
  } catch (error: any) {
    console.error('[Superwall] ❌ Error presenting paywall:', error);
    throw error;
  }
};

export const restorePurchases = async () => {
  if (!isSuperwallInitialized) {
    console.warn('[Superwall] ⚠️ Cannot restore purchases - Superwall not initialized');
    throw new Error('Superwall is not configured. Please contact support.');
  }

  try {
    console.log('[Superwall] 🔄 Restoring purchases...');
    const result = await Superwall.restorePurchases();
    console.log('[Superwall] 📊 Restore result:', result);
    return result;
  } catch (error: any) {
    console.error('[Superwall] ❌ Error restoring purchases:', error);
    throw error;
  }
};

// Helper function to check if Superwall is properly configured
export const checkSuperwallConfiguration = () => {
  const isConfigured = SUPERWALL_API_KEY && SUPERWALL_API_KEY !== 'pk_YOUR_SUPERWALL_API_KEY_HERE';
  
  if (!isConfigured) {
    console.log('[Superwall] ⚠️ Configuration Check:');
    console.log('[Superwall] - API Key: NOT CONFIGURED');
    console.log('[Superwall] - Status: Disabled');
    console.log('[Superwall] 📝 To enable Superwall:');
    console.log('[Superwall]   1. Get your API key from https://superwall.com/dashboard');
    console.log('[Superwall]   2. Update SUPERWALL_API_KEY in utils/superwallConfig.ts');
    console.log('[Superwall]   3. Restart the app');
  } else {
    console.log('[Superwall] ✅ Configuration Check:');
    console.log('[Superwall] - API Key: Configured');
    console.log('[Superwall] - Status:', isSuperwallInitialized ? 'Initialized' : 'Not Initialized');
  }
  
  return isConfigured;
};
