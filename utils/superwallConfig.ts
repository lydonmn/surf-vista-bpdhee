
import { Platform, Alert } from 'react-native';
import Purchases, { 
  CustomerInfo,
  PurchasesOffering,
  LOG_LEVEL
} from 'react-native-purchases';
import { supabase } from '@/app/integrations/supabase/client';
import RevenueCatUI, { PAYWALL_RESULT } from 'react-native-purchases-ui';

const REVENUECAT_API_KEY_IOS = 'appl_uyUNhkTURhBCqiVsRaBqBYbhIda';
const REVENUECAT_API_KEY_ANDROID = 'goog_YOUR_ANDROID_KEY_HERE';

export const PAYMENT_CONFIG = {
  PRODUCTS: {
    MONTHLY_SUBSCRIPTION: 'surfvista_Monthly',
    ANNUAL_SUBSCRIPTION: 'surfvista_Annual',
  },
  ENTITLEMENT_ID: 'SurfVista',
  OFFERING_ID: 'ofrngf25b3975f3',
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
let initializationPromise: Promise<boolean> | null = null;

export const initializeRevenueCat = async (): Promise<boolean> => {
  // If already initializing, return the existing promise
  if (initializationPromise) {
    console.log('[RevenueCat] ⏳ Initialization already in progress, waiting...');
    return initializationPromise;
  }

  // If already initialized, return immediately
  if (isPaymentSystemInitialized) {
    console.log('[RevenueCat] ✅ Already initialized');
    return true;
  }

  // 🚨 CRITICAL FIX: Wrap entire initialization in try-catch to prevent crashes
  initializationPromise = (async () => {
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
      
      // 🚨 CRITICAL FIX: Wrap SDK configuration in try-catch
      try {
        Purchases.setLogLevel(__DEV__ ? LOG_LEVEL.DEBUG : LOG_LEVEL.INFO);
        console.log('[RevenueCat] 🔑 Configuring with API key...');
        
        await Purchases.configure({ apiKey: REVENUECAT_API_KEY });
        console.log('[RevenueCat] ✅ SDK configured successfully');
        
        isPaymentSystemInitialized = true;
        
      } catch (configError: any) {
        initializationError = `SDK configuration failed: ${configError?.message}`;
        console.error('[RevenueCat] ❌ Configuration error:', configError);
        isPaymentSystemInitialized = false;
        return false;
      }
      
      // 🚨 CRITICAL FIX: Wrap offerings fetch in try-catch
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
          initializationError = 'No offerings configured in RevenueCat dashboard.';
          console.warn('[RevenueCat] ⚠️ NO OFFERINGS FOUND');
          return true;
        }
        
        if (currentOffering && currentOffering.availablePackages.length > 0) {
          console.log('[RevenueCat] ✅ Packages available:', currentOffering.availablePackages.length);
          initializationError = null;
        } else {
          console.warn('[RevenueCat] ⚠️ Offering has NO packages');
          initializationError = 'Products not linked to offering.';
        }
        
      } catch (offeringError: any) {
        initializationError = `Error fetching offerings: ${offeringError.message}`;
        console.warn('[RevenueCat] ⚠️ Error fetching offerings:', offeringError.message);
        // Don't fail - allow app to continue
      }
      
      console.log('[RevenueCat] ✅ Initialization complete');
      return true;
      
    } catch (error: any) {
      initializationError = error?.message || 'Unknown initialization error';
      console.error('[RevenueCat] ❌ Failed to initialize:', error);
      isPaymentSystemInitialized = false;
      return false;
    } finally {
      initializationPromise = null;
    }
  })();

  return initializationPromise;
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
  
  if (!isPaymentSystemInitialized) {
    console.log('[RevenueCat] ❌ SDK not initialized');
    return false;
  }
  
  if (currentOffering && currentOffering.availablePackages.length > 0) {
    console.log('[RevenueCat] ✅ Configuration looks good!');
    return true;
  } else {
    console.log('[RevenueCat] ⚠️ Configuration incomplete');
    return false;
  }
};

export const forceRefreshOfferings = async (): Promise<{ success: boolean; message: string }> => {
  try {
    console.log('[RevenueCat] 🔄 Force refreshing offerings...');
    
    if (Platform.OS === 'web') {
      return {
        success: false,
        message: 'RevenueCat is not available on web'
      };
    }
    
    if (!isPaymentSystemInitialized) {
      console.log('[RevenueCat] ⚠️ SDK not initialized, attempting to initialize...');
      const initialized = await initializeRevenueCat();
      
      if (!initialized) {
        return {
          success: false,
          message: 'Payment system not initialized. Please restart the app.'
        };
      }
    }
    
    const offerings = await Purchases.getOfferings();
    
    const offeringToUse = offerings.all[PAYMENT_CONFIG.OFFERING_ID] || offerings.current || null;
    
    if (!offeringToUse) {
      currentOffering = null;
      initializationError = 'No offerings configured in RevenueCat dashboard.';
      return {
        success: false,
        message: 'No offerings found.\n\nPlease set up products in App Store Connect and RevenueCat dashboard.'
      };
    }
    
    currentOffering = offeringToUse;
    
    if (offeringToUse.availablePackages.length > 0) {
      console.log('[RevenueCat] ✅ Packages found:', offeringToUse.availablePackages.length);
      initializationError = null;
      
      return {
        success: true,
        message: `✅ Found ${offeringToUse.availablePackages.length} product(s)!\n\nYou can now subscribe.`
      };
    } else {
      initializationError = 'Products not linked to offering.';
      
      return {
        success: false,
        message: 'Offering found but no products linked.\n\nPlease link products in RevenueCat dashboard.'
      };
    }
    
  } catch (error: any) {
    console.error('[RevenueCat] ❌ Error refreshing offerings:', error);
    
    return {
      success: false,
      message: 'Failed to refresh products. Please try again.'
    };
  }
};

export const presentPaywall = async (
  userId?: string,
  userEmail?: string
): Promise<{ state: 'purchased' | 'restored' | 'declined' | 'error' | 'not_configured'; message?: string }> => {
  try {
    console.log('[RevenueCat] 🎯 Presenting paywall...');
    
    if (Platform.OS === 'web') {
      return {
        state: 'error',
        message: '📱 Mobile App Required\n\nSubscriptions are only available in the iOS or Android app.'
      };
    }
    
    if (!isPaymentSystemInitialized) {
      console.log('[RevenueCat] ⚠️ SDK not initialized, attempting to initialize now...');
      const initialized = await initializeRevenueCat();
      
      if (!initialized) {
        console.error('[RevenueCat] ❌ Failed to initialize SDK');
        return {
          state: 'error',
          message: 'Payment system not initialized.\n\nPlease restart the app and try again.'
        };
      }
    }

    if (userId) {
      try {
        await Purchases.logIn(userId);
        console.log('[RevenueCat] ✅ User logged in:', userId);
      } catch (loginError) {
        console.error('[RevenueCat] ⚠️ Error logging in user:', loginError);
      }
    }

    if (userEmail) {
      try {
        await Purchases.setEmail(userEmail);
        console.log('[RevenueCat] ✅ Email set:', userEmail);
      } catch (emailError) {
        console.error('[RevenueCat] ⚠️ Error setting email:', emailError);
      }
    }

    console.log('[RevenueCat] 📦 Fetching latest offerings...');
    let offerings;
    
    try {
      offerings = await Purchases.getOfferings();
    } catch (fetchError: any) {
      console.error('[RevenueCat] ❌ Error fetching offerings:', fetchError);
      
      return {
        state: 'not_configured',
        message: 'Unable to load subscription options.\n\nPlease ensure products are configured in App Store Connect and RevenueCat.'
      };
    }
    
    const offeringToUse = offerings.all[PAYMENT_CONFIG.OFFERING_ID] || offerings.current;
    
    if (!offeringToUse) {
      console.error('[RevenueCat] ❌ No offering found');
      return {
        state: 'not_configured',
        message: 'No offerings found.\n\nPlease create an offering in RevenueCat dashboard.'
      };
    }

    if (offeringToUse.availablePackages.length === 0) {
      console.error('[RevenueCat] ❌ Offering has NO packages');
      
      return {
        state: 'not_configured',
        message: 'Products not linked to offering.\n\nPlease link products in RevenueCat dashboard.'
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
        message: '✅ Subscription activated successfully!'
      };
    } else if (paywallResult === PAYWALL_RESULT.RESTORED) {
      console.log('[RevenueCat] ✅ Restore successful');
      const customerInfo = await Purchases.getCustomerInfo();
      if (userId) {
        await updateSubscriptionInSupabase(userId, customerInfo);
      }
      return { 
        state: 'restored',
        message: '✅ Subscription restored successfully!'
      };
    } else if (paywallResult === PAYWALL_RESULT.CANCELLED) {
      console.log('[RevenueCat] ℹ️ User cancelled paywall');
      return { state: 'declined' };
    } else {
      console.log('[RevenueCat] ℹ️ Paywall closed without action');
      return { state: 'declined' };
    }

  } catch (error: any) {
    console.error('[RevenueCat] ❌ Paywall error:', error);
    
    return { 
      state: 'error',
      message: 'An error occurred. Please try again.'
    };
  }
};

export const presentCustomerCenter = async (): Promise<void> => {
  try {
    console.log('[RevenueCat] 🏢 Presenting Customer Center...');
    
    if (Platform.OS === 'web') {
      throw new Error('Customer Center is only available in the mobile app.');
    }
    
    if (!isPaymentSystemInitialized) {
      console.log('[RevenueCat] ⚠️ SDK not initialized, attempting to initialize...');
      await initializeRevenueCat();
      
      if (!isPaymentSystemInitialized) {
        throw new Error('Payment system is not initialized.');
      }
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

    if (Platform.OS === 'web') {
      return {
        success: false,
        message: 'Restore purchases is only available in the mobile app.'
      };
    }

    if (!isPaymentSystemInitialized) {
      console.log('[RevenueCat] ⚠️ SDK not initialized, attempting to initialize...');
      await initializeRevenueCat();
      
      if (!isPaymentSystemInitialized) {
        return {
          success: false,
          message: 'Payment system not initialized. Please restart the app.'
        };
      }
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
        message: '✅ Subscription restored successfully!'
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
      message: 'Failed to restore purchases. Please try again.'
    };
  }
};

export const getCustomerInfo = async (): Promise<CustomerInfo | null> => {
  try {
    if (!isPaymentSystemInitialized) {
      console.log('[RevenueCat] ⚠️ SDK not initialized for getCustomerInfo');
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
    if (!isPaymentSystemInitialized) {
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

export const checkSubscriptionStatus = async (userId: string): Promise<{
  isActive: boolean;
  endDate: string | null;
}> => {
  try {
    if (!isPaymentSystemInitialized) {
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
  } catch (error) {
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
  } catch (error) {
    console.error('[RevenueCat] ❌ Exception checking Supabase subscription:', error);
    return { isActive: false, endDate: null };
  }
};

export const identifyUser = async (userId: string, email?: string): Promise<void> => {
  try {
    console.log('[RevenueCat] Identifying user:', userId);
    
    if (!isPaymentSystemInitialized) {
      console.log('[RevenueCat] Payment system not available for user identification');
      return;
    }

    try {
      await Purchases.logIn(userId);
      console.log('[RevenueCat] ✅ User identified:', userId);
    } catch (loginError) {
      console.error('[RevenueCat] ⚠️ Error logging in user:', loginError);
    }
    
    if (email) {
      try {
        await Purchases.setEmail(email);
        console.log('[RevenueCat] ✅ Email set:', email);
      } catch (emailError) {
        console.error('[RevenueCat] ⚠️ Error setting email:', emailError);
      }
    }
  } catch (error) {
    console.error('[RevenueCat] ❌ Error identifying user:', error);
  }
};

export const logoutUser = async (): Promise<void> => {
  try {
    console.log('[RevenueCat] Logging out user...');
    
    if (!isPaymentSystemInitialized) {
      console.log('[RevenueCat] Payment system not available for logout');
      return;
    }

    try {
      await Purchases.logOut();
      console.log('[RevenueCat] ✅ User logged out');
    } catch (logoutError) {
      console.error('[RevenueCat] ⚠️ Error logging out user:', logoutError);
    }
  } catch (error) {
    console.error('[RevenueCat] ❌ Error in logout process:', error);
  }
};

export function isPaymentSystemAvailableInternal(): boolean {
  return isPaymentSystemAvailable();
}

export function getInitializationErrorInternal(): string | null {
  return getInitializationError();
}
