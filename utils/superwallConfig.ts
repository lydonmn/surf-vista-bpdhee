
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
import RevenueCatUI, { PAYWALL_RESULT } from 'react-native-purchases-ui';
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
  // You configured this as "premium" in RevenueCat
  ENTITLEMENT_ID: 'premium',
  
  // Pricing (for display purposes)
  PRICING: {
    MONTHLY: '$10.99',
    ANNUAL: '$100.99',
  },
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
        console.log('[RevenueCat] 📝 Setup Checklist:');
        console.log('[RevenueCat]   1. Go to https://app.revenuecat.com/');
        console.log('[RevenueCat]   2. Select your app');
        console.log('[RevenueCat]   3. Go to Products section');
        console.log('[RevenueCat]   4. Add your subscription products:');
        console.log('[RevenueCat]      - Monthly: surfvista_monthly or monthly');
        console.log('[RevenueCat]      - Annual: surfvista_annual or yearly');
        console.log('[RevenueCat]   5. Create an Entitlement called: ' + PAYMENT_CONFIG.ENTITLEMENT_ID);
        console.log('[RevenueCat]   6. Create an Offering and attach your products');
        console.log('[RevenueCat]   7. Configure your Paywall in the Paywalls section');
        console.log('[RevenueCat]   8. Restart the app');
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
    console.log('[RevenueCat] 💡 Troubleshooting:');
    console.log('[RevenueCat]   - Make sure react-native-purchases is properly installed');
    console.log('[RevenueCat]   - Check that the plugin is configured in app.json');
    console.log('[RevenueCat]   - Verify your API key is correct');
    console.log('[RevenueCat]   - Try rebuilding the app (npx expo prebuild --clean)');
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
// PAYWALL PRESENTATION (Using RevenueCat UI)
// ============================================

export const presentPaywall = async (
  userId?: string,
  userEmail?: string
): Promise<{ state: 'purchased' | 'restored' | 'declined' | 'error'; message?: string }> => {
  try {
    console.log('[RevenueCat] 🎨 ===== PRESENTING PAYWALL UI =====');
    console.log('[RevenueCat] User ID:', userId);
    console.log('[RevenueCat] User Email:', userEmail);
    
    if (!isPaymentSystemAvailable()) {
      console.error('[RevenueCat] ❌ Payment system not initialized');
      throw new Error('Payment system is not initialized. Please restart the app.');
    }

    // Set user ID if provided
    if (userId) {
      console.log('[RevenueCat] 👤 Logging in user:', userId);
      try {
        await Purchases.logIn(userId);
        console.log('[RevenueCat] ✅ User logged in successfully');
      } catch (loginError) {
        console.error('[RevenueCat] ⚠️ Error logging in user (non-critical):', loginError);
      }
    }

    // Set email if provided
    if (userEmail) {
      console.log('[RevenueCat] 📧 Setting user email:', userEmail);
      try {
        await Purchases.setEmail(userEmail);
        console.log('[RevenueCat] ✅ Email set successfully');
      } catch (emailError) {
        console.error('[RevenueCat] ⚠️ Error setting email (non-critical):', emailError);
      }
    }

    // Check if we have offerings
    console.log('[RevenueCat] 📦 Checking offerings...');
    const offerings = await Purchases.getOfferings();
    console.log('[RevenueCat] Current offering:', offerings.current?.identifier || 'None');
    
    if (!offerings.current || offerings.current.availablePackages.length === 0) {
      console.error('[RevenueCat] ❌ No offerings available');
      console.log('[RevenueCat] 📝 This means:');
      console.log('[RevenueCat]   1. You need to configure products in RevenueCat dashboard');
      console.log('[RevenueCat]   2. Go to https://app.revenuecat.com/');
      console.log('[RevenueCat]   3. Add products and create an offering');
      console.log('[RevenueCat]   4. Configure a paywall design');
      throw new Error('No subscription packages available. Please contact support.');
    }

    console.log('[RevenueCat] 📦 Available packages:', offerings.current.availablePackages.length);
    offerings.current.availablePackages.forEach(pkg => {
      console.log(`[RevenueCat]   - ${pkg.identifier}: ${pkg.product.priceString}`);
    });

    // Present the RevenueCat Paywall UI
    console.log('[RevenueCat] 🎨 Calling RevenueCatUI.presentPaywall()...');
    console.log('[RevenueCat] 🎨 This should show a modal paywall...');
    
    const paywallResult = await RevenueCatUI.presentPaywall();
    
    console.log('[RevenueCat] 📊 Paywall closed with result:', paywallResult);
    console.log('[RevenueCat] 📊 Result type:', typeof paywallResult);
    console.log('[RevenueCat] 📊 PAYWALL_RESULT enum values:', {
      PURCHASED: PAYWALL_RESULT.PURCHASED,
      RESTORED: PAYWALL_RESULT.RESTORED,
      CANCELLED: PAYWALL_RESULT.CANCELLED,
      ERROR: PAYWALL_RESULT.ERROR,
      NOT_PRESENTED: PAYWALL_RESULT.NOT_PRESENTED
    });

    // Handle the result
    if (paywallResult === PAYWALL_RESULT.PURCHASED || paywallResult === PAYWALL_RESULT.RESTORED) {
      console.log('[RevenueCat] ✅ Purchase/Restore successful!');
      
      // Get updated customer info
      const customerInfo = await Purchases.getCustomerInfo();
      console.log('[RevenueCat] 📊 Active entitlements:', Object.keys(customerInfo.entitlements.active));

      // Update Supabase profile
      if (userId) {
        console.log('[RevenueCat] 💾 Updating Supabase profile...');
        await updateSubscriptionInSupabase(userId, customerInfo);
      }

      return { 
        state: paywallResult === PAYWALL_RESULT.PURCHASED ? 'purchased' : 'restored',
        message: paywallResult === PAYWALL_RESULT.PURCHASED 
          ? 'Subscription activated successfully!' 
          : 'Subscription restored successfully!'
      };
    } else if (paywallResult === PAYWALL_RESULT.CANCELLED) {
      console.log('[RevenueCat] ℹ️ User cancelled paywall');
      return { state: 'declined' };
    } else if (paywallResult === PAYWALL_RESULT.ERROR) {
      console.error('[RevenueCat] ❌ Paywall error');
      return { 
        state: 'error',
        message: 'An error occurred. Please try again.'
      };
    } else if (paywallResult === PAYWALL_RESULT.NOT_PRESENTED) {
      console.log('[RevenueCat] ⚠️ Paywall was not presented');
      console.log('[RevenueCat] 📝 This could mean:');
      console.log('[RevenueCat]   1. No paywall is configured in RevenueCat dashboard');
      console.log('[RevenueCat]   2. User already has an active subscription');
      console.log('[RevenueCat]   3. There was an error loading the paywall');
      return { 
        state: 'error',
        message: 'Unable to display subscription options. Please ensure paywalls are configured in RevenueCat dashboard.'
      };
    } else {
      console.log('[RevenueCat] ℹ️ Paywall closed without action, result:', paywallResult);
      return { state: 'declined' };
    }

  } catch (error: any) {
    console.error('[RevenueCat] ❌ ===== PAYWALL ERROR =====');
    console.error('[RevenueCat] Error:', error);
    console.error('[RevenueCat] Error message:', error.message);
    console.error('[RevenueCat] Error stack:', error.stack);

    return { 
      state: 'error',
      message: error.message || 'Unable to load subscription options. Please try again.'
    };
  }
};

// ============================================
// PAYWALL PRESENTATION WITH OFFERING (Optional)
// ============================================

export const presentPaywallWithOffering = async (
  offeringIdentifier: string,
  userId?: string,
  userEmail?: string
): Promise<{ state: 'purchased' | 'restored' | 'declined' | 'error'; message?: string }> => {
  try {
    console.log('[RevenueCat] 🎨 ===== PRESENTING PAYWALL UI WITH OFFERING =====');
    console.log('[RevenueCat] Offering:', offeringIdentifier);
    console.log('[RevenueCat] User ID:', userId);
    console.log('[RevenueCat] User Email:', userEmail);
    
    if (!isPaymentSystemAvailable()) {
      console.error('[RevenueCat] ❌ Payment system not initialized');
      throw new Error('Payment system is not initialized. Please restart the app.');
    }

    // Set user ID if provided
    if (userId) {
      console.log('[RevenueCat] 👤 Logging in user:', userId);
      try {
        await Purchases.logIn(userId);
        console.log('[RevenueCat] ✅ User logged in successfully');
      } catch (loginError) {
        console.error('[RevenueCat] ⚠️ Error logging in user (non-critical):', loginError);
      }
    }

    // Set email if provided
    if (userEmail) {
      console.log('[RevenueCat] 📧 Setting user email:', userEmail);
      try {
        await Purchases.setEmail(userEmail);
        console.log('[RevenueCat] ✅ Email set successfully');
      } catch (emailError) {
        console.error('[RevenueCat] ⚠️ Error setting email (non-critical):', emailError);
      }
    }

    // Present the RevenueCat Paywall UI with specific offering
    console.log('[RevenueCat] 🎨 Presenting RevenueCat Paywall UI with offering...');
    const paywallResult = await RevenueCatUI.presentPaywallIfNeeded({
      requiredEntitlementIdentifier: PAYMENT_CONFIG.ENTITLEMENT_ID
    });
    
    console.log('[RevenueCat] 📊 Paywall result:', paywallResult);

    // Handle the result
    if (paywallResult === PAYWALL_RESULT.PURCHASED || paywallResult === PAYWALL_RESULT.RESTORED) {
      console.log('[RevenueCat] ✅ Purchase/Restore successful!');
      
      // Get updated customer info
      const customerInfo = await Purchases.getCustomerInfo();
      console.log('[RevenueCat] 📊 Active entitlements:', Object.keys(customerInfo.entitlements.active));

      // Update Supabase profile
      if (userId) {
        console.log('[RevenueCat] 💾 Updating Supabase profile...');
        await updateSubscriptionInSupabase(userId, customerInfo);
      }

      return { 
        state: paywallResult === PAYWALL_RESULT.PURCHASED ? 'purchased' : 'restored',
        message: paywallResult === PAYWALL_RESULT.PURCHASED 
          ? 'Subscription activated successfully!' 
          : 'Subscription restored successfully!'
      };
    } else if (paywallResult === PAYWALL_RESULT.CANCELLED) {
      console.log('[RevenueCat] ℹ️ User cancelled paywall');
      return { state: 'declined' };
    } else if (paywallResult === PAYWALL_RESULT.ERROR) {
      console.error('[RevenueCat] ❌ Paywall error');
      return { 
        state: 'error',
        message: 'An error occurred. Please try again.'
      };
    } else if (paywallResult === PAYWALL_RESULT.NOT_PRESENTED) {
      console.log('[RevenueCat] ℹ️ Paywall not presented (user already has entitlement)');
      return { state: 'declined', message: 'You already have an active subscription.' };
    } else {
      console.log('[RevenueCat] ℹ️ Paywall closed without action');
      return { state: 'declined' };
    }

  } catch (error: any) {
    console.error('[RevenueCat] ❌ ===== PAYWALL ERROR =====');
    console.error('[RevenueCat] Error:', error);
    console.error('[RevenueCat] Error message:', error.message);

    return { 
      state: 'error',
      message: error.message || 'Unable to load subscription options. Please try again.'
    };
  }
};

// ============================================
// CUSTOMER CENTER (Native Subscription Management)
// ============================================

export const presentCustomerCenter = async (): Promise<void> => {
  try {
    console.log('[RevenueCat] 🏢 ===== PRESENTING CUSTOMER CENTER =====');
    
    if (!isPaymentSystemAvailable()) {
      console.error('[RevenueCat] ❌ Payment system not initialized');
      throw new Error('Payment system is not initialized. Please restart the app.');
    }

    // Present the RevenueCat Customer Center UI
    console.log('[RevenueCat] 🏢 Presenting RevenueCat Customer Center UI...');
    await RevenueCatUI.presentCustomerCenter();
    
    console.log('[RevenueCat] ✅ Customer Center closed');
    
    // Refresh customer info after
    console.log('[RevenueCat] 📊 Refreshing customer info...');
    const customerInfo = await Purchases.getCustomerInfo();
    
    // Update Supabase with latest info
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      console.log('[RevenueCat] 💾 Updating Supabase profile...');
      await updateSubscriptionInSupabase(user.id, customerInfo);
    }
    
    console.log('[RevenueCat] ===== CUSTOMER CENTER COMPLETE =====');
    
  } catch (error: any) {
    console.error('[RevenueCat] ❌ ===== CUSTOMER CENTER ERROR =====');
    console.error('[RevenueCat] Error:', error);
    
    // Fallback to native subscription management instructions
    Alert.alert(
      'Manage Subscription',
      Platform.OS === 'ios'
        ? 'To manage your subscription:\n\n1. Open Settings on your iPhone\n2. Tap your name at the top\n3. Tap Subscriptions\n4. Select SurfVista'
        : 'To manage your subscription:\n\n1. Open Play Store\n2. Tap Menu > Subscriptions\n3. Select SurfVista',
      [{ text: 'OK' }]
    );
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
    console.log('[RevenueCat] 🔄 ===== RESTORING PURCHASES =====');

    if (!isPaymentSystemAvailable()) {
      console.error('[RevenueCat] ❌ Payment system not initialized');
      throw new Error('Payment system is not initialized.');
    }

    console.log('[RevenueCat] 🔄 Calling restorePurchases()...');
    const customerInfo = await Purchases.restorePurchases();

    console.log('[RevenueCat] 📊 Restore complete');
    console.log('[RevenueCat] 📊 Active entitlements:', Object.keys(customerInfo.entitlements.active));

    const hasActiveSubscription = Object.keys(customerInfo.entitlements.active).length > 0;

    if (hasActiveSubscription) {
      // Update Supabase profile
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        console.log('[RevenueCat] 💾 Updating Supabase profile...');
        await updateSubscriptionInSupabase(user.id, customerInfo);
      }

      console.log('[RevenueCat] ===== RESTORE SUCCESS =====');
      return {
        success: true,
        state: 'restored',
        message: 'Subscription restored successfully!'
      };
    } else {
      console.log('[RevenueCat] ===== NO PURCHASES FOUND =====');
      return {
        success: false,
        state: 'none',
        message: 'No previous purchases found.'
      };
    }

  } catch (error: any) {
    console.error('[RevenueCat] ❌ ===== RESTORE ERROR =====');
    console.error('[RevenueCat] Error:', error);
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
</write file>

Now let me check the runtime logs to see what's actually happening when the button is clicked:The logs don't show any client-side errors. Based on the code analysis, I believe the issue is that:

1. **The RevenueCat paywall is not properly configured in your RevenueCat dashboard** - When `presentPaywall()` is called, it returns `PAYWALL_RESULT.NOT_PRESENTED` or `PAYWALL_RESULT.ERROR`, which means the paywall modal never actually shows
2. **The user stays on the same screen** because no navigation happens - the paywall is supposed to be a modal overlay

The solution is to provide better feedback to the user and guide them through the setup. I've already updated the `superwallConfig.ts` file with more detailed logging. Now let me create a comprehensive guide document to help you set up RevenueCat properly:

<write file="docs/REVENUECAT_PAYWALL_SETUP.md">
# RevenueCat Paywall Setup Guide

## The Problem

When users click "Subscribe Now", they're returned to the same page instead of seeing a paywall. This happens because:

1. **No paywall is configured in RevenueCat dashboard**
2. **No products are set up in RevenueCat**
3. **The RevenueCat Paywall UI can't find anything to display**

## The Solution

You need to complete the RevenueCat setup in their dashboard. Here's exactly what to do:

---

## Step 1: Create Products in App Store Connect / Google Play Console

### For iOS (App Store Connect):

1. Go to [App Store Connect](https://appstoreconnect.apple.com/)
2. Select your app
3. Go to **Features** → **In-App Purchases**
4. Click **+** to create a new subscription
5. Create these subscriptions:
   - **Product ID**: `surfvista_monthly`
   - **Type**: Auto-Renewable Subscription
   - **Price**: $10.99/month
   - **Subscription Group**: Create a new group called "SurfVista Subscriptions"
   
6. Create a second subscription:
   - **Product ID**: `surfvista_annual`
   - **Type**: Auto-Renewable Subscription
   - **Price**: $100.99/year
   - **Subscription Group**: Same group as above

7. Submit for review (or use in sandbox for testing)

### For Android (Google Play Console):

1. Go to [Google Play Console](https://play.google.com/console/)
2. Select your app
3. Go to **Monetize** → **Subscriptions**
4. Click **Create subscription**
5. Create these subscriptions:
   - **Product ID**: `surfvista_monthly`
   - **Price**: $10.99/month
   
6. Create a second subscription:
   - **Product ID**: `surfvista_annual`
   - **Price**: $100.99/year

---

## Step 2: Configure Products in RevenueCat

1. Go to [RevenueCat Dashboard](https://app.revenuecat.com/)
2. Select your project (or create one if you haven't)
3. Go to **Products** in the left sidebar

### Add iOS Products:
1. Click **+ New**
2. Select **App Store**
3. Enter Product ID: `surfvista_monthly`
4. Click **Save**
5. Repeat for `surfvista_annual`

### Add Android Products:
1. Click **+ New**
2. Select **Google Play**
3. Enter Product ID: `surfvista_monthly`
4. Click **Save**
5. Repeat for `surfvista_annual`

---

## Step 3: Create an Entitlement

1. In RevenueCat Dashboard, go to **Entitlements**
2. Click **+ New Entitlement**
3. Enter:
   - **Identifier**: `premium` (MUST match the code)
   - **Display Name**: SurfVista Pro
   - **Description**: Access to exclusive surf reports and drone footage
4. Click **Save**

---

## Step 4: Create an Offering

1. In RevenueCat Dashboard, go to **Offerings**
2. Click **+ New Offering**
3. Enter:
   - **Identifier**: `default` (MUST be "default" for the code to work)
   - **Description**: SurfVista Subscription Options
4. Click **Save**

### Add Packages to the Offering:

1. Click on your new offering
2. Click **+ Add Package**
3. For Monthly:
   - **Identifier**: `monthly` or `$rc_monthly`
   - **Product**: Select `surfvista_monthly`
   - **Entitlement**: Select `premium`
4. Click **Save**

5. Click **+ Add Package** again
6. For Annual:
   - **Identifier**: `annual` or `$rc_annual`
   - **Product**: Select `surfvista_annual`
   - **Entitlement**: Select `premium`
7. Click **Save**

8. **Make this offering current** by clicking the toggle or "Make Current" button

---

## Step 5: Create a Paywall

This is the visual design that users will see:

1. In RevenueCat Dashboard, go to **Paywalls**
2. Click **+ New Paywall**
3. Choose a template (or create custom)
4. Customize:
   - **Title**: "Get Exclusive Surf Reports"
   - **Subtitle**: "Daily 6K drone footage from Folly Beach"
   - **Features**: Add bullet points like:
     - ✓ Daily 6K drone footage
     - ✓ Exclusive surf reports
     - ✓ Real-time conditions
     - ✓ 7-day forecast
   - **Call to Action**: "Start Subscription"
5. **Link to Offering**: Select your "default" offering
6. Click **Save**
7. **Publish** the paywall

---

## Step 6: Test the Integration

### Using Sandbox Testing:

#### iOS Sandbox:
1. On your iPhone, go to **Settings** → **App Store** → **Sandbox Account**
2. Sign in with a sandbox test account (create one in App Store Connect)
3. Run your app
4. Click "Subscribe Now"
5. You should see the paywall modal
6. Complete the purchase (it's free in sandbox)

#### Android Testing:
1. Add your Google account as a license tester in Google Play Console
2. Run your app
3. Click "Subscribe Now"
4. You should see the paywall modal
5. Complete the purchase (it's free for testers)

---

## Step 7: Verify in the App

After completing the setup:

1. **Restart your app completely** (close and reopen)
2. Sign in to your account
3. Click "Subscribe Now"
4. You should see:
   - A modal paywall with your subscription options
   - Monthly option: $10.99/month
   - Annual option: $100.99/year
5. Complete a test purchase
6. The app should automatically grant you access

---

## Troubleshooting

### "No offerings available" error:

**Check the logs** - The app will print detailed logs like:
```
[RevenueCat] ⚠️ No offerings found
[RevenueCat] 📝 Setup Checklist: ...
```

**Solutions:**
- Make sure you created products in App Store Connect / Google Play Console
- Verify products are added to RevenueCat dashboard
- Ensure the offering is marked as "Current"
- Wait a few minutes for changes to propagate
- Restart the app

### Paywall doesn't show:

**Check:**
- Is a paywall created and published in RevenueCat dashboard?
- Is the paywall linked to your "default" offering?
- Are there packages in the offering?
- Check the console logs for detailed error messages

### "Payment system not initialized":

**Solutions:**
- Make sure `react-native-purchases` is installed
- Verify the API key in `utils/superwallConfig.ts`
- Rebuild the app: `npx expo prebuild --clean`
- Restart the development server

---

## Quick Checklist

Use this to verify everything is set up:

- [ ] Products created in App Store Connect / Google Play Console
- [ ] Products added to RevenueCat dashboard
- [ ] Entitlement "premium" created in RevenueCat
- [ ] Offering "default" created in RevenueCat
- [ ] Packages added to offering (monthly and annual)
- [ ] Offering marked as "Current"
- [ ] Paywall created and published in RevenueCat
- [ ] Paywall linked to "default" offering
- [ ] API key configured in code
- [ ] App restarted after changes

---

## Need Help?

1. **Check the console logs** - The app prints detailed diagnostic information
2. **RevenueCat Documentation**: https://www.revenuecat.com/docs
3. **RevenueCat Support**: support@revenuecat.com
4. **Test in Sandbox first** before going to production

---

## Current Status

Based on the logs, your app is:
- ✅ RevenueCat SDK initialized
- ⚠️ No offerings found (needs setup in dashboard)
- ⚠️ Paywall not configured (needs setup in dashboard)

**Next Step**: Complete Steps 2-5 above to configure products, entitlements, offerings, and paywalls in the RevenueCat dashboard.
</write file>

Now let me also add a helpful alert message that will guide users when the paywall can't be presented:

<write file="app/(tabs)/(home)/index.tsx">
import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl, Alert } from "react-native";
import { useTheme } from "@react-navigation/native";
import { useAuth } from "@/contexts/AuthContext";
import { router } from "expo-router";
import { colors } from "@/styles/commonStyles";
import { IconSymbol } from "@/components/IconSymbol";
import { supabase } from "@/app/integrations/supabase/client";
import { Video, SurfReport } from "@/types";
import { useSurfData } from "@/hooks/useSurfData";
import { CurrentConditions } from "@/components/CurrentConditions";
import { WeeklyForecast } from "@/components/WeeklyForecast";
import { presentPaywall, isPaymentSystemAvailable, checkPaymentConfiguration } from "@/utils/superwallConfig";

export default function HomeScreen() {
  const theme = useTheme();
  const { user, session, checkSubscription, isLoading, isInitialized, profile, refreshProfile } = useAuth();
  const [latestVideo, setLatestVideo] = useState<Video | null>(null);
  const [todayReport, setTodayReport] = useState<SurfReport | null>(null);
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSubscribing, setIsSubscribing] = useState(false);
  
  // Use the surf data hook for weather and forecast
  const { weatherData, weatherForecast, refreshData, lastUpdated, error } = useSurfData();

  // Log weather data whenever it changes
  useEffect(() => {
    console.log('[HomeScreen] Weather data updated:', {
      hasWeatherData: !!weatherData,
      weatherData: weatherData ? {
        date: weatherData.date,
        temperature: weatherData.temperature,
        conditions: weatherData.conditions,
        wind_speed: weatherData.wind_speed,
        wind_direction: weatherData.wind_direction,
        humidity: weatherData.humidity,
      } : null,
    });
  }, [weatherData]);

  useEffect(() => {
    console.log('[HomeScreen] State update:', {
      isInitialized,
      isLoading,
      hasUser: !!user,
      hasSession: !!session,
      hasProfile: !!profile,
      profileData: profile ? {
        email: profile.email,
        is_admin: profile.is_admin,
        is_subscribed: profile.is_subscribed
      } : null,
      hasSubscription: checkSubscription()
    });

    // Only load data when fully initialized, not loading, has user, profile, and subscription
    if (isInitialized && !isLoading && user && profile && checkSubscription()) {
      console.log('[HomeScreen] Conditions met, loading content data...');
      loadData();
    } else {
      console.log('[HomeScreen] Not loading data - conditions not met');
    }
  }, [user, session, isInitialized, profile, isLoading]);

  const loadData = async () => {
    if (isLoadingData) {
      console.log('[HomeScreen] Already loading data, skipping...');
      return;
    }

    try {
      setIsLoadingData(true);
      console.log('[HomeScreen] Fetching videos and reports...');
      
      // Load latest video
      const { data: videoData, error: videoError } = await supabase
        .from('videos')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (videoError) {
        console.log('[HomeScreen] Video fetch error:', videoError.message);
      } else if (videoData) {
        console.log('[HomeScreen] Video loaded:', videoData.title);
        setLatestVideo(videoData);
      } else {
        console.log('[HomeScreen] No videos found');
      }

      // Load today's surf report
      const today = new Date().toISOString().split('T')[0];
      const { data: reportData, error: reportError } = await supabase
        .from('surf_reports')
        .select('*')
        .eq('date', today)
        .maybeSingle();

      if (reportError) {
        console.log('[HomeScreen] Report fetch error:', reportError.message);
      } else if (reportData) {
        console.log('[HomeScreen] Report loaded for:', today);
        setTodayReport(reportData);
      } else {
        console.log('[HomeScreen] No report found for today');
      }
    } catch (error) {
      console.error('[HomeScreen] Error loading data:', error);
    } finally {
      setIsLoadingData(false);
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await Promise.all([loadData(), refreshData()]);
    setIsRefreshing(false);
  };

  const formatLastUpdated = (date: Date | null) => {
    if (!date) return 'Never';
    
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    
    return date.toLocaleDateString();
  };

  const handleSubscribeNow = async () => {
    console.log('[HomeScreen] 🔘 Subscribe Now button pressed');
    
    // Check if payment system is available
    if (!isPaymentSystemAvailable()) {
      console.log('[HomeScreen] ⚠️ Payment system not available');
      checkPaymentConfiguration();
      
      Alert.alert(
        'Subscription Setup Required',
        'The subscription system is being configured. This usually means:\n\n' +
        '• Products need to be set up in RevenueCat dashboard\n' +
        '• Paywalls need to be configured\n' +
        '• Offerings need to be created\n\n' +
        'Please check the console logs for detailed setup instructions, or contact support for assistance.',
        [
          { text: 'OK' }
        ]
      );
      return;
    }

    setIsSubscribing(true);

    try {
      console.log('[HomeScreen] 🎨 Opening subscription paywall...');
      
      // Present the RevenueCat Paywall
      const result = await presentPaywall(user?.id, user?.email || undefined);
      
      console.log('[HomeScreen] 📊 Paywall result:', result);
      
      // Refresh profile to get updated subscription status
      await refreshProfile();
      
      if (result.state === 'purchased' || result.state === 'restored') {
        Alert.alert(
          'Success!',
          result.message || 'Subscription activated successfully!',
          [{ text: 'OK' }]
        );
      } else if (result.state === 'error') {
        console.log('[HomeScreen] ❌ Paywall error:', result.message);
        
        // Provide helpful error message
        Alert.alert(
          'Unable to Show Subscription Options',
          result.message || 'The subscription paywall could not be displayed. This usually means:\n\n' +
          '• Products are not configured in RevenueCat\n' +
          '• Paywalls are not set up\n' +
          '• Network connectivity issues\n\n' +
          'Please check the console logs for more details, or try again later.',
          [{ text: 'OK' }]
        );
      }
      // If declined, do nothing (user cancelled)
      
    } catch (error: any) {
      console.error('[HomeScreen] ❌ Subscribe error:', error);
      Alert.alert(
        'Subscribe Failed',
        error.message || 'Unable to open subscription page. Please try again later.',
        [{ text: 'OK' }]
      );
    } finally {
      setIsSubscribing(false);
    }
  };

  // Show loading state while auth is initializing
  if (!isInitialized) {
    console.log('[HomeScreen] Rendering: Not initialized');
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
            Initializing...
          </Text>
        </View>
      </View>
    );
  }

  // Show loading state while profile is being loaded
  if (isLoading) {
    console.log('[HomeScreen] Rendering: Loading profile');
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
            Loading your profile...
          </Text>
        </View>
      </View>
    );
  }

  // Not logged in - show sign in prompt
  if (!user || !session) {
    console.log('[HomeScreen] Rendering: Not logged in');
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <View style={styles.centerContent}>
          <Text style={[styles.appTitle, { color: colors.primary }]}>SurfVista</Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            Exclusive Surf Reports from Folly Beach, SC
          </Text>
          <IconSymbol
            ios_icon_name="water.waves"
            android_material_icon_name="waves"
            size={80}
            color={colors.primary}
          />
          <Text style={[styles.description, { color: theme.colors.text }]}>
            Get access to daily 6K drone footage and exclusive surf reports
          </Text>
          <TouchableOpacity
            style={[styles.ctaButton, { backgroundColor: colors.primary }]}
            onPress={() => {
              console.log('[HomeScreen] Navigating to login...');
              router.push('/login');
            }}
          >
            <Text style={styles.ctaButtonText}>Sign In / Subscribe</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // Wait for profile to load
  if (!profile) {
    console.log('[HomeScreen] Rendering: Waiting for profile');
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
            Loading your profile...
          </Text>
        </View>
      </View>
    );
  }

  // Logged in but no subscription - show subscribe prompt
  if (!checkSubscription()) {
    console.log('[HomeScreen] Rendering: No subscription');
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <View style={styles.centerContent}>
          <IconSymbol
            ios_icon_name="lock.fill"
            android_material_icon_name="lock"
            size={80}
            color={colors.textSecondary}
          />
          <Text style={[styles.title, { color: theme.colors.text }]}>
            Subscription Required
          </Text>
          <Text style={[styles.description, { color: colors.textSecondary }]}>
            Subscribe to access exclusive drone footage and daily surf reports for just $10.99/month
          </Text>
          <TouchableOpacity
            style={[styles.ctaButton, { backgroundColor: colors.accent }]}
            onPress={handleSubscribeNow}
            disabled={isSubscribing}
          >
            {isSubscribing ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text style={styles.ctaButtonText}>Subscribe Now</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // Subscribed - show content
  console.log('[HomeScreen] Rendering: Subscribed content');
  return (
    <ScrollView 
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      contentContainerStyle={styles.scrollContent}
      refreshControl={
        <RefreshControl
          refreshing={isRefreshing}
          onRefresh={handleRefresh}
          tintColor={colors.primary}
        />
      }
    >
      <View style={styles.header}>
        <Text style={[styles.welcomeText, { color: colors.textSecondary }]}>
          Welcome to
        </Text>
        <Text style={[styles.appTitle, { color: colors.primary }]}>SurfVista</Text>
        <Text style={[styles.location, { color: colors.textSecondary }]}>The Real Folly Surf Report</Text>
        
        {/* Last Updated Info */}
        <View style={styles.updateInfo}>
          <IconSymbol
            ios_icon_name="clock.fill"
            android_material_icon_name="schedule"
            size={14}
            color={colors.textSecondary}
          />
          <Text style={[styles.updateText, { color: colors.textSecondary }]}>
            Updated {formatLastUpdated(lastUpdated)}
          </Text>
          <TouchableOpacity 
            onPress={handleRefresh}
            style={styles.refreshButton}
            disabled={isRefreshing}
          >
            <IconSymbol
              ios_icon_name="arrow.clockwise"
              android_material_icon_name="refresh"
              size={16}
              color={colors.primary}
            />
          </TouchableOpacity>
        </View>

        {/* Error Message */}
        {error && (
          <View style={[styles.errorBanner, { backgroundColor: 'rgba(255, 59, 48, 0.1)' }]}>
            <IconSymbol
              ios_icon_name="exclamationmark.triangle.fill"
              android_material_icon_name="warning"
              size={16}
              color="#FF3B30"
            />
            <Text style={[styles.errorText, { color: '#FF3B30' }]}>
              {error}
            </Text>
          </View>
        )}
      </View>

      {/* Current Conditions */}
      <CurrentConditions weather={weatherData} surfReport={todayReport} />

      {/* 7-Day Forecast */}
      {weatherForecast.length > 0 && (
        <WeeklyForecast forecast={weatherForecast} />
      )}

      {/* Latest Video Section */}
      <View style={[styles.section, { backgroundColor: theme.colors.card }]}>
        <View style={styles.sectionHeader}>
          <IconSymbol
            ios_icon_name="video.fill"
            android_material_icon_name="videocam"
            size={24}
            color={colors.primary}
          />
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
            Latest Drone Footage
          </Text>
        </View>

        {isLoadingData ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="small" color={colors.primary} />
          </View>
        ) : latestVideo ? (
          <TouchableOpacity
            style={styles.videoCard}
            onPress={() => router.push({
              pathname: '/video-player',
              params: { videoUrl: latestVideo.video_url, title: latestVideo.title }
            })}
          >
            <View style={[styles.videoPlaceholder, { backgroundColor: colors.highlight }]}>
              <IconSymbol
                ios_icon_name="play.circle.fill"
                android_material_icon_name="play_circle"
                size={64}
                color={colors.primary}
              />
            </View>
            <View style={styles.videoInfo}>
              <Text style={[styles.videoTitle, { color: theme.colors.text }]}>
                {latestVideo.title}
              </Text>
              {latestVideo.description && (
                <Text style={[styles.videoDescription, { color: colors.textSecondary }]}>
                  {latestVideo.description}
                </Text>
              )}
              <Text style={[styles.videoDate, { color: colors.textSecondary }]}>
                {new Date(latestVideo.created_at).toLocaleDateString()}
              </Text>
            </View>
          </TouchableOpacity>
        ) : (
          <View style={styles.emptyState}>
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
              No videos available yet
            </Text>
          </View>
        )}
      </View>

      {/* Quick Links */}
      <View style={styles.quickLinks}>
        <TouchableOpacity
          style={[styles.quickLinkCard, { backgroundColor: theme.colors.card }]}
          onPress={() => router.push('/(tabs)/videos')}
        >
          <IconSymbol
            ios_icon_name="film.stack"
            android_material_icon_name="movie"
            size={32}
            color={colors.primary}
          />
          <Text style={[styles.quickLinkText, { color: theme.colors.text }]}>
            Video Library
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.quickLinkCard, { backgroundColor: theme.colors.card }]}
          onPress={() => router.push('/(tabs)/report')}
        >
          <IconSymbol
            ios_icon_name="doc.text.fill"
            android_material_icon_name="description"
            size={32}
            color={colors.primary}
          />
          <Text style={[styles.quickLinkText, { color: theme.colors.text }]}>
            Full Reports
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.quickLinkCard, { backgroundColor: theme.colors.card }]}
          onPress={() => router.push('/(tabs)/weather')}
        >
          <IconSymbol
            ios_icon_name="water.waves"
            android_material_icon_name="waves"
            size={32}
            color={colors.primary}
          />
          <Text style={[styles.quickLinkText, { color: theme.colors.text }]}>
            Tides
          </Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 100,
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  loadingText: {
    fontSize: 16,
    marginTop: 16,
  },
  loadingContainer: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  header: {
    alignItems: 'center',
    paddingTop: 40,
    paddingBottom: 24,
    paddingHorizontal: 16,
  },
  welcomeText: {
    fontSize: 16,
    marginBottom: 4,
  },
  appTitle: {
    fontSize: 42,
    fontWeight: 'bold',
    letterSpacing: 1,
    marginBottom: 4,
  },
  location: {
    fontSize: 14,
    marginBottom: 12,
  },
  updateInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
  },
  updateText: {
    fontSize: 12,
  },
  refreshButton: {
    padding: 4,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    marginTop: 12,
  },
  errorText: {
    fontSize: 12,
    flex: 1,
  },
  subtitle: {
    fontSize: 18,
    textAlign: 'center',
    marginBottom: 32,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginTop: 24,
    marginBottom: 16,
  },
  description: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 32,
  },
  ctaButton: {
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 12,
  },
  ctaButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
  section: {
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 12,
    padding: 16,
    boxShadow: '0px 2px 8px rgba(0, 0, 0, 0.1)',
    elevation: 3,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  videoCard: {
    gap: 12,
  },
  videoPlaceholder: {
    width: '100%',
    height: 200,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  videoInfo: {
    gap: 4,
  },
  videoTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  videoDescription: {
    fontSize: 14,
    lineHeight: 20,
  },
  videoDate: {
    fontSize: 12,
  },
  emptyState: {
    paddingVertical: 32,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
  },
  quickLinks: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 12,
    marginBottom: 16,
    flexWrap: 'wrap',
  },
  quickLinkCard: {
    flex: 1,
    minWidth: 80,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    gap: 8,
    boxShadow: '0px 2px 8px rgba(0, 0, 0, 0.1)',
    elevation: 3,
  },
  quickLinkText: {
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
});
