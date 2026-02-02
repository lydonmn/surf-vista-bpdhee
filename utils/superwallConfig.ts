
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
// 🔧 CONFIGURATION - UPDATE THESE VALUES
// ═══════════════════════════════════════════════════════════════════════════

// Production API Keys from RevenueCat Dashboard
const REVENUECAT_API_KEY_IOS = 'appl_uyUNhkTURhBCqiVsRaBqBYbhIda';
const REVENUECAT_API_KEY_ANDROID = 'goog_YOUR_ANDROID_PRODUCTION_KEY_HERE';

// Product Configuration
// ⚠️ CRITICAL: These product IDs MUST match EXACTLY in:
// 1. App Store Connect (iOS) or Google Play Console (Android)
// 2. RevenueCat Dashboard > Products
// 3. This configuration file
export const PAYMENT_CONFIG = {
  PRODUCTS: {
    // 🔴 IMPORTANT: Update these to match your App Store Connect product IDs
    MONTHLY_SUBSCRIPTION: 'surfvista_monthly',  // Must match App Store Connect
    ANNUAL_SUBSCRIPTION: 'surfvista_annual',    // Must match App Store Connect
  },
  // Offering ID from RevenueCat Dashboard
  OFFERING_IDS: ['ofrnge7bdc97106', 'default'],
  // Entitlement identifier from RevenueCat Dashboard
  ENTITLEMENT_ID: 'premium',
  PRICING: {
    MONTHLY: '$10.99',
    ANNUAL: '$99.99',
  },
};

// ═══════════════════════════════════════════════════════════════════════════
// 🚨 TROUBLESHOOTING GUIDE
// ═══════════════════════════════════════════════════════════════════════════
//
// ERROR: "None of the products could be fetched from App Store Connect"
//
// SOLUTION:
// 1. **Check App Store Connect:**
//    - Go to https://appstoreconnect.apple.com
//    - Select your app
//    - Go to "In-App Purchases" or "Subscriptions"
//    - Verify product IDs match EXACTLY (case-sensitive):
//      * surfvista_monthly
//      * surfvista_annual
//    - Ensure products are in "Ready to Submit" or "Approved" status
//
// 2. **Check RevenueCat Dashboard:**
//    - Go to https://app.revenuecat.com
//    - Navigate to "Products"
//    - Click "Add Product" if products don't exist
//    - Enter the EXACT product IDs from App Store Connect
//    - Select the correct app (iOS or Android)
//    - Save the products
//
// 3. **Link Products to Offering:**
//    - In RevenueCat Dashboard, go to "Offerings"
//    - Find offering "ofrnge7bdc97106" (or create it)
//    - Click "Edit"
//    - Add both products to the offering
//    - Click "Make Current" to set as default
//    - Save changes
//
// 4. **Create and Publish Paywall:**
//    - In RevenueCat Dashboard, go to "Paywalls"
//    - Create a new paywall or select existing
//    - Link it to your offering
//    - Publish the paywall
//
// 5. **Wait for Sync:**
//    - After making changes, wait 5-10 minutes
//    - RevenueCat needs time to sync with App Store Connect
//    - Restart your app to fetch latest configuration
//
// 6. **Test with Sandbox:**
//    - Use a sandbox test account in iOS Settings
//    - Ensure you're testing with a device, not simulator
//    - Check that products appear in the paywall
//
// ═══════════════════════════════════════════════════════════════════════════

let isPaymentSystemInitialized = false;
let currentOffering: PurchasesOffering | null = null;
let initializationError: string | null = null;

export const initializeRevenueCat = async (): Promise<boolean> => {
  try {
    console.log('[RevenueCat] 🚀 Initializing SDK...');
    console.log('[RevenueCat] Platform:', Platform.OS);
    console.log('[RevenueCat] Environment:', __DEV__ ? 'Development' : 'Production');
    
    // Get the API key for the current platform
    const REVENUECAT_API_KEY = Platform.OS === 'ios' ? REVENUECAT_API_KEY_IOS : REVENUECAT_API_KEY_ANDROID;
    
    // Validate API key for current platform
    if (Platform.OS === 'ios') {
      if (!REVENUECAT_API_KEY.startsWith('appl_')) {
        initializationError = 'Invalid iOS API key format';
        console.error('[RevenueCat] ❌', initializationError);
        return false;
      }
      if (REVENUECAT_API_KEY.includes('YOUR_') || REVENUECAT_API_KEY.includes('_HERE')) {
        initializationError = 'iOS API key is a placeholder';
        console.error('[RevenueCat] ❌', initializationError);
        return false;
      }
    } else if (Platform.OS === 'android') {
      if (!REVENUECAT_API_KEY.startsWith('goog_')) {
        initializationError = 'Invalid Android API key format';
        console.error('[RevenueCat] ❌', initializationError);
        return false;
      }
      if (REVENUECAT_API_KEY.includes('YOUR_') || REVENUECAT_API_KEY.includes('_HERE')) {
        initializationError = 'Android API key is a placeholder. Please add your Android API key to utils/superwallConfig.ts';
        console.error('[RevenueCat] ❌', initializationError);
        return false;
      }
    }
    
    // Configure RevenueCat with detailed logging
    Purchases.setLogLevel(__DEV__ ? LOG_LEVEL.DEBUG : LOG_LEVEL.INFO);
    await Purchases.configure({ apiKey: REVENUECAT_API_KEY });
    
    console.log('[RevenueCat] ✅ SDK configured successfully');
    console.log('[RevenueCat] 📋 Configuration:');
    console.log('[RevenueCat]    - Product IDs:', Object.values(PAYMENT_CONFIG.PRODUCTS));
    console.log('[RevenueCat]    - Offering IDs:', PAYMENT_CONFIG.OFFERING_IDS);
    console.log('[RevenueCat]    - Entitlement:', PAYMENT_CONFIG.ENTITLEMENT_ID);
    
    // Fetch offerings with detailed error handling
    try {
      console.log('[RevenueCat] 📦 Fetching offerings from RevenueCat...');
      const offerings = await Purchases.getOfferings();
      
      console.log('[RevenueCat] 🔍 Offerings Response:');
      console.log('[RevenueCat]    - Current offering:', offerings.current?.identifier || 'NONE');
      console.log('[RevenueCat]    - All offerings:', Object.keys(offerings.all).length);
      console.log('[RevenueCat]    - Offering IDs:', Object.keys(offerings.all));
      
      // Try to find the offering in order of preference
      for (const offeringId of PAYMENT_CONFIG.OFFERING_IDS) {
        if (offerings.all[offeringId]) {
          currentOffering = offerings.all[offeringId];
          console.log('[RevenueCat] ✅ Found offering:', offeringId);
          console.log('[RevenueCat]    - Packages:', currentOffering.availablePackages.length);
          
          if (currentOffering.availablePackages.length > 0) {
            console.log('[RevenueCat]    - Package details:');
            currentOffering.availablePackages.forEach((pkg, index) => {
              console.log(`[RevenueCat]      ${index + 1}. ${pkg.identifier}`);
              console.log(`[RevenueCat]         Product: ${pkg.product.identifier}`);
              console.log(`[RevenueCat]         Price: ${pkg.product.priceString}`);
            });
          } else {
            console.warn('[RevenueCat] ⚠️ Offering has NO packages!');
            console.warn('[RevenueCat] 💡 Add products to this offering in RevenueCat dashboard');
          }
          break;
        }
      }
      
      // If no specific offering found, use current
      if (!currentOffering && offerings.current) {
        currentOffering = offerings.current;
        console.log('[RevenueCat] ✅ Using current offering:', offerings.current.identifier);
        console.log('[RevenueCat]    - Packages:', currentOffering.availablePackages.length);
        
        if (currentOffering.availablePackages.length > 0) {
          console.log('[RevenueCat]    - Package details:');
          currentOffering.availablePackages.forEach((pkg, index) => {
            console.log(`[RevenueCat]      ${index + 1}. ${pkg.identifier}`);
            console.log(`[RevenueCat]         Product: ${pkg.product.identifier}`);
            console.log(`[RevenueCat]         Price: ${pkg.product.priceString}`);
          });
        }
      }
      
      // If still no offering, use first available
      if (!currentOffering && Object.keys(offerings.all).length > 0) {
        const firstKey = Object.keys(offerings.all)[0];
        currentOffering = offerings.all[firstKey];
        console.log('[RevenueCat] ⚠️ Using first available offering:', firstKey);
        console.log('[RevenueCat]    - Packages:', currentOffering.availablePackages.length);
      }
      
      // Final check
      if (!currentOffering) {
        initializationError = 'No offering found in RevenueCat dashboard';
        console.error('[RevenueCat] ❌ NO OFFERING FOUND!');
        console.error('[RevenueCat]');
        console.error('[RevenueCat] 🔧 SOLUTION:');
        console.error('[RevenueCat]    1. Go to https://app.revenuecat.com');
        console.error('[RevenueCat]    2. Navigate to "Offerings"');
        console.error('[RevenueCat]    3. Create an offering or mark one as "Current"');
        console.error('[RevenueCat]    4. Add products to the offering');
        console.error('[RevenueCat]    5. Create and publish a paywall');
        console.error('[RevenueCat]    6. Wait 5-10 minutes for sync');
        console.error('[RevenueCat]    7. Restart the app');
        console.error('[RevenueCat]');
        return false;
      }
      
      // Check if offering has packages
      if (currentOffering.availablePackages.length === 0) {
        initializationError = 'Offering has no products';
        console.error('[RevenueCat] ❌ OFFERING HAS NO PACKAGES!');
        console.error('[RevenueCat]');
        console.error('[RevenueCat] 🔧 SOLUTION:');
        console.error('[RevenueCat]    1. Go to https://app.revenuecat.com');
        console.error('[RevenueCat]    2. Navigate to "Products"');
        console.error('[RevenueCat]    3. Add products with IDs:');
        console.error('[RevenueCat]       - surfvista_monthly');
        console.error('[RevenueCat]       - surfvista_annual');
        console.error('[RevenueCat]    4. Go to "Offerings"');
        console.error('[RevenueCat]    5. Edit offering:', currentOffering.identifier);
        console.error('[RevenueCat]    6. Add both products to the offering');
        console.error('[RevenueCat]    7. Save and wait for sync');
        console.error('[RevenueCat]');
        return false;
      }
      
      console.log('[RevenueCat] ✅ Offering ready:', currentOffering.identifier);
      console.log('[RevenueCat] ✅ Products available:', currentOffering.availablePackages.length);
      
    } catch (offeringError: any) {
      initializationError = offeringError.message;
      console.error('[RevenueCat] ❌ Error fetching offerings:', offeringError.message);
      console.error('[RevenueCat]');
      console.error('[RevenueCat] 🔧 COMMON CAUSES:');
      console.error('[RevenueCat]    1. No offerings configured in RevenueCat dashboard');
      console.error('[RevenueCat]    2. Products not linked to App Store Connect');
      console.error('[RevenueCat]    3. Product IDs mismatch between App Store Connect and RevenueCat');
      console.error('[RevenueCat]    4. Network connectivity issues');
      console.error('[RevenueCat]    5. API key permissions issue');
      console.error('[RevenueCat]');
      console.error('[RevenueCat] 🔧 SOLUTION:');
      console.error('[RevenueCat]    1. Verify product IDs in App Store Connect:');
      console.error('[RevenueCat]       - surfvista_monthly');
      console.error('[RevenueCat]       - surfvista_annual');
      console.error('[RevenueCat]    2. Add same product IDs to RevenueCat dashboard');
      console.error('[RevenueCat]    3. Link products to an offering');
      console.error('[RevenueCat]    4. Mark offering as "Current"');
      console.error('[RevenueCat]    5. Wait 5-10 minutes for sync');
      console.error('[RevenueCat]    6. Restart the app');
      console.error('[RevenueCat]');
      return false;
    }
    
    isPaymentSystemInitialized = true;
    initializationError = null;
    console.log('[RevenueCat] ✅ Initialization complete');
    console.log('[RevenueCat] ✅ Ready to present paywall');
    return true;
    
  } catch (error: any) {
    initializationError = error.message;
    console.error('[RevenueCat] ❌ Failed to initialize:', error.message);
    console.error('[RevenueCat] Stack:', error.stack);
    isPaymentSystemInitialized = false;
    return false;
  }
};

export const initializePaymentSystem = initializeRevenueCat;

export const isPaymentSystemAvailable = (): boolean => {
  return isPaymentSystemInitialized;
};

export const getInitializationError = (): string | null => {
  return initializationError;
};

export const checkPaymentConfiguration = (): boolean => {
  console.log('[RevenueCat] 🔍 Configuration Check:');
  console.log('[RevenueCat]    - Initialized:', isPaymentSystemInitialized);
  console.log('[RevenueCat]    - Platform:', Platform.OS);
  console.log('[RevenueCat]    - Current Offering:', currentOffering?.identifier || 'None');
  console.log('[RevenueCat]    - Offering Packages:', currentOffering?.availablePackages.length || 0);
  console.log('[RevenueCat]    - Initialization Error:', initializationError || 'None');
  
  if (currentOffering && currentOffering.availablePackages.length > 0) {
    console.log('[RevenueCat] ✅ Configuration looks good!');
    return true;
  } else {
    console.log('[RevenueCat] ⚠️ Configuration incomplete');
    if (initializationError) {
      console.log('[RevenueCat] ❌ Error:', initializationError);
    }
    return false;
  }
};

export const presentPaywall = async (
  userId?: string,
  userEmail?: string
): Promise<{ state: 'purchased' | 'restored' | 'declined' | 'error'; message?: string }> => {
  try {
    console.log('[RevenueCat] 🎯 Presenting paywall...');
    
    if (!isPaymentSystemAvailable()) {
      console.error('[RevenueCat] ❌ Payment system not initialized');
      
      let errorMsg = '🚨 RevenueCat Configuration Required\n\n';
      errorMsg += 'The subscription system is not properly configured. ';
      errorMsg += 'This is a configuration issue that needs to be fixed in the RevenueCat dashboard.\n\n';
      
      if (initializationError) {
        errorMsg += '📋 Error Details:\n' + initializationError + '\n\n';
      }
      
      errorMsg += '🔧 How to Fix:\n\n';
      errorMsg += '1. Go to https://app.revenuecat.com\n';
      errorMsg += '2. Navigate to "Products" and add:\n';
      errorMsg += '   • surfvista_monthly\n';
      errorMsg += '   • surfvista_annual\n\n';
      errorMsg += '3. Go to "Offerings" and:\n';
      errorMsg += '   • Create or edit an offering\n';
      errorMsg += '   • Add both products to it\n';
      errorMsg += '   • Mark it as "Current"\n\n';
      errorMsg += '4. Go to "Paywalls" and:\n';
      errorMsg += '   • Create a paywall\n';
      errorMsg += '   • Link it to your offering\n';
      errorMsg += '   • Publish the paywall\n\n';
      errorMsg += '5. Wait 5-10 minutes for sync\n';
      errorMsg += '6. Restart the app\n\n';
      errorMsg += '📖 Check the console logs for detailed troubleshooting steps.';
      
      return {
        state: 'error',
        message: errorMsg
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
    console.log('[RevenueCat]    - Current:', offerings.current?.identifier || 'NONE');
    console.log('[RevenueCat]    - All:', Object.keys(offerings.all));
    
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
        message: '🚨 No Subscription Options Available\n\n' +
                 'RevenueCat configuration is incomplete.\n\n' +
                 '🔧 Required Steps:\n\n' +
                 '1. Go to RevenueCat dashboard\n' +
                 '2. Create or mark an offering as "Current"\n' +
                 '3. Add products to the offering\n' +
                 '4. Create and publish a paywall\n' +
                 '5. Wait 5-10 minutes for sync\n' +
                 '6. Restart the app\n\n' +
                 '📖 See console logs for detailed instructions.'
      };
    }

    // Check if offering has packages
    console.log('[RevenueCat] 📦 Offering packages:', offeringToUse.availablePackages.length);
    
    if (offeringToUse.availablePackages.length === 0) {
      console.error('[RevenueCat] ❌ No packages in offering');
      return {
        state: 'error',
        message: '🚨 No Subscription Plans Available\n\n' +
                 'Products are not configured in RevenueCat.\n\n' +
                 '🔧 Required Steps:\n\n' +
                 '1. Verify product IDs in App Store Connect:\n' +
                 '   • surfvista_monthly\n' +
                 '   • surfvista_annual\n\n' +
                 '2. Add same product IDs to RevenueCat\n' +
                 '3. Link products to offering\n' +
                 '4. Wait for sync (5-10 minutes)\n' +
                 '5. Restart the app\n\n' +
                 '📖 See console logs for detailed instructions.'
      };
    }

    // Log package details
    console.log('[RevenueCat] 📋 Available packages:');
    offeringToUse.availablePackages.forEach((pkg, index) => {
      console.log(`[RevenueCat]    ${index + 1}. ${pkg.identifier}`);
      console.log(`[RevenueCat]       Product: ${pkg.product.identifier}`);
      console.log(`[RevenueCat]       Price: ${pkg.product.priceString}`);
    });

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
          message: '🚨 Unable to Display Subscription Options\n\n' +
                   'Paywall is not configured in RevenueCat.\n\n' +
                   '🔧 Required Steps:\n\n' +
                   '1. Create a paywall in RevenueCat dashboard\n' +
                   '2. Link paywall to offering\n' +
                   '3. Publish the paywall\n' +
                   '4. Restart the app\n\n' +
                   '📋 Error: ' + fallbackError.message
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
        message: '🚨 Paywall Not Configured\n\n' +
                 'Create and publish a paywall in RevenueCat dashboard.'
      };
    } else {
      console.log('[RevenueCat] ℹ️ Paywall closed without action');
      return { state: 'declined' };
    }

  } catch (error: any) {
    console.error('[RevenueCat] ❌ Paywall error:', error);

    let errorMessage = '🚨 Unable to Load Subscription Options\n\n';
    
    const errorMsg = error.message || '';
    
    if (errorMsg.includes('No current offering') || errorMsg.includes('default offering')) {
      errorMessage += '🔧 SOLUTION:\n\n';
      errorMessage += '1. Go to RevenueCat dashboard\n';
      errorMessage += '2. Navigate to Offerings\n';
      errorMessage += '3. Mark an offering as "Current"\n';
      errorMessage += '4. Ensure products are linked\n';
      errorMessage += '5. Create and publish a paywall\n';
      errorMessage += '6. Wait 5-10 minutes for sync\n';
      errorMessage += '7. Restart the app';
    } else if (errorMsg.includes('products') || errorMsg.includes('App Store Connect') || errorMsg.includes('StoreKit')) {
      errorMessage += '🔧 PRODUCT CONFIGURATION ISSUE:\n\n';
      errorMessage += '1. Verify product IDs in App Store Connect:\n';
      errorMessage += '   • surfvista_monthly\n';
      errorMessage += '   • surfvista_annual\n\n';
      errorMessage += '2. Add same product IDs to RevenueCat\n';
      errorMessage += '3. Link products to offering\n';
      errorMessage += '4. Ensure products are "Ready to Submit"\n';
      errorMessage += '5. Wait 5-10 minutes for sync\n';
      errorMessage += '6. Restart the app';
    } else if (errorMsg.includes('paywall') || errorMsg.includes('configuration')) {
      errorMessage += 'Please ensure paywall is configured and published in RevenueCat dashboard.';
    } else if (errorMsg.includes('network')) {
      errorMessage += 'Please check your internet connection and try again.';
    } else {
      errorMessage += 'Please try again later or contact support.\n\n📋 Error: ' + errorMsg;
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
