
import { useState, useEffect, useCallback } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Switch, Modal } from "react-native";
import { router } from "expo-router";
import {
  restorePurchases,
  presentCustomerCenter,
  forceRefreshOfferings,
  isPaymentSystemAvailable,
  initializeRevenueCat
} from '@/utils/superwallConfig';
import { NotificationLocationSelector } from "@/components/NotificationLocationSelector";
import { useTheme } from "@react-navigation/native";
import {
  setDailyReportNotifications,
  getDailyReportNotificationStatus,
  checkNotificationPermissions,
  openNotificationSettings,
  getNotificationLocations,
  setNotificationLocations,
  ensurePushTokenRegistered
} from '@/utils/pushNotifications';
import { useAuth } from "@/contexts/AuthContext";
import { IconSymbol } from "@/components/IconSymbol";
import { colors } from "@/styles/commonStyles";
import { openPaywall } from "@/utils/paywallHelper";

export default function ProfileScreen() {
  const theme = useTheme();
  const { user, profile, signOut, deleteAccount, refreshProfile, checkSubscription } = useAuth();

  const [isLoading, setIsLoading] = useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [notificationLocations, setNotificationLocationsState] = useState<string[]>([]);
  const [hasPermission, setHasPermission] = useState(false);
  const [showSignOutModal, setShowSignOutModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showDeleteConfirmModal, setShowDeleteConfirmModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const isSubscribed = checkSubscription();

  const checkPermissions = useCallback(async () => {
    const result = await checkNotificationPermissions();
    setHasPermission(result.granted);
  }, []);

  useEffect(() => {
    checkPermissions();
  }, [checkPermissions]);

  useEffect(() => {
    const initializePayments = async () => {
      try {
        await initializeRevenueCat();
      } catch (initError) {
        console.log('[Profile] RevenueCat initialization error:', initError);
      }
    };
    initializePayments();
  }, []);

  const loadNotificationStatus = useCallback(async () => {
    if (!user?.id) return;
    try {
      const status = await getDailyReportNotificationStatus(user.id);
      setNotificationsEnabled(status);
    } catch (statusError) {
      console.error('[Profile] Error loading notification status:', statusError);
    }
  }, [user?.id]);

  const loadNotificationLocations = useCallback(async () => {
    if (!user?.id) return;
    try {
      const locations = await getNotificationLocations(user.id);
      setNotificationLocationsState(locations);
    } catch (locationsError) {
      console.error('[Profile] Error loading notification locations:', locationsError);
    }
  }, [user?.id]);

  useEffect(() => {
    loadNotificationStatus();
    loadNotificationLocations();
  }, [user?.id, loadNotificationStatus, loadNotificationLocations]);

  const handleToggleDailyNotifications = async (value: boolean) => {
    console.log('[Profile] Toggle daily notifications:', value);
    if (!user?.id) return;

    if (value && !hasPermission) {
      await openNotificationSettings();
      return;
    }

    try {
      setNotificationsEnabled(value);
      await setDailyReportNotifications(user.id, value);
      if (value) {
        await ensurePushTokenRegistered(user.id);
      }
    } catch (toggleError) {
      console.error('[Profile] Error toggling notifications:', toggleError);
      setNotificationsEnabled(!value);
    }
  };

  const handleLocationsChange = async (newLocations: string[]) => {
    if (!user?.id) return;
    try {
      setNotificationLocationsState(newLocations);
      await setNotificationLocations(user.id, newLocations);
    } catch (locationsChangeError) {
      console.error('[Profile] Error updating notification locations:', locationsChangeError);
    }
  };

  const confirmSignOut = () => {
    console.log('[Profile] Sign out button pressed');
    setShowSignOutModal(true);
  };

  const handleSignOut = async () => {
    console.log('[Profile] Confirming sign out');
    setShowSignOutModal(false);
    setIsLoading(true);
    try {
      await signOut();
      router.replace('/login');
    } catch (signOutError) {
      console.error('[Profile] Sign out error:', signOutError);
    } finally {
      setIsLoading(false);
    }
  };

  const confirmDeleteAccount = () => {
    console.log('[Profile] Delete account button pressed');
    setShowDeleteModal(true);
  };

  const handleDeleteAccount = () => {
    setShowDeleteModal(false);
    setShowDeleteConfirmModal(true);
  };

  const finalDeleteAccount = async () => {
    console.log('[Profile] Final delete account confirmed');
    setShowDeleteConfirmModal(false);
    setIsDeleting(true);
    setDeleteError(null);
    try {
      const result = await deleteAccount();
      if (result.success) {
        router.replace('/login');
      } else {
        setDeleteError(result.message);
      }
    } catch (deleteAccountError) {
      console.error('[Profile] Delete account error:', deleteAccountError);
      setDeleteError('An unexpected error occurred');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleRefreshProfile = async () => {
    console.log('[Profile] Refresh profile pressed');
    setIsLoading(true);
    try {
      await refreshProfile();
    } catch (refreshError) {
      console.error('[Profile] Refresh profile error:', refreshError);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRefreshProducts = async () => {
    console.log('[Profile] Refresh products pressed');
    setIsLoading(true);
    try {
      await forceRefreshOfferings();
      await refreshProfile();
    } catch (refreshProductsError) {
      console.error('[Profile] Refresh products error:', refreshProductsError);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRestorePurchases = async () => {
    console.log('[Profile] Restore purchases pressed');
    setIsLoading(true);
    try {
      await restorePurchases();
      await refreshProfile();
    } catch (restoreError) {
      console.error('[Profile] Restore purchases error:', restoreError);
    } finally {
      setIsLoading(false);
    }
  };

  const handleManageSubscription = async () => {
    console.log('[Profile] Manage subscription pressed');
    try {
      const available = isPaymentSystemAvailable();
      if (available) {
        await presentCustomerCenter();
      }
    } catch (manageError) {
      console.error('[Profile] Manage subscription error:', manageError);
    }
  };

  const handleSubscribeNow = async () => {
    console.log('[Profile] Subscribe now pressed');
    if (!user) {
      router.push('/login');
      return;
    }
    try {
      await openPaywall(user.id, user.email || undefined, async () => {
        await refreshProfile();
      });
    } catch (subscribeError) {
      console.error('[Profile] Subscribe error:', subscribeError);
    }
  };

  if (!user) {
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: theme.colors.text }]}>
            Loading profile...
          </Text>
        </View>
      </View>
    );
  }

  const statusText = isSubscribed ? 'Active ✓' : 'Inactive';
  const statusColor = isSubscribed ? '#4CAF50' : colors.textSecondary;
  const userEmail = user.email || '';
  const isAdmin = profile?.is_admin || false;
  const isRegionalAdmin = (profile as any)?.is_regional_admin || false;

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <View style={[styles.header, { backgroundColor: theme.colors.card }]}>
          <View style={[styles.avatarContainer, { backgroundColor: colors.primary }]}>
            <IconSymbol
              ios_icon_name="person.fill"
              android_material_icon_name="person"
              size={48}
              color="#FFFFFF"
            />
          </View>
          <Text style={[styles.email, { color: theme.colors.text }]}>
            {userEmail}
          </Text>
          {isAdmin && (
            <View style={[styles.badge, { backgroundColor: colors.accent }]}>
              <Text style={styles.badgeText}>Admin</Text>
            </View>
          )}
          {isRegionalAdmin && (
            <View style={[styles.badge, { backgroundColor: colors.secondary }]}>
              <Text style={styles.badgeText}>Regional Admin</Text>
            </View>
          )}
        </View>

        <View style={[styles.section, { backgroundColor: theme.colors.card }]}>
          <View style={styles.sectionHeader}>
            <IconSymbol
              ios_icon_name="checkmark.circle.fill"
              android_material_icon_name="check-circle"
              size={24}
              color={colors.primary}
            />
            <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
              Subscription Status
            </Text>
          </View>

          <View style={styles.statusRow}>
            <Text style={[styles.statusLabel, { color: colors.textSecondary }]}>
              Status:
            </Text>
            <View style={styles.statusBadge}>
              <Text style={[styles.statusText, { color: statusColor }]}>
                {statusText}
              </Text>
            </View>
          </View>

          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: '#5B9BD5' }]}
            onPress={handleManageSubscription}
            disabled={isLoading}
          >
            <IconSymbol ios_icon_name="gear" android_material_icon_name="settings" size={20} color="#FFFFFF" />
            <Text style={styles.actionButtonText}>Manage Subscription</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: '#FF8C69' }]}
            onPress={handleRefreshProducts}
            disabled={isLoading}
          >
            <IconSymbol ios_icon_name="arrow.clockwise" android_material_icon_name="refresh" size={20} color="#FFFFFF" />
            <Text style={styles.actionButtonText}>Refresh Products</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: '#5B9BD5' }]}
            onPress={handleRestorePurchases}
            disabled={isLoading}
          >
            <IconSymbol ios_icon_name="arrow.clockwise.circle" android_material_icon_name="restore" size={20} color="#FFFFFF" />
            <Text style={styles.actionButtonText}>Restore Purchases</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: '#5B9BD5' }]}
            onPress={handleRefreshProfile}
            disabled={isLoading}
          >
            <IconSymbol ios_icon_name="arrow.clockwise" android_material_icon_name="refresh" size={20} color="#FFFFFF" />
            <Text style={styles.actionButtonText}>Refresh Profile Data</Text>
          </TouchableOpacity>

          {!isSubscribed && (
            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: colors.accent }]}
              onPress={handleSubscribeNow}
              disabled={isLoading}
            >
              <IconSymbol ios_icon_name="star.fill" android_material_icon_name="star" size={20} color="#FFFFFF" />
              <Text style={styles.actionButtonText}>Subscribe Now</Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={[styles.section, { backgroundColor: theme.colors.card }]}>
          <View style={styles.sectionHeader}>
            <IconSymbol
              ios_icon_name="bell.fill"
              android_material_icon_name="notifications"
              size={24}
              color={colors.primary}
            />
            <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
              Notifications
            </Text>
          </View>

          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Text style={[styles.settingLabel, { color: theme.colors.text }]}>
                Daily Surf Report
              </Text>
              <Text style={[styles.settingDescription, { color: colors.textSecondary }]}>
                Get a push notification at 6 AM EST with your daily surf report summary
              </Text>
              {notificationsEnabled && (
                <View style={styles.statusIndicator}>
                  <IconSymbol ios_icon_name="checkmark.circle.fill" android_material_icon_name="check-circle" size={16} color="#4CAF50" />
                  <Text style={[styles.statusIndicatorText, { color: '#4CAF50' }]}>
                    Linked to 6AM reports
                  </Text>
                </View>
              )}
              {hasPermission && (
                <View style={styles.statusIndicator}>
                  <Text style={[styles.permissionText, { color: '#4CAF50' }]}>
                    Permission: Granted ✓
                  </Text>
                </View>
              )}
            </View>
            <Switch
              value={notificationsEnabled}
              onValueChange={handleToggleDailyNotifications}
              trackColor={{ false: colors.textSecondary, true: '#5B9BD5' }}
              thumbColor="#FFFFFF"
            />
          </View>

          {notificationsEnabled && (
            <View style={styles.locationSelectorContainer}>
              <View style={styles.locationHeader}>
                <IconSymbol ios_icon_name="location.fill" android_material_icon_name="place" size={20} color={colors.primary} />
                <Text style={[styles.locationHeaderText, { color: theme.colors.text }]}>
                  Report Locations
                </Text>
              </View>
              <NotificationLocationSelector
                selectedLocations={notificationLocations}
                onLocationsChange={handleLocationsChange}
              />
            </View>
          )}

          {!hasPermission && (
            <TouchableOpacity
              style={[styles.permissionButton, { backgroundColor: colors.accent }]}
              onPress={openNotificationSettings}
            >
              <IconSymbol ios_icon_name="bell.badge.fill" android_material_icon_name="notifications" size={20} color="#FFFFFF" />
              <Text style={styles.buttonText}>Enable Notifications</Text>
            </TouchableOpacity>
          )}
        </View>

        {(isAdmin || isRegionalAdmin) && (
          <TouchableOpacity
            style={[styles.section, styles.adminSection, { backgroundColor: theme.colors.card }]}
            onPress={() => {
              console.log('[Profile] Admin panel pressed');
              router.push('/admin');
            }}
          >
            <View style={styles.adminHeader}>
              <View style={styles.adminTitleRow}>
                <IconSymbol ios_icon_name="gear" android_material_icon_name="settings" size={24} color={colors.primary} />
                <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
                  Admin Panel
                </Text>
              </View>
              <IconSymbol ios_icon_name="chevron.right" android_material_icon_name="chevron-right" size={24} color={colors.textSecondary} />
            </View>
            <Text style={[styles.adminDescription, { color: colors.textSecondary }]}>
              Manage videos, surf reports, and subscription settings
            </Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={[styles.section, styles.linkSection, { backgroundColor: theme.colors.card }]}
          onPress={() => {
            console.log('[Profile] Privacy policy pressed');
            router.push('/privacy-policy');
          }}
        >
          <View style={styles.linkRow}>
            <IconSymbol ios_icon_name="hand.raised.fill" android_material_icon_name="privacy-tip" size={24} color={colors.primary} />
            <Text style={[styles.linkText, { color: theme.colors.text }]}>
              Privacy Policy
            </Text>
            <IconSymbol ios_icon_name="chevron.right" android_material_icon_name="chevron-right" size={24} color={colors.textSecondary} />
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.section, styles.signOutSection, { backgroundColor: theme.colors.card }]}
          onPress={confirmSignOut}
          disabled={isLoading}
        >
          <View style={styles.linkRow}>
            <IconSymbol ios_icon_name="rectangle.portrait.and.arrow.right" android_material_icon_name="logout" size={24} color={colors.error} />
            <Text style={[styles.linkText, { color: colors.error }]}>
              Sign Out
            </Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.section, styles.linkSection, { backgroundColor: theme.colors.card }]}
          onPress={confirmDeleteAccount}
          disabled={isLoading}
        >
          <View style={styles.linkRow}>
            <IconSymbol ios_icon_name="trash.fill" android_material_icon_name="delete" size={24} color="#D32F2F" />
            <Text style={[styles.linkText, { color: '#D32F2F' }]}>
              Delete Account
            </Text>
          </View>
        </TouchableOpacity>
      </ScrollView>

      <Modal
        visible={showSignOutModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowSignOutModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.colors.card }]}>
            <Text style={[styles.modalTitle, { color: theme.colors.text }]}>Sign Out</Text>
            <Text style={[styles.modalMessage, { color: colors.textSecondary }]}>
              Are you sure you want to sign out?
            </Text>
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, { backgroundColor: colors.textSecondary }]}
                onPress={() => setShowSignOutModal(false)}
              >
                <Text style={styles.modalButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, { backgroundColor: colors.errorBackground }]}
                onPress={handleSignOut}
              >
                <Text style={styles.modalButtonText}>Sign Out</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showDeleteModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowDeleteModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.colors.card }]}>
            <Text style={[styles.modalTitle, { color: theme.colors.text }]}>Delete Account</Text>
            <Text style={[styles.modalMessage, { color: colors.textSecondary }]}>
              This will permanently delete your account and all associated data. This action cannot be undone.
            </Text>
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, { backgroundColor: colors.textSecondary }]}
                onPress={() => setShowDeleteModal(false)}
              >
                <Text style={styles.modalButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, { backgroundColor: '#D32F2F' }]}
                onPress={handleDeleteAccount}
              >
                <Text style={styles.modalButtonText}>Continue</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showDeleteConfirmModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowDeleteConfirmModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.colors.card }]}>
            <Text style={[styles.modalTitle, { color: theme.colors.text }]}>Final Confirmation</Text>
            <Text style={[styles.modalMessage, { color: colors.textSecondary }]}>
              Are you absolutely sure? This cannot be undone.
            </Text>
            {deleteError && (
              <Text style={[styles.errorText, { color: colors.errorBackground }]}>
                {deleteError}
              </Text>
            )}
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, { backgroundColor: colors.textSecondary }]}
                onPress={() => {
                  setShowDeleteConfirmModal(false);
                  setDeleteError(null);
                }}
                disabled={isDeleting}
              >
                <Text style={styles.modalButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, { backgroundColor: '#D32F2F' }]}
                onPress={finalDeleteAccount}
                disabled={isDeleting}
              >
                {isDeleting ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.modalButtonText}>Delete Forever</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollView: { flex: 1 },
  scrollContent: { paddingTop: 60, paddingBottom: 100 },
  centerContent: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { fontSize: 16, marginTop: 16 },
  header: { alignItems: 'center', padding: 24, marginHorizontal: 16, marginBottom: 16, borderRadius: 16 },
  avatarContainer: { width: 96, height: 96, borderRadius: 48, justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  email: { fontSize: 18, fontWeight: '600', marginBottom: 8 },
  badge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12, marginTop: 8 },
  badgeText: { color: '#FFFFFF', fontSize: 12, fontWeight: '600' },
  section: { padding: 20, marginHorizontal: 16, marginBottom: 16, borderRadius: 16 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 },
  sectionTitle: { fontSize: 18, fontWeight: 'bold' },
  statusRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 },
  statusLabel: { fontSize: 16 },
  statusBadge: { paddingHorizontal: 12, paddingVertical: 4 },
  statusText: { fontSize: 16, fontWeight: '600' },
  actionButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, borderRadius: 12, marginBottom: 12 },
  actionButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },
  settingRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 },
  settingInfo: { flex: 1, paddingRight: 16 },
  settingLabel: { fontSize: 16, fontWeight: '600', marginBottom: 4 },
  settingDescription: { fontSize: 14, lineHeight: 20, marginBottom: 8 },
  statusIndicator: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 },
  statusIndicatorText: { fontSize: 13, fontWeight: '500' },
  permissionText: { fontSize: 13, fontWeight: '500' },
  locationSelectorContainer: { marginTop: 16, paddingTop: 16, borderTopWidth: 1, borderTopColor: 'rgba(255, 255, 255, 0.1)' },
  locationHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  locationHeaderText: { fontSize: 16, fontWeight: '600' },
  permissionButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, borderRadius: 12, marginTop: 8 },
  buttonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },
  adminSection: { flexDirection: 'column' },
  adminHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  adminTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  adminDescription: { fontSize: 14, lineHeight: 20 },
  linkSection: { padding: 16 },
  signOutSection: { padding: 16 },
  linkRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  linkText: { flex: 1, fontSize: 16, fontWeight: '600' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalContent: { width: '100%', maxWidth: 400, borderRadius: 16, padding: 24 },
  modalTitle: { fontSize: 20, fontWeight: 'bold', marginBottom: 12 },
  modalMessage: { fontSize: 16, lineHeight: 24, marginBottom: 24 },
  errorText: { fontSize: 14, marginBottom: 16 },
  modalButtons: { flexDirection: 'row', gap: 12 },
  modalButton: { flex: 1, paddingVertical: 12, borderRadius: 8, alignItems: 'center' },
  modalButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },
});
