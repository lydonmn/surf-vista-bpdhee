
import Purchases, { 
  CustomerInfo,
  PurchasesOffering,
  LOG_LEVEL
} from 'react-native-purchases';
import RevenueCatUI, { PAYWALL_RESULT } from 'react-native-purchases-ui';
import { Platform, Alert } from 'react-native';
import { supabase } from '@/app/integrations/supabase/client';

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
      
      isPaymentSystemInitialized = true;
      
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
      console.log('[RevenueCat]    - All offering IDs:', Object.keys(offerings.all).join(', '));
      
      if (offerings.all[PAYMENT_CONFIG.OFFERING_ID]) {
        currentOffering = offerings.all[PAYMENT_CONFIG.OFFERING_ID];
        console.log('[RevenueCat] ✅ Using configured offering:', PAYMENT_CONFIG.OFFERING_ID);
      } else if (offerings.current) {
        currentOffering = offerings.current;
        console.log('[RevenueCat] ⚠️ Using current offering:', offerings.current.identifier);
        console.log('[RevenueCat] ⚠️ Configured offering not found:', PAYMENT_CONFIG.OFFERING_ID);
      } else {
        initializationError = 'No offerings configured in RevenueCat dashboard.';
        console.warn('[RevenueCat] ⚠️ NO OFFERINGS FOUND');
        console.warn('[RevenueCat] ⚠️ This is expected if you haven\'t set up products yet');
        return true;
      }
      
      if (currentOffering && currentOffering.availablePackages.length > 0) {
        console.log('[RevenueCat] ✅ Packages available:', currentOffering.availablePackages.length);
        currentOffering.availablePackages.forEach((pkg, index) => {
          console.log(`[RevenueCat]    ${index + 1}. ${pkg.identifier} - ${pkg.product.identifier} - ${pkg.product.priceString}`);
        });
        initializationError = null;
      } else {
        console.warn('[RevenueCat] ⚠️ Offering has NO packages');
        console.warn('[RevenueCat] ⚠️ This means products are not linked to the offering in RevenueCat dashboard');
        initializationError = 'Products not linked to offering. Please configure in RevenueCat dashboard.';
      }
      
    } catch (offeringError: any) {
      initializationError = `Error fetching offerings: ${offeringError.message}`;
      console.warn('[RevenueCat] ⚠️ Error fetching offerings:', offeringError.message);
      console.warn('[RevenueCat] ⚠️ This is expected if products aren\'t set up in App Store Connect yet');
      console.warn('[RevenueCat] ⚠️ The app will continue to work, but subscriptions won\'t be available');
    }
    
    console.log('[RevenueCat] ✅ Initialization complete (SDK ready, offerings may be pending)');
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
      return {
        success: false,
        message: 'Payment system not initialized. Please restart the app.'
      };
    }
    
    const offerings = await Purchases.getOfferings();
    
    console.log('[RevenueCat] 📊 Refreshed offerings:');
    console.log('[RevenueCat]    - Current offering:', offerings.current?.identifier || 'NONE');
    console.log('[RevenueCat]    - All offerings:', Object.keys(offerings.all).length);
    console.log('[RevenueCat]    - All offering IDs:', Object.keys(offerings.all).join(', '));
    
    const offeringToUse = offerings.all[PAYMENT_CONFIG.OFFERING_ID] || offerings.current;
    
    if (!offeringToUse) {
      currentOffering = null;
      console.warn('[RevenueCat] ⚠️ No offerings found after refresh');
      initializationError = 'No offerings configured in RevenueCat dashboard.';
      return {
        success: false,
        message: 'No offerings found.\n\nPlease set up products in:\n1. App Store Connect\n2. RevenueCat dashboard\n\nSee console logs for details.'
      };
    }
    
    currentOffering = offeringToUse;
    
    if (offeringToUse.availablePackages.length > 0) {
      console.log('[RevenueCat] ✅ Packages found:', offeringToUse.availablePackages.length);
      offeringToUse.availablePackages.forEach((pkg, index) => {
        console.log(`[RevenueCat]    ${index + 1}. ${pkg.identifier} - ${pkg.product.identifier} - ${pkg.product.priceString}`);
      });
      
      initializationError = null;
      
      return {
        success: true,
        message: `✅ Found ${offeringToUse.availablePackages.length} product(s)!\n\nYou can now subscribe.`
      };
    } else {
      console.warn('[RevenueCat] ⚠️ Offering has NO packages after refresh');
      initializationError = 'Products not linked to offering.';
      
      return {
        success: false,
        message: 'Offering found but no products linked.\n\nTo fix:\n1. Go to app.revenuecat.com\n2. Products tab → Add products\n3. Offerings tab → Link products\n4. Wait 5-10 minutes\n5. Try "Refresh Products" again'
      };
    }
    
  } catch (error: any) {
    console.error('[RevenueCat] ❌ Error refreshing offerings:', error);
    
    let userMessage = 'Failed to refresh products.';
    
    if (error.message?.includes('configuration')) {
      userMessage = 'Configuration error.\n\nPlease check:\n• Products exist in App Store Connect\n• Products are "Ready to Submit"\n• Product IDs match exactly';
    } else if (error.message?.includes('network') || error.message?.includes('connection')) {
      userMessage = 'Network error.\n\nPlease check your internet connection and try again.';
    } else if (error.message?.includes('fetch')) {
      userMessage = 'Cannot fetch products from App Store Connect.\n\nThis usually means:\n• Products not approved yet\n• Products not linked in RevenueCat\n• App Store Connect sync delay';
    }
    
    return {
      success: false,
      message: userMessage + '\n\nError: ' + error.message
    };
  }
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
    console.log('[RevenueCat] ');
    console.log('[RevenueCat] 📦 Available Products:');
    currentOffering.availablePackages.forEach((pkg, index) => {
      console.log(`[RevenueCat]    ${index + 1}. ${pkg.identifier}`);
      console.log(`[RevenueCat]       Product ID: ${pkg.product.identifier}`);
      console.log(`[RevenueCat]       Price: ${pkg.product.priceString}`);
      console.log(`[RevenueCat]       Title: ${pkg.product.title}`);
    });
    console.log('[RevenueCat] ');
    return true;
  } else {
    console.log('[RevenueCat] ⚠️ ===== CONFIGURATION INCOMPLETE =====');
    console.log('[RevenueCat] ');
    console.log('[RevenueCat] 🚨 SUBSCRIPTIONS NOT AVAILABLE BECAUSE:');
    console.log('[RevenueCat] ');
    
    if (!currentOffering) {
      console.log('[RevenueCat] ❌ No offering found');
      console.log('[RevenueCat]    → Expected offering ID:', PAYMENT_CONFIG.OFFERING_ID);
      console.log('[RevenueCat] ');
      console.log('[RevenueCat] 📋 TO FIX:');
      console.log('[RevenueCat]    1. Go to app.revenuecat.com');
      console.log('[RevenueCat]    2. Select SurfVista project');
      console.log('[RevenueCat]    3. Go to Offerings tab');
      console.log('[RevenueCat]    4. Create offering with ID:', PAYMENT_CONFIG.OFFERING_ID);
    } else if (currentOffering.availablePackages.length === 0) {
      console.log('[RevenueCat] ❌ Offering exists but has NO PACKAGES (products)');
      console.log('[RevenueCat]    → Offering ID:', currentOffering.identifier);
      console.log('[RevenueCat] ');
      console.log('[RevenueCat] 📋 STEP-BY-STEP FIX:');
      console.log('[RevenueCat] ');
      console.log('[RevenueCat] 1️⃣ CREATE PRODUCTS IN APP STORE CONNECT:');
      console.log('[RevenueCat]    → Go to appstoreconnect.apple.com');
      console.log('[RevenueCat]    → Select SurfVista app');
      console.log('[RevenueCat]    → Monetization > Subscriptions');
      console.log('[RevenueCat]    → Create these products (EXACT names):');
      console.log('[RevenueCat]       • surfvista_Monthly');
      console.log('[RevenueCat]       • surfvista_Annual');
      console.log('[RevenueCat]    → Set status to "Ready to Submit"');
      console.log('[RevenueCat] ');
      console.log('[RevenueCat] 2️⃣ ADD PRODUCTS TO REVENUECAT:');
      console.log('[RevenueCat]    → Go to app.revenuecat.com');
      console.log('[RevenueCat]    → Select SurfVista project');
      console.log('[RevenueCat]    → Products tab → "Add Product"');
      console.log('[RevenueCat]    → Enter: surfvista_Monthly');
      console.log('[RevenueCat]    → Repeat for: surfvista_Annual');
      console.log('[RevenueCat] ');
      console.log('[RevenueCat] 3️⃣ LINK PRODUCTS TO OFFERING:');
      console.log('[RevenueCat]    → Offerings tab');
      console.log('[RevenueCat]    → Edit offering:', PAYMENT_CONFIG.OFFERING_ID);
      console.log('[RevenueCat]    → Add both products');
      console.log('[RevenueCat]    → Save changes');
      console.log('[RevenueCat] ');
      console.log('[RevenueCat] 4️⃣ WAIT AND TEST:');
      console.log('[RevenueCat]    → Wait 5-10 minutes for sync');
      console.log('[RevenueCat]    → Restart the app');
      console.log('[RevenueCat]    → Tap "Refresh Products" in profile');
      console.log('[RevenueCat] ');
      console.log('[RevenueCat] 📚 More info: https://rev.cat/why-are-offerings-empty');
    }
    
    console.log('[RevenueCat] ===== END CONFIGURATION CHECK =====');
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
    
    if (!isPaymentSystemAvailable()) {
      console.log('[RevenueCat] ❌ Payment system not initialized');
      return {
        state: 'error',
        message: 'Payment system not initialized.\n\nPlease restart the app and try again.'
      };
    }

    if (userId) {
      try {
        await Purchases.logIn(userId);
        console.log('[RevenueCat] ✅ User logged in:', userId);
      } catch {
        console.error('[RevenueCat] ⚠️ Error logging in user');
      }
    }

    if (userEmail) {
      try {
        await Purchases.setEmail(userEmail);
        console.log('[RevenueCat] ✅ Email set:', userEmail);
      } catch {
        console.error('[RevenueCat] ⚠️ Error setting email');
      }
    }

    console.log('[RevenueCat] 📦 Fetching latest offerings...');
    let offerings;
    
    try {
      offerings = await Purchases.getOfferings();
    } catch (fetchError: any) {
      console.error('[RevenueCat] ❌ Error fetching offerings:', fetchError);
      
      let errorMessage = 'Unable to load subscription options.';
      
      if (fetchError.message?.includes('configuration')) {
        errorMessage = '⚠️ Configuration Error\n\nProducts are not properly configured.\n\nPlease ensure:\n• Products exist in App Store Connect\n• Products are "Ready to Submit"\n• Products are linked in RevenueCat';
      } else if (fetchError.message?.includes('network')) {
        errorMessage = '⚠️ Network Error\n\nPlease check your internet connection and try again.';
      } else {
        errorMessage = '⚠️ Setup Required\n\n' + fetchError.message + '\n\nPlease complete the setup in:\n1. App Store Connect\n2. RevenueCat dashboard';
      }
      
      checkPaymentConfiguration();
      
      return {
        state: 'not_configured',
        message: errorMessage
      };
    }
    
    console.log('[RevenueCat] 📊 Latest offerings fetched:');
    console.log('[RevenueCat]    - Current offering:', offerings.current?.identifier || 'NONE');
    console.log('[RevenueCat]    - All offerings:', Object.keys(offerings.all).length);

    const offeringToUse = offerings.all[PAYMENT_CONFIG.OFFERING_ID] || offerings.current;
    
    if (!offeringToUse) {
      console.error('[RevenueCat] ❌ No offering found');
      checkPaymentConfiguration();
      return {
        state: 'not_configured',
        message: '⚠️ No Offerings Found\n\nPlease create an offering in RevenueCat dashboard:\n\n1. Go to app.revenuecat.com\n2. Offerings tab\n3. Create offering: ' + PAYMENT_CONFIG.OFFERING_ID
      };
    }
    
    console.log('[RevenueCat] 📋 Using offering:', offeringToUse.identifier);
    console.log('[RevenueCat] 📋 Available packages:', offeringToUse.availablePackages.length);

    if (offeringToUse.availablePackages.length === 0) {
      console.error('[RevenueCat] ❌ Offering has NO packages');
      checkPaymentConfiguration();
      
      return {
        state: 'not_configured',
        message: '⚠️ Products Not Linked\n\n' +
          'The offering exists but has no products.\n\n' +
          'To fix:\n\n' +
          '1. Create products in App Store Connect:\n' +
          '   • surfvista_Monthly\n' +
          '   • surfvista_Annual\n\n' +
          '2. Add products to RevenueCat:\n' +
          '   • app.revenuecat.com\n' +
          '   • Products tab\n\n' +
          '3. Link to offering:\n' +
          '   • Offerings tab\n' +
          '   • Edit: ' + offeringToUse.identifier + '\n\n' +
          '4. Wait 5-10 minutes\n\n' +
          '5. Tap "Refresh Products"'
      };
    }

    console.log('[RevenueCat] 🎨 Presenting paywall UI...');
    console.log('[RevenueCat] 📦 Products in paywall:');
    offeringToUse.availablePackages.forEach((pkg, index) => {
      console.log(`[RevenueCat]    ${index + 1}. ${pkg.identifier} - ${pkg.product.identifier} - ${pkg.product.priceString}`);
    });
    
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
    } else if (paywallResult === PAYWALL_RESULT.ERROR) {
      console.error('[RevenueCat] ❌ Paywall error');
      return { 
        state: 'error',
        message: 'An error occurred. Please try again.'
      };
    } else if (paywallResult === PAYWALL_RESULT.NOT_PRESENTED) {
      console.log('[RevenueCat] ⚠️ Paywall was not presented');
      return { 
        state: 'not_configured',
        message: 'Paywall not configured.\n\nPlease create a paywall in RevenueCat dashboard.'
      };
    } else {
      console.log('[RevenueCat] ℹ️ Paywall closed without action');
      return { state: 'declined' };
    }

  } catch (error: any) {
    console.error('[RevenueCat] ❌ Paywall error:', error);
    console.error('[RevenueCat] ❌ Error details:', JSON.stringify(error, null, 2));
    
    let errorMessage = 'Unable to load subscription options.';
    
    if (error.message?.includes('configuration')) {
      errorMessage = '⚠️ Configuration Error\n\n' + error.message;
    } else if (error.message?.includes('network')) {
      errorMessage = '⚠️ Network Error\n\nPlease check your internet connection.';
    } else {
      errorMessage = error.message || 'An unexpected error occurred.';
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
      return {
        success: false,
        message: 'Payment system not initialized. Please restart the app.'
      };
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
        message: 'No previous purchases found.\n\nIf you believe this is an error, please contact support.'
      };
    }

  } catch (error: any) {
    console.error('[RevenueCat] ❌ Restore error:', error);
    return {
      success: false,
      message: error.message || 'Failed to restore purchases. Please try again.'
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
  } catch {
    console.error('[RevenueCat] ❌ Exception updating Supabase');
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
  } catch {
    console.error('[RevenueCat] ❌ Exception checking Supabase subscription');
    return { isActive: false, endDate: null };
  }
};

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
    } catch {
      console.error('[RevenueCat] ⚠️ Error logging in user');
    }
    
    if (email) {
      try {
        await Purchases.setEmail(email);
        console.log('[RevenueCat] ✅ Email set:', email);
      } catch {
        console.error('[RevenueCat] ⚠️ Error setting email');
      }
    }
  } catch {
    console.error('[RevenueCat] ❌ Error identifying user');
  }
};

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
    } catch {
      console.error('[RevenueCat] ⚠️ Error logging out user');
    }
  } catch {
    console.error('[RevenueCat] ❌ Error in logout process');
  }
};
