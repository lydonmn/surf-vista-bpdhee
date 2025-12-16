
// ============================================
// REVENUECAT + SUPERWALL INTEGRATION
// ============================================
// 
// This file integrates RevenueCat for subscription management
// RevenueCat works with Expo and can display Superwall paywalls
//
// Setup Instructions:
// 1. Create a RevenueCat account at https://www.revenuecat.com/
// 2. Add your app in the RevenueCat dashboard
// 3. Configure your products (monthly and annual subscriptions)
// 4. Get your API keys from the RevenueCat dashboard
// 5. Replace the API keys below
// 6. (Optional) Connect Superwall to RevenueCat for custom paywalls
//
// ============================================

import Purchases, { 
  PurchasesPackage, 
  CustomerInfo,
  PurchasesOffering,
  LOG_LEVEL
} from 'react-native-purchases';
import { Platform, Alert } from 'react-native';
import { supabase } from '@/app/integrations/supabase/client';

// ============================================
// CONFIGURATION - REPLACE WITH YOUR KEYS
// ============================================

// RevenueCat API Keys
// Get these from: https://app.revenuecat.com/settings/api-keys
// IMPORTANT: Replace these with your actual API keys from RevenueCat
const REVENUECAT_API_KEY_IOS = 'YOUR_IOS_API_KEY_HERE';
const REVENUECAT_API_KEY_ANDROID = 'YOUR_ANDROID_API_KEY_HERE';

// Product Identifiers (must match App Store Connect / Google Play Console)
// IMPORTANT: Use these exact identifiers when creating products in:
// - App Store Connect (iOS)
// - Google Play Console (Android)
// - RevenueCat Dashboard
export const PAYMENT_CONFIG = {
  // Pricing (can be adjusted in App Store Connect / Google Play Console)
  MONTHLY_PRICE: 4.99,  // $4.99/month
  ANNUAL_PRICE: 49.99,  // $49.99/year (save ~17%)
  
  // Product Identifiers - MUST MATCH YOUR STORE CONFIGURATION
  // These are the identifiers you provided:
  MONTHLY_PRODUCT_ID: 'com.anonymous.Natively.monthly',
  ANNUAL_PRODUCT_ID: 'com.anonymous.Natively.annual',
  
  // RevenueCat Offering ID (default is usually 'default')
  OFFERING_ID: 'default',
};

// ============================================
// STATE MANAGEMENT
// ============================================

let isPaymentSystemInitialized = false;
let currentOffering: PurchasesOffering | null = null;

// ============================================
// INITIALIZATION
// ============================================

export const initializePaymentSystem = async (): Promise<boolean> => {
  try {
    console.log('[Payment] 🚀 Initializing RevenueCat...');
    
    // Check if API keys are configured
    const apiKey = Platform.OS === 'ios' ? REVENUECAT_API_KEY_IOS : REVENUECAT_API_KEY_ANDROID;
    
    if (apiKey === 'YOUR_IOS_API_KEY_HERE' || apiKey === 'YOUR_ANDROID_API_KEY_HERE') {
      console.log('[Payment] ⚠️ RevenueCat API keys not configured');
      console.log('[Payment] 📝 Please update utils/superwallConfig.ts with your RevenueCat API keys');
      console.log('[Payment] 🔗 Get your keys from: https://app.revenuecat.com/settings/api-keys');
      isPaymentSystemInitialized = false;
      return false;
    }

    // Configure RevenueCat
    Purchases.setLogLevel(LOG_LEVEL.DEBUG);
    
    // Initialize RevenueCat
    await Purchases.configure({ apiKey });
    
    console.log('[Payment] ✅ RevenueCat initialized successfully');
    
    // Fetch available offerings
    try {
      const offerings = await Purchases.getOfferings();
      currentOffering = offerings.current;
      
      if (currentOffering) {
        console.log('[Payment] 📦 Available offerings:', currentOffering.identifier);
        console.log('[Payment] 📦 Available packages:', currentOffering.availablePackages.length);
        
        currentOffering.availablePackages.forEach(pkg => {
          console.log(`[Payment]   - ${pkg.identifier}: ${pkg.product.priceString}`);
        });
      } else {
        console.log('[Payment] ⚠️ No offerings found. Please configure products in RevenueCat dashboard.');
      }
    } catch (offeringError) {
      console.error('[Payment] ⚠️ Error fetching offerings:', offeringError);
      // Don't fail initialization if offerings can't be fetched
    }
    
    isPaymentSystemInitialized = true;
    return true;
  } catch (error: any) {
    console.error('[Payment] ❌ Failed to initialize RevenueCat:', error);
    console.error('[Payment] Error details:', error.message);
    isPaymentSystemInitialized = false;
    return false;
  }
};

// ============================================
// PAYMENT SYSTEM AVAILABILITY
// ============================================

export const isPaymentSystemAvailable = (): boolean => {
  const apiKey = Platform.OS === 'ios' ? REVENUECAT_API_KEY_IOS : REVENUECAT_API_KEY_ANDROID;
  const isConfigured = apiKey !== 'YOUR_IOS_API_KEY_HERE' && apiKey !== 'YOUR_ANDROID_API_KEY_ANDROID';
  
  return isPaymentSystemInitialized && isConfigured;
};

export const checkPaymentConfiguration = (): boolean => {
  console.log('[Payment] ⚙️ Configuration Check:');
  console.log('[Payment] - Initialized:', isPaymentSystemInitialized);
  console.log('[Payment] - Platform:', Platform.OS);
  console.log('[Payment] - Product IDs:');
  console.log('[Payment]   • Monthly:', PAYMENT_CONFIG.MONTHLY_PRODUCT_ID);
  console.log('[Payment]   • Annual:', PAYMENT_CONFIG.ANNUAL_PRODUCT_ID);
  
  const apiKey = Platform.OS === 'ios' ? REVENUECAT_API_KEY_IOS : REVENUECAT_API_KEY_ANDROID;
  const isConfigured = apiKey !== 'YOUR_IOS_API_KEY_HERE' && apiKey !== 'YOUR_ANDROID_API_KEY_HERE';
  
  console.log('[Payment] - API Key Configured:', isConfigured);
  console.log('[Payment] - Current Offering:', currentOffering?.identifier || 'None');
  
  if (!isConfigured) {
    console.log('[Payment] 📝 Setup Instructions:');
    console.log('[Payment]   1. Create account at https://www.revenuecat.com/');
    console.log('[Payment]   2. Add your app in RevenueCat dashboard');
    console.log('[Payment]   3. Configure products with these identifiers:');
    console.log('[Payment]      • Monthly: ' + PAYMENT_CONFIG.MONTHLY_PRODUCT_ID);
    console.log('[Payment]      • Annual: ' + PAYMENT_CONFIG.ANNUAL_PRODUCT_ID);
    console.log('[Payment]   4. Get API keys from Settings > API Keys');
    console.log('[Payment]   5. Update REVENUECAT_API_KEY_IOS and REVENUECAT_API_KEY_ANDROID');
    console.log('[Payment]   6. Restart the app');
  }
  
  return isConfigured && isPaymentSystemInitialized;
};

// ============================================
// PAYWALL PRESENTATION
// ============================================

export const presentPaywall = async (
  productType: 'monthly' | 'annual' = 'monthly',
  userId?: string,
  userEmail?: string
): Promise<{ state: 'purchased' | 'restored' | 'declined' | 'error'; message?: string }> => {
  try {
    console.log('[Payment] 🎨 Presenting paywall for:', productType);
    
    if (!isPaymentSystemAvailable()) {
      throw new Error('Payment system is not configured. Please update your RevenueCat API keys.');
    }

    // Set user ID if provided
    if (userId) {
      console.log('[Payment] 👤 Setting user ID:', userId);
      await Purchases.logIn(userId);
    }

    // Get current offerings
    const offerings = await Purchases.getOfferings();
    const offering = offerings.current;

    if (!offering || offering.availablePackages.length === 0) {
      throw new Error(
        'No subscription packages available.\n\n' +
        'Please configure your products in the RevenueCat dashboard:\n' +
        '1. Go to https://app.revenuecat.com/\n' +
        '2. Select your app\n' +
        '3. Go to Products\n' +
        '4. Add your subscription products:\n' +
        `   • ${PAYMENT_CONFIG.MONTHLY_PRODUCT_ID}\n` +
        `   • ${PAYMENT_CONFIG.ANNUAL_PRODUCT_ID}\n` +
        '5. Create an offering with your packages'
      );
    }

    console.log('[Payment] 📦 Available packages:', offering.availablePackages.length);

    // Find the requested package
    let selectedPackage: PurchasesPackage | null = null;

    // Try to find by identifier first
    if (productType === 'monthly') {
      selectedPackage = offering.monthly || 
                       offering.availablePackages.find(pkg => 
                         pkg.identifier.toLowerCase().includes('monthly') ||
                         pkg.packageType === 'MONTHLY' ||
                         pkg.product.identifier === PAYMENT_CONFIG.MONTHLY_PRODUCT_ID
                       ) || null;
    } else {
      selectedPackage = offering.annual || 
                       offering.availablePackages.find(pkg => 
                         pkg.identifier.toLowerCase().includes('annual') ||
                         pkg.identifier.toLowerCase().includes('yearly') ||
                         pkg.packageType === 'ANNUAL' ||
                         pkg.product.identifier === PAYMENT_CONFIG.ANNUAL_PRODUCT_ID
                       ) || null;
    }

    // Fallback to first package if specific type not found
    if (!selectedPackage && offering.availablePackages.length > 0) {
      console.log('[Payment] ⚠️ Specific package not found, using first available package');
      selectedPackage = offering.availablePackages[0];
    }

    if (!selectedPackage) {
      throw new Error('No subscription package found. Please check your RevenueCat configuration.');
    }

    console.log('[Payment] 💳 Selected package:', selectedPackage.identifier);
    console.log('[Payment] 💰 Price:', selectedPackage.product.priceString);

    // Purchase the package
    console.log('[Payment] 🛒 Starting purchase...');
    const { customerInfo } = await Purchases.purchasePackage(selectedPackage);

    console.log('[Payment] ✅ Purchase successful!');
    console.log('[Payment] 📊 Active entitlements:', Object.keys(customerInfo.entitlements.active));

    // Update Supabase profile
    if (userId) {
      await updateSubscriptionInSupabase(userId, customerInfo);
    }

    return { 
      state: 'purchased',
      message: 'Subscription activated successfully!'
    };

  } catch (error: any) {
    console.error('[Payment] ❌ Purchase error:', error);

    // Handle user cancellation
    if (error.userCancelled) {
      console.log('[Payment] ℹ️ User cancelled purchase');
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
// RESTORE PURCHASES
// ============================================

export const restorePurchases = async (): Promise<{ 
  success: boolean; 
  state?: 'restored' | 'none';
  message?: string 
}> => {
  try {
    console.log('[Payment] 🔄 Restoring purchases...');

    if (!isPaymentSystemAvailable()) {
      throw new Error('Payment system is not configured.');
    }

    const customerInfo = await Purchases.restorePurchases();

    console.log('[Payment] 📊 Restore complete');
    console.log('[Payment] 📊 Active entitlements:', Object.keys(customerInfo.entitlements.active));

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
    console.error('[Payment] ❌ Restore error:', error);
    return {
      success: false,
      message: error.message || 'Failed to restore purchases.'
    };
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
      console.log('[Payment] ⚠️ Payment system not available, checking Supabase only');
      return await checkSubscriptionInSupabase(userId);
    }

    // Get customer info from RevenueCat
    const customerInfo = await Purchases.getCustomerInfo();
    
    const hasActiveSubscription = Object.keys(customerInfo.entitlements.active).length > 0;
    
    if (hasActiveSubscription) {
      // Get the first active entitlement
      const entitlement = Object.values(customerInfo.entitlements.active)[0];
      const endDate = entitlement.expirationDate || null;
      
      console.log('[Payment] ✅ Active subscription found');
      console.log('[Payment] 📅 Expires:', endDate);
      
      // Update Supabase with latest info
      await updateSubscriptionInSupabase(userId, customerInfo);
      
      return {
        isActive: true,
        endDate: endDate
      };
    } else {
      console.log('[Payment] ℹ️ No active subscription in RevenueCat');
      
      // Check Supabase as fallback
      return await checkSubscriptionInSupabase(userId);
    }
  } catch (error: any) {
    console.error('[Payment] ❌ Error checking subscription:', error);
    
    // Fallback to Supabase check
    return await checkSubscriptionInSupabase(userId);
  }
};

// ============================================
// SUPABASE INTEGRATION
// ============================================

const updateSubscriptionInSupabase = async (userId: string, customerInfo: CustomerInfo) => {
  try {
    const hasActiveSubscription = Object.keys(customerInfo.entitlements.active).length > 0;
    
    let subscriptionEndDate: string | null = null;
    
    if (hasActiveSubscription) {
      const entitlement = Object.values(customerInfo.entitlements.active)[0];
      subscriptionEndDate = entitlement.expirationDate || null;
    }
    
    console.log('[Payment] 💾 Updating Supabase profile...');
    console.log('[Payment]   - User ID:', userId);
    console.log('[Payment]   - Is Subscribed:', hasActiveSubscription);
    console.log('[Payment]   - End Date:', subscriptionEndDate);
    
    const { error } = await supabase
      .from('profiles')
      .update({
        is_subscribed: hasActiveSubscription,
        subscription_end_date: subscriptionEndDate,
      })
      .eq('id', userId);
    
    if (error) {
      console.error('[Payment] ❌ Error updating Supabase:', error);
    } else {
      console.log('[Payment] ✅ Supabase profile updated');
    }
  } catch (error: any) {
    console.error('[Payment] ❌ Exception updating Supabase:', error);
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
      console.error('[Payment] ❌ Error checking Supabase subscription:', error);
      return { isActive: false, endDate: null };
    }
    
    if (profile.is_subscribed && profile.subscription_end_date) {
      const endDate = new Date(profile.subscription_end_date);
      const isActive = endDate > new Date();
      
      console.log('[Payment] 📊 Supabase subscription status:', isActive ? 'Active' : 'Expired');
      
      return { isActive, endDate: profile.subscription_end_date };
    }
    
    return { isActive: false, endDate: null };
  } catch (error: any) {
    console.error('[Payment] ❌ Exception checking Supabase subscription:', error);
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
    console.log('[Payment] 🎁 Manually granting subscription:', durationType);
    
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
      console.error('[Payment] ❌ Error granting subscription:', error);
      return { success: false, error: error.message };
    }
    
    console.log('[Payment] ✅ Subscription granted successfully');
    console.log('[Payment] 📅 End date:', subscriptionEndDate.toISOString());
    return { success: true };
  } catch (error: any) {
    console.error('[Payment] ❌ Exception granting subscription:', error);
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

    console.log('[Payment] 👤 Identifying user:', userId);
    await Purchases.logIn(userId);
    
    if (email) {
      await Purchases.setEmail(email);
    }
    
    console.log('[Payment] ✅ User identified');
  } catch (error: any) {
    console.error('[Payment] ❌ Error identifying user:', error);
  }
};

export const logoutUser = async () => {
  try {
    if (!isPaymentSystemAvailable()) {
      return;
    }

    console.log('[Payment] 👋 Logging out user from RevenueCat');
    await Purchases.logOut();
    console.log('[Payment] ✅ User logged out');
  } catch (error: any) {
    console.error('[Payment] ❌ Error logging out user:', error);
  }
};
