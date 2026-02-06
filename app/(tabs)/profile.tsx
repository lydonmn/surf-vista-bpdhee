
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
  presentPaywall,
  forceRefreshOfferings
} from '@/utils/superwallConfig';

export default function ProfileScreen() {
  const theme = useTheme();
  const { user, profile, signOut, deleteAccount, refreshProfile, checkSubscription, isAdmin } = useAuth();
  const [isRestoring, setIsRestoring] = useState(false);
  const [isLoadingCustomerCenter, setIsLoadingCustomerCenter] = useState(false);
  const [isSubscribing, setIsSubscribing] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isRefreshingProducts, setIsRefreshingProducts] = useState(false);

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
              await signOut();
              router.replace('/login');
            } catch (error) {
              console.error('[ProfileScreen] ❌ Error during sign out:', error);
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
                          [{ text: 'OK', onPress: () => router.replace('/login') }]
                        );
                      } else {
                        Alert.alert('Error', result.message);
                      }
                    } catch (error: any) {
                      setIsDeleting(false);
                      Alert.alert('Error', error.message || 'Failed to delete account. Please try again.');
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
    await refreshProfile();
    Alert.alert('Success', 'Profile data refreshed');
  };

  const handleRefreshProducts = async () => {
    console.log('[ProfileScreen] 🔄 ===== REFRESH PRODUCTS BUTTON PRESSED =====');
    
    if (!isPaymentSystemAvailable()) {
      Alert.alert(
        'Payment System Not Ready',
        'The payment system is not initialized yet. Please wait a moment and try again.',
        [{ text: 'OK' }]
      );
      return;
    }
    
    setIsRefreshingProducts(true);
    
    try {
      const result = await forceRefreshOfferings();
      
      if (result.success) {
        Alert.alert(
          'Products Refreshed',
          result.message + '\n\nYou can now try subscribing again.',
          [{ text: 'OK' }]
        );
      } else {
        Alert.alert(
          'Refresh Failed',
          result.message + '\n\nPlease check:\n• Products exist in App Store Connect\n• Products are linked in RevenueCat dashboard\n• Product IDs match exactly\n\nCheck console logs for details.',
          [
            { text: 'OK', style: 'cancel' },
            {
              text: 'View Diagnostics',
              onPress: () => {
                checkPaymentConfiguration();
                Alert.alert(
                  'Diagnostics',
                  'Check the console logs for detailed diagnostic information about your RevenueCat configuration.',
                  [{ text: 'OK' }]
                );
              }
            }
          ]
        );
      }
    } catch (error: any) {
      Alert.alert(
        'Refresh Failed',
        error.message || 'Unable to refresh products. Please try again later.',
        [{ text: 'OK' }]
      );
    } finally {
      setIsRefreshingProducts(false);
    }
  };

  const handleRestorePurchases = async () => {
    if (!isPaymentSystemAvailable()) {
      checkPaymentConfiguration();
      Alert.alert(
        'RevenueCat Configuration Required',
        'The subscription system is not properly configured. Please check the console logs for setup instructions.',
        [{ text: 'OK' }]
      );
      return;
    }

    setIsRestoring(true);
    
    try {
      const result = await restorePurchases();
      await refreshProfile();
      
      if (result.success || result.state === 'restored') {
        Alert.alert('Purchases Restored', 'Your subscription has been restored successfully!', [{ text: 'OK' }]);
      } else {
        Alert.alert('No Purchases Found', 'We couldn\'t find any previous purchases to restore.', [{ text: 'OK' }]);
      }
    } catch (error: any) {
      Alert.alert('Restore Failed', error.message || 'Unable to restore purchases.', [{ text: 'OK' }]);
    } finally {
      setIsRestoring(false);
    }
  };

  const handleManageSubscription = async () => {
    if (!isPaymentSystemAvailable()) {
      checkPaymentConfiguration();
      Alert.alert('RevenueCat Configuration Required', 'Please check the console logs for setup instructions.', [{ text: 'OK' }]);
      return;
    }

    setIsLoadingCustomerCenter(true);
    
    try {
      await presentCustomerCenter();
      await refreshProfile();
    } catch (error: any) {
      Alert.alert(
        'Manage Subscription',
        'To manage your subscription:\n\n• Android: Open Play Store > Menu > Subscriptions\n• iOS: Go to Settings > [Your Name] > Subscriptions',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Restore Purchases', onPress: handleRestorePurchases }
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
      let retryCount = 0;
      const maxRetries = 10;
      let result: any = null;
      
      while (retryCount < maxRetries) {
        result = await presentPaywall(user?.id, user?.email || undefined);
        
        if (result.state === 'initializing') {
          retryCount++;
          await new Promise(resolve => setTimeout(resolve, 1000));
          continue;
        }
        
        break;
      }
      
      if (result.state === 'initializing') {
        checkPaymentConfiguration();
        Alert.alert('Payment System Not Ready', 'Please try again in a few moments, or restart the app.', [{ text: 'OK' }]);
        return;
      }
      
      await refreshProfile();
      
      if (result.state === 'purchased' || result.state === 'restored') {
        Alert.alert('Success!', result.message || 'Subscription activated successfully!', [{ text: 'OK' }]);
      } else if (result.state === 'error') {
        Alert.alert(
          'Setup Required',
          result.message || 'Unable to load subscription options.',
          [
            { text: 'Refresh Products', onPress: handleRefreshProducts },
            { text: 'OK', style: 'cancel' }
          ]
        );
      }
      
    } catch (error: any) {
      Alert.alert('Subscribe Failed', error.message || 'Unable to open subscription page.', [{ text: 'OK' }]);
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
          <Text style={[styles.title, { color: theme.colors.text }]}>Not Signed In</Text>
          <Text style={[styles.text, { color: colors.textSecondary }]}>Please sign in to view your profile</Text>
          <TouchableOpacity style={[styles.button, { backgroundColor: colors.primary }]} onPress={() => router.push('/login')}>
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
          <IconSymbol ios_icon_name="person.fill" android_material_icon_name="person" size={48} color="#FFFFFF" />
        </View>
        <Text style={[styles.email, { color: theme.colors.text }]}>{user.email}</Text>
        {profile.is_admin && (
          <View style={[styles.badge, { backgroundColor: colors.accent }]}>
            <IconSymbol ios_icon_name="star.fill" android_material_icon_name="star" size={16} color="#FFFFFF" />
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
          <Text style={[styles.cardTitle, { color: theme.colors.text }]}>Subscription Status</Text>
        </View>
        
        <View style={styles.statusContainer}>
          <Text style={[styles.statusLabel, { color: colors.textSecondary }]}>Status:</Text>
          <Text style={[styles.statusValue, { color: isSubscribed ? colors.primary : colors.textSecondary }]}>
            {isSubscribed ? 'Active ✓' : 'Inactive'}
          </Text>
        </View>

        {subscriptionEndDate && (
          <View style={styles.statusContainer}>
            <Text style={[styles.statusLabel, { color: colors.textSecondary }]}>{isSubscribed ? 'Renews:' : 'Expired:'}</Text>
            <Text style={[styles.statusValue, { color: theme.colors.text }]}>{subscriptionEndDate}</Text>
          </View>
        )}

        {!isSubscribed && !profile.is_admin && (
          <TouchableOpacity style={[styles.subscribeButton, { backgroundColor: colors.accent }]} onPress={handleSubscribeNow} disabled={isSubscribing}>
            {isSubscribing ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <React.Fragment>
                <IconSymbol ios_icon_name="star.fill" android_material_icon_name="star" size={20} color="#FFFFFF" />
                <Text style={styles.subscribeButtonText}>Subscribe Now - $12.99/month</Text>
              </React.Fragment>
            )}
          </TouchableOpacity>
        )}

        {isSubscribed && (
          <TouchableOpacity style={[styles.manageButton, { borderColor: colors.primary }]} onPress={handleManageSubscription} disabled={isLoadingCustomerCenter}>
            {isLoadingCustomerCenter ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <React.Fragment>
                <IconSymbol ios_icon_name="gearshape.fill" android_material_icon_name="settings" size={20} color={colors.primary} />
                <Text style={[styles.manageButtonText, { color: colors.primary }]}>Manage Subscription</Text>
              </React.Fragment>
            )}
          </TouchableOpacity>
        )}

        <TouchableOpacity style={[styles.refreshProductsButton, { borderColor: colors.accent }]} onPress={handleRefreshProducts} disabled={isRefreshingProducts}>
          {isRefreshingProducts ? (
            <ActivityIndicator size="small" color={colors.accent} />
          ) : (
            <React.Fragment>
              <IconSymbol ios_icon_name="arrow.triangle.2.circlepath" android_material_icon_name="sync" size={20} color={colors.accent} />
              <Text style={[styles.refreshProductsButtonText, { color: colors.accent }]}>Refresh Products</Text>
            </React.Fragment>
          )}
        </TouchableOpacity>

        <TouchableOpacity style={[styles.restoreButton, { borderColor: colors.textSecondary }]} onPress={handleRestorePurchases} disabled={isRestoring}>
          {isRestoring ? (
            <ActivityIndicator size="small" color={colors.textSecondary} />
          ) : (
            <React.Fragment>
              <IconSymbol ios_icon_name="arrow.clockwise" android_material_icon_name="refresh" size={20} color={colors.textSecondary} />
              <Text style={[styles.restoreButtonText, { color: colors.textSecondary }]}>Restore Purchases</Text>
            </React.Fragment>
          )}
        </TouchableOpacity>

        <TouchableOpacity style={[styles.refreshButton, { borderColor: colors.primary }]} onPress={handleRefreshProfile}>
          <IconSymbol ios_icon_name="arrow.clockwise" android_material_icon_name="refresh" size={20} color={colors.primary} />
          <Text style={[styles.refreshButtonText, { color: colors.primary }]}>Refresh Profile Data</Text>
        </TouchableOpacity>
      </View>

      {isAdmin() && (
        <TouchableOpacity style={[styles.card, { backgroundColor: theme.colors.card }]} onPress={() => router.push('/admin')}>
          <View style={styles.cardHeader}>
            <IconSymbol ios_icon_name="gearshape.fill" android_material_icon_name="settings" size={24} color={colors.primary} />
            <Text style={[styles.cardTitle, { color: theme.colors.text }]}>Admin Panel</Text>
            <IconSymbol ios_icon_name="chevron.right" android_material_icon_name="chevron-right" size={20} color={colors.textSecondary} />
          </View>
          <Text style={[styles.cardDescription, { color: colors.textSecondary }]}>Manage videos, surf reports, and subscription settings</Text>
        </TouchableOpacity>
      )}

      <View style={[styles.card, { backgroundColor: theme.colors.card }]}>
        <TouchableOpacity style={styles.actionItem} onPress={() => router.push('/privacy-policy')}>
          <IconSymbol ios_icon_name="hand.raised.fill" android_material_icon_name="privacy-tip" size={24} color={colors.textSecondary} />
          <Text style={[styles.actionText, { color: theme.colors.text }]}>Privacy Policy</Text>
          <IconSymbol ios_icon_name="chevron.right" android_material_icon_name="chevron-right" size={20} color={colors.textSecondary} />
        </TouchableOpacity>
        <View style={styles.divider} />
        <TouchableOpacity style={styles.actionItem} onPress={() => router.push('/terms-of-service')}>
          <IconSymbol ios_icon_name="doc.text.fill" android_material_icon_name="description" size={24} color={colors.textSecondary} />
          <Text style={[styles.actionText, { color: theme.colors.text }]}>Terms of Service</Text>
          <IconSymbol ios_icon_name="chevron.right" android_material_icon_name="chevron-right" size={20} color={colors.textSecondary} />
        </TouchableOpacity>
      </View>

      <View style={[styles.card, { backgroundColor: theme.colors.card }]}>
        <TouchableOpacity style={styles.actionItem} onPress={handleSignOut}>
          <IconSymbol ios_icon_name="rectangle.portrait.and.arrow.right" android_material_icon_name="logout" size={24} color={colors.textSecondary} />
          <Text style={[styles.actionText, { color: theme.colors.text }]}>Sign Out</Text>
        </TouchableOpacity>
        <View style={styles.divider} />
        <TouchableOpacity style={styles.actionItem} onPress={handleDeleteAccount} disabled={isDeleting}>
          {isDeleting ? (
            <ActivityIndicator size="small" color="#FF3B30" />
          ) : (
            <React.Fragment>
              <IconSymbol ios_icon_name="trash.fill" android_material_icon_name="delete" size={24} color="#FF3B30" />
              <Text style={[styles.actionText, { color: '#FF3B30' }]}>Delete Account</Text>
            </React.Fragment>
          )}
        </TouchableOpacity>
      </View>

      {__DEV__ && (
        <View style={[styles.debugCard, { backgroundColor: theme.colors.card }]}>
          <Text style={[styles.debugTitle, { color: theme.colors.text }]}>Debug Info</Text>
          <Text style={[styles.debugText, { color: colors.textSecondary }]}>User ID: {user.id}</Text>
          <Text style={[styles.debugText, { color: colors.textSecondary }]}>Is Admin: {profile.is_admin ? 'Yes' : 'No'}</Text>
          <Text style={[styles.debugText, { color: colors.textSecondary }]}>Is Subscribed: {profile.is_subscribed ? 'Yes' : 'No'}</Text>
          <Text style={[styles.debugText, { color: colors.textSecondary }]}>Subscription Check: {isSubscribed ? 'Active' : 'Inactive'}</Text>
          <Text style={[styles.debugText, { color: colors.textSecondary }]}>Payment System Available: {isPaymentSystemAvailable() ? 'Yes' : 'No'}</Text>
        </View>
      )}

      <View style={styles.infoContainer}>
        <Text style={[styles.infoText, { color: colors.textSecondary }]}>SurfVista - Folly Beach, SC</Text>
        <Text style={[styles.infoText, { color: colors.textSecondary }]}>Version 3.0.0</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 100 },
  centerContent: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 32 },
  header: { alignItems: 'center', marginBottom: 24, paddingTop: 20 },
  avatarContainer: { width: 100, height: 100, borderRadius: 50, justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  email: { fontSize: 20, fontWeight: 'bold', marginBottom: 8 },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16 },
  badgeText: { color: '#FFFFFF', fontSize: 14, fontWeight: 'bold' },
  title: { fontSize: 24, fontWeight: 'bold', textAlign: 'center', marginTop: 16, marginBottom: 8 },
  text: { fontSize: 16, textAlign: 'center', marginBottom: 24, lineHeight: 24 },
  button: { paddingHorizontal: 32, paddingVertical: 16, borderRadius: 12 },
  buttonText: { color: '#FFFFFF', fontSize: 18, fontWeight: 'bold' },
  card: { borderRadius: 12, padding: 16, marginBottom: 16, boxShadow: '0px 2px 8px rgba(0, 0, 0, 0.1)', elevation: 3 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  cardTitle: { fontSize: 18, fontWeight: 'bold', flex: 1 },
  cardDescription: { fontSize: 14, lineHeight: 20 },
  statusContainer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  statusLabel: { fontSize: 16 },
  statusValue: { fontSize: 16, fontWeight: 'bold' },
  subscribeButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 12, borderRadius: 8, marginTop: 12 },
  subscribeButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: 'bold' },
  manageButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 10, borderRadius: 8, marginTop: 12, borderWidth: 1 },
  manageButtonText: { fontSize: 14, fontWeight: '600' },
  refreshProductsButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 10, borderRadius: 8, marginTop: 8, borderWidth: 1 },
  refreshProductsButtonText: { fontSize: 14, fontWeight: '600' },
  restoreButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 10, borderRadius: 8, marginTop: 8, borderWidth: 1 },
  restoreButtonText: { fontSize: 14, fontWeight: '600' },
  refreshButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 10, borderRadius: 8, marginTop: 8, borderWidth: 1 },
  refreshButtonText: { fontSize: 14, fontWeight: '600' },
  actionItem: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 4, flex: 1 },
  actionText: { fontSize: 16 },
  divider: { height: 1, backgroundColor: '#E5E5E5', marginVertical: 12 },
  debugCard: { borderRadius: 12, padding: 16, marginBottom: 16, borderWidth: 2, borderColor: '#FFA07A' },
  debugTitle: { fontSize: 16, fontWeight: 'bold', marginBottom: 8 },
  debugText: { fontSize: 12, marginBottom: 4, fontFamily: 'monospace' },
  infoContainer: { alignItems: 'center', marginTop: 24, gap: 4 },
  infoText: { fontSize: 12 },
});
