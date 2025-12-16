
import React from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from "react-native";
import { useTheme } from "@react-navigation/native";
import { useAuth } from "@/contexts/AuthContext";
import { router } from "expo-router";
import { colors } from "@/styles/commonStyles";
import { IconSymbol } from "@/components/IconSymbol";

export default function ProfileScreen() {
  const theme = useTheme();
  const { user, profile, signOut, checkSubscription, isAdmin } = useAuth();
  const isSubscribed = checkSubscription();

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
              console.log('[ProfileScreen iOS] Current user:', user.email);
              
              // Call signOut and wait for it to complete
              console.log('[ProfileScreen iOS] Calling signOut()...');
              await signOut();
              console.log('[ProfileScreen iOS] ✅ signOut() completed successfully');
              
              // Small delay to ensure state is cleared
              await new Promise(resolve => setTimeout(resolve, 100));
              
              console.log('[ProfileScreen iOS] Navigating to login screen...');
              router.replace('/login');
              console.log('[ProfileScreen iOS] ===== SIGN OUT PROCESS COMPLETE =====');
            } catch (error) {
              console.error('[ProfileScreen iOS] ❌ Error during sign out:', error);
              Alert.alert('Error', 'Failed to sign out. Please try again.');
            }
          },
        },
      ]
    );
  };

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
        {!isSubscribed && (
          <TouchableOpacity
            style={[styles.subscribeButton, { backgroundColor: colors.accent }]}
            onPress={() => {
              console.log('Opening subscription flow');
              Alert.alert(
                'Subscribe to SurfVista',
                'Get unlimited access to exclusive drone footage and daily surf reports for just $5/month.\n\nPayment integration coming soon with Superwall!'
              );
            }}
          >
            <Text style={styles.subscribeButtonText}>Subscribe - $5/month</Text>
          </TouchableOpacity>
        )}
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
  version: {
    fontSize: 12,
    textAlign: 'center',
  },
});
