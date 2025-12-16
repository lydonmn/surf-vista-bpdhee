
// ============================================
// REVENUECAT INTEGRATION
// ============================================
// 
// This file integrates RevenueCat for subscription management
// with support for Paywalls and Customer Center
//
// Setup Instructions:
// 1. Create a RevenueCat account at https://www.revenuecat.com/
// 2. Add your app in the RevenueCat dashboard
// 3. Configure your products (monthly and annual subscriptions)
// 4. Get your API keys from the RevenueCat dashboard
// 5. Replace the API keys below
// 6. Configure your paywall in the RevenueCat dashboard
//
// ============================================

import Purchases, { 
  PurchasesPackage, 
  CustomerInfo,
  PurchasesOffering,
  LOG_LEVEL
} from 'react-native-purchases';
import { presentPaywallUI, presentCustomerCenterUI } from 'react-native-purchases-ui';
import { Platform, Alert } from 'react-native';
import { supabase } from '@/app/integrations/supabase/client';

// ============================================
// CONFIGURATION - YOUR API KEYS
// ============================================

// RevenueCat API Key (test key provided)
// Get your production key from: https://app.revenuecat.com/settings/api-keys
const REVENUECAT_API_KEY = 'test_pIbMwlfINrGOjQfGWYzmARWVOvg';

// Product Identifiers (must match App Store Connect / Google Play Console)
export const PAYMENT_CONFIG = {
  // Product Identifiers - These are the ones you configured in RevenueCat
  PRODUCTS: {
    MONTHLY_SUBSCRIPTION: 'surfvista_monthly',
    ANNUAL_SUBSCRIPTION: 'surfvista_annual',
    MONTHLY: 'monthly',
    YEARLY: 'yearly',
  },
  
  // RevenueCat Offering ID (default is usually 'default')
  OFFERING_ID: 'default',
  
  // Entitlement ID - This is what you check to see if user has access
  // You configured this as "SurfVista Pro" in RevenueCat
  ENTITLEMENT_ID: 'premium',
};

// ============================================
// STATE MANAGEMENT
// ============================================

let isPaymentSystemInitialized = false;
let currentOffering: PurchasesOffering | null = null;

// ============================================
// INITIALIZATION
// ============================================

export const initializeRevenueCat = async (): Promise<boolean> => {
  try {
    console.log('[RevenueCat] 🚀 Initializing RevenueCat SDK...');
    console.log('[RevenueCat] 📱 Platform:', Platform.OS);
    
    // Set log level for debugging
    Purchases.setLogLevel(LOG_LEVEL.DEBUG);
    
    // Configure RevenueCat with API key
    await Purchases.configure({ apiKey: REVENUECAT_API_KEY });
    
    console.log('[RevenueCat] ✅ RevenueCat SDK initialized successfully');
    
    // Fetch available offerings
    try {
      const offerings = await Purchases.getOfferings();
      currentOffering = offerings.current;
      
      if (currentOffering) {
        console.log('[RevenueCat] 📦 Current offering:', currentOffering.identifier);
        console.log('[RevenueCat] 📦 Available packages:', currentOffering.availablePackages.length);
        
        currentOffering.availablePackages.forEach(pkg => {
          console.log(`[RevenueCat]   - ${pkg.identifier}: ${pkg.product.priceString}`);
        });
      } else {
        console.log('[RevenueCat] ⚠️ No offerings found. Please configure products in RevenueCat dashboard.');
        console.log('[RevenueCat] 📝 Next steps:');
        console.log('[RevenueCat]   1. Go to https://app.revenuecat.com/');
        console.log('[RevenueCat]   2. Select your app');
        console.log('[RevenueCat]   3. Go to Products section');
        console.log('[RevenueCat]   4. Add your subscription products');
        console.log('[RevenueCat]   5. Create an Entitlement called: ' + PAYMENT_CONFIG.ENTITLEMENT_ID);
        console.log('[RevenueCat]   6. Create an Offering and attach your products');
      }
    } catch (offeringError) {
      console.error('[RevenueCat] ⚠️ Error fetching offerings:', offeringError);
      // Don't fail initialization if offerings can't be fetched
    }
    
    isPaymentSystemInitialized = true;
    return true;
  } catch (error: any) {
    console.error('[RevenueCat] ❌ Failed to initialize RevenueCat:', error);
    console.error('[RevenueCat] Error details:', error.message);
    isPaymentSystemInitialized = false;
    return false;
  }
};

// Alias for backward compatibility
export const initializePaymentSystem = initializeRevenueCat;

// ============================================
// PAYMENT SYSTEM AVAILABILITY
// ============================================

export const isPaymentSystemAvailable = (): boolean => {
  return isPaymentSystemInitialized;
};

export const checkPaymentConfiguration = (): boolean => {
  console.log('[RevenueCat] ⚙️ Configuration Check:');
  console.log('[RevenueCat] - Initialized:', isPaymentSystemInitialized);
  console.log('[RevenueCat] - Platform:', Platform.OS);
  console.log('[RevenueCat] - API Key Configured: ✅ YES');
  console.log('[RevenueCat] - Product IDs:');
  console.log('[RevenueCat]   • Monthly Subscription:', PAYMENT_CONFIG.PRODUCTS.MONTHLY_SUBSCRIPTION);
  console.log('[RevenueCat]   • Annual Subscription:', PAYMENT_CONFIG.PRODUCTS.ANNUAL_SUBSCRIPTION);
  console.log('[RevenueCat]   • Monthly:', PAYMENT_CONFIG.PRODUCTS.MONTHLY);
  console.log('[RevenueCat]   • Yearly:', PAYMENT_CONFIG.PRODUCTS.YEARLY);
  console.log('[RevenueCat] - Entitlement ID:', PAYMENT_CONFIG.ENTITLEMENT_ID);
  console.log('[RevenueCat] - Current Offering:', currentOffering?.identifier || 'None');
  
  if (!currentOffering) {
    console.log('[RevenueCat] 📝 Setup Instructions:');
    console.log('[RevenueCat]   1. Go to https://app.revenuecat.com/');
    console.log('[RevenueCat]   2. Select your app');
    console.log('[RevenueCat]   3. Go to Products section');
    console.log('[RevenueCat]   4. Add your subscription products');
    console.log('[RevenueCat]   5. Create an Entitlement called: ' + PAYMENT_CONFIG.ENTITLEMENT_ID);
    console.log('[RevenueCat]   6. Create an Offering and attach your products');
    console.log('[RevenueCat]   7. Configure your Paywall in the Paywalls section');
    console.log('[RevenueCat]   8. Restart the app');
  }
  
  return isPaymentSystemInitialized;
};

// ============================================
// PAYWALL PRESENTATION (Modern Method)
// ============================================

export const presentPaywall = async (
  userId?: string,
  userEmail?: string
): Promise<{ state: 'purchased' | 'restored' | 'declined' | 'error'; message?: string }> => {
  try {
    console.log('[RevenueCat] 🎨 Presenting RevenueCat Paywall...');
    
    if (!isPaymentSystemAvailable()) {
      throw new Error('Payment system is not initialized. Please restart the app.');
    }

    // Set user ID if provided
    if (userId) {
      console.log('[RevenueCat] 👤 Setting user ID:', userId);
      await Purchases.logIn(userId);
    }

    // Set email if provided
    if (userEmail) {
      await Purchases.setEmail(userEmail);
    }

    // Present the paywall UI (configured in RevenueCat dashboard)
    console.log('[RevenueCat] 🎨 Showing paywall UI...');
    const result = await presentPaywallUI();

    console.log('[RevenueCat] 📊 Paywall result:', result);

    // Handle the result
    if (result === 'purchased' || result === 'restored') {
      console.log('[RevenueCat] ✅ Purchase successful!');
      
      // Get updated customer info
      const customerInfo = await Purchases.getCustomerInfo();
      console.log('[RevenueCat] 📊 Active entitlements:', Object.keys(customerInfo.entitlements.active));

      // Update Supabase profile
      if (userId) {
        await updateSubscriptionInSupabase(userId, customerInfo);
      }

      return { 
        state: result,
        message: result === 'purchased' 
          ? 'Subscription activated successfully!' 
          : 'Subscription restored successfully!'
      };
    } else if (result === 'cancelled') {
      console.log('[RevenueCat] ℹ️ User cancelled paywall');
      return { state: 'declined' };
    } else {
      console.log('[RevenueCat] ℹ️ Paywall closed without purchase');
      return { state: 'declined' };
    }

  } catch (error: any) {
    console.error('[RevenueCat] ❌ Paywall error:', error);

    // Handle user cancellation
    if (error.userCancelled) {
      console.log('[RevenueCat] ℹ️ User cancelled purchase');
      return { state: 'declined' };
    }

    // Handle other errors
    return { 
      state: 'error',
      message: error.message || 'Purchase failed. Please try again.'
    };
  }
};

// ============================================
// CUSTOMER CENTER (Modern Method)
// ============================================

export const presentCustomerCenter = async (): Promise<void> => {
  try {
    console.log('[RevenueCat] 🏢 Presenting Customer Center...');
    
    if (!isPaymentSystemAvailable()) {
      throw new Error('Payment system is not initialized. Please restart the app.');
    }

    // Present the Customer Center UI
    await presentCustomerCenterUI();
    
    console.log('[RevenueCat] ✅ Customer Center closed');
    
    // Refresh customer info after Customer Center closes
    const customerInfo = await Purchases.getCustomerInfo();
    
    // Update Supabase with latest info
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await updateSubscriptionInSupabase(user.id, customerInfo);
    }
    
  } catch (error: any) {
    console.error('[RevenueCat] ❌ Customer Center error:', error);
    throw error;
  }
};

// ============================================
// MANUAL PURCHASE (Legacy Method)
// ============================================

export const purchaseSubscription = async (
  productId: string
): Promise<boolean> => {
  try {
    console.log('[RevenueCat] 💳 Purchasing product:', productId);
    
    if (!isPaymentSystemAvailable()) {
      throw new Error('Payment system is not initialized.');
    }

    // Get current offerings
    const offerings = await Purchases.getOfferings();
    const offering = offerings.current;

    if (!offering || offering.availablePackages.length === 0) {
      throw new Error('No subscription packages available.');
    }

    // Find the package with the matching product ID
    const selectedPackage = offering.availablePackages.find(pkg => 
      pkg.product.identifier === productId
    );

    if (!selectedPackage) {
      throw new Error(`Product ${productId} not found in available packages.`);
    }

    console.log('[RevenueCat] 🛒 Starting purchase...');
    const { customerInfo } = await Purchases.purchasePackage(selectedPackage);

    console.log('[RevenueCat] ✅ Purchase successful!');
    console.log('[RevenueCat] 📊 Active entitlements:', Object.keys(customerInfo.entitlements.active));

    // Update Supabase profile
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await updateSubscriptionInSupabase(user.id, customerInfo);
    }

    return customerInfo.entitlements.active[PAYMENT_CONFIG.ENTITLEMENT_ID] !== undefined;

  } catch (error: any) {
    console.error('[RevenueCat] ❌ Purchase error:', error);
    
    if (error.userCancelled) {
      console.log('[RevenueCat] ℹ️ User cancelled purchase');
    }
    
    return false;
  }
};

// ============================================
// RESTORE PURCHASES
// ============================================

export const restorePurchases = async (): Promise<{ 
  success: boolean; 
  state?: 'restored' | 'none';
  message?: string 
}> => {
  try {
    console.log('[RevenueCat] 🔄 Restoring purchases...');

    if (!isPaymentSystemAvailable()) {
      throw new Error('Payment system is not initialized.');
    }

    const customerInfo = await Purchases.restorePurchases();

    console.log('[RevenueCat] 📊 Restore complete');
    console.log('[RevenueCat] 📊 Active entitlements:', Object.keys(customerInfo.entitlements.active));

    const hasActiveSubscription = Object.keys(customerInfo.entitlements.active).length > 0;

    if (hasActiveSubscription) {
      // Update Supabase profile
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await updateSubscriptionInSupabase(user.id, customerInfo);
      }

      return {
        success: true,
        state: 'restored',
        message: 'Subscription restored successfully!'
      };
    } else {
      return {
        success: false,
        state: 'none',
        message: 'No previous purchases found.'
      };
    }

  } catch (error: any) {
    console.error('[RevenueCat] ❌ Restore error:', error);
    return {
      success: false,
      message: error.message || 'Failed to restore purchases.'
    };
  }
};

// ============================================
// CUSTOMER INFO
// ============================================

export const getCustomerInfo = async (): Promise<CustomerInfo | null> => {
  try {
    if (!isPaymentSystemAvailable()) {
      console.log('[RevenueCat] ⚠️ Payment system not available');
      return null;
    }

    const customerInfo = await Purchases.getCustomerInfo();
    console.log('[RevenueCat] 📊 Customer info retrieved');
    console.log('[RevenueCat] 📊 Active entitlements:', Object.keys(customerInfo.entitlements.active));
    
    return customerInfo;
  } catch (error: any) {
    console.error('[RevenueCat] ❌ Error getting customer info:', error);
    return null;
  }
};

// ============================================
// ENTITLEMENT CHECKING
// ============================================

export const checkEntitlements = async (): Promise<boolean> => {
  try {
    if (!isPaymentSystemAvailable()) {
      console.log('[RevenueCat] ⚠️ Payment system not available, checking Supabase only');
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const result = await checkSubscriptionInSupabase(user.id);
        return result.isActive;
      }
      return false;
    }

    const customerInfo = await Purchases.getCustomerInfo();
    const hasEntitlement = customerInfo.entitlements.active[PAYMENT_CONFIG.ENTITLEMENT_ID] !== undefined;
    
    console.log('[RevenueCat] 🔐 Entitlement check:', hasEntitlement ? 'GRANTED' : 'DENIED');
    
    return hasEntitlement;
  } catch (error: any) {
    console.error('[RevenueCat] ❌ Error checking entitlements:', error);
    return false;
  }
};

// ============================================
// SUBSCRIPTION STATUS
// ============================================

export const checkSubscriptionStatus = async (userId: string): Promise<{
  isActive: boolean;
  endDate: string | null;
}> => {
  try {
    if (!isPaymentSystemAvailable()) {
      console.log('[RevenueCat] ⚠️ Payment system not available, checking Supabase only');
      return await checkSubscriptionInSupabase(userId);
    }

    // Get customer info from RevenueCat
    const customerInfo = await Purchases.getCustomerInfo();
    
    // Check for the premium entitlement
    const hasActiveSubscription = customerInfo.entitlements.active[PAYMENT_CONFIG.ENTITLEMENT_ID] !== undefined;
    
    if (hasActiveSubscription) {
      // Get the entitlement
      const entitlement = customerInfo.entitlements.active[PAYMENT_CONFIG.ENTITLEMENT_ID];
      const endDate = entitlement.expirationDate || null;
      
      console.log('[RevenueCat] ✅ Active subscription found');
      console.log('[RevenueCat] 📅 Expires:', endDate);
      
      // Update Supabase with latest info
      await updateSubscriptionInSupabase(userId, customerInfo);
      
      return {
        isActive: true,
        endDate: endDate
      };
    } else {
      console.log('[RevenueCat] ℹ️ No active subscription in RevenueCat');
      
      // Check Supabase as fallback
      return await checkSubscriptionInSupabase(userId);
    }
  } catch (error: any) {
    console.error('[RevenueCat] ❌ Error checking subscription:', error);
    
    // Fallback to Supabase check
    return await checkSubscriptionInSupabase(userId);
  }
};

// ============================================
// SUPABASE INTEGRATION
// ============================================

const updateSubscriptionInSupabase = async (userId: string, customerInfo: CustomerInfo) => {
  try {
    const hasActiveSubscription = customerInfo.entitlements.active[PAYMENT_CONFIG.ENTITLEMENT_ID] !== undefined;
    
    let subscriptionEndDate: string | null = null;
    
    if (hasActiveSubscription) {
      const entitlement = customerInfo.entitlements.active[PAYMENT_CONFIG.ENTITLEMENT_ID];
      subscriptionEndDate = entitlement.expirationDate || null;
    }
    
    console.log('[RevenueCat] 💾 Updating Supabase profile...');
    console.log('[RevenueCat]   - User ID:', userId);
    console.log('[RevenueCat]   - Is Subscribed:', hasActiveSubscription);
    console.log('[RevenueCat]   - End Date:', subscriptionEndDate);
    
    const { error } = await supabase
      .from('profiles')
      .update({
        is_subscribed: hasActiveSubscription,
        subscription_end_date: subscriptionEndDate,
      })
      .eq('id', userId);
    
    if (error) {
      console.error('[RevenueCat] ❌ Error updating Supabase:', error);
    } else {
      console.log('[RevenueCat] ✅ Supabase profile updated');
    }
  } catch (error: any) {
    console.error('[RevenueCat] ❌ Exception updating Supabase:', error);
  }
};

const checkSubscriptionInSupabase = async (userId: string): Promise<{
  isActive: boolean;
  endDate: string | null;
}> => {
  try {
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('is_subscribed, subscription_end_date')
      .eq('id', userId)
      .single();
    
    if (error || !profile) {
      console.error('[RevenueCat] ❌ Error checking Supabase subscription:', error);
      return { isActive: false, endDate: null };
    }
    
    if (profile.is_subscribed && profile.subscription_end_date) {
      const endDate = new Date(profile.subscription_end_date);
      const isActive = endDate > new Date();
      
      console.log('[RevenueCat] 📊 Supabase subscription status:', isActive ? 'Active' : 'Expired');
      
      return { isActive, endDate: profile.subscription_end_date };
    }
    
    return { isActive: false, endDate: null };
  } catch (error: any) {
    console.error('[RevenueCat] ❌ Exception checking Supabase subscription:', error);
    return { isActive: false, endDate: null };
  }
};

// ============================================
// ADMIN FUNCTIONS
// ============================================

export const grantSubscription = async (
  userId: string, 
  durationType: 'monthly' | 'annual'
): Promise<{ success: boolean; error?: string }> => {
  try {
    console.log('[RevenueCat] 🎁 Manually granting subscription:', durationType);
    
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
      console.error('[RevenueCat] ❌ Error granting subscription:', error);
      return { success: false, error: error.message };
    }
    
    console.log('[RevenueCat] ✅ Subscription granted successfully');
    console.log('[RevenueCat] 📅 End date:', subscriptionEndDate.toISOString());
    return { success: true };
  } catch (error: any) {
    console.error('[RevenueCat] ❌ Exception granting subscription:', error);
    return { success: false, error: error.message || 'Failed to grant subscription' };
  }
};

// ============================================
// USER IDENTIFICATION
// ============================================

export const identifyUser = async (userId: string, email?: string) => {
  try {
    if (!isPaymentSystemAvailable()) {
      return;
    }

    console.log('[RevenueCat] 👤 Identifying user:', userId);
    await Purchases.logIn(userId);
    
    if (email) {
      await Purchases.setEmail(email);
    }
    
    console.log('[RevenueCat] ✅ User identified');
  } catch (error: any) {
    console.error('[RevenueCat] ❌ Error identifying user:', error);
  }
};

export const logoutUser = async () => {
  try {
    if (!isPaymentSystemAvailable()) {
      return;
    }

    console.log('[RevenueCat] 👋 Logging out user from RevenueCat');
    await Purchases.logOut();
    console.log('[RevenueCat] ✅ User logged out');
  } catch (error: any) {
    console.error('[RevenueCat] ❌ Error logging out user:', error);
  }
};

// ============================================
// OFFERINGS
// ============================================

export const getOfferings = async (): Promise<PurchasesOffering | null> => {
  try {
    if (!isPaymentSystemAvailable()) {
      console.log('[RevenueCat] ⚠️ Payment system not available');
      return null;
    }

    const offerings = await Purchases.getOfferings();
    const offering = offerings.current;
    
    if (offering) {
      console.log('[RevenueCat] 📦 Current offering:', offering.identifier);
      console.log('[RevenueCat] 📦 Available packages:', offering.availablePackages.length);
    } else {
      console.log('[RevenueCat] ⚠️ No current offering found');
    }
    
    return offering;
  } catch (error: any) {
    console.error('[RevenueCat] ❌ Error getting offerings:', error);
    return null;
  }
};
