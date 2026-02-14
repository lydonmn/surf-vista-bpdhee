
import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, TextInput, TouchableOpacity, ScrollView, Modal } from 'react-native';
import { supabase } from '@/app/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@react-navigation/native';
import { IconSymbol } from '@/components/IconSymbol';
import { colors } from '@/styles/commonStyles';
import { router } from 'expo-router';

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
  const { profile, user } = useAuth();
  const theme = useTheme();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [stats, setStats] = useState<UserStats>({ total: 0, subscribed: 0, admins: 0 });
  const [refreshing, setRefreshing] = useState(false);
  
  // Modal states
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [confirmAction, setConfirmAction] = useState<(() => void) | null>(null);
  const [confirmMessage, setConfirmMessage] = useState('');

  // Check access
  useEffect(() => {
    if (user?.email !== 'lydonmn@gmail.com') {
      console.log('[ManageAllUsers] Access denied - not super admin');
      showError('Access Denied', 'Only the super admin can access this page.');
      router.back();
    }
  }, [user]);

  const fetchUsers = useCallback(async () => {
    try {
      console.log('[ManageAllUsers] Fetching all users...');
      setLoading(true);

      const { data, error } = await supabase
        .from('profiles')
        .select('id, email, is_admin, is_regional_admin, is_subscribed, subscription_end_date, created_at, managed_locations')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('[ManageAllUsers] Error fetching users:', error);
        showError('Error', `Failed to fetch users: ${error.message}`);
        return;
      }

      console.log('[ManageAllUsers] Fetched users:', data?.length);
      setUsers(data || []);
      setFilteredUsers(data || []);
      
      // Calculate stats
      const totalUsers = data?.length || 0;
      const subscribedUsers = data?.filter(u => u.is_subscribed).length || 0;
      const adminUsers = data?.filter(u => u.is_admin || u.is_regional_admin).length || 0;
      
      setStats({
        total: totalUsers,
        subscribed: subscribedUsers,
        admins: adminUsers,
      });
    } catch (error: any) {
      console.error('[ManageAllUsers] Error:', error);
      showError('Error', error.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  // Search filter
  useEffect(() => {
    if (searchTerm.trim() === '') {
      setFilteredUsers(users);
    } else {
      const lowercaseSearch = searchTerm.toLowerCase();
      const filtered = users.filter(user =>
        user.email.toLowerCase().includes(lowercaseSearch)
      );
      setFilteredUsers(filtered);
    }
  }, [searchTerm, users]);

  const showSuccess = (title: string, message: string) => {
    setSuccessMessage(`${title}\n\n${message}`);
    setShowSuccessModal(true);
  };

  const showError = (title: string, message: string) => {
    setErrorMessage(`${title}\n\n${message}`);
    setShowErrorModal(true);
  };

  const showConfirm = (message: string, action: () => void) => {
    setConfirmMessage(message);
    setConfirmAction(() => action);
    setShowConfirmModal(true);
  };

  const handleGrantFreeMonths = async (userId: string, userEmail: string) => {
    showConfirm(
      `Grant 3 free months to ${userEmail}?\n\nThis will extend their subscription by 3 months from today or their current end date.`,
      async () => {
        try {
          console.log('[ManageAllUsers] Granting 3 free months to:', userEmail);
          
          // Calculate new end date (3 months from now or from current end date)
          const user = users.find(u => u.id === userId);
          let newEndDate: Date;
          
          if (user?.subscription_end_date && new Date(user.subscription_end_date) > new Date()) {
            // Extend from current end date
            newEndDate = new Date(user.subscription_end_date);
          } else {
            // Start from today
            newEndDate = new Date();
          }
          
          // Add 3 months
          newEndDate.setMonth(newEndDate.getMonth() + 3);
          
          const { error } = await supabase
            .from('profiles')
            .update({
              is_subscribed: true,
              subscription_end_date: newEndDate.toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq('id', userId);

          if (error) {
            console.error('[ManageAllUsers] Error granting free months:', error);
            showError('Error', `Failed to grant free months: ${error.message}`);
            return;
          }

          console.log('[ManageAllUsers] ✅ Free months granted');
          showSuccess(
            'Success',
            `Granted 3 free months to ${userEmail}\n\nNew end date: ${newEndDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`
          );
          await fetchUsers();
        } catch (error: any) {
          console.error('[ManageAllUsers] Error:', error);
          showError('Error', error.message);
        }
      }
    );
  };

  const handlePauseSubscription = async (userId: string, userEmail: string) => {
    showConfirm(
      `Pause subscription for ${userEmail}?\n\nThis will set is_subscribed to false but keep their end date. They can resume later.`,
      async () => {
        try {
          console.log('[ManageAllUsers] Pausing subscription for:', userEmail);
          
          const { error } = await supabase
            .from('profiles')
            .update({
              is_subscribed: false,
              updated_at: new Date().toISOString(),
            })
            .eq('id', userId);

          if (error) {
            console.error('[ManageAllUsers] Error pausing subscription:', error);
            showError('Error', `Failed to pause subscription: ${error.message}`);
            return;
          }

          console.log('[ManageAllUsers] ✅ Subscription paused');
          showSuccess('Success', `Subscription paused for ${userEmail}`);
          await fetchUsers();
        } catch (error: any) {
          console.error('[ManageAllUsers] Error:', error);
          showError('Error', error.message);
        }
      }
    );
  };

  const handleCancelSubscription = async (userId: string, userEmail: string) => {
    showConfirm(
      `Cancel subscription for ${userEmail}?\n\nThis will immediately revoke their access and clear their end date.`,
      async () => {
        try {
          console.log('[ManageAllUsers] Canceling subscription for:', userEmail);
          
          const { error } = await supabase
            .from('profiles')
            .update({
              is_subscribed: false,
              subscription_end_date: null,
              updated_at: new Date().toISOString(),
            })
            .eq('id', userId);

          if (error) {
            console.error('[ManageAllUsers] Error canceling subscription:', error);
            showError('Error', `Failed to cancel subscription: ${error.message}`);
            return;
          }

          console.log('[ManageAllUsers] ✅ Subscription canceled');
          showSuccess('Success', `Subscription canceled for ${userEmail}`);
          await fetchUsers();
        } catch (error: any) {
          console.error('[ManageAllUsers] Error:', error);
          showError('Error', error.message);
        }
      }
    );
  };

  const handleIssueRefund = async (userId: string, userEmail: string) => {
    showConfirm(
      `Issue refund for ${userEmail}?\n\nNote: This will mark them as unsubscribed in the app. You must process the actual refund through RevenueCat/Apple/Google separately.`,
      async () => {
        try {
          console.log('[ManageAllUsers] Issuing refund for:', userEmail);
          
          const { error } = await supabase
            .from('profiles')
            .update({
              is_subscribed: false,
              subscription_end_date: null,
              updated_at: new Date().toISOString(),
            })
            .eq('id', userId);

          if (error) {
            console.error('[ManageAllUsers] Error issuing refund:', error);
            showError('Error', `Failed to issue refund: ${error.message}`);
            return;
          }

          console.log('[ManageAllUsers] ✅ Refund processed in app');
          showSuccess(
            'Refund Processed',
            `${userEmail} has been marked as unsubscribed.\n\n⚠️ Remember to process the actual refund through RevenueCat/Apple/Google.`
          );
          await fetchUsers();
        } catch (error: any) {
          console.error('[ManageAllUsers] Error:', error);
          showError('Error', error.message);
        }
      }
    );
  };

  const handleToggleAdmin = async (userId: string, userEmail: string, currentStatus: boolean) => {
    const action = currentStatus ? 'revoke admin' : 'grant admin';
    showConfirm(
      `${action.charAt(0).toUpperCase() + action.slice(1)} privileges for ${userEmail}?`,
      async () => {
        try {
          console.log(`[ManageAllUsers] ${action} for:`, userEmail);
          
          const { error } = await supabase
            .from('profiles')
            .update({
              is_admin: !currentStatus,
              updated_at: new Date().toISOString(),
            })
            .eq('id', userId);

          if (error) {
            console.error(`[ManageAllUsers] Error ${action}:`, error);
            showError('Error', `Failed to ${action}: ${error.message}`);
            return;
          }

          console.log(`[ManageAllUsers] ✅ Admin ${action} successful`);
          showSuccess('Success', `Admin privileges ${currentStatus ? 'revoked from' : 'granted to'} ${userEmail}`);
          await fetchUsers();
        } catch (error: any) {
          console.error('[ManageAllUsers] Error:', error);
          showError('Error', error.message);
        }
      }
    );
  };

  const handleDeleteUser = async (userId: string, userEmail: string) => {
    showConfirm(
      `⚠️ DELETE USER: ${userEmail}?\n\nThis action CANNOT be undone. All user data will be permanently deleted.`,
      async () => {
        try {
          console.log('[ManageAllUsers] Deleting user:', userEmail);
          
          const { error } = await supabase
            .from('profiles')
            .delete()
            .eq('id', userId);

          if (error) {
            console.error('[ManageAllUsers] Error deleting user:', error);
            showError('Error', `Failed to delete user: ${error.message}`);
            return;
          }

          console.log('[ManageAllUsers] ✅ User deleted');
          showSuccess('Success', `User ${userEmail} has been permanently deleted.`);
          await fetchUsers();
        } catch (error: any) {
          console.error('[ManageAllUsers] Error:', error);
          showError('Error', error.message);
        }
      }
    );
  };

  const handleRefresh = () => {
    setRefreshing(true);
    fetchUsers();
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const getDaysLeft = (endDate: string | null) => {
    if (!endDate) return null;
    const end = new Date(endDate);
    const now = new Date();
    const diffTime = end.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const getSubscriptionStatus = (user: UserProfile) => {
    if (!user.is_subscribed) {
      return { text: 'No Subscription', color: '#9E9E9E' };
    }
    
    const daysLeft = getDaysLeft(user.subscription_end_date);
    if (daysLeft === null) {
      return { text: 'Active', color: '#4CAF50' };
    }
    
    if (daysLeft < 0) {
      return { text: 'Expired', color: '#F44336' };
    }
    
    return { text: `Active (${daysLeft} days left)`, color: '#4CAF50' };
  };

  const renderUserCard = ({ item }: { item: UserProfile }) => {
    const subscriptionStatus = getSubscriptionStatus(item);
    const isCurrentUser = item.id === user?.id;
    
    return (
      <View style={[styles.userCard, { backgroundColor: theme.colors.card }]}>
        {/* User Header */}
        <View style={styles.userHeader}>
          <View style={styles.userAvatar}>
            <IconSymbol
              ios_icon_name="person.fill"
              android_material_icon_name="person"
              size={24}
              color={colors.primary}
            />
          </View>
          <View style={styles.userInfo}>
            <Text style={[styles.userEmail, { color: theme.colors.text }]}>
              {item.email}
              {isCurrentUser && <Text style={styles.youBadge}> (You)</Text>}
            </Text>
            <Text style={[styles.joinedDate, { color: colors.textSecondary }]}>
              Joined {formatDate(item.created_at)}
            </Text>
          </View>
        </View>

        {/* Subscription Status */}
        <View style={styles.statusRow}>
          <View style={[styles.statusBadge, { backgroundColor: subscriptionStatus.color + '20' }]}>
            <Text style={[styles.statusText, { color: subscriptionStatus.color }]}>
              {subscriptionStatus.text}
            </Text>
          </View>
          {item.subscription_end_date && (
            <Text style={[styles.endDateText, { color: colors.textSecondary }]}>
              Ends: {formatDate(item.subscription_end_date)}
            </Text>
          )}
        </View>

        {/* Admin Badges */}
        {(item.is_admin || item.is_regional_admin) && (
          <View style={styles.adminBadges}>
            {item.is_admin && (
              <View style={[styles.badge, { backgroundColor: '#9C27B0' }]}>
                <IconSymbol
                  ios_icon_name="star.fill"
                  android_material_icon_name="star"
                  size={14}
                  color="#FFFFFF"
                />
                <Text style={styles.badgeText}>Super Admin</Text>
              </View>
            )}
            {item.is_regional_admin && (
              <View style={[styles.badge, { backgroundColor: '#FF9800' }]}>
                <IconSymbol
                  ios_icon_name="location.fill"
                  android_material_icon_name="place"
                  size={14}
                  color="#FFFFFF"
                />
                <Text style={styles.badgeText}>Regional Admin</Text>
              </View>
            )}
          </View>
        )}

        {/* Notifications Status */}
        <View style={styles.notificationRow}>
          <IconSymbol
            ios_icon_name="bell.fill"
            android_material_icon_name="notifications"
            size={16}
            color={colors.textSecondary}
          />
          <Text style={[styles.notificationText, { color: colors.textSecondary }]}>
            Notifications: Enabled
          </Text>
        </View>

        {/* Action Buttons */}
        <View style={styles.actionButtons}>
          {/* Free Months Button */}
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: '#2196F3' }]}
            onPress={() => handleGrantFreeMonths(item.id, item.email)}
          >
            <IconSymbol
              ios_icon_name="gift.fill"
              android_material_icon_name="card_giftcard"
              size={18}
              color="#FFFFFF"
            />
            <Text style={styles.actionBtnText}>Free Months</Text>
          </TouchableOpacity>

          {/* Pause Button */}
          {item.is_subscribed && (
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: '#FF9800' }]}
              onPress={() => handlePauseSubscription(item.id, item.email)}
            >
              <IconSymbol
                ios_icon_name="pause.circle.fill"
                android_material_icon_name="pause"
                size={18}
                color="#FFFFFF"
              />
              <Text style={styles.actionBtnText}>Pause</Text>
            </TouchableOpacity>
          )}

          {/* Cancel Button */}
          {item.is_subscribed && (
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: '#F44336' }]}
              onPress={() => handleCancelSubscription(item.id, item.email)}
            >
              <IconSymbol
                ios_icon_name="xmark.circle.fill"
                android_material_icon_name="cancel"
                size={18}
                color="#FFFFFF"
              />
              <Text style={styles.actionBtnText}>Cancel</Text>
            </TouchableOpacity>
          )}

          {/* Refund Button */}
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: '#9C27B0' }]}
            onPress={() => handleIssueRefund(item.id, item.email)}
          >
            <IconSymbol
              ios_icon_name="dollarsign.circle.fill"
              android_material_icon_name="attach_money"
              size={18}
              color="#FFFFFF"
            />
            <Text style={styles.actionBtnText}>Refund</Text>
          </TouchableOpacity>
        </View>

        {/* Secondary Actions */}
        <View style={styles.secondaryActions}>
          {!isCurrentUser && (
            <>
              <TouchableOpacity
                style={[styles.secondaryBtn, { borderColor: colors.border }]}
                onPress={() => handleToggleAdmin(item.id, item.email, item.is_admin)}
              >
                <Text style={[styles.secondaryBtnText, { color: theme.colors.text }]}>
                  {item.is_admin ? 'Revoke Admin' : 'Grant Admin'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.secondaryBtn, styles.deleteBtnBorder]}
                onPress={() => handleDeleteUser(item.id, item.email)}
              >
                <Text style={styles.deleteBtnText}>Delete User</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>
    );
  };

  if (user?.email !== 'lydonmn@gmail.com') {
    return null;
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: theme.colors.card }]}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <IconSymbol
            ios_icon_name="chevron.left"
            android_material_icon_name="arrow-back"
            size={24}
            color={theme.colors.text}
          />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.colors.text }]}>User Management</Text>
        <TouchableOpacity
          style={styles.refreshButton}
          onPress={handleRefresh}
          disabled={refreshing}
        >
          {refreshing ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : (
            <IconSymbol
              ios_icon_name="arrow.clockwise"
              android_material_icon_name="refresh"
              size={24}
              color={colors.primary}
            />
          )}
        </TouchableOpacity>
      </View>

      {/* Search Bar */}
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
        {searchTerm.length > 0 && (
          <TouchableOpacity onPress={() => setSearchTerm('')}>
            <IconSymbol
              ios_icon_name="xmark.circle.fill"
              android_material_icon_name="cancel"
              size={20}
              color={colors.textSecondary}
            />
          </TouchableOpacity>
        )}
      </View>

      {/* Stats */}
      <View style={styles.statsContainer}>
        <View style={styles.statCard}>
          <Text style={styles.statNumber}>{stats.total}</Text>
          <Text style={styles.statLabel}>Total Users</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={[styles.statNumber, { color: '#4CAF50' }]}>{stats.subscribed}</Text>
          <Text style={styles.statLabel}>Subscribed</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={[styles.statNumber, { color: '#9C27B0' }]}>{stats.admins}</Text>
          <Text style={styles.statLabel}>Admins</Text>
        </View>
      </View>

      {/* User List */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
            Loading users...
          </Text>
        </View>
      ) : (
        <FlatList
          data={filteredUsers}
          renderItem={renderUserCard}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          refreshing={refreshing}
          onRefresh={handleRefresh}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <IconSymbol
                ios_icon_name="person.slash"
                android_material_icon_name="person_off"
                size={48}
                color={colors.textSecondary}
              />
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                No users found
              </Text>
            </View>
          }
        />
      )}

      {/* Success Modal */}
      <Modal
        visible={showSuccessModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowSuccessModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.colors.card }]}>
            <View style={[styles.modalIcon, { backgroundColor: '#4CAF50' }]}>
              <IconSymbol
                ios_icon_name="checkmark.circle.fill"
                android_material_icon_name="check_circle"
                size={48}
                color="#FFFFFF"
              />
            </View>
            <Text style={[styles.modalTitle, { color: theme.colors.text }]}>Success</Text>
            <Text style={[styles.modalMessage, { color: colors.textSecondary }]}>
              {successMessage}
            </Text>
            <TouchableOpacity
              style={[styles.modalButton, { backgroundColor: '#4CAF50' }]}
              onPress={() => setShowSuccessModal(false)}
            >
              <Text style={styles.modalButtonText}>OK</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Error Modal */}
      <Modal
        visible={showErrorModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowErrorModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.colors.card }]}>
            <View style={[styles.modalIcon, { backgroundColor: '#F44336' }]}>
              <IconSymbol
                ios_icon_name="exclamationmark.triangle.fill"
                android_material_icon_name="error"
                size={48}
                color="#FFFFFF"
              />
            </View>
            <Text style={[styles.modalTitle, { color: theme.colors.text }]}>Error</Text>
            <Text style={[styles.modalMessage, { color: colors.textSecondary }]}>
              {errorMessage}
            </Text>
            <TouchableOpacity
              style={[styles.modalButton, { backgroundColor: '#F44336' }]}
              onPress={() => setShowErrorModal(false)}
            >
              <Text style={styles.modalButtonText}>OK</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Confirm Modal */}
      <Modal
        visible={showConfirmModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowConfirmModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.colors.card }]}>
            <View style={[styles.modalIcon, { backgroundColor: '#FF9800' }]}>
              <IconSymbol
                ios_icon_name="questionmark.circle.fill"
                android_material_icon_name="help"
                size={48}
                color="#FFFFFF"
              />
            </View>
            <Text style={[styles.modalTitle, { color: theme.colors.text }]}>Confirm Action</Text>
            <Text style={[styles.modalMessage, { color: colors.textSecondary }]}>
              {confirmMessage}
            </Text>
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton, { borderColor: colors.border }]}
                onPress={() => {
                  setShowConfirmModal(false);
                  setConfirmAction(null);
                }}
              >
                <Text style={[styles.cancelButtonText, { color: theme.colors.text }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, { backgroundColor: colors.primary }]}
                onPress={() => {
                  setShowConfirmModal(false);
                  if (confirmAction) {
                    confirmAction();
                  }
                  setConfirmAction(null);
                }}
              >
                <Text style={styles.modalButtonText}>Confirm</Text>
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 48,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    flex: 1,
    textAlign: 'center',
  },
  refreshButton: {
    padding: 8,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.cardBackground,
    marginHorizontal: 16,
    marginTop: 16,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: 16,
    paddingVertical: 20,
    gap: 12,
  },
  statCard: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: colors.cardBackground,
    paddingVertical: 16,
    borderRadius: 12,
  },
  statNumber: {
    fontSize: 32,
    fontWeight: 'bold',
    color: colors.primary,
  },
  statLabel: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 4,
  },
  listContent: {
    padding: 16,
    paddingBottom: 100,
  },
  userCard: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  userHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 12,
  },
  userAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.primary + '20',
    alignItems: 'center',
    justifyContent: 'center',
  },
  userInfo: {
    flex: 1,
  },
  userEmail: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  youBadge: {
    fontSize: 12,
    color: colors.primary,
    fontWeight: 'bold',
  },
  joinedDate: {
    fontSize: 13,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  statusText: {
    fontSize: 13,
    fontWeight: '600',
  },
  endDateText: {
    fontSize: 12,
  },
  adminBadges: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  notificationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 12,
  },
  notificationText: {
    fontSize: 13,
  },
  actionButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  actionBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  secondaryActions: {
    flexDirection: 'row',
    gap: 8,
  },
  secondaryBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
  },
  secondaryBtnText: {
    fontSize: 13,
    fontWeight: '600',
  },
  deleteBtnBorder: {
    borderColor: '#F44336',
  },
  deleteBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#F44336',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    marginTop: 12,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 48,
  },
  emptyText: {
    fontSize: 16,
    marginTop: 12,
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
    alignItems: 'center',
  },
  modalIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  modalMessage: {
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  modalButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  modalButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  cancelButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
});
