
import Purchases, { 
  PurchasesPackage, 
  CustomerInfo,
  PurchasesOffering,
  LOG_LEVEL
} from 'react-native-purchases';
import RevenueCatUI, { PAYWALL_RESULT } from 'react-native-purchases-ui';
import { Platform, Alert } from 'react-native';
import { supabase } from '@/app/integrations/supabase/client';

// Production API Keys
const REVENUECAT_API_KEY_IOS = 'appl_uyUNhkTURhBCqiVsRaBqBYbhIda';
const REVENUECAT_API_KEY_ANDROID = 'goog_YOUR_ANDROID_PRODUCTION_KEY_HERE';

// Product Configuration
export const PAYMENT_CONFIG = {
  PRODUCTS: {
    MONTHLY_SUBSCRIPTION: 'surfvista_monthly',
    ANNUAL_SUBSCRIPTION: 'surfvista_annual',
    MONTHLY: 'monthly',
    YEARLY: 'yearly',
  },
  OFFERING_IDS: ['ofrnge7bdc97106', 'default'],
  ENTITLEMENT_ID: 'premium',
  PRICING: {
    MONTHLY: '$10.99',
    ANNUAL: '$99.99',
  },
};

let isPaymentSystemInitialized = false;
let currentOffering: PurchasesOffering | null = null;

export const initializeRevenueCat = async (): Promise<boolean> => {
  try {
    console.log('[RevenueCat] 🚀 Initializing SDK...');
    console.log('[RevenueCat] Platform:', Platform.OS);
    
    // Get the API key for the current platform
    const REVENUECAT_API_KEY = Platform.OS === 'ios' ? REVENUECAT_API_KEY_IOS : REVENUECAT_API_KEY_ANDROID;
    
    // Only validate the API key for the CURRENT platform
    if (Platform.OS === 'ios') {
      if (!REVENUECAT_API_KEY.startsWith('appl_')) {
        console.error('[RevenueCat] ❌ Invalid iOS API key format');
        return false;
      }
      if (REVENUECAT_API_KEY.includes('YOUR_') || REVENUECAT_API_KEY.includes('_HERE')) {
        console.error('[RevenueCat] ❌ iOS API key is a placeholder');
        return false;
      }
    } else if (Platform.OS === 'android') {
      if (!REVENUECAT_API_KEY.startsWith('goog_')) {
        console.error('[RevenueCat] ❌ Invalid Android API key format');
        return false;
      }
      if (REVENUECAT_API_KEY.includes('YOUR_') || REVENUECAT_API_KEY.includes('_HERE')) {
        console.error('[RevenueCat] ❌ Android API key is a placeholder');
        console.error('[RevenueCat] 💡 Please add your Android API key to utils/superwallConfig.ts');
        return false;
      }
    }
    
    // Configure RevenueCat
    Purchases.setLogLevel(__DEV__ ? LOG_LEVEL.DEBUG : LOG_LEVEL.INFO);
    await Purchases.configure({ apiKey: REVENUECAT_API_KEY });
    
    console.log('[RevenueCat] ✅ SDK configured successfully');
    
    // Fetch offerings
    try {
      console.log('[RevenueCat] 📦 Fetching offerings...');
      const offerings = await Purchases.getOfferings();
      
      console.log('[RevenueCat] 🔍 Offerings Debug:');
      console.log('[RevenueCat] - Current offering:', offerings.current?.identifier || 'NONE');
      console.log('[RevenueCat] - All offerings:', Object.keys(offerings.all));
      
      // Try to find the offering in order of preference
      for (const offeringId of PAYMENT_CONFIG.OFFERING_IDS) {
        if (offerings.all[offeringId]) {
          currentOffering = offerings.all[offeringId];
          console.log('[RevenueCat] ✅ Found offering:', offeringId);
          console.log('[RevenueCat] - Packages:', currentOffering.availablePackages.length);
          console.log('[RevenueCat] - Package IDs:', currentOffering.availablePackages.map(p => p.identifier));
          break;
        }
      }
      
      // If no specific offering found, use current
      if (!currentOffering && offerings.current) {
        currentOffering = offerings.current;
        console.log('[RevenueCat] ✅ Using current offering:', offerings.current.identifier);
        console.log('[RevenueCat] - Packages:', currentOffering.availablePackages.length);
        console.log('[RevenueCat] - Package IDs:', currentOffering.availablePackages.map(p => p.identifier));
      }
      
      // If still no offering, use first available
      if (!currentOffering && Object.keys(offerings.all).length > 0) {
        const firstKey = Object.keys(offerings.all)[0];
        currentOffering = offerings.all[firstKey];
        console.log('[RevenueCat] ⚠️ Using first available offering:', firstKey);
        console.log('[RevenueCat] - Packages:', currentOffering.availablePackages.length);
      }
      
      if (!currentOffering) {
        console.error('[RevenueCat] ❌ NO OFFERING FOUND!');
        console.error('[RevenueCat] 💡 SOLUTION:');
        console.error('[RevenueCat]    1. Go to RevenueCat dashboard');
        console.error('[RevenueCat]    2. Navigate to Offerings');
        console.error('[RevenueCat]    3. Create an offering or mark one as "Current"');
        console.error('[RevenueCat]    4. Ensure products are linked to the offering');
        console.error('[RevenueCat]    5. Create and publish a paywall');
      } else {
        console.log('[RevenueCat] ✅ Offering ready:', currentOffering.identifier);
      }
    } catch (offeringError: any) {
      console.error('[RevenueCat] ❌ Error fetching offerings:', offeringError.message);
      console.error('[RevenueCat] 💡 This usually means:');
      console.error('[RevenueCat]    - No offerings configured in RevenueCat dashboard');
      console.error('[RevenueCat]    - Network connectivity issues');
      console.error('[RevenueCat]    - API key permissions issue');
    }
    
    isPaymentSystemInitialized = true;
    console.log('[RevenueCat] ✅ Initialization complete');
    return true;
  } catch (error: any) {
    console.error('[RevenueCat] ❌ Failed to initialize:', error.message);
    isPaymentSystemInitialized = false;
    return false;
  }
};

export const initializePaymentSystem = initializeRevenueCat;

export const isPaymentSystemAvailable = (): boolean => {
  return isPaymentSystemInitialized;
};

export const checkPaymentConfiguration = (): boolean => {
  console.log('[RevenueCat] 🔍 Configuration Check:');
  console.log('[RevenueCat] - Initialized:', isPaymentSystemInitialized);
  console.log('[RevenueCat] - Platform:', Platform.OS);
  console.log('[RevenueCat] - Current Offering:', currentOffering?.identifier || 'None');
  console.log('[RevenueCat] - Offering Packages:', currentOffering?.availablePackages.length || 0);
  
  if (currentOffering && currentOffering.availablePackages.length > 0) {
    console.log('[RevenueCat] ✅ Configuration looks good!');
  } else {
    console.log('[RevenueCat] ⚠️ Configuration incomplete - check offerings in dashboard');
  }
  
  return isPaymentSystemInitialized;
};

export const presentPaywall = async (
  userId?: string,
  userEmail?: string
): Promise<{ state: 'purchased' | 'restored' | 'declined' | 'error'; message?: string }> => {
  try {
    console.log('[RevenueCat] 🎯 Presenting paywall...');
    
    if (!isPaymentSystemAvailable()) {
      console.error('[RevenueCat] ❌ Payment system not initialized');
      return {
        state: 'error',
        message: 'Payment system is not initialized. Please restart the app.'
      };
    }

    // Identify user if provided
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

    // Fetch latest offerings
    console.log('[RevenueCat] 📦 Fetching latest offerings...');
    const offerings = await Purchases.getOfferings();
    
    console.log('[RevenueCat] 🔍 Offerings check:');
    console.log('[RevenueCat] - Current:', offerings.current?.identifier || 'NONE');
    console.log('[RevenueCat] - All:', Object.keys(offerings.all));
    
    // Determine which offering to use
    let offeringToUse: PurchasesOffering | null = null;
    
    // Try specific offering IDs first
    for (const offeringId of PAYMENT_CONFIG.OFFERING_IDS) {
      if (offerings.all[offeringId]) {
        offeringToUse = offerings.all[offeringId];
        console.log('[RevenueCat] ✅ Using offering:', offeringId);
        break;
      }
    }
    
    // Fall back to current offering
    if (!offeringToUse && offerings.current) {
      offeringToUse = offerings.current;
      console.log('[RevenueCat] ✅ Using current offering:', offerings.current.identifier);
    }
    
    // Last resort: use first available offering
    if (!offeringToUse && Object.keys(offerings.all).length > 0) {
      const firstOfferingKey = Object.keys(offerings.all)[0];
      offeringToUse = offerings.all[firstOfferingKey];
      console.log('[RevenueCat] ⚠️ Using first available offering:', firstOfferingKey);
    }

    // Check if we have an offering
    if (!offeringToUse) {
      console.error('[RevenueCat] ❌ No offering available');
      return {
        state: 'error',
        message: 'No subscription options available.\n\n' +
                 'Please ensure an offering is marked as "Current" in your RevenueCat dashboard.\n\n' +
                 'Steps:\n' +
                 '1. Go to RevenueCat dashboard\n' +
                 '2. Click on Offerings\n' +
                 '3. Find offering "ofrnge7bdc97106"\n' +
                 '4. Click "Make Current"\n' +
                 '5. Ensure products are linked\n' +
                 '6. Create and publish a paywall'
      };
    }

    // Check if offering has packages
    console.log('[RevenueCat] 📦 Offering packages:', offeringToUse.availablePackages.length);
    
    if (offeringToUse.availablePackages.length === 0) {
      console.error('[RevenueCat] ❌ No packages in offering');
      return {
        state: 'error',
        message: 'No subscription plans available.\n\n' +
                 'Please add products to your offering in RevenueCat dashboard.'
      };
    }

    // Present the paywall
    let paywallResult: PAYWALL_RESULT;
    
    try {
      console.log('[RevenueCat] 🎨 Presenting paywall UI...');
      
      // Try with explicit offering first
      paywallResult = await RevenueCatUI.presentPaywall({
        offering: offeringToUse
      });
      
      console.log('[RevenueCat] ✅ Paywall presented successfully');
    } catch (paywallError: any) {
      console.error('[RevenueCat] ❌ Error presenting paywall:', paywallError.message);
      
      // Try without explicit offering as fallback
      try {
        console.log('[RevenueCat] 🔄 Trying default paywall...');
        paywallResult = await RevenueCatUI.presentPaywall();
        console.log('[RevenueCat] ✅ Default paywall presented');
      } catch (fallbackError: any) {
        console.error('[RevenueCat] ❌ Fallback also failed:', fallbackError.message);
        
        return {
          state: 'error',
          message: 'Unable to display subscription options.\n\n' +
                   'Please ensure:\n' +
                   '1. Offering "ofrnge7bdc97106" is marked as "Current"\n' +
                   '2. A paywall is created and published\n' +
                   '3. Products are linked to the offering\n\n' +
                   'Error: ' + fallbackError.message
        };
      }
    }

    // Handle paywall result
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
        message: 'An error occurred while processing your purchase. Please try again.'
      };
    } else if (paywallResult === PAYWALL_RESULT.NOT_PRESENTED) {
      console.log('[RevenueCat] ⚠️ Paywall was not presented');
      return { 
        state: 'error',
        message: 'Paywall not configured.\n\n' +
                 'Please create and publish a paywall in RevenueCat dashboard.'
      };
    } else {
      console.log('[RevenueCat] ℹ️ Paywall closed without action');
      return { state: 'declined' };
    }

  } catch (error: any) {
    console.error('[RevenueCat] ❌ Paywall error:', error);

    let errorMessage = 'Unable to load subscription options.\n\n';
    
    const errorMsg = error.message || '';
    
    if (errorMsg.includes('No current offering') || errorMsg.includes('default offering')) {
      errorMessage += '🔧 SOLUTION:\n\n';
      errorMessage += '1. Go to RevenueCat dashboard\n';
      errorMessage += '2. Navigate to Offerings\n';
      errorMessage += '3. Find offering "ofrnge7bdc97106"\n';
      errorMessage += '4. Click "Make Current" or "Set as Default"\n';
      errorMessage += '5. Ensure a paywall is attached\n';
      errorMessage += '6. Verify products are linked';
    } else if (errorMsg.includes('paywall') || errorMsg.includes('configuration')) {
      errorMessage += 'Please ensure paywall is configured and published in RevenueCat dashboard.';
    } else if (errorMsg.includes('network')) {
      errorMessage += 'Please check your internet connection and try again.';
    } else if (errorMsg.includes('products') || errorMsg.includes('App Store')) {
      errorMessage += 'There is an issue with product configuration. Please contact support.';
    } else {
      errorMessage += 'Please try again later or contact support.\n\nError: ' + errorMsg;
    }

    return { 
      state: 'error',
      message: errorMessage
    };
  }
};

export const presentCustomerCenter = async (): Promise<void> => {
  try {
    console.log('[RevenueCat] 🏢 Presenting Customer Center...');
    
    if (!isPaymentSystemAvailable()) {
      throw new Error('Payment system is not initialized. Please restart the app.');
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

export const checkEntitlements = async (): Promise<boolean> => {
  try {
    if (!isPaymentSystemAvailable()) {
      return false;
    }

    const customerInfo = await Purchases.getCustomerInfo();
    const hasEntitlement = customerInfo.entitlements.active[PAYMENT_CONFIG.ENTITLEMENT_ID] !== undefined;
    
    return hasEntitlement;
  } catch (error: any) {
    console.error('[RevenueCat] ❌ Error checking entitlements:', error);
    return false;
  }
};

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

export const identifyUser = async (userId: string, email?: string): Promise<void> => {
  try {
    if (!isPaymentSystemAvailable()) {
      return;
    }

    await Purchases.logIn(userId);
    console.log('[RevenueCat] ✅ User identified:', userId);
    
    if (email) {
      await Purchases.setEmail(email);
      console.log('[RevenueCat] ✅ Email set:', email);
    }
  } catch (error: any) {
    console.error('[RevenueCat] ❌ Error identifying user:', error);
  }
};

export const logoutUser = async (): Promise<void> => {
  try {
    if (!isPaymentSystemAvailable()) {
      return;
    }

    await Purchases.logOut();
    console.log('[RevenueCat] ✅ User logged out');
  } catch (error: any) {
    console.error('[RevenueCat] ❌ Error logging out user:', error);
  }
};
