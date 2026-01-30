
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
const REVENUECAT_API_KEY = Platform.OS === 'ios' ? REVENUECAT_API_KEY_IOS : REVENUECAT_API_KEY_ANDROID;

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
    console.log('[RevenueCat] Initializing SDK...');
    
    if (Platform.OS === 'ios' && !REVENUECAT_API_KEY.startsWith('appl_')) {
      console.error('[RevenueCat] Invalid iOS API key format');
      return false;
    }
    
    if (Platform.OS === 'android' && !REVENUECAT_API_KEY.startsWith('goog_')) {
      console.error('[RevenueCat] Invalid Android API key format');
      return false;
    }
    
    if (REVENUECAT_API_KEY.includes('YOUR_') || REVENUECAT_API_KEY.includes('_HERE')) {
      console.error('[RevenueCat] Placeholder API key detected');
      return false;
    }
    
    Purchases.setLogLevel(__DEV__ ? LOG_LEVEL.DEBUG : LOG_LEVEL.INFO);
    await Purchases.configure({ apiKey: REVENUECAT_API_KEY });
    
    console.log('[RevenueCat] SDK initialized successfully');
    
    try {
      const offerings = await Purchases.getOfferings();
      
      console.log('[RevenueCat] 🔍 Offerings Debug:');
      console.log('[RevenueCat] - Current offering:', offerings.current?.identifier || 'NONE');
      console.log('[RevenueCat] - All offerings:', Object.keys(offerings.all));
      
      for (const offeringId of PAYMENT_CONFIG.OFFERING_IDS) {
        if (offerings.all[offeringId]) {
          currentOffering = offerings.all[offeringId];
          console.log('[RevenueCat] ✅ Using offering:', offeringId);
          console.log('[RevenueCat] - Packages:', currentOffering.availablePackages.length);
          break;
        }
      }
      
      if (!currentOffering && offerings.current) {
        currentOffering = offerings.current;
        console.log('[RevenueCat] ✅ Using current offering:', offerings.current.identifier);
        console.log('[RevenueCat] - Packages:', currentOffering.availablePackages.length);
      }
      
      if (!currentOffering) {
        console.error('[RevenueCat] ❌ NO OFFERING FOUND!');
        console.error('[RevenueCat] 💡 SOLUTION: In RevenueCat dashboard, mark offering "ofrnge7bdc97106" as "Current"');
      }
    } catch (offeringError) {
      console.error('[RevenueCat] Error fetching offerings:', offeringError);
    }
    
    isPaymentSystemInitialized = true;
    return true;
  } catch (error: any) {
    console.error('[RevenueCat] Failed to initialize:', error);
    isPaymentSystemInitialized = false;
    return false;
  }
};

export const initializePaymentSystem = initializeRevenueCat;

export const isPaymentSystemAvailable = (): boolean => {
  return isPaymentSystemInitialized;
};

export const checkPaymentConfiguration = (): boolean => {
  console.log('[RevenueCat] Configuration Check:');
  console.log('[RevenueCat] - Initialized:', isPaymentSystemInitialized);
  console.log('[RevenueCat] - Platform:', Platform.OS);
  console.log('[RevenueCat] - Current Offering:', currentOffering?.identifier || 'None');
  
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

    if (userId) {
      try {
        await Purchases.logIn(userId);
        console.log('[RevenueCat] ✅ User logged in:', userId);
      } catch (loginError) {
        console.error('[RevenueCat] Error logging in user:', loginError);
      }
    }

    if (userEmail) {
      try {
        await Purchases.setEmail(userEmail);
        console.log('[RevenueCat] ✅ Email set:', userEmail);
      } catch (emailError) {
        console.error('[RevenueCat] Error setting email:', emailError);
      }
    }

    const offerings = await Purchases.getOfferings();
    
    console.log('[RevenueCat] 🔍 Offerings check:');
    console.log('[RevenueCat] - Current:', offerings.current?.identifier || 'NONE');
    console.log('[RevenueCat] - All:', Object.keys(offerings.all));
    
    if (!offerings.current && Object.keys(offerings.all).length === 0) {
      console.error('[RevenueCat] ❌ No offerings available');
      console.error('[RevenueCat] 💡 SOLUTION: Create and publish an offering in RevenueCat dashboard');
      return {
        state: 'error',
        message: 'No subscription options available.\n\nPlease configure offerings in RevenueCat dashboard.'
      };
    }

    let offeringToUse: PurchasesOffering | null = null;
    
    for (const offeringId of PAYMENT_CONFIG.OFFERING_IDS) {
      if (offerings.all[offeringId]) {
        offeringToUse = offerings.all[offeringId];
        console.log('[RevenueCat] ✅ Found offering:', offeringId);
        break;
      }
    }
    
    if (!offeringToUse && offerings.current) {
      offeringToUse = offerings.current;
      console.log('[RevenueCat] ✅ Using current offering:', offerings.current.identifier);
    }
    
    if (!offeringToUse && Object.keys(offerings.all).length > 0) {
      const firstOfferingKey = Object.keys(offerings.all)[0];
      offeringToUse = offerings.all[firstOfferingKey];
      console.log('[RevenueCat] ⚠️ Using first available offering:', firstOfferingKey);
    }

    if (!offeringToUse) {
      console.error('[RevenueCat] ❌ No offering found');
      console.error('[RevenueCat] 💡 SOLUTION: Mark offering "ofrnge7bdc97106" as "Current" in RevenueCat dashboard');
      return {
        state: 'error',
        message: 'Unable to load subscription options.\n\nPlease configure a default offering in your RevenueCat dashboard.\n\nSteps:\n1. Go to RevenueCat dashboard\n2. Click on Offerings\n3. Find offering "ofrnge7bdc97106"\n4. Click "Make Current"'
      };
    }

    console.log('[RevenueCat] 📦 Offering packages:', offeringToUse.availablePackages.length);
    
    if (offeringToUse.availablePackages.length === 0) {
      console.error('[RevenueCat] ❌ No packages in offering');
      console.error('[RevenueCat] 💡 SOLUTION: Add products to offering in RevenueCat dashboard');
      return {
        state: 'error',
        message: 'No subscription plans available.\n\nPlease add products to your offering in RevenueCat dashboard.'
      };
    }

    let paywallResult: PAYWALL_RESULT;
    
    try {
      console.log('[RevenueCat] 🎨 Attempting to present paywall...');
      paywallResult = await RevenueCatUI.presentPaywall();
      console.log('[RevenueCat] ✅ Paywall presented successfully');
    } catch (defaultError: any) {
      console.error('[RevenueCat] ❌ Error presenting default paywall:', defaultError.message);
      
      try {
        console.log('[RevenueCat] 🔄 Trying with explicit offering...');
        paywallResult = await RevenueCatUI.presentPaywall({
          offering: offeringToUse
        });
        console.log('[RevenueCat] ✅ Paywall presented with explicit offering');
      } catch (fallbackError: any) {
        console.error('[RevenueCat] ❌ Fallback also failed:', fallbackError.message);
        console.error('[RevenueCat] 💡 SOLUTION: Ensure paywall is created and published in RevenueCat dashboard');
        
        return {
          state: 'error',
          message: 'Unable to display subscription options.\n\nPlease ensure:\n1. Offering "ofrnge7bdc97106" is marked as "Current"\n2. A paywall is created and published\n3. Products are linked to the offering\n\nError: ' + fallbackError.message
        };
      }
    }

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
      console.error('[RevenueCat] 💡 SOLUTION: Create and publish a paywall in RevenueCat dashboard');
      return { 
        state: 'error',
        message: 'Paywall not configured.\n\nPlease create and publish a paywall in RevenueCat dashboard.'
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
    console.log('[RevenueCat] Presenting Customer Center...');
    
    if (!isPaymentSystemAvailable()) {
      throw new Error('Payment system is not initialized. Please restart the app.');
    }

    await RevenueCatUI.presentCustomerCenter();
    
    console.log('[RevenueCat] Customer Center closed');
    
    const customerInfo = await Purchases.getCustomerInfo();
    
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await updateSubscriptionInSupabase(user.id, customerInfo);
    }
    
  } catch (error: any) {
    console.error('[RevenueCat] Customer Center error:', error);
    
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
    console.log('[RevenueCat] Restoring purchases...');

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
    console.error('[RevenueCat] Restore error:', error);
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
    console.error('[RevenueCat] Error getting customer info:', error);
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
    console.error('[RevenueCat] Error checking entitlements:', error);
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
    console.error('[RevenueCat] Error checking subscription:', error);
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
      console.error('[RevenueCat] Error updating Supabase:', error);
    }
  } catch (error: any) {
    console.error('[RevenueCat] Exception updating Supabase:', error);
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
    console.error('[RevenueCat] Exception checking Supabase subscription:', error);
    return { isActive: false, endDate: null };
  }
};

export const identifyUser = async (userId: string, email?: string): Promise<void> => {
  try {
    if (!isPaymentSystemAvailable()) {
      return;
    }

    await Purchases.logIn(userId);
    
    if (email) {
      await Purchases.setEmail(email);
    }
  } catch (error: any) {
    console.error('[RevenueCat] Error identifying user:', error);
  }
};

export const logoutUser = async (): Promise<void> => {
  try {
    if (!isPaymentSystemAvailable()) {
      return;
    }

    await Purchases.logOut();
  } catch (error: any) {
    console.error('[RevenueCat] Error logging out user:', error);
  }
};
