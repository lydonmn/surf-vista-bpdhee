
// ============================================
// PAYMENT INTEGRATION PLACEHOLDER
// ============================================
// 
// IMPORTANT: Superwall requires native modules that are not compatible
// with Expo's managed workflow. To integrate payments, you have 3 options:
//
// OPTION 1 (Recommended): Use RevenueCat with Expo
// - Install: npx expo install react-native-purchases
// - RevenueCat has better Expo support and similar features
// - Docs: https://www.revenuecat.com/docs/getting-started
//
// OPTION 2: Create an EAS Development Build
// - Install: npm install @superwall/react-native
// - Run: eas build --profile development --platform ios
// - This creates a custom native build with Superwall
// - Docs: https://docs.expo.dev/develop/development-builds/introduction/
//
// OPTION 3: Use Web-Based Payments
// - Integrate Stripe or another web payment provider
// - Use WebView or expo-web-browser for checkout
// - Update subscription status in Supabase after payment
//
// ============================================

import { supabase } from '@/app/integrations/supabase/client';

// Placeholder configuration
export const PAYMENT_CONFIG = {
  MONTHLY_PRICE: 10.99,
  ANNUAL_PRICE: 100.99,
  MONTHLY_PRODUCT_ID: 'monthly_subscription',
  ANNUAL_PRODUCT_ID: 'annual_subscription',
};

let isPaymentSystemInitialized = false;

export const initializePaymentSystem = async () => {
  console.log('[Payment] ⚠️ Payment system is not configured');
  console.log('[Payment] 📝 See utils/superwallConfig.ts for integration options');
  console.log('[Payment] 💡 Recommended: Use RevenueCat or create an EAS development build');
  
  isPaymentSystemInitialized = true;
  return true;
};

export const isPaymentSystemAvailable = () => {
  return isPaymentSystemInitialized;
};

export const presentPaywall = async (productType: 'monthly' | 'annual' = 'monthly', userId?: string, userEmail?: string) => {
  console.log('[Payment] ⚠️ Payment system not configured');
  console.log('[Payment] 📝 Product type:', productType);
  console.log('[Payment] 👤 User:', userEmail);
  
  throw new Error(
    'Payment system is not configured.\n\n' +
    'To enable payments, please:\n' +
    '1. Choose a payment provider (RevenueCat recommended)\n' +
    '2. Follow the integration guide in utils/superwallConfig.ts\n' +
    '3. Update this file with the actual implementation'
  );
};

export const restorePurchases = async () => {
  console.log('[Payment] ⚠️ Restore purchases not available - payment system not configured');
  
  throw new Error(
    'Payment system is not configured.\n\n' +
    'Cannot restore purchases without a payment provider.'
  );
};

// Helper function to manually grant subscription (for testing or admin purposes)
export const grantSubscription = async (userId: string, durationType: 'monthly' | 'annual') => {
  try {
    console.log('[Payment] 🎁 Manually granting subscription:', durationType);
    
    const subscriptionEndDate = new Date();
    if (durationType === 'annual') {
      subscriptionEndDate.setFullYear(subscriptionEndDate.getFullYear() + 1);
    } else {
      subscriptionEndDate.setMonth(subscriptionEndDate.getMonth() + 1);
    }
    
    const { error } = await supabase
      .from('profiles')
      .update({
        is_subscribed: true,
        subscription_end_date: subscriptionEndDate.toISOString(),
      })
      .eq('id', userId);
    
    if (error) {
      console.error('[Payment] ❌ Error granting subscription:', error);
      return { success: false, error: error.message };
    }
    
    console.log('[Payment] ✅ Subscription granted successfully');
    console.log('[Payment] 📅 End date:', subscriptionEndDate.toISOString());
    return { success: true };
  } catch (error: any) {
    console.error('[Payment] ❌ Exception granting subscription:', error);
    return { success: false, error: error.message || 'Failed to grant subscription' };
  }
};

// Helper function to check subscription status
export const checkSubscriptionStatus = async (userId: string) => {
  try {
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('is_subscribed, subscription_end_date')
      .eq('id', userId)
      .single();
    
    if (error || !profile) {
      console.error('[Payment] ❌ Error checking subscription:', error);
      return { isActive: false, endDate: null };
    }
    
    if (profile.is_subscribed && profile.subscription_end_date) {
      const endDate = new Date(profile.subscription_end_date);
      const isActive = endDate > new Date();
      
      console.log('[Payment] 📊 Subscription status:', isActive ? 'Active' : 'Expired');
      console.log('[Payment] 📅 End date:', profile.subscription_end_date);
      
      return { isActive, endDate: profile.subscription_end_date };
    }
    
    console.log('[Payment] 📊 No active subscription');
    return { isActive: false, endDate: null };
  } catch (error: any) {
    console.error('[Payment] ❌ Exception checking subscription:', error);
    return { isActive: false, endDate: null };
  }
};

// Helper function to check payment configuration
export const checkPaymentConfiguration = () => {
  console.log('[Payment] ⚠️ Configuration Check:');
  console.log('[Payment] - Status: Not Configured');
  console.log('[Payment] - Monthly Price: $' + PAYMENT_CONFIG.MONTHLY_PRICE);
  console.log('[Payment] - Annual Price: $' + PAYMENT_CONFIG.ANNUAL_PRICE);
  console.log('[Payment] 📝 To enable payments:');
  console.log('[Payment]   1. Choose a payment provider (RevenueCat, Stripe, etc.)');
  console.log('[Payment]   2. Follow integration guide in utils/superwallConfig.ts');
  console.log('[Payment]   3. Update payment functions in this file');
  
  return false;
};
