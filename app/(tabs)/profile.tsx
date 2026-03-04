
import { useState, useEffect, useCallback } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Switch, Modal } from "react-native";
import { router } from "expo-router";
import { 
  restorePurchases, 
  presentCustomerCenter,
  presentPaywall,
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
    const permission = await checkNotificationPermissions();
    setHasPermission(permission);
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
    setShowSignOutModal(true);
  };

  const handleSignOut = async () => {
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
    setShowDeleteModal(true);
  };

  const handleDeleteAccount = () => {
    setShowDeleteModal(false);
    setShowDeleteConfirmModal(true);
  };

  const finalDeleteAccount = async () => {
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
    try {
      const available = await isPaymentSystemAvailable();
      if (available) {
        await presentCustomerCenter();
      }
    } catch (manageError) {
      console.error('[Profile] Manage subscription error:', manageError);
    }
  };

  const handleSubscribeNow = async () => {
    try {
      const available = await isPaymentSystemAvailable();
      if (available) {
        await presentPaywall();
        await refreshProfile();
      }
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
            {user.email}
          </Text>
          {profile?.is_admin && (
            <View style={[styles.badge, { backgroundColor: colors.accent }]}>
              <Text style={styles.badgeText}>Admin</Text>
            </View>
          )}
          {profile?.is_regional_admin && (
            <View style={[styles.badge, { backgroundColor: colors.secondary }]}>
              <Text style={styles.badgeText}>Regional Admin</Text>
            </View>
          )}
        </View>

        <View style={[styles.section, { backgroundColor: theme.colors.card }]}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
            Subscription
          </Text>
          
          {isSubscribed ? (
            <>
              <View style={styles.subscriptionStatus}>
                <IconSymbol
                  ios_icon_name="checkmark.circle.fill"
                  android_material_icon_name="check-circle"
                  size={24}
                  color="#4CAF50"
                />
                <Text style={[styles.subscriptionText, { color: theme.colors.text }]}>
                  Active Subscription
                </Text>
              </View>
              
              <TouchableOpacity
                style={[styles.button, { backgroundColor: colors.primary }]}
                onPress={handleManageSubscription}
                disabled={isLoading}
              >
                <IconSymbol
                  ios_icon_name="gear"
                  android_material_icon_name="settings"
                  size={20}
                  color="#FFFFFF"
                />
                <Text style={styles.buttonText}>Manage Subscription</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <View style={styles.subscriptionStatus}>
                <IconSymbol
                  ios_icon_name="xmark.circle.fill"
                  android_material_icon_name="cancel"
                  size={24}
                  color="#F44336"
                />
                <Text style={[styles.subscriptionText, { color: theme.colors.text }]}>
                  No Active Subscription
                </Text>
              </View>
              
              <TouchableOpacity
                style={[styles.button, { backgroundColor: colors.accent }]}
                onPress={handleSubscribeNow}
                disabled={isLoading}
              >
                <IconSymbol
                  ios_icon_name="star.fill"
                  android_material_icon_name="star"
                  size={20}
                  color="#FFFFFF"
                />
                <Text style={styles.buttonText}>Subscribe Now</Text>
              </TouchableOpacity>
            </>
          )}

          <TouchableOpacity
            style={[styles.secondaryButton, { borderColor: colors.primary }]}
            onPress={handleRestorePurchases}
            disabled={isLoading}
          >
            <IconSymbol
              ios_icon_name="arrow.clockwise"
              android_material_icon_name="refresh"
              size={20}
              color={colors.primary}
            />
            <Text style={[styles.secondaryButtonText, { color: colors.primary }]}>
              Restore Purchases
            </Text>
          </TouchableOpacity>
        </View>

        <View style={[styles.section, { backgroundColor: theme.colors.card }]}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
            Notifications
          </Text>
          
          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Text style={[styles.settingLabel, { color: theme.colors.text }]}>
                Daily Surf Reports
              </Text>
              <Text style={[styles.settingDescription, { color: colors.textSecondary }]}>
                Get notified at 6 AM EST
              </Text>
            </View>
            <Switch
              value={notificationsEnabled}
              onValueChange={handleToggleDailyNotifications}
              trackColor={{ false: colors.textSecondary, true: colors.primary }}
              thumbColor="#FFFFFF"
            />
          </View>

          {notificationsEnabled && (
            <View style={styles.locationSelectorContainer}>
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
              <IconSymbol
                ios_icon_name="bell.badge.fill"
                android_material_icon_name="notifications"
                size={20}
                color="#FFFFFF"
              />
              <Text style={styles.buttonText}>Enable Notifications</Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={[styles.section, { backgroundColor: theme.colors.card }]}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
            Account
          </Text>
          
          <TouchableOpacity
            style={[styles.secondaryButton, { borderColor: colors.primary }]}
            onPress={handleRefreshProfile}
            disabled={isLoading}
          >
            <IconSymbol
              ios_icon_name="arrow.clockwise"
              android_material_icon_name="refresh"
              size={20}
              color={colors.primary}
            />
            <Text style={[styles.secondaryButtonText, { color: colors.primary }]}>
              Refresh Profile
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.secondaryButton, { borderColor: colors.primary }]}
            onPress={handleRefreshProducts}
            disabled={isLoading}
          >
            <IconSymbol
              ios_icon_name="arrow.clockwise"
              android_material_icon_name="refresh"
              size={20}
              color={colors.primary}
            />
            <Text style={[styles.secondaryButtonText, { color: colors.primary }]}>
              Refresh Products
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.dangerButton, { backgroundColor: colors.errorBackground }]}
            onPress={confirmSignOut}
            disabled={isLoading}
          >
            <IconSymbol
              ios_icon_name="arrow.right.square.fill"
              android_material_icon_name="logout"
              size={20}
              color="#FFFFFF"
            />
            <Text style={styles.buttonText}>Sign Out</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.dangerButton, { backgroundColor: '#D32F2F' }]}
            onPress={confirmDeleteAccount}
            disabled={isLoading || isDeleting}
          >
            <IconSymbol
              ios_icon_name="trash.fill"
              android_material_icon_name="delete"
              size={20}
              color="#FFFFFF"
            />
            <Text style={styles.buttonText}>Delete Account</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

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
            <Text style={[styles.modalTitle, { color: theme.colors.text }]}>
              Delete Account
            </Text>
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
            <Text style={[styles.modalTitle, { color: theme.colors.text }]}>
              Final Confirmation
            </Text>
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
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: 60,
    paddingBottom: 100,
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    marginTop: 16,
  },
  header: {
    alignItems: 'center',
    padding: 24,
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 16,
  },
  avatarContainer: {
    width: 96,
    height: 96,
    borderRadius: 48,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  email: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
  },
  badge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    marginTop: 8,
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  section: {
    padding: 20,
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  subscriptionStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  subscriptionText: {
    fontSize: 16,
    fontWeight: '600',
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
    marginBottom: 12,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 2,
    marginBottom: 12,
  },
  secondaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  dangerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
    marginBottom: 12,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  settingInfo: {
    flex: 1,
  },
  settingLabel: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  settingDescription: {
    fontSize: 14,
  },
  locationSelectorContainer: {
    marginTop: 8,
  },
  permissionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
    marginTop: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    width: '100%',
    maxWidth: 400,
    borderRadius: 16,
    padding: 24,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  modalMessage: {
    fontSize: 16,
    lineHeight: 24,
    marginBottom: 24,
  },
  errorText: {
    fontSize: 14,
    marginBottom: 16,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  modalButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
