
import { colors } from '@/styles/commonStyles';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, TextInput, TouchableOpacity, Modal, Alert, ScrollView } from 'react-native';
import { router } from 'expo-router';
import { IconSymbol } from '@/components/IconSymbol';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { useTheme } from '@react-navigation/native';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/app/integrations/supabase/client';

interface UserProfile {
  id: string;
  email: string;
  full_name?: string | null;
  is_admin: boolean;
  is_regional_admin: boolean;
  is_subscribed: boolean;
  subscription_end_date: string | null;
  subscription_source?: string | null;
  created_at: string;
  managed_locations?: string[];
  subscription_paused?: boolean;
  subscription_paused_days?: number;
  subscription_paused_at?: string;
  subscription_refunded?: boolean;
  subscription_refunded_at?: string;
}

interface UserStats {
  total: number;
  subscribed: number;
  admins: number;
}

type TabKey = 'all' | 'active' | 'paid' | 'expired' | 'never';

function getDisplayName(user: UserProfile): string {
  const trimmed = user.full_name?.trim();
  if (trimmed) return trimmed;
  return user.email;
}

function isUserActive(user: UserProfile): boolean {
  if (!user.is_subscribed) return false;
  if (!user.subscription_end_date) return true;
  return new Date(user.subscription_end_date) > new Date();
}

function isUserExpired(user: UserProfile): boolean {
  // Has subscribed at some point but is currently not active
  if (user.is_subscribed && isUserActive(user)) return false;
  // Had a subscription end date (previously subscribed) or was refunded
  return user.subscription_end_date !== null || (user.subscription_refunded === true);
}

function isUserNeverSubscribed(user: UserProfile): boolean {
  return !user.is_subscribed && user.subscription_end_date === null && !user.subscription_refunded;
}

function sortByName(a: UserProfile, b: UserProfile): number {
  const nameA = getDisplayName(a) || a.email;
  const nameB = getDisplayName(b) || b.email;
  return nameA.localeCompare(nameB);
}

export default function ManageAllUsersScreen() {
  const theme = useTheme();
  const { user } = useAuth();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<TabKey>('all');
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
  const [freeMonthsModalVisible, setFreeMonthsModalVisible] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [selectedUserEmail, setSelectedUserEmail] = useState<string>('');
  const [freeMonthsInput, setFreeMonthsInput] = useState('');
  const [durationUnit, setDurationUnit] = useState<'weeks' | 'months'>('months');

  const fetchUsers = useCallback(async () => {
    try {
      console.log('[ManageAllUsersScreen] Fetching all users...');
      setIsLoading(true);

      const { data, error } = await supabase
        .from('profiles')
        .select('id, email, full_name, is_admin, is_regional_admin, is_subscribed, subscription_end_date, subscription_source, created_at, managed_locations, subscription_paused, subscription_paused_days, subscription_paused_at, subscription_refunded, subscription_refunded_at')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('[ManageAllUsersScreen] Error fetching users:', error);
        showError('Error', `Failed to load users: ${error.message}`);
        return;
      }

      console.log('[ManageAllUsersScreen] Loaded', data?.length || 0, 'users');
      setUsers(data || []);

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

  // Search filter applied to all users
  const searchFiltered = useMemo(() => {
    if (searchTerm.trim() === '') return users;
    const term = searchTerm.toLowerCase();
    return users.filter(u => {
      const name = getDisplayName(u).toLowerCase();
      const email = u.email.toLowerCase();
      return name.includes(term) || email.includes(term);
    });
  }, [users, searchTerm]);

  // Tab buckets (computed from search-filtered list)
  const allUsers = useMemo(
    () => [...searchFiltered].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()),
    [searchFiltered]
  );
  const activeUsers = useMemo(
    () => [...searchFiltered].filter(isUserActive).sort(sortByName),
    [searchFiltered]
  );
  const paidUsers = useMemo(
    () => [...searchFiltered].filter(u => u.subscription_source === 'revenuecat' && u.is_subscribed).sort(sortByName),
    [searchFiltered]
  );
  const expiredUsers = useMemo(
    () => [...searchFiltered].filter(isUserExpired).sort(sortByName),
    [searchFiltered]
  );
  const neverSubscribedUsers = useMemo(
    () => [...searchFiltered].filter(isUserNeverSubscribed).sort(sortByName),
    [searchFiltered]
  );

  const tabData: Record<TabKey, UserProfile[]> = {
    all: allUsers,
    active: activeUsers,
    paid: paidUsers,
    expired: expiredUsers,
    never: neverSubscribedUsers,
  };

  const currentList = tabData[activeTab];

  const tabs: { key: TabKey; label: string; count: number }[] = [
    { key: 'all', label: 'All', count: allUsers.length },
    { key: 'active', label: 'Active', count: activeUsers.length },
    { key: 'paid', label: 'Paid', count: paidUsers.length },
    { key: 'expired', label: 'Expired', count: expiredUsers.length },
    { key: 'never', label: 'Never Subscribed', count: neverSubscribedUsers.length },
  ];

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
    console.log('[ManageAllUsersScreen] Opening free time modal for:', userEmail);
    setSelectedUserId(userId);
    setSelectedUserEmail(userEmail);
    setFreeMonthsInput('');
    setDurationUnit('months');
    setFreeMonthsModalVisible(true);
  };

  const confirmGrantFreeMonths = async () => {
    const amount = parseInt(freeMonthsInput);
    const isWeeks = durationUnit === 'weeks';

    if (isNaN(amount) || amount <= 0) {
      showError('Invalid Input', `Please enter a valid number of ${durationUnit} (1 or greater)`);
      return;
    }

    const maxAmount = isWeeks ? 520 : 120;
    if (amount > maxAmount) {
      showError('Invalid Input', `Maximum ${maxAmount} ${durationUnit} allowed`);
      return;
    }

    try {
      console.log('[ManageAllUsersScreen] Granting', amount, durationUnit, 'to:', selectedUserEmail);
      setFreeMonthsModalVisible(false);

      const targetUser = users.find(u => u.id === selectedUserId);
      let currentEndDate = new Date();

      if (targetUser?.subscription_end_date) {
        const existingEndDate = new Date(targetUser.subscription_end_date);
        if (existingEndDate > currentEndDate) {
          currentEndDate = existingEndDate;
        }
      }

      const newEndDate = new Date(currentEndDate);
      if (isWeeks) {
        newEndDate.setDate(newEndDate.getDate() + amount * 7);
      } else {
        newEndDate.setMonth(newEndDate.getMonth() + amount);
      }

      const { error } = await supabase
        .from('profiles')
        .update({
          is_subscribed: true,
          subscription_end_date: newEndDate.toISOString(),
        })
        .eq('id', selectedUserId);

      if (error) {
        console.error('[ManageAllUsersScreen] Error granting free time:', error);
        showError('Error', `Failed to grant free ${durationUnit}: ${error.message}`);
        return;
      }

      const unitLabel = amount === 1 ? durationUnit.slice(0, -1) : durationUnit;
      showSuccess(
        `Free ${durationUnit.charAt(0).toUpperCase() + durationUnit.slice(1)} Granted`,
        `Successfully granted ${amount} free ${unitLabel} to ${selectedUserEmail}.\n\nNew subscription end date: ${newEndDate.toLocaleDateString()}`
      );
      await fetchUsers();
    } catch (error) {
      console.error('[ManageAllUsersScreen] Exception granting free time:', error);
      showError('Error', `Failed to grant free ${durationUnit}`);
    }
  };

  const handlePauseSubscription = async (userId: string, userEmail: string) => {
    const action = async () => {
      try {
        console.log('[ManageAllUsersScreen] Pausing subscription for:', userEmail);

        const targetUser = users.find(u => u.id === userId);
        if (!targetUser?.subscription_end_date) {
          showError('Error', 'User does not have an active subscription');
          return;
        }

        const endDate = new Date(targetUser.subscription_end_date);
        const now = new Date();
        const daysRemaining = Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

        if (daysRemaining <= 0) {
          showError('Error', 'Subscription has already expired');
          return;
        }

        const { error } = await supabase
          .from('profiles')
          .update({
            subscription_paused: true,
            subscription_paused_days: daysRemaining,
            subscription_paused_at: now.toISOString(),
          })
          .eq('id', userId);

        if (error) {
          console.error('[ManageAllUsersScreen] Error pausing subscription:', error);
          showError('Error', `Failed to pause subscription: ${error.message}`);
          return;
        }

        showSuccess(
          'Subscription Paused',
          `Subscription paused for ${userEmail}.\n\n${daysRemaining} days will be preserved and can be resumed later.`
        );
        await fetchUsers();
      } catch (error) {
        console.error('[ManageAllUsersScreen] Exception pausing subscription:', error);
        showError('Error', 'Failed to pause subscription');
      }
    };

    showConfirm(
      `Are you sure you want to pause the subscription for ${userEmail}?\n\nThe remaining subscription time will be preserved and can be resumed later.`,
      action
    );
  };

  const handleResumeSubscription = async (userId: string, userEmail: string) => {
    const action = async () => {
      try {
        console.log('[ManageAllUsersScreen] Resuming subscription for:', userEmail);

        const targetUser = users.find(u => u.id === userId);
        if (!targetUser?.subscription_paused || !targetUser.subscription_paused_days) {
          showError('Error', 'User does not have a paused subscription');
          return;
        }

        const now = new Date();
        const newEndDate = new Date(now);
        newEndDate.setDate(newEndDate.getDate() + targetUser.subscription_paused_days);

        const { error } = await supabase
          .from('profiles')
          .update({
            is_subscribed: true,
            subscription_end_date: newEndDate.toISOString(),
            subscription_paused: false,
            subscription_paused_days: null,
            subscription_paused_at: null,
          })
          .eq('id', userId);

        if (error) {
          console.error('[ManageAllUsersScreen] Error resuming subscription:', error);
          showError('Error', `Failed to resume subscription: ${error.message}`);
          return;
        }

        showSuccess(
          'Subscription Resumed',
          `Subscription resumed for ${userEmail}.\n\n${targetUser.subscription_paused_days} days have been restored.\nNew end date: ${newEndDate.toLocaleDateString()}`
        );
        await fetchUsers();
      } catch (error) {
        console.error('[ManageAllUsersScreen] Exception resuming subscription:', error);
        showError('Error', 'Failed to resume subscription');
      }
    };

    showConfirm(
      `Resume subscription for ${userEmail}?\n\nTheir preserved subscription time will be restored starting from today.`,
      action
    );
  };

  const handleCancelSubscription = async (userId: string, userEmail: string) => {
    const action = async () => {
      try {
        console.log('[ManageAllUsersScreen] Cancelling subscription for:', userEmail);

        const { error } = await supabase
          .from('profiles')
          .update({
            is_subscribed: false,
            subscription_end_date: null,
            subscription_paused: false,
            subscription_paused_days: null,
            subscription_paused_at: null,
          })
          .eq('id', userId);

        if (error) {
          console.error('[ManageAllUsersScreen] Error cancelling subscription:', error);
          showError('Error', `Failed to cancel subscription: ${error.message}`);
          return;
        }

        showSuccess(
          'Subscription Cancelled',
          `Subscription cancelled for ${userEmail}.\n\nThe user will no longer have access to premium features.`
        );
        await fetchUsers();
      } catch (error) {
        console.error('[ManageAllUsersScreen] Exception cancelling subscription:', error);
        showError('Error', 'Failed to cancel subscription');
      }
    };

    showConfirm(
      `Are you sure you want to cancel the subscription for ${userEmail}?\n\nThis will immediately revoke their premium access.`,
      action
    );
  };

  const handleIssueRefund = async (userId: string, userEmail: string) => {
    const action = async () => {
      try {
        console.log('[ManageAllUsersScreen] Issuing refund for:', userEmail);

        const { error } = await supabase
          .from('profiles')
          .update({
            is_subscribed: false,
            subscription_end_date: null,
            subscription_paused: false,
            subscription_paused_days: null,
            subscription_paused_at: null,
            subscription_refunded: true,
            subscription_refunded_at: new Date().toISOString(),
          })
          .eq('id', userId);

        if (error) {
          console.error('[ManageAllUsersScreen] Error issuing refund:', error);
          showError('Error', `Failed to issue refund: ${error.message}`);
          return;
        }

        showSuccess(
          'Refund Issued',
          `Refund processed for ${userEmail}.\n\nTheir subscription has been cancelled and marked as refunded.\n\nNote: You must manually process the actual refund through your payment provider (RevenueCat/Stripe/Apple/Google).`
        );
        await fetchUsers();
      } catch (error) {
        console.error('[ManageAllUsersScreen] Exception issuing refund:', error);
        showError('Error', 'Failed to issue refund');
      }
    };

    showConfirm(
      `Are you sure you want to issue a refund for ${userEmail}?\n\nThis will cancel their subscription and mark it as refunded.\n\nIMPORTANT: You must manually process the actual refund through your payment provider.`,
      action
    );
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

  const handleDeleteUser = (userId: string, userEmail: string, isAdmin: boolean, displayName: string) => {
    console.log('[ManageAllUsersScreen] Delete tapped for:', userEmail);

    if (isAdmin) {
      Alert.alert('Cannot Delete Admin', 'Cannot delete admin accounts. Remove admin privileges first.');
      return;
    }

    const label = displayName || userEmail;
    Alert.alert(
      'Delete Account',
      `Delete ${label}'s account? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              console.log('[ManageAllUsersScreen] Confirming delete for:', userEmail, 'id:', userId);

              setUsers(prev => prev.filter(u => u.id !== userId));

              try {
                const { error: authError } = await supabase.auth.admin.deleteUser(userId);
                if (authError) {
                  console.warn('[ManageAllUsersScreen] Auth delete failed (may lack service role), falling back to profile delete:', authError.message);
                }
              } catch {
                console.warn('[ManageAllUsersScreen] Auth admin delete not available, deleting profile only');
              }

              const { error: profileError } = await supabase
                .from('profiles')
                .delete()
                .eq('id', userId);

              if (profileError) {
                console.error('[ManageAllUsersScreen] Error deleting profile:', profileError);
                await fetchUsers();
                Alert.alert('Error', `Failed to delete account: ${profileError.message}`);
                return;
              }

              console.log('[ManageAllUsersScreen] Successfully deleted user:', userEmail);
              showSuccess('Account Deleted', `${label}'s account has been deleted.`);
            } catch (error) {
              console.error('[ManageAllUsersScreen] Exception deleting user:', error);
              await fetchUsers();
              Alert.alert('Error', 'Failed to delete account');
            }
          },
        },
      ]
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

  const getSubscriptionStatus = (u: UserProfile): string => {
    if (u.subscription_paused) {
      const pausedDays = u.subscription_paused_days || 0;
      return `Paused (${pausedDays} days saved)`;
    }
    if (u.subscription_refunded) {
      return 'Refunded';
    }
    if (!u.is_subscribed) return 'Not Subscribed';
    if (!u.subscription_end_date) return 'Active';
    const daysLeft = getDaysLeft(u.subscription_end_date);
    if (daysLeft === 0) return 'Expired';
    return `Active (${daysLeft} days left)`;
  };

  const renderUserCard = ({ item }: { item: UserProfile }) => {
    const subscriptionStatus = getSubscriptionStatus(item);
    const active = item.is_subscribed && (!item.subscription_end_date || getDaysLeft(item.subscription_end_date) > 0) && !item.subscription_paused;
    const isPaused = item.subscription_paused;
    const isRefunded = item.subscription_refunded;

    let statusColor = '#9E9E9E';
    if (isRefunded) {
      statusColor = '#9C27B0';
    } else if (isPaused) {
      statusColor = '#FF9800';
    } else if (active) {
      statusColor = '#4CAF50';
    }

    const primaryLabel = getDisplayName(item);
    const hasDistinctName = !!(item.full_name?.trim()) && item.full_name.trim() !== item.email;
    const showEmail = hasDistinctName;

    return (
      <View style={[styles.userCard, { backgroundColor: theme.colors.card }]}>
        <View style={styles.userHeader}>
          <View style={styles.userInfo}>
            <Text style={[styles.userName, { color: theme.colors.text }]}>
              {primaryLabel}
            </Text>
            {showEmail && (
              <Text style={[styles.userEmail, { color: colors.textSecondary }]}>
                {item.email}
              </Text>
            )}
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
          <View style={styles.headerRight}>
            <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
            <TouchableOpacity
              style={styles.deleteButton}
              onPress={() => handleDeleteUser(item.id, item.email, item.is_admin, primaryLabel)}
            >
              <IconSymbol
                ios_icon_name="trash"
                android_material_icon_name="delete"
                size={16}
                color="#FF3B30"
              />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.userDetails}>
          <Text style={[styles.userDetailText, { color: colors.textSecondary }]}>
            Status: {subscriptionStatus}
          </Text>
          {item.subscription_end_date && !item.subscription_paused && (
            <Text style={[styles.userDetailText, { color: colors.textSecondary }]}>
              Ends: {formatDate(item.subscription_end_date)}
            </Text>
          )}
          {item.subscription_paused_at && (
            <Text style={[styles.userDetailText, { color: colors.textSecondary }]}>
              Paused: {formatDate(item.subscription_paused_at)}
            </Text>
          )}
          {item.subscription_refunded_at && (
            <Text style={[styles.userDetailText, { color: colors.textSecondary }]}>
              Refunded: {formatDate(item.subscription_refunded_at)}
            </Text>
          )}
          <Text style={[styles.userDetailText, { color: colors.textSecondary }]}>
            Joined: {formatDate(item.created_at)}
          </Text>
        </View>

        <View style={styles.userActions}>
          {item.subscription_paused ? (
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => handleResumeSubscription(item.id, item.email)}
            >
              <IconSymbol
                ios_icon_name="play.circle"
                android_material_icon_name="play-circle"
                size={16}
                color="#4CAF50"
              />
              <Text style={[styles.actionButtonText, { color: '#4CAF50' }]}>
                Resume
              </Text>
            </TouchableOpacity>
          ) : item.is_subscribed && !item.subscription_refunded ? (
            <>
              <TouchableOpacity
                style={styles.actionButton}
                onPress={() => handlePauseSubscription(item.id, item.email)}
              >
                <IconSymbol
                  ios_icon_name="pause.circle"
                  android_material_icon_name="pause-circle"
                  size={16}
                  color="#FF9800"
                />
                <Text style={[styles.actionButtonText, { color: '#FF9800' }]}>
                  Pause
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.actionButton}
                onPress={() => handleCancelSubscription(item.id, item.email)}
              >
                <IconSymbol
                  ios_icon_name="xmark.circle"
                  android_material_icon_name="cancel"
                  size={16}
                  color="#FF3B30"
                />
                <Text style={[styles.actionButtonText, { color: '#FF3B30' }]}>
                  Cancel
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.actionButton}
                onPress={() => handleIssueRefund(item.id, item.email)}
              >
                <IconSymbol
                  ios_icon_name="dollarsign.circle"
                  android_material_icon_name="payment"
                  size={16}
                  color="#9C27B0"
                />
                <Text style={[styles.actionButtonText, { color: '#9C27B0' }]}>
                  Refund
                </Text>
              </TouchableOpacity>
            </>
          ) : null}

          {!item.subscription_refunded && (
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => handleGrantFreeMonths(item.id, item.email)}
            >
              <IconSymbol
                ios_icon_name="gift"
                android_material_icon_name="card-giftcard"
                size={16}
                color="#4CAF50"
              />
              <Text style={[styles.actionButtonText, { color: '#4CAF50' }]}>
                Free Months
              </Text>
            </TouchableOpacity>
          )}

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
        </View>
      </View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => {
          console.log('[ManageAllUsersScreen] Back button pressed');
          router.back();
        }}>
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
          placeholder="Search by name or email..."
          placeholderTextColor={colors.textSecondary}
          value={searchTerm}
          onChangeText={setSearchTerm}
        />
        {searchTerm.length > 0 && (
          <TouchableOpacity onPress={() => setSearchTerm('')}>
            <IconSymbol
              ios_icon_name="xmark.circle.fill"
              android_material_icon_name="close"
              size={18}
              color={colors.textSecondary}
            />
          </TouchableOpacity>
        )}
      </View>

      {/* Tab Bar — fixed, never scrolls */}
      <View style={[styles.tabBarWrapper, { backgroundColor: theme.colors.background }]}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.tabBarScroll}
          contentContainerStyle={styles.tabBarContent}
        >
          {tabs.map(tab => {
            const isActive = activeTab === tab.key;
            const tabLabel = `${tab.label} (${tab.count})`;
            return (
              <TouchableOpacity
                key={tab.key}
                style={[
                  styles.tabPill,
                  isActive ? styles.tabPillActive : styles.tabPillInactive,
                ]}
                onPress={() => {
                  console.log('[ManageAllUsersScreen] Tab selected:', tab.key);
                  setActiveTab(tab.key);
                }}
              >
                <Text style={[
                  styles.tabPillText,
                  isActive ? styles.tabPillTextActive : styles.tabPillTextInactive,
                ]}>
                  {tabLabel}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={currentList}
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

      {/* Free Time Modal */}
      <Modal
        visible={freeMonthsModalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setFreeMonthsModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.freeMonthsModalContent, { backgroundColor: theme.colors.card }]}>
            <View style={styles.freeMonthsHeader}>
              <Text style={[styles.modalTitle, { color: theme.colors.text }]}>
                Grant Free Time
              </Text>
              <TouchableOpacity onPress={() => setFreeMonthsModalVisible(false)}>
                <IconSymbol
                  ios_icon_name="xmark.circle.fill"
                  android_material_icon_name="close"
                  size={28}
                  color={colors.textSecondary}
                />
              </TouchableOpacity>
            </View>

            <Text style={[styles.freeMonthsUserEmail, { color: colors.textSecondary }]}>
              {selectedUserEmail}
            </Text>

            <View style={styles.segmentedControl}>
              <TouchableOpacity
                style={[
                  styles.segmentButton,
                  durationUnit === 'weeks' && styles.segmentButtonActive,
                ]}
                onPress={() => {
                  console.log('[ManageAllUsersScreen] Duration unit switched to: weeks');
                  setDurationUnit('weeks');
                  setFreeMonthsInput('');
                }}
              >
                <Text style={[
                  styles.segmentButtonText,
                  durationUnit === 'weeks' && styles.segmentButtonTextActive,
                ]}>
                  Weeks
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.segmentButton,
                  durationUnit === 'months' && styles.segmentButtonActive,
                ]}
                onPress={() => {
                  console.log('[ManageAllUsersScreen] Duration unit switched to: months');
                  setDurationUnit('months');
                  setFreeMonthsInput('');
                }}
              >
                <Text style={[
                  styles.segmentButtonText,
                  durationUnit === 'months' && styles.segmentButtonTextActive,
                ]}>
                  Months
                </Text>
              </TouchableOpacity>
            </View>

            <Text style={[styles.freeMonthsLabel, { color: theme.colors.text }]}>
              {durationUnit === 'weeks' ? 'Number of Weeks' : 'Number of Months'}
            </Text>
            <TextInput
              style={[styles.freeMonthsInput, {
                color: theme.colors.text,
                backgroundColor: colors.background,
                borderColor: colors.border,
              }]}
              placeholder={durationUnit === 'weeks' ? 'Enter number (1-520)' : 'Enter number (1-120)'}
              placeholderTextColor={colors.textSecondary}
              value={freeMonthsInput}
              onChangeText={setFreeMonthsInput}
              keyboardType="number-pad"
              autoFocus
            />

            <Text style={[styles.freeMonthsHelperText, { color: colors.textSecondary }]}>
              {durationUnit === 'weeks'
                ? 'This will extend their subscription by the specified number of weeks (7 days each). If they already have an active subscription, the time will be added to their current end date.'
                : 'This will extend their subscription by the specified number of months. If they already have an active subscription, the time will be added to their current end date.'}
            </Text>

            <View style={styles.freeMonthsActions}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => setFreeMonthsModalVisible(false)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.confirmButton]}
                onPress={confirmGrantFreeMonths}
              >
                <Text style={styles.confirmButtonText}>Grant</Text>
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
    paddingTop: 60,
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
    marginBottom: 12,
    paddingHorizontal: 12,
    borderRadius: 12,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 16,
  },
  tabBarWrapper: {
    flexShrink: 0,
    paddingBottom: 12,
  },
  tabBarScroll: {
    flexGrow: 0,
  },
  tabBarContent: {
    paddingHorizontal: 16,
    gap: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  tabPill: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  tabPillActive: {
    backgroundColor: '#FFFFFF',
  },
  tabPillInactive: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  tabPillText: {
    fontSize: 13,
    fontWeight: '600',
  },
  tabPillTextActive: {
    color: '#000000',
  },
  tabPillTextInactive: {
    color: '#888888',
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
    marginRight: 8,
  },
  userName: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  userEmail: {
    fontSize: 13,
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
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  statusDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginTop: 4,
  },
  deleteButton: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 8,
    backgroundColor: 'rgba(255,59,48,0.1)',
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
  freeMonthsModalContent: {
    borderRadius: 16,
    padding: 24,
    width: '90%',
    maxWidth: 400,
  },
  freeMonthsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  freeMonthsUserEmail: {
    fontSize: 14,
    marginBottom: 20,
    textAlign: 'center',
  },
  freeMonthsLabel: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 8,
  },
  freeMonthsInput: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 14,
    fontSize: 16,
    marginBottom: 12,
  },
  freeMonthsHelperText: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 20,
  },
  freeMonthsActions: {
    flexDirection: 'row',
    gap: 12,
  },
  segmentedControl: {
    flexDirection: 'row',
    backgroundColor: colors.highlight,
    borderRadius: 10,
    padding: 3,
    marginBottom: 16,
  },
  segmentButton: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
  },
  segmentButtonActive: {
    backgroundColor: colors.primary,
  },
  segmentButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  segmentButtonTextActive: {
    color: '#FFFFFF',
  },
});
