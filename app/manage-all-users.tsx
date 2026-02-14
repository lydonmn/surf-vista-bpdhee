
import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Modal,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from './integrations/supabase/client';
import { colors } from '@/styles/commonStyles';
import { IconSymbol } from '@/components/IconSymbol';
import { useAuth } from '@/contexts/AuthContext';

interface UserProfile {
  id: string;
  email: string;
  is_admin: boolean;
  is_regional_admin: boolean;
  managed_locations: string[];
  is_subscribed: boolean;
  subscription_status: string | null;
  created_at: string;
}

export default function ManageAllUsersScreen() {
  const router = useRouter();
  const { user, profile } = useAuth();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [errorModalVisible, setErrorModalVisible] = useState(false);
  const [errorModalTitle, setErrorModalTitle] = useState('');
  const [errorModalMessage, setErrorModalMessage] = useState('');

  const loadAllUsers = useCallback(async () => {
    try {
      console.log('[ManageAllUsersScreen] Loading all users...');
      setIsLoading(true);

      const { data, error } = await supabase
        .from('profiles')
        .select('id, email, is_admin, is_regional_admin, managed_locations, is_subscribed, subscription_status, created_at')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('[ManageAllUsersScreen] Error loading users:', error);
        showErrorModal('Error', `Failed to load users: ${error.message}`);
        return;
      }

      console.log('[ManageAllUsersScreen] Loaded', data?.length || 0, 'users');
      setUsers(data || []);
    } catch (error) {
      console.error('[ManageAllUsersScreen] Exception loading users:', error);
      showErrorModal('Error', 'Failed to load users');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    // Only lydonmn@gmail.com can access this screen
    if (!user || user.email !== 'lydonmn@gmail.com') {
      console.log('[ManageAllUsersScreen] Access denied - not super admin');
      showErrorModal('Access Denied', 'This screen is only accessible to the super administrator');
      router.back();
      return;
    }

    loadAllUsers();
  }, [user, loadAllUsers]);

  const showErrorModal = (title: string, message: string) => {
    setErrorModalTitle(title);
    setErrorModalMessage(message);
    setErrorModalVisible(true);
  };

  const handleToggleAdmin = async (userId: string, currentStatus: boolean, userEmail: string) => {
    try {
      console.log('[ManageAllUsersScreen] Toggling admin status for:', userEmail);

      const { error } = await supabase
        .from('profiles')
        .update({ is_admin: !currentStatus })
        .eq('id', userId);

      if (error) {
        console.error('[ManageAllUsersScreen] Error updating admin status:', error);
        throw new Error(error.message);
      }

      const statusText = !currentStatus ? 'granted' : 'revoked';
      showErrorModal('Success', `Admin privileges ${statusText} for ${userEmail}`);
      await loadAllUsers();
    } catch (error) {
      console.error('[ManageAllUsersScreen] Error toggling admin:', error);
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      showErrorModal('Error', `Failed to update admin status: ${errorMsg}`);
    }
  };

  const handleToggleSubscription = async (userId: string, currentStatus: boolean, userEmail: string) => {
    try {
      console.log('[ManageAllUsersScreen] Toggling subscription for:', userEmail);

      const { error } = await supabase
        .from('profiles')
        .update({ 
          is_subscribed: !currentStatus,
          subscription_status: !currentStatus ? 'active' : 'inactive'
        })
        .eq('id', userId);

      if (error) {
        console.error('[ManageAllUsersScreen] Error updating subscription:', error);
        throw new Error(error.message);
      }

      const statusText = !currentStatus ? 'activated' : 'deactivated';
      showErrorModal('Success', `Subscription ${statusText} for ${userEmail}`);
      await loadAllUsers();
    } catch (error) {
      console.error('[ManageAllUsersScreen] Error toggling subscription:', error);
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      showErrorModal('Error', `Failed to update subscription: ${errorMsg}`);
    }
  };

  const handleDeleteUser = async (userId: string, userEmail: string) => {
    try {
      console.log('[ManageAllUsersScreen] Deleting user:', userEmail);

      // Delete from auth
      const { error: authError } = await supabase.auth.admin.deleteUser(userId);

      if (authError) {
        console.error('[ManageAllUsersScreen] Error deleting user from auth:', authError);
        throw new Error(authError.message);
      }

      showErrorModal('Success', `User ${userEmail} deleted successfully`);
      await loadAllUsers();
    } catch (error) {
      console.error('[ManageAllUsersScreen] Error deleting user:', error);
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      showErrorModal('Error', `Failed to delete user: ${errorMsg}`);
    }
  };

  const confirmDelete = (userId: string, userEmail: string) => {
    setErrorModalTitle('Confirm Delete');
    setErrorModalMessage(`Are you sure you want to permanently delete ${userEmail}?\n\nThis action cannot be undone.`);
    setErrorModalVisible(true);
    
    // Store the action for the modal button
    (errorModalVisible as any).deleteAction = () => handleDeleteUser(userId, userEmail);
  };

  const handleGoBack = () => {
    console.log('[ManageAllUsersScreen] Navigating back...');
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/admin');
    }
  };

  if (!user || user.email !== 'lydonmn@gmail.com') {
    return (
      <View style={styles.container}>
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Checking permissions...</Text>
        </View>
      </View>
    );
  }

  const filteredUsers = users.filter(u => 
    u.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const backIconName = 'chevron.left';
  const backMaterialIconName = 'chevron-left';
  const backButtonText = 'Back';
  const headerTitleText = 'Manage All Users';
  const searchPlaceholder = 'Search by email...';
  const totalUsersText = `Total Users: ${users.length}`;
  const subscribedUsersText = `Subscribed: ${users.filter(u => u.is_subscribed).length}`;
  const adminsText = `Admins: ${users.filter(u => u.is_admin).length}`;
  const regionalAdminsText = `Regional Admins: ${users.filter(u => u.is_regional_admin).length}`;
  const sectionTitleText = 'All Users';
  const emptyStateText = 'No users found';

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={handleGoBack}>
          <IconSymbol
            ios_icon_name={backIconName}
            android_material_icon_name={backMaterialIconName}
            size={24}
            color={colors.primary}
          />
          <Text style={[styles.backButtonText, { color: colors.primary }]}>
            {backButtonText}
          </Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{headerTitleText}</Text>
        <View style={styles.headerSpacer} />
      </View>

      <View style={styles.statsBar}>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{users.length}</Text>
          <Text style={styles.statLabel}>Total</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{users.filter(u => u.is_subscribed).length}</Text>
          <Text style={styles.statLabel}>Subscribed</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{users.filter(u => u.is_admin).length}</Text>
          <Text style={styles.statLabel}>Admins</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{users.filter(u => u.is_regional_admin).length}</Text>
          <Text style={styles.statLabel}>Regional</Text>
        </View>
      </View>

      <View style={styles.searchContainer}>
        <IconSymbol
          ios_icon_name="magnifyingglass"
          android_material_icon_name="search"
          size={20}
          color={colors.textSecondary}
        />
        <TextInput
          style={styles.searchInput}
          placeholder={searchPlaceholder}
          placeholderTextColor={colors.textSecondary}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{sectionTitleText}</Text>

          {isLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={colors.primary} />
            </View>
          ) : filteredUsers.length === 0 ? (
            <View style={styles.emptyState}>
              <IconSymbol
                ios_icon_name="person.2"
                android_material_icon_name="group"
                size={48}
                color={colors.textSecondary}
              />
              <Text style={styles.emptyStateText}>{emptyStateText}</Text>
            </View>
          ) : (
            <>
              {filteredUsers.map((userProfile) => {
                const createdDate = new Date(userProfile.created_at).toLocaleDateString();
                const subscriptionBadge = userProfile.is_subscribed ? '✅ Subscribed' : '❌ Free';
                const adminBadge = userProfile.is_admin ? '👑 Super Admin' : userProfile.is_regional_admin ? '🔧 Regional Admin' : '👤 User';

                return (
                  <View style={styles.userCard} key={userProfile.id}>
                    <View style={styles.userHeader}>
                      <View style={styles.userInfo}>
                        <Text style={styles.userEmail}>{userProfile.email}</Text>
                        <View style={styles.badges}>
                          <View style={[
                            styles.badge,
                            userProfile.is_subscribed ? styles.badgeSuccess : styles.badgeWarning
                          ]}>
                            <Text style={styles.badgeText}>{subscriptionBadge}</Text>
                          </View>
                          <View style={[
                            styles.badge,
                            userProfile.is_admin ? styles.badgePrimary : userProfile.is_regional_admin ? styles.badgeInfo : styles.badgeDefault
                          ]}>
                            <Text style={styles.badgeText}>{adminBadge}</Text>
                          </View>
                        </View>
                        <Text style={styles.userDate}>Joined: {createdDate}</Text>
                      </View>
                    </View>

                    <View style={styles.userActions}>
                      <TouchableOpacity
                        style={[styles.actionButton, styles.subscriptionButton]}
                        onPress={() => handleToggleSubscription(userProfile.id, userProfile.is_subscribed, userProfile.email)}
                      >
                        <IconSymbol
                          ios_icon_name={userProfile.is_subscribed ? 'xmark.circle' : 'checkmark.circle'}
                          android_material_icon_name={userProfile.is_subscribed ? 'cancel' : 'check_circle'}
                          size={18}
                          color="#FFFFFF"
                        />
                        <Text style={styles.actionButtonText}>
                          {userProfile.is_subscribed ? 'Revoke Sub' : 'Grant Sub'}
                        </Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[styles.actionButton, styles.adminButton]}
                        onPress={() => handleToggleAdmin(userProfile.id, userProfile.is_admin, userProfile.email)}
                      >
                        <IconSymbol
                          ios_icon_name={userProfile.is_admin ? 'crown.fill' : 'crown'}
                          android_material_icon_name="admin_panel_settings"
                          size={18}
                          color="#FFFFFF"
                        />
                        <Text style={styles.actionButtonText}>
                          {userProfile.is_admin ? 'Revoke Admin' : 'Make Admin'}
                        </Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[styles.actionButton, styles.deleteButton]}
                        onPress={() => confirmDelete(userProfile.id, userProfile.email)}
                      >
                        <IconSymbol
                          ios_icon_name="trash.fill"
                          android_material_icon_name="delete"
                          size={18}
                          color="#FFFFFF"
                        />
                        <Text style={styles.actionButtonText}>Delete</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })}
            </>
          )}
        </View>
      </ScrollView>

      {/* Error/Success Modal */}
      <Modal
        visible={errorModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setErrorModalVisible(false)}
      >
        <View style={styles.errorModalOverlay}>
          <View style={styles.errorModalContent}>
            <Text style={styles.errorModalTitle}>{errorModalTitle}</Text>
            <Text style={styles.errorModalMessage}>{errorModalMessage}</Text>
            <TouchableOpacity
              style={styles.errorModalButton}
              onPress={() => setErrorModalVisible(false)}
            >
              <Text style={styles.errorModalButtonText}>OK</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 48,
    paddingBottom: 16,
    backgroundColor: colors.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingRight: 8,
  },
  backButtonText: {
    fontSize: 17,
    fontWeight: '600',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.text,
  },
  headerSpacer: {
    width: 70,
  },
  statsBar: {
    flexDirection: 'row',
    backgroundColor: colors.card,
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.primary,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.card,
    marginHorizontal: 16,
    marginVertical: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: colors.text,
  },
  scrollView: {
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
  },
  loadingText: {
    fontSize: 16,
    color: colors.textSecondary,
    marginTop: 16,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 16,
    marginLeft: 4,
  },
  loadingContainer: {
    padding: 40,
    alignItems: 'center',
  },
  emptyState: {
    alignItems: 'center',
    padding: 40,
    backgroundColor: colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: 'dashed',
  },
  emptyStateText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginTop: 16,
  },
  userCard: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 18,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  userHeader: {
    marginBottom: 14,
  },
  userInfo: {
    gap: 8,
  },
  userEmail: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.text,
  },
  badges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  badgeSuccess: {
    backgroundColor: '#10B981',
  },
  badgeWarning: {
    backgroundColor: '#F59E0B',
  },
  badgePrimary: {
    backgroundColor: colors.primary,
  },
  badgeInfo: {
    backgroundColor: '#3B82F6',
  },
  badgeDefault: {
    backgroundColor: colors.textSecondary,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  userDate: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  userActions: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 8,
    flex: 1,
    minWidth: '30%',
    justifyContent: 'center',
  },
  subscriptionButton: {
    backgroundColor: '#10B981',
  },
  adminButton: {
    backgroundColor: colors.primary,
  },
  deleteButton: {
    backgroundColor: '#EF4444',
  },
  actionButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  errorModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorModalContent: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 400,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  errorModalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 12,
  },
  errorModalMessage: {
    fontSize: 16,
    color: colors.text,
    lineHeight: 24,
    marginBottom: 20,
  },
  errorModalButton: {
    backgroundColor: colors.primary,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignItems: 'center',
  },
  errorModalButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
