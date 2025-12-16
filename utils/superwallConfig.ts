
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
  
  // RevenueCat Offering ID - YOUR SPECIFIC OFFERING
  OFFERING_ID: 'ofrnge7bdc97106',
  
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
      
      // Try to get the specific offering first
      if (offerings.all[PAYMENT_CONFIG.OFFERING_ID]) {
        currentOffering = offerings.all[PAYMENT_CONFIG.OFFERING_ID];
        console.log('[RevenueCat] 📦 Using specific offering:', PAYMENT_CONFIG.OFFERING_ID);
      } else if (offerings.current) {
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
  console.log('[RevenueCat] - API Key Configured: ✅ YES');
  console.log('[RevenueCat] - Offering ID:', PAYMENT_CONFIG.OFFERING_ID);
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
    console.log('[RevenueCat] 📦 Checking offerings...');
    const offerings = await Purchases.getOfferings();
    
    console.log('[RevenueCat] 📦 All available offerings:', Object.keys(offerings.all));
    console.log('[RevenueCat] 📦 Current offering:', offerings.current?.identifier || 'None');
    
    if (!offerings.current && Object.keys(offerings.all).length === 0) {
      console.error('[RevenueCat] ❌ No offerings available');
      return {
        state: 'error',
        message: 'No subscription packages available. Please ensure products and paywalls are configured in RevenueCat dashboard.'
      };
    }

    // Present the RevenueCat Paywall UI
    console.log('[RevenueCat] 🎨 Calling RevenueCatUI.presentPaywall()...');
    console.log('[RevenueCat] 🎨 This will show the default paywall configured in RevenueCat dashboard');
    
    // Call presentPaywall without parameters to show the default paywall
    const paywallResult = await RevenueCatUI.presentPaywall();
    
    console.log('[RevenueCat] 📊 Paywall closed with result:', paywallResult);

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
        message: 'Unable to display subscription options. Please ensure a paywall is configured in RevenueCat dashboard with the default offering.'
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

    // Provide more specific error messages
    let errorMessage = 'Unable to load subscription options. ';
    
    if (error.message?.includes('No current offering')) {
      errorMessage += 'Please configure a default offering in your RevenueCat dashboard.';
    } else if (error.message?.includes('paywall')) {
      errorMessage += 'Please configure a paywall in your RevenueCat dashboard.';
    } else if (error.message?.includes('network')) {
      errorMessage += 'Please check your internet connection and try again.';
    } else {
      errorMessage += 'Please try again later or contact support.';
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
</write file>

Now let me also update the profile screens to add better error handling and loading states:

<write file="app/(tabs)/profile.tsx">
import React, { useState } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, ActivityIndicator } from "react-native";
import { useTheme } from "@react-navigation/native";
import { useAuth } from "@/contexts/AuthContext";
import { router } from "expo-router";
import { colors } from "@/styles/commonStyles";
import { IconSymbol } from "@/components/IconSymbol";
import { 
  isPaymentSystemAvailable, 
  restorePurchases, 
  checkPaymentConfiguration,
  presentCustomerCenter,
  presentPaywall
} from '@/utils/superwallConfig';

export default function ProfileScreen() {
  const theme = useTheme();
  const { user, profile, signOut, refreshProfile, checkSubscription, isAdmin } = useAuth();
  const [isRestoring, setIsRestoring] = useState(false);
  const [isLoadingCustomerCenter, setIsLoadingCustomerCenter] = useState(false);
  const [isSubscribing, setIsSubscribing] = useState(false);

  const handleSignOut = () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            try {
              console.log('[ProfileScreen] ===== SIGN OUT BUTTON PRESSED =====');
              console.log('[ProfileScreen] User confirmed sign out');
              console.log('[ProfileScreen] Current user:', user?.email);
              
              // Call signOut - it will clear state immediately
              console.log('[ProfileScreen] Calling signOut()...');
              await signOut();
              console.log('[ProfileScreen] ✅ signOut() completed');
              
              // Navigate to login immediately after signOut completes
              console.log('[ProfileScreen] Navigating to login screen...');
              router.replace('/login');
              console.log('[ProfileScreen] ===== SIGN OUT PROCESS COMPLETE =====');
            } catch (error) {
              console.error('[ProfileScreen] ❌ Error during sign out:', error);
              // Still try to navigate even if there was an error
              router.replace('/login');
            }
          }
        }
      ]
    );
  };

  const handleRefreshProfile = async () => {
    console.log('[ProfileScreen] Refreshing profile data...');
    await refreshProfile();
    Alert.alert('Success', 'Profile data refreshed');
  };

  const handleRestorePurchases = async () => {
    // Check if payment system is available
    if (!isPaymentSystemAvailable()) {
      checkPaymentConfiguration();
      Alert.alert(
        'Restore Purchases Unavailable',
        'Subscription features are currently being configured. This usually means:\n\n' +
        '• Products need to be set up in RevenueCat dashboard\n' +
        '• Paywalls need to be configured\n' +
        '• Offerings need to be created\n\n' +
        'Please check the console logs for detailed setup instructions, or contact support for assistance.',
        [{ text: 'OK' }]
      );
      return;
    }

    setIsRestoring(true);
    
    try {
      console.log('[ProfileScreen] 🔄 Starting restore purchases...');
      
      const result = await restorePurchases();
      
      console.log('[ProfileScreen] 📊 Restore result:', result);
      
      // Refresh profile to get updated subscription status
      await refreshProfile();
      
      if (result.success || result.state === 'restored') {
        Alert.alert(
          'Purchases Restored',
          'Your subscription has been restored successfully!',
          [{ text: 'OK' }]
        );
      } else {
        Alert.alert(
          'No Purchases Found',
          'We couldn\'t find any previous purchases to restore. If you believe this is an error, please contact support.',
          [{ text: 'OK' }]
        );
      }
    } catch (error: any) {
      console.error('[ProfileScreen] ❌ Restore purchases error:', error);
      Alert.alert(
        'Restore Failed',
        error.message || 'Unable to restore purchases at this time. Please try again later or contact support.',
        [{ text: 'OK' }]
      );
    } finally {
      setIsRestoring(false);
    }
  };

  const handleManageSubscription = async () => {
    // Check if payment system is available
    if (!isPaymentSystemAvailable()) {
      checkPaymentConfiguration();
      Alert.alert(
        'Manage Subscription Unavailable',
        'Subscription features are currently being configured. Please contact support or try again later.',
        [{ text: 'OK' }]
      );
      return;
    }

    setIsLoadingCustomerCenter(true);
    
    try {
      console.log('[ProfileScreen] 🏢 Opening Customer Center...');
      
      // Present the RevenueCat Customer Center
      await presentCustomerCenter();
      
      console.log('[ProfileScreen] ✅ Customer Center closed');
      
      // Refresh profile to get updated subscription status
      await refreshProfile();
      
    } catch (error: any) {
      console.error('[ProfileScreen] ❌ Customer Center error:', error);
      
      // Fallback to native subscription management
      Alert.alert(
        'Manage Subscription',
        'To manage your subscription, cancel, or change your plan:\n\n' +
        '• iOS: Go to Settings > [Your Name] > Subscriptions\n' +
        '• Android: Open Play Store > Menu > Subscriptions\n\n' +
        'You can also restore your purchases if you\'ve subscribed on another device.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Restore Purchases',
            onPress: handleRestorePurchases
          }
        ]
      );
    } finally {
      setIsLoadingCustomerCenter(false);
    }
  };

  const handleSubscribeNow = async () => {
    console.log('[ProfileScreen] 🔘 ===== SUBSCRIBE NOW BUTTON PRESSED =====');
    
    // Check if payment system is available
    if (!isPaymentSystemAvailable()) {
      console.log('[ProfileScreen] ⚠️ Payment system not available');
      checkPaymentConfiguration();
      
      Alert.alert(
        'Subscription Setup Required',
        'The subscription system is being configured. This usually means:\n\n' +
        '• Products need to be set up in RevenueCat dashboard\n' +
        '• Paywalls need to be configured\n' +
        '• Offerings need to be created\n\n' +
        'Please check the console logs for detailed setup instructions, or contact support for assistance.',
        [{ text: 'OK' }]
      );
      return;
    }

    setIsSubscribing(true);

    try {
      console.log('[ProfileScreen] 🎨 Opening subscription paywall...');
      console.log('[ProfileScreen] User ID:', user?.id);
      console.log('[ProfileScreen] User Email:', user?.email);
      
      // Present the RevenueCat Paywall
      const result = await presentPaywall(user?.id, user?.email || undefined);
      
      console.log('[ProfileScreen] 📊 Paywall result:', result);
      
      // Refresh profile to get updated subscription status
      console.log('[ProfileScreen] 🔄 Refreshing profile...');
      await refreshProfile();
      
      if (result.state === 'purchased' || result.state === 'restored') {
        console.log('[ProfileScreen] ✅ Purchase/Restore successful!');
        Alert.alert(
          'Success!',
          result.message || 'Subscription activated successfully!',
          [{ text: 'OK' }]
        );
      } else if (result.state === 'error') {
        console.log('[ProfileScreen] ❌ Paywall error:', result.message);
        
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
      } else if (result.state === 'declined') {
        console.log('[ProfileScreen] ℹ️ User cancelled paywall');
        // User cancelled, do nothing
      }
      
    } catch (error: any) {
      console.error('[ProfileScreen] ❌ Subscribe error:', error);
      Alert.alert(
        'Subscribe Failed',
        error.message || 'Unable to open subscription page. Please try again later.',
        [{ text: 'OK' }]
      );
    } finally {
      setIsSubscribing(false);
      console.log('[ProfileScreen] ===== SUBSCRIBE FLOW COMPLETE =====');
    }
  };

  if (!user || !profile) {
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <View style={styles.centerContent}>
          <IconSymbol
            ios_icon_name="person.circle.fill"
            android_material_icon_name="account_circle"
            size={80}
            color={colors.textSecondary}
          />
          <Text style={[styles.title, { color: theme.colors.text }]}>
            Not Signed In
          </Text>
          <Text style={[styles.text, { color: colors.textSecondary }]}>
            Please sign in to view your profile
          </Text>
          <TouchableOpacity
            style={[styles.button, { backgroundColor: colors.primary }]}
            onPress={() => router.push('/login')}
          >
            <Text style={styles.buttonText}>Sign In</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const isSubscribed = checkSubscription();
  const subscriptionEndDate = profile.subscription_end_date 
    ? new Date(profile.subscription_end_date).toLocaleDateString()
    : null;

  return (
    <ScrollView 
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      contentContainerStyle={styles.scrollContent}
    >
      <View style={styles.header}>
        <View style={[styles.avatarContainer, { backgroundColor: colors.primary }]}>
          <IconSymbol
            ios_icon_name="person.fill"
            android_material_icon_name="person"
            size={48}
            color="#FFFFFF"
          />
        </View>
        <Text style={[styles.email, { color: theme.colors.text }]}>
          {user.email}
        </Text>
        {profile.is_admin && (
          <View style={[styles.badge, { backgroundColor: colors.accent }]}>
            <IconSymbol
              ios_icon_name="star.fill"
              android_material_icon_name="star"
              size={16}
              color="#FFFFFF"
            />
            <Text style={styles.badgeText}>Admin</Text>
          </View>
        )}
      </View>

      {/* Subscription Status */}
      <View style={[styles.card, { backgroundColor: theme.colors.card }]}>
        <View style={styles.cardHeader}>
          <IconSymbol
            ios_icon_name="checkmark.seal.fill"
            android_material_icon_name="verified"
            size={24}
            color={isSubscribed ? colors.primary : colors.textSecondary}
          />
          <Text style={[styles.cardTitle, { color: theme.colors.text }]}>
            Subscription Status
          </Text>
        </View>
        
        <View style={styles.statusContainer}>
          <Text style={[styles.statusLabel, { color: colors.textSecondary }]}>
            Status:
          </Text>
          <Text style={[
            styles.statusValue, 
            { color: isSubscribed ? colors.primary : colors.textSecondary }
          ]}>
            {isSubscribed ? 'Active ✓' : 'Inactive'}
          </Text>
        </View>

        {subscriptionEndDate && (
          <View style={styles.statusContainer}>
            <Text style={[styles.statusLabel, { color: colors.textSecondary }]}>
              {isSubscribed ? 'Renews:' : 'Expired:'}
            </Text>
            <Text style={[styles.statusValue, { color: theme.colors.text }]}>
              {subscriptionEndDate}
            </Text>
          </View>
        )}

        {!isSubscribed && !profile.is_admin && (
          <TouchableOpacity
            style={[styles.subscribeButton, { backgroundColor: colors.accent }]}
            onPress={handleSubscribeNow}
            disabled={isSubscribing}
          >
            {isSubscribing ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <React.Fragment>
                <IconSymbol
                  ios_icon_name="star.fill"
                  android_material_icon_name="star"
                  size={20}
                  color="#FFFFFF"
                />
                <Text style={styles.subscribeButtonText}>Subscribe Now - $10.99/month</Text>
              </React.Fragment>
            )}
          </TouchableOpacity>
        )}

        {isSubscribed && (
          <TouchableOpacity
            style={[styles.manageButton, { borderColor: colors.primary }]}
            onPress={handleManageSubscription}
            disabled={isLoadingCustomerCenter}
          >
            {isLoadingCustomerCenter ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <React.Fragment>
                <IconSymbol
                  ios_icon_name="gearshape.fill"
                  android_material_icon_name="settings"
                  size={20}
                  color={colors.primary}
                />
                <Text style={[styles.manageButtonText, { color: colors.primary }]}>
                  Manage Subscription
                </Text>
              </React.Fragment>
            )}
          </TouchableOpacity>
        )}

        {/* Restore Purchases Button */}
        <TouchableOpacity
          style={[styles.restoreButton, { borderColor: colors.textSecondary }]}
          onPress={handleRestorePurchases}
          disabled={isRestoring}
        >
          {isRestoring ? (
            <ActivityIndicator size="small" color={colors.textSecondary} />
          ) : (
            <React.Fragment>
              <IconSymbol
                ios_icon_name="arrow.clockwise"
                android_material_icon_name="refresh"
                size={20}
                color={colors.textSecondary}
              />
              <Text style={[styles.restoreButtonText, { color: colors.textSecondary }]}>
                Restore Purchases
              </Text>
            </React.Fragment>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.refreshButton, { borderColor: colors.primary }]}
          onPress={handleRefreshProfile}
        >
          <IconSymbol
            ios_icon_name="arrow.clockwise"
            android_material_icon_name="refresh"
            size={20}
            color={colors.primary}
          />
          <Text style={[styles.refreshButtonText, { color: colors.primary }]}>
            Refresh Profile Data
          </Text>
        </TouchableOpacity>
      </View>

      {/* Admin Panel Access */}
      {isAdmin() && (
        <TouchableOpacity
          style={[styles.card, { backgroundColor: theme.colors.card }]}
          onPress={() => router.push('/admin')}
        >
          <View style={styles.cardHeader}>
            <IconSymbol
              ios_icon_name="gearshape.fill"
              android_material_icon_name="settings"
              size={24}
              color={colors.primary}
            />
            <Text style={[styles.cardTitle, { color: theme.colors.text }]}>
              Admin Panel
            </Text>
            <IconSymbol
              ios_icon_name="chevron.right"
              android_material_icon_name="chevron_right"
              size={20}
              color={colors.textSecondary}
            />
          </View>
          <Text style={[styles.cardDescription, { color: colors.textSecondary }]}>
            Manage videos, surf reports, and subscription settings
          </Text>
        </TouchableOpacity>
      )}

      {/* Account Actions */}
      <View style={[styles.card, { backgroundColor: theme.colors.card }]}>
        <TouchableOpacity
          style={styles.actionItem}
          onPress={handleSignOut}
        >
          <IconSymbol
            ios_icon_name="rectangle.portrait.and.arrow.right"
            android_material_icon_name="logout"
            size={24}
            color={colors.textSecondary}
          />
          <Text style={[styles.actionText, { color: theme.colors.text }]}>
            Sign Out
          </Text>
        </TouchableOpacity>
      </View>

      {/* Debug Info */}
      {__DEV__ && (
        <View style={[styles.debugCard, { backgroundColor: theme.colors.card }]}>
          <Text style={[styles.debugTitle, { color: theme.colors.text }]}>
            Debug Info
          </Text>
          <Text style={[styles.debugText, { color: colors.textSecondary }]}>
            User ID: {user.id}
          </Text>
          <Text style={[styles.debugText, { color: colors.textSecondary }]}>
            Is Admin: {profile.is_admin ? 'Yes' : 'No'}
          </Text>
          <Text style={[styles.debugText, { color: colors.textSecondary }]}>
            Is Subscribed: {profile.is_subscribed ? 'Yes' : 'No'}
          </Text>
          <Text style={[styles.debugText, { color: colors.textSecondary }]}>
            Subscription Check: {isSubscribed ? 'Active' : 'Inactive'}
          </Text>
          <Text style={[styles.debugText, { color: colors.textSecondary }]}>
            Payment System Available: {isPaymentSystemAvailable() ? 'Yes' : 'No'}
          </Text>
        </View>
      )}

      {/* Info */}
      <View style={styles.infoContainer}>
        <Text style={[styles.infoText, { color: colors.textSecondary }]}>
          SurfVista - Folly Beach, SC
        </Text>
        <Text style={[styles.infoText, { color: colors.textSecondary }]}>
          Version 1.0.0
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 100,
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  header: {
    alignItems: 'center',
    marginBottom: 24,
    paddingTop: 20,
  },
  avatarContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  email: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: 'bold',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginTop: 16,
    marginBottom: 8,
  },
  text: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 24,
  },
  button: {
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 12,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
  card: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    boxShadow: '0px 2px 8px rgba(0, 0, 0, 0.1)',
    elevation: 3,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    flex: 1,
  },
  cardDescription: {
    fontSize: 14,
    lineHeight: 20,
  },
  statusContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  statusLabel: {
    fontSize: 16,
  },
  statusValue: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  subscribeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 12,
  },
  subscribeButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  manageButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 10,
    borderRadius: 8,
    marginTop: 12,
    borderWidth: 1,
  },
  manageButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  restoreButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 10,
    borderRadius: 8,
    marginTop: 8,
    borderWidth: 1,
  },
  restoreButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  refreshButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 10,
    borderRadius: 8,
    marginTop: 8,
    borderWidth: 1,
  },
  refreshButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  actionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 4,
  },
  actionText: {
    fontSize: 16,
  },
  debugCard: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 2,
    borderColor: '#FFA07A',
  },
  debugTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  debugText: {
    fontSize: 12,
    marginBottom: 4,
    fontFamily: 'monospace',
  },
  infoContainer: {
    alignItems: 'center',
    marginTop: 24,
    gap: 4,
  },
  infoText: {
    fontSize: 12,
  },
});
