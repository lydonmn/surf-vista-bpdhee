
import Purchases, { 
  PurchasesPackage, 
  CustomerInfo,
  PurchasesOffering,
  LOG_LEVEL
} from 'react-native-purchases';
import RevenueCatUI, { PAYWALL_RESULT } from 'react-native-purchases-ui';
import { Platform, Alert } from 'react-native';
import { supabase } from '@/app/integrations/supabase/client';

// ═══════════════════════════════════════════════════════════════════════════
// 🔧 REVENUECAT CONFIGURATION - SURFVISTA
// ═══════════════════════════════════════════════════════════════════════════

// RevenueCat API Keys
const REVENUECAT_API_KEY_IOS = 'appl_uyUNhkTURhBCqiVsRaBqBYbhIda'; // ✅ PRODUCTION KEY
const REVENUECAT_API_KEY_ANDROID = 'goog_YOUR_ANDROID_KEY_HERE';

// Product Configuration
// ⚠️ CRITICAL: These product IDs MUST match EXACTLY in App Store Connect
// Based on your RevenueCat dashboard screenshot, you need to create:
// 1. Product ID: "surfvista_Monthly" (Monthly subscription)
// 2. Product ID: "surfvista_Annual" (Annual subscription)
export const PAYMENT_CONFIG = {
  PRODUCTS: {
    MONTHLY_SUBSCRIPTION: 'surfvista_Monthly',
    ANNUAL_SUBSCRIPTION: 'surfvista_Annual',
  },
  ENTITLEMENT_ID: 'SurfVista',
  OFFERING_ID: 'ofrngf25b3975f3', // From your RevenueCat dashboard
  PACKAGE_IDS: {
    MONTHLY: '$rc_monthly',
    ANNUAL: '$rc_annual',
  },
  PRICING: {
    MONTHLY: '$12.99',
    ANNUAL: '$99.99',
  },
};

let isPaymentSystemInitialized = false;
let currentOffering: PurchasesOffering | null = null;
let initializationError: string | null = null;

/**
 * Initialize RevenueCat SDK
 */
export const initializeRevenueCat = async (): Promise<boolean> => {
  try {
    console.log('[RevenueCat] 🚀 Initializing SDK...');
    console.log('[RevenueCat] Platform:', Platform.OS);
    
    if (Platform.OS === 'web') {
      console.log('[RevenueCat] ℹ️ Skipping initialization on web platform');
      initializationError = 'RevenueCat is not supported on web.';
      isPaymentSystemInitialized = false;
      return false;
    }
    
    const REVENUECAT_API_KEY = Platform.OS === 'ios' 
      ? REVENUECAT_API_KEY_IOS 
      : REVENUECAT_API_KEY_ANDROID;
    
    if (REVENUECAT_API_KEY.includes('YOUR_')) {
      initializationError = 'API key not configured.';
      console.warn('[RevenueCat] ⚠️', initializationError);
      isPaymentSystemInitialized = false;
      return false;
    }
    
    try {
      Purchases.setLogLevel(__DEV__ ? LOG_LEVEL.DEBUG : LOG_LEVEL.INFO);
      console.log('[RevenueCat] 🔑 Configuring with API key...');
      
      await Purchases.configure({ apiKey: REVENUECAT_API_KEY });
      console.log('[RevenueCat] ✅ SDK configured successfully');
    } catch (configError: any) {
      initializationError = `SDK configuration failed: ${configError?.message}`;
      console.warn('[RevenueCat] ⚠️', initializationError);
      isPaymentSystemInitialized = false;
      return false;
    }
    
    try {
      console.log('[RevenueCat] 📦 Fetching offerings...');
      const offerings = await Purchases.getOfferings();
      
      console.log('[RevenueCat] 🔍 Offerings Response:');
      console.log('[RevenueCat]    - Current offering:', offerings.current?.identifier || 'NONE');
      console.log('[RevenueCat]    - All offerings:', Object.keys(offerings.all).length);
      
      if (offerings.all[PAYMENT_CONFIG.OFFERING_ID]) {
        currentOffering = offerings.all[PAYMENT_CONFIG.OFFERING_ID];
        console.log('[RevenueCat] ✅ Using configured offering:', PAYMENT_CONFIG.OFFERING_ID);
      } else if (offerings.current) {
        currentOffering = offerings.current;
        console.log('[RevenueCat] ⚠️ Using current offering:', offerings.current.identifier);
      } else {
        initializationError = 'No offerings found.';
        console.warn('[RevenueCat] ⚠️ NO OFFERINGS FOUND');
        isPaymentSystemInitialized = true;
        return true;
      }
      
      if (currentOffering && currentOffering.availablePackages.length > 0) {
        console.log('[RevenueCat] ✅ Packages available:', currentOffering.availablePackages.length);
        currentOffering.availablePackages.forEach((pkg, index) => {
          console.log(`[RevenueCat]    ${index + 1}. ${pkg.identifier} - ${pkg.product.priceString}`);
        });
      } else {
        console.warn('[RevenueCat] ⚠️ Offering has NO packages');
        initializationError = 'No products found in offering.';
      }
      
    } catch (offeringError: any) {
      initializationError = offeringError.message;
      console.warn('[RevenueCat] ⚠️ Error fetching offerings:', offeringError.message);
      isPaymentSystemInitialized = true;
      return true;
    }
    
    isPaymentSystemInitialized = true;
    initializationError = null;
    console.log('[RevenueCat] ✅ Initialization complete');
    return true;
    
  } catch (error: any) {
    initializationError = error?.message || 'Unknown initialization error';
    console.warn('[RevenueCat] ⚠️ Failed to initialize:', error);
    isPaymentSystemInitialized = false;
    return false;
  }
};

export const initializePaymentSystem = initializeRevenueCat;

export const isPaymentSystemAvailable = (): boolean => {
  if (Platform.OS === 'web') {
    return false;
  }
  return isPaymentSystemInitialized;
};

export const getInitializationError = (): string | null => {
  return initializationError;
};

export const checkPaymentConfiguration = (): boolean => {
  console.log('[RevenueCat] 🔍 ===== CONFIGURATION CHECK =====');
  console.log('[RevenueCat]    - Platform:', Platform.OS);
  console.log('[RevenueCat]    - Initialized:', isPaymentSystemInitialized);
  console.log('[RevenueCat]    - Current Offering:', currentOffering?.identifier || 'None');
  console.log('[RevenueCat]    - Offering Packages:', currentOffering?.availablePackages.length || 0);
  console.log('[RevenueCat]    - Initialization Error:', initializationError || 'None');
  
  if (Platform.OS === 'web') {
    console.log('[RevenueCat] ℹ️ RevenueCat is not supported on web');
    return false;
  }
  
  if (currentOffering && currentOffering.availablePackages.length > 0) {
    console.log('[RevenueCat] ✅ Configuration looks good!');
    return true;
  } else {
    console.log('[RevenueCat] ⚠️ ===== CONFIGURATION INCOMPLETE =====');
    console.log('[RevenueCat] ');
    console.log('[RevenueCat] 🚨 THE PAYWALL CANNOT BE PRESENTED BECAUSE:');
    console.log('[RevenueCat] ');
    
    if (!isPaymentSystemInitialized) {
      console.log('[RevenueCat] ❌ RevenueCat SDK is not initialized');
    } else if (!currentOffering) {
      console.log('[RevenueCat] ❌ No offering found');
      console.log('[RevenueCat]    → Expected offering ID:', PAYMENT_CONFIG.OFFERING_ID);
    } else if (currentOffering.availablePackages.length === 0) {
      console.log('[RevenueCat] ❌ Offering has NO PACKAGES (products)');
      console.log('[RevenueCat]    → This is the error you\'re seeing!');
      console.log('[RevenueCat] ');
      console.log('[RevenueCat] 📋 TO FIX THIS ERROR:');
      console.log('[RevenueCat] ');
      console.log('[RevenueCat] 1️⃣ CREATE PRODUCTS IN APP STORE CONNECT:');
      console.log('[RevenueCat]    → Go to appstoreconnect.apple.com');
      console.log('[RevenueCat]    → Select SurfVista app');
      console.log('[RevenueCat]    → Go to Monetization > Subscriptions');
      console.log('[RevenueCat]    → Create subscription group (if not exists)');
      console.log('[RevenueCat]    → Add monthly subscription:');
      console.log('[RevenueCat]       • Product ID: surfvista_Monthly (EXACT!)');
      console.log('[RevenueCat]       • Price: $12.99/month');
      console.log('[RevenueCat]       • Duration: 1 month');
      console.log('[RevenueCat]       • Status: Ready to Submit');
      console.log('[RevenueCat]    → Add annual subscription:');
      console.log('[RevenueCat]       • Product ID: surfvista_Annual (EXACT!)');
      console.log('[RevenueCat]       • Price: $99.99/year');
      console.log('[RevenueCat]       • Duration: 1 year');
      console.log('[RevenueCat]       • Status: Ready to Submit');
      console.log('[RevenueCat] ');
      console.log('[RevenueCat] 2️⃣ VERIFY IN REVENUECAT DASHBOARD:');
      console.log('[RevenueCat]    → Go to app.revenuecat.com');
      console.log('[RevenueCat]    → Select SurfVista project');
      console.log('[RevenueCat]    → Go to Products');
      console.log('[RevenueCat]    → Verify surfvista_Monthly exists');
      console.log('[RevenueCat]    → Verify surfvista_Annual exists');
      console.log('[RevenueCat]    → Go to Offerings');
      console.log('[RevenueCat]    → Edit offering:', PAYMENT_CONFIG.OFFERING_ID);
      console.log('[RevenueCat]    → Verify both products are linked');
      console.log('[RevenueCat] ');
      console.log('[RevenueCat] 3️⃣ WAIT FOR SYNC:');
      console.log('[RevenueCat]    → Wait 15-30 minutes for App Store Connect to sync');
      console.log('[RevenueCat]    → Force quit and restart the app');
      console.log('[RevenueCat]    → Try again');
      console.log('[RevenueCat] ');
      console.log('[RevenueCat] 📚 More info: https://rev.cat/why-are-offerings-empty');
    }
    
    console.log('[RevenueCat] ===== END CONFIGURATION CHECK =====');
    return false;
  }
};

/**
 * Present the RevenueCat Paywall
 */
export const presentPaywall = async (
  userId?: string,
  userEmail?: string
): Promise<{ state: 'purchased' | 'restored' | 'declined' | 'error' | 'initializing'; message?: string }> => {
  try {
    console.log('[RevenueCat] 🎯 Presenting paywall...');
    
    if (Platform.OS === 'web') {
      return {
        state: 'error',
        message: '📱 Mobile App Required\n\nSubscriptions are only available in the iOS or Android app.'
      };
    }
    
    if (!isPaymentSystemAvailable()) {
      console.log('[RevenueCat] ⏳ Payment system not ready yet...');
      return {
        state: 'initializing',
        message: 'Initializing payment system...'
      };
    }

    if (userId) {
      try {
        await Purchases.logIn(userId);
        console.log('[RevenueCat] ✅ User logged in:', userId);
      } catch (loginError: any) {
        console.error('[RevenueCat] ⚠️ Error logging in user:', loginError.message);
      }
    }

    if (userEmail) {
      try {
        await Purchases.setEmail(userEmail);
        console.log('[RevenueCat] ✅ Email set:', userEmail);
      } catch (emailError: any) {
        console.error('[RevenueCat] ⚠️ Error setting email:', emailError.message);
      }
    }

    console.log('[RevenueCat] 📦 Fetching latest offerings...');
    const offerings = await Purchases.getOfferings();
    
    let offeringToUse = offerings.all[PAYMENT_CONFIG.OFFERING_ID] || offerings.current || currentOffering;

    if (!offeringToUse) {
      return {
        state: 'error',
        message: '⚠️ Configuration Error\n\nNo subscription offerings found. Please contact support.'
      };
    }

    console.log('[RevenueCat] 📋 Using offering:', offeringToUse.identifier);
    console.log('[RevenueCat] 📋 Available packages:', offeringToUse.availablePackages.length);

    if (offeringToUse.availablePackages.length === 0) {
      // This is the error you're seeing!
      return {
        state: 'error',
        message: '⚠️ Products Not Found\n\n' +
          'The subscription products are not available yet. This happens when:\n\n' +
          '• Products haven\'t been created in App Store Connect\n' +
          '• Products are not in "Ready to Submit" status\n' +
          '• App Store Connect hasn\'t synced with RevenueCat yet\n\n' +
          'What to do:\n\n' +
          '1. Create products in App Store Connect:\n' +
          '   • surfvista_Monthly ($12.99/month)\n' +
          '   • surfvista_Annual ($99.99/year)\n\n' +
          '2. Set products to "Ready to Submit"\n\n' +
          '3. Wait 15-30 minutes for sync\n\n' +
          '4. Restart the app and try again\n\n' +
          'If you\'ve already done this, please wait a bit longer for the sync to complete.'
      };
    }

    console.log('[RevenueCat] 🎨 Presenting paywall UI...');
    
    const paywallResult = await RevenueCatUI.presentPaywall({
      offering: offeringToUse
    });
    
    console.log('[RevenueCat] 📊 Paywall result:', paywallResult);

    if (paywallResult === PAYWALL_RESULT.PURCHASED) {
      console.log('[RevenueCat] ✅ Purchase successful');
      const customerInfo = await Purchases.getCustomerInfo();
      if (userId) {
        await updateSubscriptionInSupabase(userId, customerInfo);
      }
      return { 
        state: 'purchased',
        message: 'Subscription activated successfully!'
      };
    } else if (paywallResult === PAYWALL_RESULT.RESTORED) {
      console.log('[RevenueCat] ✅ Restore successful');
      const customerInfo = await Purchases.getCustomerInfo();
      if (userId) {
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
        message: 'An error occurred. Please try again.'
      };
    } else if (paywallResult === PAYWALL_RESULT.NOT_PRESENTED) {
      console.log('[RevenueCat] ⚠️ Paywall was not presented');
      return { 
        state: 'error',
        message: 'Paywall not configured. Please create a paywall in RevenueCat dashboard.'
      };
    } else {
      console.log('[RevenueCat] ℹ️ Paywall closed without action');
      return { state: 'declined' };
    }

  } catch (error: any) {
    console.error('[RevenueCat] ❌ Paywall error:', error);
    return { 
      state: 'error',
      message: error.message || 'Unable to load subscription options.'
    };
  }
};

/**
 * Present the RevenueCat Customer Center
 */
export const presentCustomerCenter = async (): Promise<void> => {
  try {
    console.log('[RevenueCat] 🏢 Presenting Customer Center...');
    
    if (Platform.OS === 'web') {
      throw new Error('Customer Center is only available in the mobile app.');
    }
    
    if (!isPaymentSystemAvailable()) {
      throw new Error('Payment system is not initialized.');
    }

    await RevenueCatUI.presentCustomerCenter();
    console.log('[RevenueCat] ✅ Customer Center closed');
    
    const customerInfo = await Purchases.getCustomerInfo();
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await updateSubscriptionInSupabase(user.id, customerInfo);
    }
    
  } catch (error: any) {
    console.error('[RevenueCat] ❌ Customer Center error:', error);
    
    Alert.alert(
      'Manage Subscription',
      Platform.OS === 'ios'
        ? 'To manage your subscription:\n\n1. Open Settings on your iPhone\n2. Tap your name at the top\n3. Tap Subscriptions\n4. Select SurfVista'
        : 'To manage your subscription:\n\n1. Open Play Store\n2. Tap Menu > Subscriptions\n3. Select SurfVista',
      [{ text: 'OK' }]
    );
  }
};

/**
 * Restore previous purchases
 */
export const restorePurchases = async (): Promise<{ 
  success: boolean; 
  state?: 'restored' | 'none';
  message?: string 
}> => {
  try {
    console.log('[RevenueCat] 🔄 Restoring purchases...');

    if (Platform.OS === 'web') {
      return {
        success: false,
        message: 'Restore purchases is only available in the mobile app.'
      };
    }

    if (!isPaymentSystemAvailable()) {
      throw new Error('Payment system is not initialized.');
    }

    const customerInfo = await Purchases.restorePurchases();
    const hasActiveSubscription = Object.keys(customerInfo.entitlements.active).length > 0;

    if (hasActiveSubscription) {
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

/**
 * Get customer info
 */
export const getCustomerInfo = async (): Promise<CustomerInfo | null> => {
  try {
    if (!isPaymentSystemAvailable()) {
      return null;
    }
    const customerInfo = await Purchases.getCustomerInfo();
    return customerInfo;
  } catch (error: any) {
    console.error('[RevenueCat] ❌ Error getting customer info:', error);
    return null;
  }
};

/**
 * Check if user has active entitlement
 */
export const checkEntitlements = async (): Promise<boolean> => {
  try {
    if (!isPaymentSystemAvailable()) {
      return false;
    }
    const customerInfo = await Purchases.getCustomerInfo();
    const hasEntitlement = customerInfo.entitlements.active[PAYMENT_CONFIG.ENTITLEMENT_ID] !== undefined;
    console.log('[RevenueCat] 🔍 Entitlement check:', hasEntitlement);
    return hasEntitlement;
  } catch (error: any) {
    console.error('[RevenueCat] ❌ Error checking entitlements:', error);
    return false;
  }
};

/**
 * Check subscription status
 */
export const checkSubscriptionStatus = async (userId: string): Promise<{
  isActive: boolean;
  endDate: string | null;
}> => {
  try {
    if (!isPaymentSystemAvailable()) {
      return await checkSubscriptionInSupabase(userId);
    }

    const customerInfo = await Purchases.getCustomerInfo();
    const hasActiveSubscription = customerInfo.entitlements.active[PAYMENT_CONFIG.ENTITLEMENT_ID] !== undefined;
    
    if (hasActiveSubscription) {
      const entitlement = customerInfo.entitlements.active[PAYMENT_CONFIG.ENTITLEMENT_ID];
      const endDate = entitlement.expirationDate || null;
      await updateSubscriptionInSupabase(userId, customerInfo);
      return {
        isActive: true,
        endDate: endDate
      };
    } else {
      return await checkSubscriptionInSupabase(userId);
    }
  } catch (error: any) {
    console.error('[RevenueCat] ❌ Error checking subscription:', error);
    return await checkSubscriptionInSupabase(userId);
  }
};

/**
 * Update subscription status in Supabase
 */
export const updateSubscriptionInSupabase = async (userId: string, customerInfo: CustomerInfo): Promise<void> => {
  try {
    const hasActiveSubscription = customerInfo.entitlements.active[PAYMENT_CONFIG.ENTITLEMENT_ID] !== undefined;
    let subscriptionEndDate: string | null = null;
    
    if (hasActiveSubscription) {
      const entitlement = customerInfo.entitlements.active[PAYMENT_CONFIG.ENTITLEMENT_ID];
      subscriptionEndDate = entitlement.expirationDate || null;
    }
    
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

/**
 * Check subscription in Supabase (fallback)
 */
export const checkSubscriptionInSupabase = async (userId: string): Promise<{
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
      return { isActive: false, endDate: null };
    }
    
    if (profile.is_subscribed && profile.subscription_end_date) {
      const endDate = new Date(profile.subscription_end_date);
      const isActive = endDate > new Date();
      return { isActive, endDate: profile.subscription_end_date };
    }
    
    return { isActive: false, endDate: null };
  } catch (error: any) {
    console.error('[RevenueCat] ❌ Exception checking Supabase subscription:', error);
    return { isActive: false, endDate: null };
  }
};

/**
 * Identify user in RevenueCat
 */
export const identifyUser = async (userId: string, email?: string): Promise<void> => {
  try {
    console.log('[RevenueCat] Identifying user:', userId);
    
    if (!isPaymentSystemAvailable()) {
      console.log('[RevenueCat] Payment system not available');
      return;
    }

    try {
      await Purchases.logIn(userId);
      console.log('[RevenueCat] ✅ User identified:', userId);
    } catch (loginError: any) {
      console.error('[RevenueCat] ⚠️ Error logging in user:', loginError?.message);
    }
    
    if (email) {
      try {
        await Purchases.setEmail(email);
        console.log('[RevenueCat] ✅ Email set:', email);
      } catch (emailError: any) {
        console.error('[RevenueCat] ⚠️ Error setting email:', emailError?.message);
      }
    }
  } catch (error: any) {
    console.error('[RevenueCat] ❌ Error identifying user:', error?.message);
  }
};

/**
 * Logout user from RevenueCat
 */
export const logoutUser = async (): Promise<void> => {
  try {
    console.log('[RevenueCat] Logging out user...');
    
    if (!isPaymentSystemAvailable()) {
      console.log('[RevenueCat] Payment system not available');
      return;
    }

    try {
      await Purchases.logOut();
      console.log('[RevenueCat] ✅ User logged out');
    } catch (logoutError: any) {
      console.error('[RevenueCat] ⚠️ Error logging out user:', logoutError?.message);
    }
  } catch (error: any) {
    console.error('[RevenueCat] ❌ Error in logout process:', error?.message);
  }
};
