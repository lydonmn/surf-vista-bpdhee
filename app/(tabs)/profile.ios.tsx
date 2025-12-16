
import React, { useState } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, ActivityIndicator } from "react-native";
import { useTheme } from "@react-navigation/native";
import { useAuth } from "@/contexts/AuthContext";
import { router } from "expo-router";
import { colors } from "@/styles/commonStyles";
import { IconSymbol } from "@/components/IconSymbol";
import { isPaymentSystemAvailable, restorePurchases, checkPaymentConfiguration } from '@/utils/superwallConfig';

export default function ProfileScreen() {
  const theme = useTheme();
  const { user, profile, signOut, refreshProfile, checkSubscription, isAdmin } = useAuth();
  const [isRestoring, setIsRestoring] = useState(false);
  const isSubscribed = checkSubscription();

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
              console.log('[ProfileScreen iOS] User confirmed sign out');
              console.log('[ProfileScreen iOS] Current user:', user?.email);
              
              // Call signOut - it will clear state immediately
              console.log('[ProfileScreen iOS] Calling signOut()...');
              await signOut();
              console.log('[ProfileScreen iOS] ✅ signOut() completed');
              
              // Navigate to login immediately after signOut completes
              console.log('[ProfileScreen iOS] Navigating to login screen...');
              router.replace('/login');
              console.log('[ProfileScreen iOS] ===== SIGN OUT PROCESS COMPLETE =====');
            } catch (error) {
              console.error('[ProfileScreen iOS] ❌ Error during sign out:', error);
              // Still try to navigate even if there was an error
              router.replace('/login');
            }
          },
        },
      ]
    );
  };

  const handleRestorePurchases = async () => {
    // Check if payment system is available
    if (!isPaymentSystemAvailable()) {
      checkPaymentConfiguration();
      Alert.alert(
        'Restore Purchases Unavailable',
        'Subscription features are currently being configured. Please contact support or try again later.',
        [{ text: 'OK' }]
      );
      return;
    }

    setIsRestoring(true);
    
    try {
      console.log('[ProfileScreen iOS] 🔄 Starting restore purchases...');
      
      const result = await restorePurchases();
      
      console.log('[ProfileScreen iOS] 📊 Restore result:', result);
      
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
      console.error('[ProfileScreen iOS] ❌ Restore purchases error:', error);
      Alert.alert(
        'Restore Failed',
        error.message || 'Unable to restore purchases at this time. Please try again later or contact support.',
        [{ text: 'OK' }]
      );
    } finally {
      setIsRestoring(false);
    }
  };

  const handleManageSubscription = () => {
    Alert.alert(
      'Manage Subscription',
      'To manage your subscription or cancel:\n\n' +
      '1. Open Settings on your iPhone\n' +
      '2. Tap your name at the top\n' +
      '3. Tap Subscriptions\n' +
      '4. Select SurfVista\n\n' +
      'You can also restore your purchases if you\'ve subscribed on another device.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Restore Purchases',
          onPress: handleRestorePurchases
        }
      ]
    );
  };

  if (!user || !profile) {
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <View style={styles.centerContent}>
          <IconSymbol
            ios_icon_name="person.circle"
            android_material_icon_name="account_circle"
            size={80}
            color={colors.textSecondary}
          />
          <Text style={[styles.title, { color: theme.colors.text }]}>
            Not Logged In
          </Text>
          <TouchableOpacity
            style={[styles.loginButton, { backgroundColor: colors.primary }]}
            onPress={() => router.push('/login')}
          >
            <Text style={styles.loginButtonText}>Login</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <ScrollView 
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      contentContainerStyle={styles.scrollContent}
    >
      <View style={styles.header}>
        <IconSymbol
          ios_icon_name="person.circle.fill"
          android_material_icon_name="account_circle"
          size={80}
          color={colors.primary}
        />
        <Text style={[styles.email, { color: theme.colors.text }]}>
          {user.email}
        </Text>
        {profile.is_admin && (
          <View style={[styles.adminBadge, { backgroundColor: colors.accent }]}>
            <Text style={styles.adminBadgeText}>Admin</Text>
          </View>
        )}
      </View>

      <View style={[styles.card, { backgroundColor: theme.colors.card }]}>
        <Text style={[styles.cardTitle, { color: theme.colors.text }]}>
          Subscription Status
        </Text>
        <View style={styles.statusRow}>
          <IconSymbol
            ios_icon_name={isSubscribed ? "checkmark.circle.fill" : "xmark.circle.fill"}
            android_material_icon_name={isSubscribed ? "check_circle" : "cancel"}
            size={24}
            color={isSubscribed ? colors.primary : colors.textSecondary}
          />
          <Text style={[styles.statusText, { color: theme.colors.text }]}>
            {isSubscribed ? 'Active Subscription' : 'No Active Subscription'}
          </Text>
        </View>
        {isSubscribed && profile.subscription_end_date && (
          <Text style={[styles.expiryText, { color: colors.textSecondary }]}>
            Renews on {new Date(profile.subscription_end_date).toLocaleDateString()}
          </Text>
        )}
        
        {!isSubscribed && !profile.is_admin && (
          <TouchableOpacity
            style={[styles.subscribeButton, { backgroundColor: colors.accent }]}
            onPress={() => router.push('/login')}
          >
            <Text style={styles.subscribeButtonText}>Subscribe - $5/month</Text>
          </TouchableOpacity>
        )}

        {isSubscribed && (
          <TouchableOpacity
            style={[styles.manageButton, { borderColor: colors.primary }]}
            onPress={handleManageSubscription}
          >
            <IconSymbol
              ios_icon_name="gearshape"
              android_material_icon_name="settings"
              size={18}
              color={colors.primary}
            />
            <Text style={[styles.manageButtonText, { color: colors.primary }]}>
              Manage Subscription
            </Text>
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
                size={18}
                color={colors.textSecondary}
              />
              <Text style={[styles.restoreButtonText, { color: colors.textSecondary }]}>
                Restore Purchases
              </Text>
            </React.Fragment>
          )}
        </TouchableOpacity>
      </View>

      <View style={[styles.card, { backgroundColor: theme.colors.card }]}>
        <Text style={[styles.cardTitle, { color: theme.colors.text }]}>
          Account Settings
        </Text>
        
        <TouchableOpacity style={styles.menuItem}>
          <IconSymbol
            ios_icon_name="bell.fill"
            android_material_icon_name="notifications"
            size={24}
            color={colors.primary}
          />
          <Text style={[styles.menuText, { color: theme.colors.text }]}>
            Notifications
          </Text>
          <IconSymbol
            ios_icon_name="chevron.right"
            android_material_icon_name="chevron_right"
            size={20}
            color={colors.textSecondary}
          />
        </TouchableOpacity>

        <TouchableOpacity style={styles.menuItem}>
          <IconSymbol
            ios_icon_name="creditcard.fill"
            android_material_icon_name="payment"
            size={24}
            color={colors.primary}
          />
          <Text style={[styles.menuText, { color: theme.colors.text }]}>
            Payment Method
          </Text>
          <IconSymbol
            ios_icon_name="chevron.right"
            android_material_icon_name="chevron_right"
            size={20}
            color={colors.textSecondary}
          />
        </TouchableOpacity>
      </View>

      {isAdmin() && (
        <TouchableOpacity
          style={[styles.adminButton, { backgroundColor: colors.accent }]}
          onPress={() => router.push('/admin')}
        >
          <IconSymbol
            ios_icon_name="gear"
            android_material_icon_name="settings"
            size={20}
            color="#FFFFFF"
          />
          <Text style={styles.adminButtonText}>Admin Panel</Text>
        </TouchableOpacity>
      )}

      <TouchableOpacity
        style={[styles.signOutButton, { backgroundColor: colors.textSecondary }]}
        onPress={handleSignOut}
      >
        <IconSymbol
          ios_icon_name="rectangle.portrait.and.arrow.right"
          android_material_icon_name="logout"
          size={20}
          color="#FFFFFF"
        />
        <Text style={styles.signOutButtonText}>Sign Out</Text>
      </TouchableOpacity>

      {/* Debug Info */}
      {__DEV__ && (
        <View style={[styles.debugCard, { backgroundColor: theme.colors.card }]}>
          <Text style={[styles.debugTitle, { color: theme.colors.text }]}>
            Debug Info
          </Text>
          <Text style={[styles.debugText, { color: colors.textSecondary }]}>
            Payment System Available: {isPaymentSystemAvailable() ? 'Yes' : 'No'}
          </Text>
        </View>
      )}

      <Text style={[styles.version, { color: colors.textSecondary }]}>
        SurfVista v1.0.0
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: 16,
    paddingHorizontal: 16,
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
  },
  email: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 12,
  },
  adminBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    marginTop: 8,
  },
  adminBadgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 'bold',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginTop: 16,
    marginBottom: 24,
  },
  loginButton: {
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 12,
    minWidth: 200,
  },
  loginButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  card: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 8,
  },
  statusText: {
    fontSize: 16,
    fontWeight: '600',
  },
  expiryText: {
    fontSize: 14,
    marginLeft: 36,
    marginBottom: 8,
  },
  subscribeButton: {
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
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
    marginTop: 8,
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
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    gap: 12,
  },
  menuText: {
    flex: 1,
    fontSize: 16,
  },
  adminButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    marginBottom: 16,
    gap: 8,
  },
  adminButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  signOutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 8,
    marginBottom: 16,
    gap: 8,
  },
  signOutButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
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
  version: {
    fontSize: 12,
    textAlign: 'center',
  },
});
