
import { useState, useEffect, useCallback } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, ActivityIndicator, Switch, Modal } from "react-native";
import { useTheme } from "@react-navigation/native";
import { useAuth } from "@/contexts/AuthContext";
import { router } from "expo-router";
import { colors } from "@/styles/commonStyles";
import { IconSymbol } from "@/components/IconSymbol";
import { NotificationLocationSelector } from "@/components/NotificationLocationSelector";
import { 
  restorePurchases, 
  presentCustomerCenter,
  presentPaywall,
  forceRefreshOfferings,
  isPaymentSystemAvailable,
  initializeRevenueCat
} from '@/utils/superwallConfig';
import { 
  setDailyReportNotifications, 
  getDailyReportNotificationStatus,
  checkNotificationPermissions,
  openNotificationSettings,
  getNotificationLocations,
  setNotificationLocations,
  ensurePushTokenRegistered
} from '@/utils/pushNotifications';

export default function ProfileScreen() {
  const theme = useTheme();
  const { user, profile, signOut, deleteAccount, refreshProfile, refreshSession, checkSubscription, isAdmin } = useAuth();
  const [isRestoring, setIsRestoring] = useState(false);
  const [isLoadingCustomerCenter, setIsLoadingCustomerCenter] = useState(false);
  const [isSubscribing, setIsSubscribing] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isRefreshingProducts, setIsRefreshingProducts] = useState(false);
  const [dailyNotificationsEnabled, setDailyNotificationsEnabled] = useState(false);
  const [isTogglingNotifications, setIsTogglingNotifications] = useState(false);
  const [paymentSystemReady, setPaymentSystemReady] = useState(false);
  const [showSignOutModal, setShowSignOutModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showDeleteConfirmModal, setShowDeleteConfirmModal] = useState(false);
  const [notificationPermissionStatus, setNotificationPermissionStatus] = useState<{
    granted: boolean;
    canAskAgain: boolean;
    status: string;
  } | null>(null);
  const [showPermissionPrompt, setShowPermissionPrompt] = useState(false);
  const [selectedNotificationLocations, setSelectedNotificationLocations] = useState<string[]>(['folly-beach']);
  const [isLoadingLocations, setIsLoadingLocations] = useState(false);

  const loadNotificationStatus = useCallback(async () => {
    if (!user?.id) {
      return;
    }
    console.log('[ProfileScreen] 🔍 Loading notification status...');
    const status = await getDailyReportNotificationStatus(user.id);
    console.log('[ProfileScreen] ✅ Notification status loaded:', status);
    setDailyNotificationsEnabled(status);
  }, [user?.id]);

  const loadNotificationLocations = useCallback(async () => {
    if (!user?.id) {
      return;
    }
    console.log('[ProfileScreen] 📍 Loading notification locations...');
    setIsLoadingLocations(true);
    const locations = await getNotificationLocations(user.id);
    console.log('[ProfileScreen] 📍 Notification locations loaded:', locations);
    setSelectedNotificationLocations(locations);
    setIsLoadingLocations(false);
  }, [user?.id]);

  const checkPermissions = useCallback(async () => {
    console.log('[ProfileScreen] 🔐 Checking notification permissions...');
    const permStatus = await checkNotificationPermissions();
    console.log('[ProfileScreen] 🔐 Permission status:', permStatus);
    setNotificationPermissionStatus(permStatus);

    // If notifications are enabled in profile but permissions are denied, show prompt
    if (dailyNotificationsEnabled && !permStatus.granted && permStatus.status !== 'simulator') {
      console.log('[ProfileScreen] ⚠️ Notifications enabled but permissions denied - showing prompt');
      setShowPermissionPrompt(true);
    }
  }, [dailyNotificationsEnabled]);

  // Load notification status and locations when screen loads
  useEffect(() => {
    if (user?.id) {
      console.log('[ProfileScreen] 📲 Screen loaded - loading notification data...');
      loadNotificationStatus();
      loadNotificationLocations();
      
      // Check push token registration (silent, automatic)
      ensurePushTokenRegistered(user.id).catch(error => {
        console.error('[ProfileScreen] ⚠️ Push token check error (non-critical):', error);
      });
    }
  }, [user?.id, loadNotificationStatus, loadNotificationLocations]);

  useEffect(() => {
    checkPermissions();
  }, [checkPermissions]);

  // Check payment system status on mount
  useEffect(() => {
    const checkPaymentSystem = async () => {
      console.log('[ProfileScreen] 💳 Checking payment system status...');
      
      const isAvailable = isPaymentSystemAvailable();
      console.log('[ProfileScreen] 💳 Payment system available:', isAvailable);
      
      if (!isAvailable) {
        console.log('[ProfileScreen] ⚠️ Payment system not ready, attempting initialization...');
        const initialized = await initializeRevenueCat();
        console.log('[ProfileScreen] 💳 Initialization result:', initialized);
        setPaymentSystemReady(initialized);
      } else {
        setPaymentSystemReady(true);
      }
    };
    
    checkPaymentSystem();
  }, []);

  const handleLocationsChange = async (newLocations: string[]) => {
    if (!user?.id) {
      console.error('[ProfileScreen] ❌ No user ID available');
      return;
    }

    console.log('[ProfileScreen] 📍 Updating notification locations:', newLocations);
    
    try {
      // Refresh session first
      await refreshSession();
      await new Promise(resolve => setTimeout(resolve, 300));
      
      const success = await setNotificationLocations(user.id, newLocations);
      
      if (success) {
        console.log('[ProfileScreen] ✅ Locations updated successfully');
        setSelectedNotificationLocations(newLocations);
        
        const locationText = newLocations.length === 1 
          ? '1 location' 
          : `${newLocations.length} locations`;
        
        Alert.alert(
          'Locations Updated',
          `You will receive daily reports for ${locationText}.`,
          [{ text: 'OK' }]
        );
      } else {
        console.error('[ProfileScreen] ❌ Failed to update locations');
        Alert.alert(
          'Update Failed',
          'Failed to update notification locations. Please try again.',
          [{ text: 'OK' }]
        );
      }
    } catch (error) {
      console.error('[ProfileScreen] ❌ Exception updating locations:', error);
      Alert.alert(
        'Error',
        'An error occurred while updating locations. Please try again.',
        [{ text: 'OK' }]
      );
    }
  };

  // ✅ V9.0 CRITICAL FIX: Enhanced toggle handler with better state management
  const handleToggleDailyNotifications = async (value: boolean) => {
    if (!user?.id) {
      console.error('[ProfileScreen] ❌ No user ID available');
      Alert.alert(
        'Error',
        'Unable to update notifications. Please try signing out and back in.',
        [{ text: 'OK' }]
      );
      return;
    }

    console.log('[ProfileScreen] ═══════════════════════════════════════');
    console.log('[ProfileScreen] 🔔 V9.0 CRITICAL FIX: TOGGLE PRESSED');
    console.log('[ProfileScreen] ═══════════════════════════════════════');
    console.log('[ProfileScreen] User toggled notifications to:', value);
    console.log('[ProfileScreen] Current state:', dailyNotificationsEnabled);

    // If enabling, check permissions first
    if (value) {
      console.log('[ProfileScreen] 🔐 User is ENABLING - checking permissions...');
      const permStatus = await checkNotificationPermissions();
      console.log('[ProfileScreen] 🔐 Permission check result:', permStatus);

      if (!permStatus.granted && permStatus.status !== 'simulator') {
        console.log('[ProfileScreen] ⚠️ Permissions not granted - showing prompt');
        setShowPermissionPrompt(true);
        return;
      }
    }

    // ✅ V9.0 CRITICAL FIX: Set loading state IMMEDIATELY
    console.log('[ProfileScreen] ⏳ Setting loading state...');
    setIsTogglingNotifications(true);

    try {
      // Refresh session to ensure valid token
      console.log('[ProfileScreen] 🔄 Refreshing session...');
      await refreshSession();
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // ✅ V9.0 CRITICAL FIX: Call the main function that handles everything
      console.log('[ProfileScreen] 📝 Calling setDailyReportNotifications...');
      console.log('[ProfileScreen] 📝 This will register token and update database...');
      const success = await setDailyReportNotifications(user.id, value);
      console.log('[ProfileScreen] 📝 Result:', success ? 'SUCCESS ✓' : 'FAILED ✗');
      
      if (success) {
        console.log('[ProfileScreen] ✅ Notifications updated successfully');
        
        // ✅ V9.0 CRITICAL FIX: Update local state IMMEDIATELY
        setDailyNotificationsEnabled(value);
        
        const statusText = value ? 'Enabled' : 'Disabled';
        const messageText = value 
          ? 'You will receive a push notification each morning at 5 AM EST with your daily surf report summary!'
          : 'Daily surf report notifications have been disabled.';
        
        Alert.alert(
          `Notifications ${statusText}`,
          messageText,
          [{ text: 'OK' }]
        );
        
        // Reload profile to verify token was saved
        if (value) {
          console.log('[ProfileScreen] 🔄 Reloading profile to verify token...');
          await refreshProfile();
        }
      } else {
        console.error('[ProfileScreen] ❌ Failed to update notifications');
        
        // ✅ V9.0 CRITICAL FIX: DO NOT revert toggle - keep it in sync with what user clicked
        // The setDailyReportNotifications function already showed an error alert
        console.log('[ProfileScreen] ℹ️ Keeping toggle state as-is (error already shown to user)');
      }
    } catch (error) {
      console.error('[ProfileScreen] ❌ Exception toggling notifications:', error);
      
      Alert.alert(
        'Error',
        'An error occurred while updating notifications. Please try again.',
        [{ text: 'OK' }]
      );
    } finally {
      // ✅ V9.0 CRITICAL FIX: ALWAYS clear loading state
      console.log('[ProfileScreen] ✅ Clearing loading state');
      setIsTogglingNotifications(false);
    }
  };

  const handleSignOut = () => {
    console.log('[ProfileScreen] Sign out button pressed');
    setShowSignOutModal(true);
  };

  const confirmSignOut = async () => {
    try {
      console.log('[ProfileScreen] ===== SIGN OUT CONFIRMED =====');
      setShowSignOutModal(false);
      await signOut();
      router.replace('/login');
    } catch (error) {
      console.error('[ProfileScreen] ❌ Error during sign out:', error);
      router.replace('/login');
    }
  };

  const handleDeleteAccount = () => {
    console.log('[ProfileScreen] Delete account button pressed');
    setShowDeleteModal(true);
  };

  const confirmDeleteAccount = () => {
    setShowDeleteModal(false);
    setShowDeleteConfirmModal(true);
  };

  const finalDeleteAccount = async () => {
    try {
      console.log('[ProfileScreen] ===== FINAL DELETE CONFIRMED =====');
      setShowDeleteConfirmModal(false);
      setIsDeleting(true);
      
      const result = await deleteAccount();
      setIsDeleting(false);
      
      if (result.success) {
        Alert.alert(
          'Account Deleted',
          result.message,
          [
            {
              text: 'OK',
              onPress: () => router.replace('/login')
            }
          ]
        );
      } else {
        Alert.alert('Error', result.message);
      }
    } catch (err: any) {
      setIsDeleting(false);
      Alert.alert('Error', err.message || 'Failed to delete account. Please try again.');
    }
  };

  const handleRefreshProfile = async () => {
    console.log('[ProfileScreen] 🔄 Refreshing profile data...');
    await refreshProfile();
    await loadNotificationStatus();
    await loadNotificationLocations();
    await checkPermissions();
    
    // Also check push token registration (silent, automatic)
    if (user?.id) {
      await ensurePushTokenRegistered(user.id);
    }
    
    Alert.alert('Success', 'Profile data refreshed');
  };

  const handleRefreshProducts = async () => {
    console.log('[ProfileScreen] 🔄 ===== REFRESH PRODUCTS BUTTON PRESSED =====');
    
    setIsRefreshingProducts(true);
    
    try {
      // Ensure RevenueCat is initialized first
      if (!isPaymentSystemAvailable()) {
        console.log('[ProfileScreen] ⚠️ Payment system not available, initializing...');
        const initialized = await initializeRevenueCat();
        
        if (!initialized) {
          Alert.alert(
            'Payment System Not Ready',
            'The payment system could not be initialized. Please restart the app and try again.',
            [{ text: 'OK' }]
          );
          return;
        }
        
        setPaymentSystemReady(true);
      }
      
      const result = await forceRefreshOfferings();
      
      Alert.alert(
        result.success ? 'Products Refreshed' : 'Setup Required',
        result.message,
        [{ text: 'OK' }]
      );
    } catch (error) {
      console.error('[ProfileScreen] ❌ Refresh products error:', error);
      Alert.alert(
        'Refresh Failed',
        'Unable to refresh products. Please try again later.',
        [{ text: 'OK' }]
      );
    } finally {
      setIsRefreshingProducts(false);
    }
  };

  const handleRestorePurchases = async () => {
    console.log('[ProfileScreen] 🔄 ===== RESTORE PURCHASES BUTTON PRESSED =====');
    
    setIsRestoring(true);
    
    try {
      // Ensure RevenueCat is initialized first
      if (!isPaymentSystemAvailable()) {
        console.log('[ProfileScreen] ⚠️ Payment system not available, initializing...');
        const initialized = await initializeRevenueCat();
        
        if (!initialized) {
          Alert.alert(
            'Payment System Not Ready',
            'The payment system could not be initialized. Please restart the app and try again.',
            [{ text: 'OK' }]
          );
          return;
        }
        
        setPaymentSystemReady(true);
      }
      
      const result = await restorePurchases();
      await refreshProfile();
      
      Alert.alert(
        result.success ? 'Purchases Restored' : 'No Purchases Found',
        result.message || 'Unable to restore purchases.',
        [{ text: 'OK' }]
      );
    } catch (error) {
      console.error('[ProfileScreen] ❌ Restore error:', error);
      Alert.alert(
        'Restore Failed',
        'Unable to restore purchases at this time.',
        [{ text: 'OK' }]
      );
    } finally {
      setIsRestoring(false);
    }
  };

  const handleManageSubscription = async () => {
    console.log('[ProfileScreen] ⚙️ ===== MANAGE SUBSCRIPTION BUTTON PRESSED =====');
    
    setIsLoadingCustomerCenter(true);
    
    try {
      // Ensure RevenueCat is initialized first
      if (!isPaymentSystemAvailable()) {
        console.log('[ProfileScreen] ⚠️ Payment system not available, initializing...');
        const initialized = await initializeRevenueCat();
        
        if (!initialized) {
          Alert.alert(
            'Payment System Not Ready',
            'The payment system could not be initialized. Please restart the app and try again.',
            [{ text: 'OK' }]
          );
          return;
        }
        
        setPaymentSystemReady(true);
      }
      
      await presentCustomerCenter();
      await refreshProfile();
    } catch (error) {
      console.error('[ProfileScreen] ❌ Customer center error:', error);
      Alert.alert(
        'Manage Subscription',
        'To manage your subscription:\n\n' +
        '• iOS: Settings > [Your Name] > Subscriptions\n' +
        '• Android: Play Store > Menu > Subscriptions',
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
    
    setIsSubscribing(true);

    try {
      // Ensure RevenueCat is initialized first
      if (!isPaymentSystemAvailable()) {
        console.log('[ProfileScreen] ⚠️ Payment system not available, initializing...');
        const initialized = await initializeRevenueCat();
        
        if (!initialized) {
          Alert.alert(
            'Payment System Not Ready',
            'The payment system could not be initialized. Please restart the app and try again.',
            [{ text: 'OK' }]
          );
          return;
        }
        
        setPaymentSystemReady(true);
      }
      
      const result = await presentPaywall(user?.id, user?.email || undefined);
      
      console.log('[ProfileScreen] 📊 Paywall result:', result);
      
      await refreshProfile();
      
      if (result.state === 'purchased' || result.state === 'restored') {
        Alert.alert(
          'Success!',
          result.message || 'Subscription activated successfully!',
          [{ text: 'OK' }]
        );
      } else if (result.state === 'not_configured') {
        Alert.alert(
          'Setup Required',
          result.message || 'Subscriptions are not configured yet.',
          [
            { 
              text: 'Refresh Products', 
              onPress: handleRefreshProducts
            },
            { text: 'OK', style: 'cancel' }
          ]
        );
      } else if (result.state === 'error') {
        Alert.alert(
          'Error',
          result.message || 'Unable to load subscription options.',
          [{ text: 'OK' }]
        );
      }
      
    } catch (error) {
      console.error('[ProfileScreen] ❌ Subscribe error:', error);
      Alert.alert(
        'Subscribe Failed',
        'Unable to open subscription page. Please try again later.',
        [{ text: 'OK' }]
      );
    } finally {
      setIsSubscribing(false);
    }
  };

  if (!user || !profile) {
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <View style={styles.centerContent}>
          <IconSymbol
            ios_icon_name="person.circle.fill"
            android_material_icon_name="account-circle"
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

  const permissionStatusText = notificationPermissionStatus?.status === 'simulator' 
    ? 'Simulator (Not Available)'
    : notificationPermissionStatus?.granted 
      ? 'Granted ✓' 
      : notificationPermissionStatus?.canAskAgain 
        ? 'Not Requested' 
        : 'Denied';

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
              <>
                <IconSymbol
                  ios_icon_name="star.fill"
                  android_material_icon_name="star"
                  size={20}
                  color="#FFFFFF"
                />
                <Text style={styles.subscribeButtonText}>Subscribe Now - $12.99/month</Text>
              </>
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
              <>
                <IconSymbol
                  ios_icon_name="gearshape.fill"
                  android_material_icon_name="settings"
                  size={20}
                  color={colors.primary}
                />
                <Text style={[styles.manageButtonText, { color: colors.primary }]}>
                  Manage Subscription
                </Text>
              </>
            )}
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={[styles.refreshProductsButton, { borderColor: colors.accent }]}
          onPress={handleRefreshProducts}
          disabled={isRefreshingProducts}
        >
          {isRefreshingProducts ? (
            <ActivityIndicator size="small" color={colors.accent} />
          ) : (
            <>
              <IconSymbol
                ios_icon_name="arrow.triangle.2.circlepath"
                android_material_icon_name="sync"
                size={20}
                color={colors.accent}
              />
              <Text style={[styles.refreshProductsButtonText, { color: colors.accent }]}>
                Refresh Products
              </Text>
            </>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.restoreButton, { borderColor: colors.textSecondary }]}
          onPress={handleRestorePurchases}
          disabled={isRestoring}
        >
          {isRestoring ? (
            <ActivityIndicator size="small" color={colors.textSecondary} />
          ) : (
            <>
              <IconSymbol
                ios_icon_name="arrow.clockwise"
                android_material_icon_name="refresh"
                size={20}
                color={colors.textSecondary}
              />
              <Text style={[styles.restoreButtonText, { color: colors.textSecondary }]}>
                Restore Purchases
              </Text>
            </>
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

      <View style={[styles.card, { backgroundColor: theme.colors.card }]}>
        <View style={styles.cardHeader}>
          <IconSymbol
            ios_icon_name="bell.fill"
            android_material_icon_name="notifications"
            size={24}
            color={colors.primary}
          />
          <Text style={[styles.cardTitle, { color: theme.colors.text }]}>
            Notifications
          </Text>
        </View>

        {notificationPermissionStatus && !notificationPermissionStatus.granted && notificationPermissionStatus.status !== 'simulator' && (
          <View style={[styles.permissionWarning, { backgroundColor: 'rgba(255, 149, 0, 0.1)' }]}>
            <IconSymbol
              ios_icon_name="exclamationmark.triangle.fill"
              android_material_icon_name="warning"
              size={20}
              color="#FF9500"
            />
            <View style={styles.permissionWarningTextContainer}>
              <Text style={[styles.permissionWarningText, { color: '#FF9500' }]}>
                Notification permissions are {notificationPermissionStatus.canAskAgain ? 'not enabled' : 'denied'}
              </Text>
              <TouchableOpacity onPress={openNotificationSettings}>
                <Text style={[styles.permissionWarningLink, { color: colors.primary }]}>
                  Open Settings →
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        <View style={styles.notificationRow}>
          <View style={styles.notificationInfo}>
            <Text style={[styles.notificationTitle, { color: theme.colors.text }]}>
              Daily Surf Report
            </Text>
            <Text style={[styles.notificationDescription, { color: colors.textSecondary }]}>
              Get a push notification at 5 AM EST with your daily surf report summary
            </Text>
            {notificationPermissionStatus && (
              <Text style={[styles.permissionStatus, { 
                color: notificationPermissionStatus.granted ? colors.primary : colors.textSecondary 
              }]}>
                Permission: {permissionStatusText}
              </Text>
            )}
          </View>
          {isTogglingNotifications ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : (
            <Switch
              value={dailyNotificationsEnabled}
              onValueChange={handleToggleDailyNotifications}
              trackColor={{ false: '#767577', true: colors.primary }}
              thumbColor={dailyNotificationsEnabled ? '#FFFFFF' : '#f4f3f4'}
              ios_backgroundColor="#3e3e3e"
              disabled={isTogglingNotifications}
            />
          )}
        </View>

        {dailyNotificationsEnabled && (
          <>
            <View style={styles.dividerSmall} />
            {isLoadingLocations ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="small" color={colors.primary} />
                <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
                  Loading locations...
                </Text>
              </View>
            ) : (
              <NotificationLocationSelector
                selectedLocations={selectedNotificationLocations}
                onLocationsChange={handleLocationsChange}
                disabled={!dailyNotificationsEnabled}
              />
            )}
          </>
        )}
      </View>

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
              android_material_icon_name="chevron-right"
              size={20}
              color={colors.textSecondary}
            />
          </View>
          <Text style={[styles.cardDescription, { color: colors.textSecondary }]}>
            Manage videos, surf reports, and subscription settings
          </Text>
        </TouchableOpacity>
      )}

      <View style={[styles.card, { backgroundColor: theme.colors.card }]}>
        <TouchableOpacity
          style={styles.actionItem}
          onPress={() => router.push('/privacy-policy')}
        >
          <IconSymbol
            ios_icon_name="hand.raised.fill"
            android_material_icon_name="privacy-tip"
            size={24}
            color={colors.textSecondary}
          />
          <Text style={[styles.actionText, { color: theme.colors.text }]}>
            Privacy Policy
          </Text>
          <IconSymbol
            ios_icon_name="chevron.right"
            android_material_icon_name="chevron-right"
            size={20}
            color={colors.textSecondary}
          />
        </TouchableOpacity>

        <View style={styles.divider} />

        <TouchableOpacity
          style={styles.actionItem}
          onPress={() => router.push('/terms-of-service')}
        >
          <IconSymbol
            ios_icon_name="doc.text.fill"
            android_material_icon_name="description"
            size={24}
            color={colors.textSecondary}
          />
          <Text style={[styles.actionText, { color: theme.colors.text }]}>
            Terms of Service
          </Text>
          <IconSymbol
            ios_icon_name="chevron.right"
            android_material_icon_name="chevron-right"
            size={20}
            color={colors.textSecondary}
          />
        </TouchableOpacity>
      </View>

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

        <View style={styles.divider} />

        <TouchableOpacity
          style={styles.actionItem}
          onPress={handleDeleteAccount}
          disabled={isDeleting}
        >
          {isDeleting ? (
            <ActivityIndicator size="small" color="#FF3B30" />
          ) : (
            <>
              <IconSymbol
                ios_icon_name="trash.fill"
                android_material_icon_name="delete"
                size={24}
                color="#FF3B30"
              />
              <Text style={[styles.actionText, { color: '#FF3B30' }]}>
                Delete Account
              </Text>
            </>
          )}
        </TouchableOpacity>
      </View>

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
            Payment System Ready: {paymentSystemReady ? 'Yes' : 'No'}
          </Text>
          <Text style={[styles.debugText, { color: colors.textSecondary }]}>
            Daily Notifications: {dailyNotificationsEnabled ? 'Enabled' : 'Disabled'}
          </Text>
          <Text style={[styles.debugText, { color: colors.textSecondary }]}>
            Permission Status: {permissionStatusText}
          </Text>
          <Text style={[styles.debugText, { color: colors.textSecondary }]}>
            Push Token: {profile.push_token ? 'Present ✓' : 'Missing ✗'}
          </Text>
          <Text style={[styles.debugText, { color: colors.textSecondary }]}>
            Notification Locations: {selectedNotificationLocations.join(', ')}
          </Text>
          <Text style={[styles.debugText, { color: colors.primary, fontWeight: 'bold' }]}>
            ℹ️ V9.0: Enhanced error handling
          </Text>
        </View>
      )}

      <View style={styles.infoContainer}>
        <Text style={[styles.infoText, { color: colors.textSecondary }]}>
          SurfVista - Folly Beach, SC
        </Text>
        <Text style={[styles.infoText, { color: colors.textSecondary }]}>
          Version 9.0
        </Text>
      </View>

      {/* Permission Prompt Modal */}
      <Modal
        visible={showPermissionPrompt}
        transparent
        animationType="fade"
        onRequestClose={() => setShowPermissionPrompt(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.colors.card }]}>
            <View style={styles.modalIconContainer}>
              <IconSymbol
                ios_icon_name="bell.badge.fill"
                android_material_icon_name="notifications_active"
                size={48}
                color={colors.primary}
              />
            </View>
            <Text style={[styles.modalTitle, { color: theme.colors.text }]}>
              Enable Notifications
            </Text>
            <Text style={[styles.modalMessage, { color: colors.textSecondary }]}>
              To receive daily surf reports at 5 AM EST, you need to enable notifications for SurfVista.
              {'\n\n'}
              Please tap "Open Settings" below and enable notifications.
            </Text>
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalCancelButton]}
                onPress={() => setShowPermissionPrompt(false)}
              >
                <Text style={[styles.modalButtonText, { color: theme.colors.text }]}>
                  Not Now
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalConfirmButton, { backgroundColor: colors.primary }]}
                onPress={async () => {
                  setShowPermissionPrompt(false);
                  await openNotificationSettings();
                }}
              >
                <Text style={[styles.modalButtonText, { color: '#FFFFFF' }]}>
                  Open Settings
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Sign Out Confirmation Modal */}
      <Modal
        visible={showSignOutModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowSignOutModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.colors.card }]}>
            <Text style={[styles.modalTitle, { color: theme.colors.text }]}>
              Sign Out
            </Text>
            <Text style={[styles.modalMessage, { color: colors.textSecondary }]}>
              Are you sure you want to sign out?
            </Text>
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalCancelButton]}
                onPress={() => setShowSignOutModal(false)}
              >
                <Text style={[styles.modalButtonText, { color: theme.colors.text }]}>
                  Cancel
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalConfirmButton, { backgroundColor: '#FF3B30' }]}
                onPress={confirmSignOut}
              >
                <Text style={[styles.modalButtonText, { color: '#FFFFFF' }]}>
                  Sign Out
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Delete Account First Confirmation Modal */}
      <Modal
        visible={showDeleteModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowDeleteModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.colors.card }]}>
            <Text style={[styles.modalTitle, { color: theme.colors.text }]}>
              Delete Account
            </Text>
            <Text style={[styles.modalMessage, { color: colors.textSecondary }]}>
              Are you sure you want to permanently delete {user.email}?
              {'\n\n'}
              This action cannot be undone. All your data will be permanently deleted.
            </Text>
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalCancelButton]}
                onPress={() => setShowDeleteModal(false)}
              >
                <Text style={[styles.modalButtonText, { color: theme.colors.text }]}>
                  Cancel
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalConfirmButton, { backgroundColor: '#FF3B30' }]}
                onPress={confirmDeleteAccount}
              >
                <Text style={[styles.modalButtonText, { color: '#FFFFFF' }]}>
                  Delete Account
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Delete Account Final Confirmation Modal */}
      <Modal
        visible={showDeleteConfirmModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowDeleteConfirmModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.colors.card }]}>
            <Text style={[styles.modalTitle, { color: '#FF3B30' }]}>
              Final Confirmation
            </Text>
            <Text style={[styles.modalMessage, { color: colors.textSecondary }]}>
              This is your last chance. Are you absolutely sure you want to delete your account?
              {'\n\n'}
              This action is PERMANENT and CANNOT be undone.
            </Text>
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalCancelButton]}
                onPress={() => setShowDeleteConfirmModal(false)}
                disabled={isDeleting}
              >
                <Text style={[styles.modalButtonText, { color: theme.colors.text }]}>
                  Cancel
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalConfirmButton, { backgroundColor: '#FF3B30' }]}
                onPress={finalDeleteAccount}
                disabled={isDeleting}
              >
                {isDeleting ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={[styles.modalButtonText, { color: '#FFFFFF' }]}>
                    Yes, Delete Forever
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
  refreshProductsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 10,
    borderRadius: 8,
    marginTop: 8,
    borderWidth: 1,
  },
  refreshProductsButtonText: {
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
  permissionWarning: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  permissionWarningTextContainer: {
    flex: 1,
  },
  permissionWarningText: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  permissionWarningLink: {
    fontSize: 14,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
  notificationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  notificationInfo: {
    flex: 1,
    marginRight: 12,
  },
  notificationTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  notificationDescription: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 4,
  },
  permissionStatus: {
    fontSize: 12,
    fontWeight: '500',
    marginTop: 4,
  },
  dividerSmall: {
    height: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.1)',
    marginVertical: 12,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
  },
  loadingText: {
    fontSize: 14,
  },
  actionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 4,
    flex: 1,
  },
  actionText: {
    fontSize: 16,
    flex: 1,
  },
  divider: {
    height: 1,
    backgroundColor: '#E5E5E5',
    marginVertical: 12,
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 400,
    boxShadow: '0px 4px 16px rgba(0, 0, 0, 0.2)',
    elevation: 5,
  },
  modalIconContainer: {
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 12,
    textAlign: 'center',
  },
  modalMessage: {
    fontSize: 16,
    lineHeight: 24,
    marginBottom: 24,
    textAlign: 'center',
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCancelButton: {
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
  },
  modalConfirmButton: {
    // backgroundColor set inline
  },
  modalButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
});
