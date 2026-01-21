
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

// ⚠️ IMPORTANT: Replace with your PRODUCTION API key from RevenueCat
// 
// DO NOT USE TEST KEYS IN PRODUCTION!
// Test keys (starting with test_) will NOT show paywalls and will cause errors.
//
// To get your production key:
// 1. Go to https://app.revenuecat.com/
// 2. Click on your project
// 3. Go to Settings → API Keys
// 4. Copy the "Apple App Store" key for iOS or "Google Play Store" key for Android
// 5. Replace the key below
//
// Your production key will look like:
// - iOS: appl_xxxxxxxxxxxxxxxxx
// - Android: goog_xxxxxxxxxxxxxxxxx

const REVENUECAT_API_KEY_IOS = 'appl_YOUR_IOS_PRODUCTION_KEY_HERE'; // ⚠️ REPLACE WITH YOUR iOS PRODUCTION KEY
const REVENUECAT_API_KEY_ANDROID = 'goog_YOUR_ANDROID_PRODUCTION_KEY_HERE'; // ⚠️ REPLACE WITH YOUR Android PRODUCTION KEY

// Select the appropriate key based on platform
const REVENUECAT_API_KEY = Platform.OS === 'ios' ? REVENUECAT_API_KEY_IOS : REVENUECAT_API_KEY_ANDROID;

// 🎬 DEMO MODE FOR SCREENSHOTS
// Set this to true to show a demo paywall for Apple Developer screenshots
// ⚠️ MUST BE FALSE FOR PRODUCTION RELEASE
const ENABLE_DEMO_MODE = false;

// Product Identifiers (must match App Store Connect / Google Play Console)
export const PAYMENT_CONFIG = {
  // Product Identifiers - These are the ones you configured in RevenueCat
  PRODUCTS: {
    MONTHLY_SUBSCRIPTION: 'surfvista_monthly',
    ANNUAL_SUBSCRIPTION: 'surfvista_annual',
    MONTHLY: 'monthly',
    YEARLY: 'yearly',
  },
  
  // RevenueCat Offering IDs - Try specific first, then fallback to default
  OFFERING_IDS: ['ofrnge7bdc97106', 'default'],
  
  // Entitlement ID - This is what you check to see if user has access
  // You configured this as "premium" in RevenueCat
  ENTITLEMENT_ID: 'premium',
  
  // Pricing (for display purposes)
  PRICING: {
    MONTHLY: '$10.99',
    ANNUAL: '$99.99',
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
    console.log('[RevenueCat] 🔑 API Key:', REVENUECAT_API_KEY.substring(0, 20) + '...');
    
    // Check if using test key
    if (REVENUECAT_API_KEY.startsWith('test_')) {
      console.error('[RevenueCat] ❌❌❌ CRITICAL ERROR: Using TEST API key! ❌❌❌');
      console.error('[RevenueCat] ❌ Paywalls will NOT present in test mode!');
      console.error('[RevenueCat] ❌ Replace with your PRODUCTION key from:');
      console.error('[RevenueCat] ❌ https://app.revenuecat.com/ → Settings → API Keys');
      
      return {
        state: 'error',
        message: '⚠️ TEST API KEY DETECTED\n\n' +
                 'Paywalls cannot be presented in test mode.\n\n' +
                 'To fix this:\n' +
                 '1. Go to https://app.revenuecat.com/\n' +
                 '2. Navigate to Settings → API Keys\n' +
                 '3. Copy your iOS or Android PRODUCTION key\n' +
                 '4. Replace the test key in utils/superwallConfig.ts\n\n' +
                 'Your production key will start with "appl_" (iOS) or "goog_" (Android)'
      };
    }
    
    // Check if placeholder keys are still in use
    if (REVENUECAT_API_KEY.includes('YOUR_') || REVENUECAT_API_KEY.includes('_HERE')) {
      console.error('[RevenueCat] ❌❌❌ CRITICAL ERROR: Placeholder API key detected! ❌❌❌');
      console.error('[RevenueCat] ❌ You must replace the placeholder with your actual production key!');
      console.error('[RevenueCat] ❌ Get your key from: https://app.revenuecat.com/ → Settings → API Keys');
      
      Alert.alert(
        'RevenueCat Not Configured',
        '⚠️ PRODUCTION API KEY REQUIRED\n\n' +
        'The app is using a placeholder API key. You must configure your production RevenueCat API key.\n\n' +
        'Steps:\n' +
        '1. Go to https://app.revenuecat.com/\n' +
        '2. Navigate to Settings → API Keys\n' +
        '3. Copy your iOS or Android PRODUCTION key\n' +
        '4. Replace the placeholder in utils/superwallConfig.ts\n\n' +
        'Your production key will start with "appl_" (iOS) or "goog_" (Android)',
        [{ text: 'OK' }]
      );
      
      return false;
    }
    
    // Set log level for debugging
    Purchases.setLogLevel(LOG_LEVEL.DEBUG);
    
    // Configure RevenueCat with API key
    await Purchases.configure({ apiKey: REVENUECAT_API_KEY });
    
    console.log('[RevenueCat] ✅ RevenueCat SDK initialized successfully');
    
    // Fetch available offerings
    try {
      const offerings = await Purchases.getOfferings();
      
      console.log('[RevenueCat] 📦 All available offerings:', Object.keys(offerings.all));
      console.log('[RevenueCat] 📦 Current offering:', offerings.current?.identifier || 'None');
      
      // Try to get offerings in priority order
      for (const offeringId of PAYMENT_CONFIG.OFFERING_IDS) {
        if (offerings.all[offeringId]) {
          currentOffering = offerings.all[offeringId];
          console.log('[RevenueCat] 📦 Using offering:', offeringId);
          break;
        }
      }
      
      // Fallback to current offering if none of the specific ones found
      if (!currentOffering && offerings.current) {
        currentOffering = offerings.current;
        console.log('[RevenueCat] 📦 Using current offering:', offerings.current.identifier);
      }
      
      if (currentOffering) {
        console.log('[RevenueCat] 📦 Offering identifier:', currentOffering.identifier);
        console.log('[RevenueCat] 📦 Available packages:', currentOffering.availablePackages.length);
        
        currentOffering.availablePackages.forEach(pkg => {
          console.log(`[RevenueCat]   - ${pkg.identifier}: ${pkg.product.priceString}`);
        });
      } else {
        console.log('[RevenueCat] ⚠️ No offerings found. Please configure products in RevenueCat dashboard.');
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
  
  if (REVENUECAT_API_KEY.startsWith('test_')) {
    console.log('[RevenueCat] - API Key Type: ⚠️ TEST KEY (won\'t show paywalls!)');
  } else if (REVENUECAT_API_KEY.includes('YOUR_') || REVENUECAT_API_KEY.includes('_HERE')) {
    console.log('[RevenueCat] - API Key Type: ⚠️ PLACEHOLDER KEY (not configured!)');
  } else {
    console.log('[RevenueCat] - API Key Type: ✅ PRODUCTION KEY');
  }
  
  console.log('[RevenueCat] - Offering IDs:', PAYMENT_CONFIG.OFFERING_IDS);
  console.log('[RevenueCat] - Current Offering:', currentOffering?.identifier || 'None');
  
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
    
    // 🎬 DEMO MODE - Show demo paywall for screenshots
    if (ENABLE_DEMO_MODE && (REVENUECAT_API_KEY.includes('YOUR_') || REVENUECAT_API_KEY.includes('_HERE'))) {
      console.log('[RevenueCat] 🎬 DEMO MODE ENABLED - Showing demo paywall for screenshots');
      
      // Return a special state that will trigger the demo paywall UI
      return {
        state: 'error',
        message: 'DEMO_MODE'
      };
    }
    
    // Check if using test key
    if (REVENUECAT_API_KEY.startsWith('test_')) {
      console.error('[RevenueCat] ❌ Cannot present paywall with TEST API key!');
      return {
        state: 'error',
        message: '⚠️ TEST API KEY DETECTED\n\n' +
                 'Paywalls cannot be presented in test mode.\n\n' +
                 'To fix this:\n' +
                 '1. Go to https://app.revenuecat.com/\n' +
                 '2. Navigate to Settings → API Keys\n' +
                 '3. Copy your iOS or Android PRODUCTION key\n' +
                 '4. Replace the test key in utils/superwallConfig.ts\n\n' +
                 'Your production key will start with "appl_" (iOS) or "goog_" (Android)'
      };
    }
    
    // Check if using placeholder key (and not in demo mode)
    if (REVENUECAT_API_KEY.includes('YOUR_') || REVENUECAT_API_KEY.includes('_HERE')) {
      console.error('[RevenueCat] ❌ Cannot present paywall with placeholder API key!');
      return {
        state: 'error',
        message: '⚠️ PRODUCTION API KEY REQUIRED\n\n' +
                 'You must configure your production RevenueCat API key.\n\n' +
                 'Steps:\n' +
                 '1. Go to https://app.revenuecat.com/\n' +
                 '2. Navigate to Settings → API Keys\n' +
                 '3. Copy your iOS or Android PRODUCTION key\n' +
                 '4. Replace the placeholder in utils/superwallConfig.ts\n\n' +
                 'Your production key will start with "appl_" (iOS) or "goog_" (Android)'
      };
    }
    
    if (!isPaymentSystemAvailable()) {
      console.error('[RevenueCat] ❌ Payment system not initialized');
      return {
        state: 'error',
        message: 'Payment system is not initialized. Please restart the app.'
      };
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
    console.log('[RevenueCat] 📦 Fetching latest offerings...');
    const offerings = await Purchases.getOfferings();
    
    console.log('[RevenueCat] 📦 All available offerings:', Object.keys(offerings.all));
    console.log('[RevenueCat] 📦 Current offering:', offerings.current?.identifier || 'None');
    
    if (!offerings.current && Object.keys(offerings.all).length === 0) {
      console.error('[RevenueCat] ❌ No offerings available');
      return {
        state: 'error',
        message: 'No subscription packages available. Please ensure:\n\n' +
                 '1. Products are created in App Store Connect/Google Play Console\n' +
                 '2. Products are added to RevenueCat dashboard\n' +
                 '3. An Offering is created in RevenueCat\n' +
                 '4. The Offering is set as "Current" or default\n' +
                 '5. A Paywall is configured and linked to the Offering\n\n' +
                 'Check the RevenueCat dashboard at: https://app.revenuecat.com/'
      };
    }

    // Determine which offering to use - try multiple strategies
    let offeringToUse: PurchasesOffering | null = null;
    
    // Strategy 1: Try specific offering IDs in order
    for (const offeringId of PAYMENT_CONFIG.OFFERING_IDS) {
      if (offerings.all[offeringId]) {
        offeringToUse = offerings.all[offeringId];
        console.log('[RevenueCat] 📦 Using specific offering:', offeringId);
        break;
      }
    }
    
    // Strategy 2: Use current/default offering
    if (!offeringToUse && offerings.current) {
      offeringToUse = offerings.current;
      console.log('[RevenueCat] 📦 Using current/default offering:', offerings.current.identifier);
    }
    
    // Strategy 3: Use first available offering as last resort
    if (!offeringToUse && Object.keys(offerings.all).length > 0) {
      const firstOfferingKey = Object.keys(offerings.all)[0];
      offeringToUse = offerings.all[firstOfferingKey];
      console.log('[RevenueCat] 📦 Using first available offering:', firstOfferingKey);
    }

    if (!offeringToUse) {
      console.error('[RevenueCat] ❌ No offering available to present');
      return {
        state: 'error',
        message: 'Unable to load subscription options. Please ensure an Offering is configured in RevenueCat dashboard.'
      };
    }

    console.log('[RevenueCat] 📦 Final offering to present:', offeringToUse.identifier);
    console.log('[RevenueCat] 📦 Available packages:', offeringToUse.availablePackages.length);
    
    if (offeringToUse.availablePackages.length === 0) {
      console.error('[RevenueCat] ❌ Offering has no packages');
      return {
        state: 'error',
        message: 'No subscription packages found in the offering. Please add products to your offering in RevenueCat dashboard.'
      };
    }

    // Present the RevenueCat Paywall UI
    console.log('[RevenueCat] 🎨 Presenting paywall...');
    
    let paywallResult: PAYWALL_RESULT;
    
    try {
      // Try presenting WITHOUT specifying offering (uses default paywall configuration)
      console.log('[RevenueCat] 🎨 Attempting to present default paywall (no offering specified)...');
      paywallResult = await RevenueCatUI.presentPaywall();
      console.log('[RevenueCat] 📊 Paywall closed with result:', paywallResult);
    } catch (defaultError: any) {
      console.error('[RevenueCat] ❌ Error presenting default paywall:', defaultError);
      
      // Fallback: Try with specific offering
      console.log('[RevenueCat] 🔄 Attempting fallback: presenting with specific offering...');
      try {
        paywallResult = await RevenueCatUI.presentPaywall({
          offering: offeringToUse
        });
        console.log('[RevenueCat] 📊 Fallback paywall closed with result:', paywallResult);
      } catch (fallbackError: any) {
        console.error('[RevenueCat] ❌ Fallback also failed:', fallbackError);
        console.error('[RevenueCat] Error details:', JSON.stringify(fallbackError, null, 2));
        
        return {
          state: 'error',
          message: 'Unable to display subscription options. Please ensure:\n\n' +
                   '1. A Paywall is configured in RevenueCat dashboard\n' +
                   '2. The Paywall is linked to the "default" offering\n' +
                   '3. The Paywall is published/active\n' +
                   '4. Products are properly configured\n\n' +
                   'Visit: https://app.revenuecat.com/\n\n' +
                   'Error: ' + (fallbackError.message || 'Unknown error')
        };
      }
    }

    // Handle the result
    if (paywallResult === PAYWALL_RESULT.PURCHASED) {
      console.log('[RevenueCat] ✅ Purchase successful!');
      
      // Get updated customer info
      const customerInfo = await Purchases.getCustomerInfo();
      console.log('[RevenueCat] 📊 Active entitlements:', Object.keys(customerInfo.entitlements.active));

      // Update Supabase profile
      if (userId) {
        console.log('[RevenueCat] 💾 Updating Supabase profile...');
        await updateSubscriptionInSupabase(userId, customerInfo);
      }

      return { 
        state: 'purchased',
        message: 'Subscription activated successfully!'
      };
    } else if (paywallResult === PAYWALL_RESULT.RESTORED) {
      console.log('[RevenueCat] ✅ Restore successful!');
      
      // Get updated customer info
      const customerInfo = await Purchases.getCustomerInfo();
      console.log('[RevenueCat] 📊 Active entitlements:', Object.keys(customerInfo.entitlements.active));

      // Update Supabase profile
      if (userId) {
        console.log('[RevenueCat] 💾 Updating Supabase profile...');
        await updateSubscriptionInSupabase(userId, customerInfo);
      }

      return { 
        state: 'restored',
        message: 'Subscription restored successfully!'
      };
    } else if (paywallResult === PAYWALL_RESULT.CANCELLED) {
      console.log('[RevenueCat] ℹ️ User cancelled paywall');
      return { state: 'declined' };
    } else if (paywallResult === PAYWALL_RESULT.ERROR) {
      console.error('[RevenueCat] ❌ Paywall error');
      return { 
        state: 'error',
        message: 'An error occurred while processing your purchase. Please try again.'
      };
    } else if (paywallResult === PAYWALL_RESULT.NOT_PRESENTED) {
      console.log('[RevenueCat] ⚠️ Paywall was not presented');
      return { 
        state: 'error',
        message: 'Unable to display subscription options. Please ensure:\n\n' +
                 '1. A Paywall is configured in RevenueCat dashboard\n' +
                 '2. The Paywall is linked to the "default" offering\n' +
                 '3. The Paywall is published/active\n' +
                 '4. Products are properly configured in App Store Connect/Google Play\n\n' +
                 'Visit: https://app.revenuecat.com/ to configure your paywall.'
      };
    } else {
      console.log('[RevenueCat] ℹ️ Paywall closed without action, result:', paywallResult);
      return { state: 'declined' };
    }

  } catch (error: any) {
    console.error('[RevenueCat] ❌ ===== PAYWALL ERROR =====');
    console.error('[RevenueCat] Error:', error);
    console.error('[RevenueCat] Error message:', error.message);
    console.error('[RevenueCat] Error code:', error.code);
    console.error('[RevenueCat] Full error:', JSON.stringify(error, null, 2));

    // Provide more specific error messages
    let errorMessage = 'Unable to load subscription options. ';
    
    if (error.message?.includes('No current offering')) {
      errorMessage += 'Please configure a default offering in your RevenueCat dashboard.';
    } else if (error.message?.includes('paywall')) {
      errorMessage += 'Please ensure:\n\n' +
                     '1. A Paywall is configured in RevenueCat dashboard\n' +
                     '2. The Paywall is linked to the "default" offering\n' +
                     '3. The Paywall is published/active';
    } else if (error.message?.includes('network')) {
      errorMessage += 'Please check your internet connection and try again.';
    } else {
      errorMessage += 'Please try again later or contact support.\n\nError: ' + (error.message || 'Unknown error');
    }

    return { 
      state: 'error',
      message: errorMessage
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
      console.log('[RevenueCat] ⚠️ Payment system not available');
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
