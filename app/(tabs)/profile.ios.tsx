
import { useState, useEffect, useCallback } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, ActivityIndicator, Switch } from "react-native";
import { useTheme } from "@react-navigation/native";
import { useAuth } from "@/contexts/AuthContext";
import { router } from "expo-router";
import { colors } from "@/styles/commonStyles";
import { IconSymbol } from "@/components/IconSymbol";
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
  getDailyReportNotificationStatus 
} from '@/utils/pushNotifications';

export default function ProfileScreen() {
  const theme = useTheme();
  const { user, profile, signOut, deleteAccount, refreshProfile, checkSubscription, isAdmin } = useAuth();
  const [isRestoring, setIsRestoring] = useState(false);
  const [isLoadingCustomerCenter, setIsLoadingCustomerCenter] = useState(false);
  const [isSubscribing, setIsSubscribing] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isRefreshingProducts, setIsRefreshingProducts] = useState(false);
  const [dailyNotificationsEnabled, setDailyNotificationsEnabled] = useState(false);
  const [isTogglingNotifications, setIsTogglingNotifications] = useState(false);
  const [paymentSystemReady, setPaymentSystemReady] = useState(false);

  const loadNotificationStatus = useCallback(async () => {
    if (!user?.id) {
      return;
    }
    console.log('[ProfileScreen iOS] 🔍 Loading notification status...');
    const status = await getDailyReportNotificationStatus(user.id);
    console.log('[ProfileScreen iOS] ✅ Notification status loaded:', status);
    setDailyNotificationsEnabled(status);
  }, [user?.id]);

  useEffect(() => {
    if (user?.id) {
      loadNotificationStatus();
    }
  }, [user?.id, loadNotificationStatus]);

  // Check payment system status on mount
  useEffect(() => {
    const checkPaymentSystem = async () => {
      console.log('[ProfileScreen iOS] 💳 Checking payment system status...');
      
      const isAvailable = isPaymentSystemAvailable();
      console.log('[ProfileScreen iOS] 💳 Payment system available:', isAvailable);
      
      if (!isAvailable) {
        console.log('[ProfileScreen iOS] ⚠️ Payment system not ready, attempting initialization...');
        const initialized = await initializeRevenueCat();
        console.log('[ProfileScreen iOS] 💳 Initialization result:', initialized);
        setPaymentSystemReady(initialized);
      } else {
        setPaymentSystemReady(true);
      }
    };
    
    checkPaymentSystem();
  }, []);

  const handleToggleDailyNotifications = async (value: boolean) => {
    if (!user?.id) {
      console.error('[ProfileScreen iOS] ❌ No user ID available');
      return;
    }

    console.log('[ProfileScreen iOS] 🔔 Toggle notifications button pressed:', value);
    setIsTogglingNotifications(true);

    try {
      const success = await setDailyReportNotifications(user.id, value);
      
      if (success) {
        console.log('[ProfileScreen iOS] ✅ Notifications updated successfully');
        setDailyNotificationsEnabled(value);
        
        const statusText = value ? 'Enabled' : 'Disabled';
        const messageText = value 
          ? 'You will receive a push notification each morning at 5 AM with your daily surf report summary!'
          : 'Daily surf report notifications have been disabled.';
        
        Alert.alert(
          `Notifications ${statusText}`,
          messageText,
          [{ text: 'OK' }]
        );
      } else {
        console.error('[ProfileScreen iOS] ❌ Failed to update notifications');
        Alert.alert(
          'Error',
          'Failed to update notification preferences. Please try again.',
          [{ text: 'OK' }]
        );
      }
    } catch (error) {
      console.error('[ProfileScreen iOS] ❌ Exception toggling notifications:', error);
      Alert.alert(
        'Error',
        'An error occurred while updating notifications.',
        [{ text: 'OK' }]
      );
    } finally {
      setIsTogglingNotifications(false);
    }
  };

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
              console.log('[ProfileScreen iOS] ===== SIGN OUT BUTTON PRESSED =====');
              await signOut();
              router.replace('/login');
            } catch (error) {
              console.error('[ProfileScreen iOS] ❌ Error during sign out:', error);
              router.replace('/login');
            }
          }
        }
      ]
    );
  };

  const handleDeleteAccount = () => {
    const userEmail = user?.email || 'your account';
    
    Alert.alert(
      'Delete Account',
      `Are you sure you want to permanently delete ${userEmail}?\n\nThis action cannot be undone. All your data will be permanently deleted.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Account',
          style: 'destructive',
          onPress: () => {
            Alert.alert(
              'Final Confirmation',
              'This is your last chance. Are you absolutely sure you want to delete your account?',
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Yes, Delete Forever',
                  style: 'destructive',
                  onPress: async () => {
                    try {
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
                  }
                }
              ]
            );
          }
        }
      ]
    );
  };

  const handleRefreshProfile = async () => {
    console.log('[ProfileScreen iOS] 🔄 Refreshing profile data...');
    await refreshProfile();
    await loadNotificationStatus();
    Alert.alert('Success', 'Profile data refreshed');
  };

  const handleRefreshProducts = async () => {
    console.log('[ProfileScreen iOS] 🔄 ===== REFRESH PRODUCTS BUTTON PRESSED =====');
    
    setIsRefreshingProducts(true);
    
    try {
      // Ensure RevenueCat is initialized first
      if (!isPaymentSystemAvailable()) {
        console.log('[ProfileScreen iOS] ⚠️ Payment system not available, initializing...');
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
      console.error('[ProfileScreen iOS] ❌ Refresh products error:', error);
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
    console.log('[ProfileScreen iOS] 🔄 ===== RESTORE PURCHASES BUTTON PRESSED =====');
    
    setIsRestoring(true);
    
    try {
      // Ensure RevenueCat is initialized first
      if (!isPaymentSystemAvailable()) {
        console.log('[ProfileScreen iOS] ⚠️ Payment system not available, initializing...');
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
      console.error('[ProfileScreen iOS] ❌ Restore error:', error);
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
    console.log('[ProfileScreen iOS] ⚙️ ===== MANAGE SUBSCRIPTION BUTTON PRESSED =====');
    
    setIsLoadingCustomerCenter(true);
    
    try {
      // Ensure RevenueCat is initialized first
      if (!isPaymentSystemAvailable()) {
        console.log('[ProfileScreen iOS] ⚠️ Payment system not available, initializing...');
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
      console.error('[ProfileScreen iOS] ❌ Customer center error:', error);
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
    console.log('[ProfileScreen iOS] 🔘 ===== SUBSCRIBE NOW BUTTON PRESSED =====');
    
    setIsSubscribing(true);

    try {
      // Ensure RevenueCat is initialized first
      if (!isPaymentSystemAvailable()) {
        console.log('[ProfileScreen iOS] ⚠️ Payment system not available, initializing...');
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
      
      console.log('[ProfileScreen iOS] 📊 Paywall result:', result);
      
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
      console.error('[ProfileScreen iOS] ❌ Subscribe error:', error);
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

        <View style={styles.notificationRow}>
          <View style={styles.notificationInfo}>
            <Text style={[styles.notificationTitle, { color: theme.colors.text }]}>
              Daily Surf Report
            </Text>
            <Text style={[styles.notificationDescription, { color: colors.textSecondary }]}>
              Get a push notification at 5 AM with your daily surf report summary
            </Text>
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
            />
          )}
        </View>
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
        </View>
      )}

      <View style={styles.infoContainer}>
        <Text style={[styles.infoText, { color: colors.textSecondary }]}>
          SurfVista - Folly Beach, SC
        </Text>
        <Text style={[styles.infoText, { color: colors.textSecondary }]}>
          Version 6.0.2
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
});
