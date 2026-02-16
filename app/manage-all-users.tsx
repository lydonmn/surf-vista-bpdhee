
import { colors } from '@/styles/commonStyles';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, TextInput, TouchableOpacity, Modal } from 'react-native';
import { router } from 'expo-router';
import { IconSymbol } from '@/components/IconSymbol';
import { useState, useEffect, useCallback } from 'react';
import { useTheme } from '@react-navigation/native';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/app/integrations/supabase/client';

interface UserProfile {
  id: string;
  email: string;
  is_admin: boolean;
  is_regional_admin: boolean;
  is_subscribed: boolean;
  subscription_end_date: string | null;
  created_at: string;
  managed_locations?: string[];
}

interface UserStats {
  total: number;
  subscribed: number;
  admins: number;
}

export default function ManageAllUsersScreen() {
  const theme = useTheme();
  const { user } = useAuth();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<UserProfile[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [stats, setStats] = useState<UserStats>({ total: 0, subscribed: 0, admins: 0 });
  const [confirmModalVisible, setConfirmModalVisible] = useState(false);
  const [confirmModalMessage, setConfirmModalMessage] = useState('');
  const [confirmModalAction, setConfirmModalAction] = useState<(() => void) | null>(null);
  const [successModalVisible, setSuccessModalVisible] = useState(false);
  const [successModalTitle, setSuccessModalTitle] = useState('');
  const [successModalMessage, setSuccessModalMessage] = useState('');
  const [errorModalVisible, setErrorModalVisible] = useState(false);
  const [errorModalTitle, setErrorModalTitle] = useState('');
  const [errorModalMessage, setErrorModalMessage] = useState('');

  const fetchUsers = useCallback(async () => {
    try {
      console.log('[ManageAllUsersScreen] Fetching all users...');
      setIsLoading(true);

      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('[ManageAllUsersScreen] Error fetching users:', error);
        showError('Error', `Failed to load users: ${error.message}`);
        return;
      }

      console.log('[ManageAllUsersScreen] Loaded', data?.length || 0, 'users');
      setUsers(data || []);
      setFilteredUsers(data || []);

      const subscribedCount = data?.filter(u => u.is_subscribed).length || 0;
      const adminCount = data?.filter(u => u.is_admin || u.is_regional_admin).length || 0;

      setStats({
        total: data?.length || 0,
        subscribed: subscribedCount,
        admins: adminCount,
      });
    } catch (error) {
      console.error('[ManageAllUsersScreen] Exception fetching users:', error);
      showError('Error', 'Failed to load users');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!user) {
      console.log('[ManageAllUsersScreen] No user, redirecting to login');
      router.replace('/login');
      return;
    }

    fetchUsers();
  }, [user, fetchUsers]);

  useEffect(() => {
    if (searchTerm.trim() === '') {
      setFilteredUsers(users);
    } else {
      const filtered = users.filter(u =>
        u.email.toLowerCase().includes(searchTerm.toLowerCase())
      );
      setFilteredUsers(filtered);
    }
  }, [searchTerm, users]);

  const showSuccess = (title: string, message: string) => {
    setSuccessModalTitle(title);
    setSuccessModalMessage(message);
    setSuccessModalVisible(true);
  };

  const showError = (title: string, message: string) => {
    setErrorModalTitle(title);
    setErrorModalMessage(message);
    setErrorModalVisible(true);
  };

  const showConfirm = (message: string, action: () => void) => {
    setConfirmModalMessage(message);
    setConfirmModalAction(() => action);
    setConfirmModalVisible(true);
  };

  const handleGrantFreeMonths = (userId: string, userEmail: string) => {
    console.log('[ManageAllUsersScreen] Grant free months for:', userEmail);
    showError('Not Implemented', 'This feature is coming soon');
  };

  const confirmGrantFreeMonths = () => {
    console.log('[ManageAllUsersScreen] Confirm grant free months');
  };

  const handlePauseSubscription = (userId: string, userEmail: string) => {
    console.log('[ManageAllUsersScreen] Pause subscription for:', userEmail);
    showError('Not Implemented', 'This feature is coming soon');
  };

  const handleCancelSubscription = (userId: string, userEmail: string) => {
    console.log('[ManageAllUsersScreen] Cancel subscription for:', userEmail);
    showError('Not Implemented', 'This feature is coming soon');
  };

  const handleIssueRefund = (userId: string, userEmail: string) => {
    console.log('[ManageAllUsersScreen] Issue refund for:', userEmail);
    showError('Not Implemented', 'This feature is coming soon');
  };

  const handleToggleAdmin = async (userId: string, userEmail: string, currentStatus: boolean) => {
    const action = async () => {
      try {
        console.log('[ManageAllUsersScreen] Toggling admin status for:', userEmail);

        const { error } = await supabase
          .from('profiles')
          .update({ is_admin: !currentStatus })
          .eq('id', userId);

        if (error) {
          console.error('[ManageAllUsersScreen] Error toggling admin:', error);
          showError('Error', `Failed to update admin status: ${error.message}`);
          return;
        }

        showSuccess('Success', `Admin status ${!currentStatus ? 'granted' : 'removed'} for ${userEmail}`);
        await fetchUsers();
      } catch (error) {
        console.error('[ManageAllUsersScreen] Exception toggling admin:', error);
        showError('Error', 'Failed to update admin status');
      }
    };

    showConfirm(
      `Are you sure you want to ${currentStatus ? 'remove' : 'grant'} admin privileges for ${userEmail}?`,
      action
    );
  };

  const handleDeleteUser = async (userId: string, userEmail: string) => {
    const action = async () => {
      try {
        console.log('[ManageAllUsersScreen] Deleting user:', userEmail);

        const { error } = await supabase.auth.admin.deleteUser(userId);

        if (error) {
          console.error('[ManageAllUsersScreen] Error deleting user:', error);
          showError('Error', `Failed to delete user: ${error.message}`);
          return;
        }

        showSuccess('Success', `User ${userEmail} has been deleted`);
        await fetchUsers();
      } catch (error) {
        console.error('[ManageAllUsersScreen] Exception deleting user:', error);
        showError('Error', 'Failed to delete user');
      }
    };

    showConfirm(
      `Are you sure you want to permanently delete ${userEmail}? This action cannot be undone.`,
      action
    );
  };

  const handleRefresh = () => {
    console.log('[ManageAllUsersScreen] Refreshing user list');
    fetchUsers();
  };

  const formatDate = (dateString: string | null): string => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString();
  };

  const getDaysLeft = (endDate: string | null): number => {
    if (!endDate) return 0;
    const end = new Date(endDate);
    const now = new Date();
    const diffTime = end.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return Math.max(0, diffDays);
  };

  const getSubscriptionStatus = (user: UserProfile): string => {
    if (!user.is_subscribed) return 'Not Subscribed';
    const daysLeft = getDaysLeft(user.subscription_end_date);
    if (daysLeft === 0) return 'Expired';
    return `Active (${daysLeft} days left)`;
  };

  const renderUserCard = ({ item }: { item: UserProfile }) => {
    const subscriptionStatus = getSubscriptionStatus(item);
    const isActive = item.is_subscribed && getDaysLeft(item.subscription_end_date) > 0;
    const statusColor = isActive ? '#4CAF50' : item.is_subscribed ? '#FF9800' : '#9E9E9E';

    return (
      <View style={[styles.userCard, { backgroundColor: theme.colors.card }]}>
        <View style={styles.userHeader}>
          <View style={styles.userInfo}>
            <Text style={[styles.userEmail, { color: theme.colors.text }]}>
              {item.email}
            </Text>
            <View style={styles.userBadges}>
              {item.is_admin && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>Admin</Text>
                </View>
              )}
              {item.is_regional_admin && (
                <View style={[styles.badge, { backgroundColor: '#9C27B0' }]}>
                  <Text style={styles.badgeText}>Regional Admin</Text>
                </View>
              )}
            </View>
          </View>
          <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
        </View>

        <View style={styles.userDetails}>
          <Text style={[styles.userDetailText, { color: colors.textSecondary }]}>
            Status: {subscriptionStatus}
          </Text>
          {item.subscription_end_date && (
            <Text style={[styles.userDetailText, { color: colors.textSecondary }]}>
              Ends: {formatDate(item.subscription_end_date)}
            </Text>
          )}
          <Text style={[styles.userDetailText, { color: colors.textSecondary }]}>
            Joined: {formatDate(item.created_at)}
          </Text>
        </View>

        <View style={styles.userActions}>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => handleToggleAdmin(item.id, item.email, item.is_admin)}
          >
            <IconSymbol
              ios_icon_name={item.is_admin ? 'person.badge.minus' : 'person.badge.plus'}
              android_material_icon_name={item.is_admin ? 'person-remove' : 'person-add'}
              size={16}
              color={colors.primary}
            />
            <Text style={[styles.actionButtonText, { color: colors.primary }]}>
              {item.is_admin ? 'Remove Admin' : 'Make Admin'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => handleDeleteUser(item.id, item.email)}
          >
            <IconSymbol
              ios_icon_name="trash"
              android_material_icon_name="delete"
              size={16}
              color="#FF3B30"
            />
            <Text style={[styles.actionButtonText, { color: '#FF3B30' }]}>
              Delete
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <IconSymbol
            ios_icon_name="chevron.left"
            android_material_icon_name="chevron-left"
            size={24}
            color={colors.primary}
          />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.colors.text }]}>
          Manage All Users
        </Text>
        <TouchableOpacity style={styles.refreshButton} onPress={handleRefresh}>
          <IconSymbol
            ios_icon_name="arrow.clockwise"
            android_material_icon_name="refresh"
            size={24}
            color={colors.primary}
          />
        </TouchableOpacity>
      </View>

      <View style={styles.statsContainer}>
        <View style={styles.statBox}>
          <Text style={[styles.statValue, { color: theme.colors.text }]}>{stats.total}</Text>
          <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Total Users</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={[styles.statValue, { color: '#4CAF50' }]}>{stats.subscribed}</Text>
          <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Subscribed</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={[styles.statValue, { color: colors.primary }]}>{stats.admins}</Text>
          <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Admins</Text>
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
          style={[styles.searchInput, { color: theme.colors.text }]}
          placeholder="Search by email..."
          placeholderTextColor={colors.textSecondary}
          value={searchTerm}
          onChangeText={setSearchTerm}
        />
      </View>

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={filteredUsers}
          renderItem={renderUserCard}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                No users found
              </Text>
            </View>
          }
        />
      )}

      {/* Confirm Modal */}
      <Modal
        visible={confirmModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setConfirmModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.colors.card }]}>
            <Text style={[styles.modalTitle, { color: theme.colors.text }]}>
              Confirm Action
            </Text>
            <Text style={[styles.modalMessage, { color: colors.textSecondary }]}>
              {confirmModalMessage}
            </Text>
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => setConfirmModalVisible(false)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.confirmButton]}
                onPress={() => {
                  setConfirmModalVisible(false);
                  if (confirmModalAction) {
                    confirmModalAction();
                  }
                }}
              >
                <Text style={styles.confirmButtonText}>Confirm</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Success Modal */}
      <Modal
        visible={successModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setSuccessModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.colors.card }]}>
            <IconSymbol
              ios_icon_name="checkmark.circle.fill"
              android_material_icon_name="check-circle"
              size={48}
              color="#4CAF50"
            />
            <Text style={[styles.modalTitle, { color: theme.colors.text }]}>
              {successModalTitle}
            </Text>
            <Text style={[styles.modalMessage, { color: colors.textSecondary }]}>
              {successModalMessage}
            </Text>
            <TouchableOpacity
              style={[styles.modalButton, styles.confirmButton]}
              onPress={() => setSuccessModalVisible(false)}
            >
              <Text style={styles.confirmButtonText}>OK</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Error Modal */}
      <Modal
        visible={errorModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setErrorModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.colors.card }]}>
            <IconSymbol
              ios_icon_name="exclamationmark.triangle.fill"
              android_material_icon_name="warning"
              size={48}
              color="#FF3B30"
            />
            <Text style={[styles.modalTitle, { color: theme.colors.text }]}>
              {errorModalTitle}
            </Text>
            <Text style={[styles.modalMessage, { color: colors.textSecondary }]}>
              {errorModalMessage}
            </Text>
            <TouchableOpacity
              style={[styles.modalButton, styles.confirmButton]}
              onPress={() => setErrorModalVisible(false)}
            >
              <Text style={styles.confirmButtonText}>OK</Text>
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
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 48,
    paddingBottom: 16,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  refreshButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  statsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingBottom: 16,
    gap: 12,
  },
  statBox: {
    flex: 1,
    backgroundColor: colors.card,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    marginHorizontal: 16,
    marginBottom: 16,
    paddingHorizontal: 12,
    borderRadius: 12,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 100,
  },
  emptyState: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
  },
  userCard: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    boxShadow: '0px 2px 4px rgba(0, 0, 0, 0.1)',
    elevation: 2,
  },
  userHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  userInfo: {
    flex: 1,
  },
  userEmail: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  userBadges: {
    flexDirection: 'row',
    gap: 6,
    flexWrap: 'wrap',
  },
  badge: {
    backgroundColor: colors.primary,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '600',
  },
  statusDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginTop: 4,
  },
  userDetails: {
    gap: 4,
    marginBottom: 12,
  },
  userDetailText: {
    fontSize: 13,
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
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: colors.highlight,
    borderRadius: 8,
  },
  actionButtonText: {
    fontSize: 13,
    fontWeight: '600',
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
    alignItems: 'center',
    gap: 16,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  modalMessage: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  modalButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: colors.highlight,
  },
  cancelButtonText: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '600',
  },
  confirmButton: {
    backgroundColor: colors.primary,
  },
  confirmButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
