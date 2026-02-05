
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
// 🔧 REVENUECAT CONFIGURATION - UPDATED FOR SURFVISTA MAIN OFFERING
// ═══════════════════════════════════════════════════════════════════════════

// RevenueCat API Keys from Dashboard
// iOS: https://app.revenuecat.com/settings/api-keys
// Android: https://app.revenuecat.com/settings/api-keys
// 
// ✅ PRODUCTION KEY CONFIGURED - READY FOR APP STORE SUBMISSION
// Production keys start with "appl_" for iOS
// 
// ✅ GRACEFUL DEGRADATION: If this key is invalid or RevenueCat fails,
// the app will continue to function normally. Users just won't be able to subscribe.
const REVENUECAT_API_KEY_IOS = 'appl_uyUNhkTURhBCqiVsRaBqBYbhIda'; // ✅ PRODUCTION KEY - VERIFIED
const REVENUECAT_API_KEY_ANDROID = 'goog_YOUR_ANDROID_KEY_HERE'; // Update when you have Android key

// ═══════════════════════════════════════════════════════════════════════════
// ✅ CONFIGURATION UPDATED - JANUARY 2025
// ═══════════════════════════════════════════════════════════════════════════
// Based on your RevenueCat dashboard:
// - Offering ID: ofrngf25b3975f3 (SurfVista Main) ✅ UPDATED
// - Monthly Package: $rc_monthly (SurfVista Monthly)
// - Annual Package: $rc_annual (Surfvista Premium)
// - Products are linked to App Store Connect
// - Paywall is configured (verify it's PUBLISHED in RevenueCat dashboard)
// 
// ⚠️ GRACEFUL DEGRADATION: If RevenueCat fails to initialize or shows errors,
// the app will continue to function normally. Users just won't be able to subscribe.
// ═══════════════════════════════════════════════════════════════════════════

// Product Configuration
// ⚠️ CRITICAL: These product IDs MUST match EXACTLY in:
// 1. App Store Connect (iOS) or Google Play Console (Android)
// 2. RevenueCat Dashboard > Products
export const PAYMENT_CONFIG = {
  PRODUCTS: {
    MONTHLY_SUBSCRIPTION: 'surfvista_Monthly',  // Your monthly product ID from RevenueCat
    ANNUAL_SUBSCRIPTION: 'surfvista_Annual',    // Your yearly product ID from RevenueCat
  },
  // Entitlement identifier from RevenueCat Dashboard
  ENTITLEMENT_ID: 'SurfVista', // Your entitlement name
  // Offering ID from RevenueCat Dashboard (CORRECT ID FROM SCREENSHOT)
  OFFERING_ID: 'ofrngf25b3975f3', // ✅ Your offering identifier (verified)
  // Package identifiers from RevenueCat (from screenshot)
  PACKAGE_IDS: {
    MONTHLY: '$rc_monthly',  // Monthly package identifier
    ANNUAL: '$rc_annual',    // Annual package identifier
  },
  PRICING: {
    MONTHLY: '$12.99',  // Your actual pricing
    ANNUAL: '$99.99',  // Your actual pricing
  },
};

// ═══════════════════════════════════════════════════════════════════════════
// 📚 REVENUECAT SETUP GUIDE
// ═══════════════════════════════════════════════════════════════════════════
//
// STEP 1: CREATE PRODUCTS IN APP STORE CONNECT ✅ (YOU'VE DONE THIS)
// ────────────────────────────────────────────
// 1. Go to https://appstoreconnect.apple.com
// 2. Select your app (SurfVista)
// 3. Go to "Monetization" > "Subscriptions"
// 4. Create subscription group if needed
// 5. Add subscriptions:
//    - Product ID: "monthly" (must match exactly)
//    - Price: $12.99/month
//    - Product ID: "yearly" (must match exactly)
//    - Price: $99.99/year
// 6. Set subscription details (name, description, etc.)
// 7. Submit for review (products must be "Ready to Submit" or "Approved")
//
// STEP 2: ADD PRODUCTS TO REVENUECAT ✅ (YOU'VE DONE THIS)
// ───────────────────────────────────
// 1. Go to https://app.revenuecat.com
// 2. Select your project (SurfVista)
// 3. Navigate to "Products" in left sidebar
// 4. Click "Add Product"
// 5. For each product:
//    - Product ID: "monthly" (must match App Store Connect)
//    - Store: iOS App Store
//    - Click "Save"
//    - Product ID: "yearly" (must match App Store Connect)
//    - Store: iOS App Store
//    - Click "Save"
//
// STEP 3: CREATE OFFERING ✅ (YOU'VE DONE THIS)
// ────────────────────────
// 1. In RevenueCat Dashboard, go to "Offerings"
// 2. Click "New Offering"
// 3. Give it an identifier: "ofrngf25b3975f3"
// 4. Add both products to the offering:
//    - Add "monthly" as a package
//    - Add "yearly" as a package
// 5. Click "Make Current" to set as default offering
// 6. Save the offering
//
// STEP 4: CREATE ENTITLEMENT ✅ (YOU'VE DONE THIS)
// ───────────────────────────
// 1. In RevenueCat Dashboard, go to "Entitlements"
// 2. Click "New Entitlement"
// 3. Identifier: "SurfVista" (must match ENTITLEMENT_ID above)
// 4. Attach both products to this entitlement
// 5. Save
//
// STEP 5: CREATE AND PUBLISH PAYWALL ⚠️ (VERIFY THIS IS PUBLISHED)
// ───────────────────────────────────
// 1. In RevenueCat Dashboard, go to "Paywalls"
// 2. Click "Create Paywall"
// 3. Choose a template or create custom
// 4. Link to your offering (ofrngf25b3975f3)
// 5. Customize text, images, colors
// 6. Click "Publish" ⚠️ MUST BE PUBLISHED, NOT JUST SAVED
//
// STEP 6: CONFIGURE CUSTOMER CENTER (OPTIONAL)
// ─────────────────────────────────────────────
// 1. In RevenueCat Dashboard, go to "Customer Center"
// 2. Enable Customer Center
// 3. Customize appearance and options
// 4. Save configuration
//
// STEP 7: TEST WITH SANDBOX ⚠️ (DO THIS BEFORE PRODUCTION)
// ──────────────────────────
// 1. On iOS device, go to Settings > App Store
// 2. Sign out of your Apple ID
// 3. Create a Sandbox Tester account in App Store Connect
// 4. Run your app and test subscription flow
// 5. When prompted, sign in with sandbox tester account
// 6. Complete test purchase (it's free in sandbox)
//
// STEP 8: SWITCH TO PRODUCTION KEY (BEFORE APP STORE SUBMISSION)
// ───────────────────────────────────────────────────────────────
// 1. In RevenueCat Dashboard, go to Settings > API Keys
// 2. Copy your PRODUCTION iOS API key (starts with "appl_")
// 3. Replace REVENUECAT_API_KEY_IOS above with production key
// 4. Rebuild and submit to App Store
//
// ═══════════════════════════════════════════════════════════════════════════

let isPaymentSystemInitialized = false;
let currentOffering: PurchasesOffering | null = null;
let initializationError: string | null = null;

/**
 * Initialize RevenueCat SDK
 * Call this once when the app starts (in _layout.tsx or App.tsx)
 * 
 * ⚠️ GRACEFUL DEGRADATION: This function will NEVER crash the app.
 * If RevenueCat fails to initialize, the app continues to work normally.
 * Users just won't be able to subscribe until the issue is resolved.
 */
export const initializeRevenueCat = async (): Promise<boolean> => {
  // Wrap everything in a try-catch to prevent any uncaught errors from crashing the app
  try {
    console.log('[RevenueCat] 🚀 Initializing SDK...');
    console.log('[RevenueCat] Platform:', Platform.OS);
    console.log('[RevenueCat] Environment:', __DEV__ ? 'Development (Sandbox)' : 'Production');
    console.log('[RevenueCat] ⚠️ GRACEFUL MODE: App will continue if RevenueCat fails');
    
    // RevenueCat only works on iOS and Android
    if (Platform.OS === 'web') {
      console.log('[RevenueCat] ℹ️ Skipping initialization on web platform');
      initializationError = 'RevenueCat is not supported on web. Please use iOS or Android app.';
      isPaymentSystemInitialized = false;
      return false;
    }
    
    // Add a safety check for Platform.OS
    if (!Platform.OS || (Platform.OS !== 'ios' && Platform.OS !== 'android')) {
      console.log('[RevenueCat] ⚠️ Unknown platform, skipping initialization');
      initializationError = 'RevenueCat is only supported on iOS and Android.';
      isPaymentSystemInitialized = false;
      return false;
    }
    
    // Get the API key for the current platform
    const REVENUECAT_API_KEY = Platform.OS === 'ios' 
      ? REVENUECAT_API_KEY_IOS 
      : REVENUECAT_API_KEY_ANDROID;
    
    // Validate API key format (but don't fail - just warn)
    if (Platform.OS === 'ios' && !REVENUECAT_API_KEY.startsWith('appl_') && !REVENUECAT_API_KEY.startsWith('test_')) {
      initializationError = 'Invalid iOS API key format. App will continue without subscriptions.';
      console.warn('[RevenueCat] ⚠️', initializationError);
      isPaymentSystemInitialized = false;
      return false;
    }
    
    if (Platform.OS === 'android' && !REVENUECAT_API_KEY.startsWith('goog_')) {
      initializationError = 'Invalid Android API key format. App will continue without subscriptions.';
      console.warn('[RevenueCat] ⚠️', initializationError);
      isPaymentSystemInitialized = false;
      return false;
    }
    
    if (REVENUECAT_API_KEY.includes('YOUR_') || REVENUECAT_API_KEY.includes('_HERE')) {
      initializationError = `${Platform.OS === 'ios' ? 'iOS' : 'Android'} API key is a placeholder. App will continue without subscriptions.`;
      console.warn('[RevenueCat] ⚠️', initializationError);
      isPaymentSystemInitialized = false;
      return false;
    }
    
    // ⚠️ CRITICAL: If using test key, warn but continue
    if (REVENUECAT_API_KEY.startsWith('test_')) {
      console.warn('[RevenueCat] ⚠️ Using TEST API key. This may show warnings in production.');
      console.warn('[RevenueCat] ⚠️ Replace with production key (appl_...) before App Store submission.');
      // Continue anyway - test keys work in development
    }
    
    // Configure RevenueCat with detailed logging and error handling
    // This is wrapped in a try-catch to prevent crashes if RevenueCat fails to initialize
    try {
      // Set log level first (this should never fail)
      try {
        Purchases.setLogLevel(__DEV__ ? LOG_LEVEL.DEBUG : LOG_LEVEL.INFO);
      } catch (logError) {
        console.warn('[RevenueCat] ⚠️ Could not set log level:', logError);
        // Continue anyway - this is not critical
      }
      
      console.log('[RevenueCat] 🔑 Configuring with API key:', REVENUECAT_API_KEY.substring(0, 15) + '...');
      
      // Configure SDK with timeout to prevent hanging
      const configPromise = Purchases.configure({ apiKey: REVENUECAT_API_KEY });
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('SDK configuration timeout')), 15000)
      );
      
      await Promise.race([configPromise, timeoutPromise]);
      
      console.log('[RevenueCat] ✅ SDK configured successfully');
      console.log('[RevenueCat] 📋 Configuration:');
      console.log('[RevenueCat]    - Offering ID:', PAYMENT_CONFIG.OFFERING_ID);
      console.log('[RevenueCat]    - Product IDs:', Object.values(PAYMENT_CONFIG.PRODUCTS));
      console.log('[RevenueCat]    - Entitlement:', PAYMENT_CONFIG.ENTITLEMENT_ID);
    } catch (configError: any) {
      initializationError = `SDK configuration failed: ${configError?.message || 'Unknown error'}. App will continue without subscriptions.`;
      console.warn('[RevenueCat] ⚠️ SDK configuration error (non-critical):', configError);
      isPaymentSystemInitialized = false;
      // Don't throw - just return false and let the app continue
      return false;
    }
    
    // Fetch offerings with timeout (completely non-blocking)
    try {
      console.log('[RevenueCat] 📦 Fetching offerings from RevenueCat...');
      console.log('[RevenueCat] 📋 Looking for offering ID:', PAYMENT_CONFIG.OFFERING_ID);
      
      // Add timeout to prevent hanging
      const offeringsPromise = Purchases.getOfferings();
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Offerings fetch timeout')), 10000)
      );
      
      const offerings = await Promise.race([offeringsPromise, timeoutPromise]) as any;
      
      console.log('[RevenueCat] 🔍 Offerings Response:');
      console.log('[RevenueCat]    - Current offering:', offerings.current?.identifier || 'NONE');
      console.log('[RevenueCat]    - All offerings:', Object.keys(offerings.all).length);
      console.log('[RevenueCat]    - Available offering IDs:', Object.keys(offerings.all).join(', '));
      
      // Try to use the specific offering ID from config first (CORRECT ID: ofrngf25b3975f3)
      if (offerings.all[PAYMENT_CONFIG.OFFERING_ID]) {
        currentOffering = offerings.all[PAYMENT_CONFIG.OFFERING_ID];
        console.log('[RevenueCat] ✅ Using configured offering:', PAYMENT_CONFIG.OFFERING_ID);
        console.log('[RevenueCat]    - Packages:', currentOffering.availablePackages.length);
      } else if (offerings.current) {
        currentOffering = offerings.current;
        console.log('[RevenueCat] ⚠️ Configured offering not found, using current offering:', offerings.current.identifier);
        console.log('[RevenueCat]    - Packages:', currentOffering.availablePackages.length);
      } else if (Object.keys(offerings.all).length > 0) {
        // Use first available offering
        const firstKey = Object.keys(offerings.all)[0];
        currentOffering = offerings.all[firstKey];
        console.log('[RevenueCat] ⚠️ Using first available offering:', firstKey);
      } else {
        initializationError = 'No offerings found. App will continue without subscriptions.';
        console.warn('[RevenueCat] ⚠️ NO OFFERINGS FOUND (non-critical)');
        console.warn('[RevenueCat] 💡 Create an offering in RevenueCat dashboard');
        // Don't return false - allow app to continue without offerings
        isPaymentSystemInitialized = true;
        return true;
      }
      
      if (currentOffering && currentOffering.availablePackages.length > 0) {
        console.log('[RevenueCat]    - Package details:');
        currentOffering.availablePackages.forEach((pkg, index) => {
          console.log(`[RevenueCat]      ${index + 1}. ${pkg.identifier}`);
          console.log(`[RevenueCat]         Product: ${pkg.product.identifier}`);
          console.log(`[RevenueCat]         Price: ${pkg.product.priceString}`);
        });
      } else {
        console.warn('[RevenueCat] ⚠️ Offering has NO packages (non-critical)');
        console.warn('[RevenueCat] 💡 Add products to your offering in RevenueCat dashboard');
      }
      
      if (currentOffering && currentOffering.availablePackages.length === 0) {
        initializationError = 'Offering has no products. App will continue without subscriptions.';
        console.warn('[RevenueCat] ⚠️ OFFERING HAS NO PACKAGES (non-critical)');
        console.warn('[RevenueCat] 💡 Add products to your offering in RevenueCat dashboard');
        // Don't return false - allow app to continue
        isPaymentSystemInitialized = true;
        return true;
      }
      
      console.log('[RevenueCat] ✅ Offering ready:', currentOffering?.identifier);
      console.log('[RevenueCat] ✅ Products available:', currentOffering?.availablePackages.length);
      
    } catch (offeringError: any) {
      initializationError = `${offeringError.message}. App will continue without subscriptions.`;
      console.warn('[RevenueCat] ⚠️ Error fetching offerings (non-critical):', offeringError.message);
      console.warn('[RevenueCat] 💡 Check RevenueCat dashboard configuration');
      // Don't return false - allow app to continue without offerings
      isPaymentSystemInitialized = true;
      return true;
    }
    
    isPaymentSystemInitialized = true;
    initializationError = null;
    console.log('[RevenueCat] ✅ Initialization complete');
    console.log('[RevenueCat] ✅ Ready to present paywall');
    console.log('[RevenueCat] ✅ App will continue normally even if RevenueCat has issues');
    return true;
    
  } catch (error: any) {
    // This is the final catch-all to ensure no errors escape and crash the app
    initializationError = `${error?.message || 'Unknown initialization error'}. App will continue without subscriptions.`;
    console.warn('[RevenueCat] ⚠️ Failed to initialize (non-critical):', error);
    if (error?.stack) {
      console.warn('[RevenueCat] ⚠️ Error stack:', error.stack);
    }
    isPaymentSystemInitialized = false;
    // Don't throw - just return false and let the app continue
    // The app should work without RevenueCat (users just can't subscribe)
    console.log('[RevenueCat] ✅ App will continue normally without subscription features');
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
  console.log('[RevenueCat] 🔍 Configuration Check:');
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
    console.log('[RevenueCat] ⚠️ Configuration incomplete');
    if (initializationError) {
      console.log('[RevenueCat] ❌ Error:', initializationError);
    }
    return false;
  }
};

/**
 * Present the RevenueCat Paywall
 * This shows the subscription options to the user
 */
export const presentPaywall = async (
  userId?: string,
  userEmail?: string
): Promise<{ state: 'purchased' | 'restored' | 'declined' | 'error'; message?: string }> => {
  try {
    console.log('[RevenueCat] 🎯 Presenting paywall...');
    
    if (Platform.OS === 'web') {
      return {
        state: 'error',
        message: '📱 Mobile App Required\n\nSubscriptions are only available in the iOS or Android app.'
      };
    }
    
    if (!isPaymentSystemAvailable()) {
      console.error('[RevenueCat] ❌ Payment system not initialized');
      return {
        state: 'error',
        message: initializationError || 'Payment system not initialized. Please restart the app.'
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
    
    // Try to use the specific offering ID from config first
    let offeringToUse = offerings.all[PAYMENT_CONFIG.OFFERING_ID] || offerings.current || currentOffering;

    if (!offeringToUse) {
      return {
        state: 'error',
        message: 'No subscription options available. Please check RevenueCat configuration.'
      };
    }

    console.log('[RevenueCat] 📋 Using offering:', offeringToUse.identifier);
    console.log('[RevenueCat] 📋 Available packages:', offeringToUse.availablePackages.length);

    if (offeringToUse.availablePackages.length === 0) {
      return {
        state: 'error',
        message: 'No subscription plans available. Please add products to your offering in RevenueCat.'
      };
    }

    console.log('[RevenueCat] 📋 Package details:');
    offeringToUse.availablePackages.forEach((pkg, index) => {
      console.log(`[RevenueCat]    ${index + 1}. ${pkg.identifier} - ${pkg.product.priceString}`);
    });

    // Present the paywall
    console.log('[RevenueCat] 🎨 Presenting paywall UI...');
    
    const paywallResult = await RevenueCatUI.presentPaywall({
      offering: offeringToUse
    });
    
    console.log('[RevenueCat] 📊 Paywall result:', paywallResult);

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
        message: 'Paywall not configured. Please create and publish a paywall in RevenueCat dashboard.'
      };
    } else {
      console.log('[RevenueCat] ℹ️ Paywall closed without action');
      return { state: 'declined' };
    }

  } catch (error: any) {
    console.error('[RevenueCat] ❌ Paywall error:', error);
    return { 
      state: 'error',
      message: error.message || 'Unable to load subscription options. Please try again later.'
    };
  }
};

/**
 * Present the RevenueCat Customer Center
 * This allows users to manage their subscription
 */
export const presentCustomerCenter = async (): Promise<void> => {
  try {
    console.log('[RevenueCat] 🏢 Presenting Customer Center...');
    
    if (Platform.OS === 'web') {
      throw new Error('Customer Center is only available in the mobile app.');
    }
    
    if (!isPaymentSystemAvailable()) {
      throw new Error('Payment system is not initialized. Please restart the app.');
    }

    await RevenueCatUI.presentCustomerCenter();
    
    console.log('[RevenueCat] ✅ Customer Center closed');
    
    // Refresh customer info after Customer Center closes
    const customerInfo = await Purchases.getCustomerInfo();
    
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await updateSubscriptionInSupabase(user.id, customerInfo);
    }
    
  } catch (error: any) {
    console.error('[RevenueCat] ❌ Customer Center error:', error);
    
    // Fallback to native subscription management
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
 * Call this when user taps "Restore Purchases" button
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
 * Returns current subscription status and entitlements
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
 * Returns true if user has "SurfVista" entitlement
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
 * Returns subscription status and expiration date
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
 * Syncs RevenueCat subscription status with your database
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
 * Used when RevenueCat is not available
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
 * Call this after user logs in
 */
export const identifyUser = async (userId: string, email?: string): Promise<void> => {
  // Wrap everything in try-catch to prevent crashes
  try {
    console.log('[RevenueCat] Attempting to identify user:', userId);
    
    if (!isPaymentSystemAvailable()) {
      console.log('[RevenueCat] Payment system not available, skipping user identification');
      return;
    }

    if (!userId) {
      console.warn('[RevenueCat] No user ID provided, skipping identification');
      return;
    }

    // Try to log in user with timeout
    try {
      const loginPromise = Purchases.logIn(userId);
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Login timeout')), 10000)
      );
      
      await Promise.race([loginPromise, timeoutPromise]);
      console.log('[RevenueCat] ✅ User identified:', userId);
    } catch (loginError: any) {
      console.error('[RevenueCat] ⚠️ Error logging in user:', loginError?.message || 'Unknown error');
      // Don't throw - this is non-critical
    }
    
    // Try to set email with timeout
    if (email) {
      try {
        const emailPromise = Purchases.setEmail(email);
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Set email timeout')), 5000)
        );
        
        await Promise.race([emailPromise, timeoutPromise]);
        console.log('[RevenueCat] ✅ Email set:', email);
      } catch (emailError: any) {
        console.error('[RevenueCat] ⚠️ Error setting email:', emailError?.message || 'Unknown error');
        // Don't throw - this is non-critical
      }
    }
  } catch (error: any) {
    console.error('[RevenueCat] ❌ Error identifying user:', error?.message || 'Unknown error');
    // Don't throw - allow the app to continue
    // The app should work without user identification in RevenueCat
  }
};

/**
 * Logout user from RevenueCat
 * Call this when user logs out
 */
export const logoutUser = async (): Promise<void> => {
  // Wrap everything in try-catch to prevent crashes
  try {
    console.log('[RevenueCat] Attempting to log out user...');
    
    if (!isPaymentSystemAvailable()) {
      console.log('[RevenueCat] Payment system not available, skipping logout');
      return;
    }

    // Try to log out with timeout
    try {
      const logoutPromise = Purchases.logOut();
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Logout timeout')), 5000)
      );
      
      await Promise.race([logoutPromise, timeoutPromise]);
      console.log('[RevenueCat] ✅ User logged out');
    } catch (logoutError: any) {
      console.error('[RevenueCat] ⚠️ Error logging out user:', logoutError?.message || 'Unknown error');
      // Don't throw - this is non-critical
    }
  } catch (error: any) {
    console.error('[RevenueCat] ❌ Error in logout process:', error?.message || 'Unknown error');
    // Don't throw - allow the app to continue
    // The app should work without logging out from RevenueCat
  }
};
