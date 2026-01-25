
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert, TextInput, Modal } from 'react-native';
import { useTheme } from '@react-navigation/native';
import { router } from 'expo-router';
import { colors } from '@/styles/commonStyles';
import { IconSymbol } from '@/components/IconSymbol';
import { supabase } from '@/app/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface UserProfile {
  id: string;
  email: string;
  is_admin: boolean;
  is_subscribed: boolean;
  subscription_end_date: string | null;
  created_at: string;
}

interface SubscriptionAction {
  userId: string;
  userEmail: string;
  action: 'free_months' | 'cancel' | 'pause' | 'refund';
}

export default function AdminUsersScreen() {
  const theme = useTheme();
  const { profile } = useAuth();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedAction, setSelectedAction] = useState<SubscriptionAction | null>(null);
  const [freeMonths, setFreeMonths] = useState('1');
  const [pauseDays, setPauseDays] = useState('30');
  const [refundAmount, setRefundAmount] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    if (profile?.is_admin) {
      loadUsers();
    }
  }, [profile]);

  const loadUsers = async () => {
    try {
      console.log('[AdminUsers] Loading users...');
      setLoading(true);
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('[AdminUsers] Error loading users:', error);
        throw error;
      }

      console.log('[AdminUsers] Loaded', data?.length || 0, 'users');
      setUsers(data || []);
    } catch (error: any) {
      console.error('[AdminUsers] Exception loading users:', error);
      Alert.alert('Error', 'Failed to load users: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const filteredUsers = users.filter(user => 
    user.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const openActionModal = (userId: string, userEmail: string, action: SubscriptionAction['action']) => {
    console.log('[AdminUsers] Opening action modal:', action, 'for user:', userEmail);
    setSelectedAction({ userId, userEmail, action });
    setModalVisible(true);
  };

  const closeModal = () => {
    setModalVisible(false);
    setSelectedAction(null);
    setFreeMonths('1');
    setPauseDays('30');
    setRefundAmount('');
  };

  const handleGrantFreeMonths = async () => {
    if (!selectedAction) return;

    const months = parseInt(freeMonths);
    if (isNaN(months) || months < 1 || months > 12) {
      Alert.alert('Invalid Input', 'Please enter a number between 1 and 12');
      return;
    }

    try {
      console.log('[AdminUsers] Granting', months, 'free months to user:', selectedAction.userEmail);
      setActionLoading(true);

      const user = users.find(u => u.id === selectedAction.userId);
      if (!user) {
        throw new Error('User not found');
      }

      let newEndDate: Date;
      
      if (user.subscription_end_date && new Date(user.subscription_end_date) > new Date()) {
        newEndDate = new Date(user.subscription_end_date);
        newEndDate.setMonth(newEndDate.getMonth() + months);
        console.log('[AdminUsers] Extending existing subscription by', months, 'months');
      } else {
        newEndDate = new Date();
        newEndDate.setMonth(newEndDate.getMonth() + months);
        console.log('[AdminUsers] Creating new subscription for', months, 'months');
      }

      const { error } = await supabase
        .from('profiles')
        .update({
          is_subscribed: true,
          subscription_end_date: newEndDate.toISOString()
        })
        .eq('id', selectedAction.userId);

      if (error) {
        console.error('[AdminUsers] Error granting free months:', error);
        throw error;
      }

      console.log('[AdminUsers] Successfully granted free months');
      Alert.alert(
        'Success',
        `Granted ${months} free month${months > 1 ? 's' : ''} to ${selectedAction.userEmail}\n\nNew end date: ${newEndDate.toLocaleDateString()}`
      );
      
      await loadUsers();
      closeModal();
    } catch (error: any) {
      console.error('[AdminUsers] Exception granting free months:', error);
      Alert.alert('Error', 'Failed to grant free months: ' + error.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancelSubscription = async () => {
    if (!selectedAction) return;

    Alert.alert(
      'Confirm Cancellation',
      `Are you sure you want to cancel the subscription for ${selectedAction.userEmail}?\n\nThis will immediately revoke their access.`,
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Yes, Cancel',
          style: 'destructive',
          onPress: async () => {
            try {
              console.log('[AdminUsers] Cancelling subscription for user:', selectedAction.userEmail);
              setActionLoading(true);

              const { error } = await supabase
                .from('profiles')
                .update({
                  is_subscribed: false,
                  subscription_end_date: null
                })
                .eq('id', selectedAction.userId);

              if (error) {
                console.error('[AdminUsers] Error cancelling subscription:', error);
                throw error;
              }

              console.log('[AdminUsers] Successfully cancelled subscription');
              Alert.alert('Success', `Subscription cancelled for ${selectedAction.userEmail}`);
              
              await loadUsers();
              closeModal();
            } catch (error: any) {
              console.error('[AdminUsers] Exception cancelling subscription:', error);
              Alert.alert('Error', 'Failed to cancel subscription: ' + error.message);
            } finally {
              setActionLoading(false);
            }
          }
        }
      ]
    );
  };

  const handlePauseSubscription = async () => {
    if (!selectedAction) return;

    const days = parseInt(pauseDays);
    if (isNaN(days) || days < 1 || days > 365) {
      Alert.alert('Invalid Input', 'Please enter a number between 1 and 365');
      return;
    }

    try {
      console.log('[AdminUsers] Pausing subscription for', days, 'days for user:', selectedAction.userEmail);
      setActionLoading(true);

      const user = users.find(u => u.id === selectedAction.userId);
      if (!user) {
        throw new Error('User not found');
      }

      if (!user.subscription_end_date) {
        Alert.alert('Error', 'User does not have an active subscription to pause');
        return;
      }

      const currentEndDate = new Date(user.subscription_end_date);
      const newEndDate = new Date(currentEndDate);
      newEndDate.setDate(newEndDate.getDate() + days);

      const { error } = await supabase
        .from('profiles')
        .update({
          subscription_end_date: newEndDate.toISOString()
        })
        .eq('id', selectedAction.userId);

      if (error) {
        console.error('[AdminUsers] Error pausing subscription:', error);
        throw error;
      }

      console.log('[AdminUsers] Successfully paused subscription');
      Alert.alert(
        'Success',
        `Subscription paused for ${days} day${days > 1 ? 's' : ''}\n\nOriginal end date: ${currentEndDate.toLocaleDateString()}\nNew end date: ${newEndDate.toLocaleDateString()}`
      );
      
      await loadUsers();
      closeModal();
    } catch (error: any) {
      console.error('[AdminUsers] Exception pausing subscription:', error);
      Alert.alert('Error', 'Failed to pause subscription: ' + error.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleIssueRefund = async () => {
    if (!selectedAction) return;

    const amount = parseFloat(refundAmount);
    if (isNaN(amount) || amount <= 0) {
      Alert.alert('Invalid Input', 'Please enter a valid refund amount');
      return;
    }

    Alert.alert(
      'Confirm Refund',
      `Issue a refund of $${amount.toFixed(2)} to ${selectedAction.userEmail}?\n\nNote: This will mark the refund in the system. You must process the actual refund through your payment provider (RevenueCat/Stripe).`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Issue Refund',
          style: 'destructive',
          onPress: async () => {
            try {
              console.log('[AdminUsers] Issuing refund of $', amount, 'to user:', selectedAction.userEmail);
              setActionLoading(true);

              const { error } = await supabase
                .from('profiles')
                .update({
                  is_subscribed: false,
                  subscription_end_date: null
                })
                .eq('id', selectedAction.userId);

              if (error) {
                console.error('[AdminUsers] Error issuing refund:', error);
                throw error;
              }

              console.log('[AdminUsers] Successfully issued refund');
              Alert.alert(
                'Refund Issued',
                `Refund of $${amount.toFixed(2)} marked for ${selectedAction.userEmail}\n\nSubscription has been cancelled.\n\nIMPORTANT: Process the actual refund through RevenueCat dashboard or your payment provider.`
              );
              
              await loadUsers();
              closeModal();
            } catch (error: any) {
              console.error('[AdminUsers] Exception issuing refund:', error);
              Alert.alert('Error', 'Failed to issue refund: ' + error.message);
            } finally {
              setActionLoading(false);
            }
          }
        }
      ]
    );
  };

  const getSubscriptionStatus = (user: UserProfile): { text: string; color: string } => {
    if (user.is_admin) {
      return { text: 'Admin (Full Access)', color: colors.accent };
    }

    if (!user.is_subscribed) {
      return { text: 'No Subscription', color: colors.textSecondary };
    }

    if (!user.subscription_end_date) {
      return { text: 'Active (No End Date)', color: colors.primary };
    }

    const endDate = new Date(user.subscription_end_date);
    const now = new Date();
    const isActive = endDate > now;

    if (isActive) {
      const daysRemaining = Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      return { 
        text: `Active (${daysRemaining} day${daysRemaining !== 1 ? 's' : ''} left)`, 
        color: colors.primary 
      };
    } else {
      return { text: 'Expired', color: '#FF6B6B' };
    }
  };

  const formatDate = (dateString: string | null): string => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  if (!profile?.is_admin) {
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <View style={styles.centerContent}>
          <IconSymbol
            ios_icon_name="lock.fill"
            android_material_icon_name="lock"
            size={64}
            color={colors.textSecondary}
          />
          <Text style={[styles.errorText, { color: theme.colors.text }]}>
            Admin access required
          </Text>
          <TouchableOpacity
            style={[styles.button, { backgroundColor: colors.primary }]}
            onPress={() => router.back()}
          >
            <Text style={styles.buttonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <IconSymbol
            ios_icon_name="chevron.left"
            android_material_icon_name="arrow-back"
            size={24}
            color={colors.primary}
          />
        </TouchableOpacity>
        <Text style={[styles.title, { color: theme.colors.text }]}>
          User Management
        </Text>
        <TouchableOpacity
          style={styles.refreshButton}
          onPress={loadUsers}
          disabled={loading}
        >
          <IconSymbol
            ios_icon_name="arrow.clockwise"
            android_material_icon_name="refresh"
            size={24}
            color={colors.primary}
          />
        </TouchableOpacity>
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
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      <View style={[styles.statsCard, { backgroundColor: theme.colors.card }]}>
        <View style={styles.statItem}>
          <Text style={[styles.statValue, { color: theme.colors.text }]}>
            {users.length}
          </Text>
          <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
            Total Users
          </Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={[styles.statValue, { color: colors.primary }]}>
            {users.filter(u => u.is_subscribed).length}
          </Text>
          <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
            Subscribed
          </Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={[styles.statValue, { color: colors.accent }]}>
            {users.filter(u => u.is_admin).length}
          </Text>
          <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
            Admins
          </Text>
        </View>
      </View>

      {loading ? (
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
            Loading users...
          </Text>
        </View>
      ) : (
        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
          {filteredUsers.length === 0 ? (
            <View style={styles.emptyContainer}>
              <IconSymbol
                ios_icon_name="person.slash"
                android_material_icon_name="person-off"
                size={48}
                color={colors.textSecondary}
              />
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                {searchQuery ? 'No users found matching your search' : 'No users found'}
              </Text>
            </View>
          ) : (
            <React.Fragment>
              {filteredUsers.map((user, index) => {
                const status = getSubscriptionStatus(user);
                
                return (
                  <React.Fragment key={`user-${user.id || index}`}>
                    <View style={[styles.userCard, { backgroundColor: theme.colors.card }]}>
                      <View style={styles.userHeader}>
                        <View style={styles.userIconContainer}>
                          <IconSymbol
                            ios_icon_name="person.circle.fill"
                            android_material_icon_name="account-circle"
                            size={40}
                            color={user.is_admin ? colors.accent : colors.primary}
                          />
                        </View>
                        <View style={styles.userInfo}>
                          <Text style={[styles.userEmail, { color: theme.colors.text }]}>
                            {user.email}
                          </Text>
                          <Text style={[styles.userDate, { color: colors.textSecondary }]}>
                            Joined {formatDate(user.created_at)}
                          </Text>
                        </View>
                      </View>

                      <View style={[styles.statusBadge, { backgroundColor: status.color + '20' }]}>
                        <Text style={[styles.statusText, { color: status.color }]}>
                          {status.text}
                        </Text>
                      </View>

                      {user.subscription_end_date && (
                        <View style={styles.endDateContainer}>
                          <IconSymbol
                            ios_icon_name="calendar"
                            android_material_icon_name="calendar-today"
                            size={16}
                            color={colors.textSecondary}
                          />
                          <Text style={[styles.endDateText, { color: colors.textSecondary }]}>
                            Ends: {formatDate(user.subscription_end_date)}
                          </Text>
                        </View>
                      )}

                      <View style={styles.actionsContainer}>
                        <TouchableOpacity
                          style={[styles.actionButton, { backgroundColor: colors.primary }]}
                          onPress={() => openActionModal(user.id, user.email, 'free_months')}
                        >
                          <IconSymbol
                            ios_icon_name="gift.fill"
                            android_material_icon_name="card-giftcard"
                            size={18}
                            color="#FFFFFF"
                          />
                          <Text style={styles.actionButtonText}>
                            Free Months
                          </Text>
                        </TouchableOpacity>

                        {user.is_subscribed && (
                          <React.Fragment>
                            <TouchableOpacity
                              style={[styles.actionButton, { backgroundColor: '#FF9800' }]}
                              onPress={() => openActionModal(user.id, user.email, 'pause')}
                            >
                              <IconSymbol
                                ios_icon_name="pause.circle.fill"
                                android_material_icon_name="pause-circle"
                                size={18}
                                color="#FFFFFF"
                              />
                              <Text style={styles.actionButtonText}>
                                Pause
                              </Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                              style={[styles.actionButton, { backgroundColor: '#FF6B6B' }]}
                              onPress={() => openActionModal(user.id, user.email, 'cancel')}
                            >
                              <IconSymbol
                                ios_icon_name="xmark.circle.fill"
                                android_material_icon_name="cancel"
                                size={18}
                                color="#FFFFFF"
                              />
                              <Text style={styles.actionButtonText}>
                                Cancel
                              </Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                              style={[styles.actionButton, { backgroundColor: '#9C27B0' }]}
                              onPress={() => openActionModal(user.id, user.email, 'refund')}
                            >
                              <IconSymbol
                                ios_icon_name="dollarsign.circle.fill"
                                android_material_icon_name="payment"
                                size={18}
                                color="#FFFFFF"
                              />
                              <Text style={styles.actionButtonText}>
                                Refund
                              </Text>
                            </TouchableOpacity>
                          </React.Fragment>
                        )}
                      </View>
                    </View>
                  </React.Fragment>
                );
              })}
            </React.Fragment>
          )}
        </ScrollView>
      )}

      <Modal
        visible={modalVisible}
        transparent
        animationType="slide"
        onRequestClose={closeModal}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.colors.card }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: theme.colors.text }]}>
                {selectedAction?.action === 'free_months' && 'Grant Free Months'}
                {selectedAction?.action === 'cancel' && 'Cancel Subscription'}
                {selectedAction?.action === 'pause' && 'Pause Subscription'}
                {selectedAction?.action === 'refund' && 'Issue Refund'}
              </Text>
              <TouchableOpacity onPress={closeModal}>
                <IconSymbol
                  ios_icon_name="xmark.circle.fill"
                  android_material_icon_name="cancel"
                  size={28}
                  color={colors.textSecondary}
                />
              </TouchableOpacity>
            </View>

            <Text style={[styles.modalSubtitle, { color: colors.textSecondary }]}>
              {selectedAction?.userEmail}
            </Text>

            {selectedAction?.action === 'free_months' && (
              <View style={styles.modalBody}>
                <Text style={[styles.inputLabel, { color: theme.colors.text }]}>
                  Number of Free Months
                </Text>
                <TextInput
                  style={[styles.modalInput, { 
                    backgroundColor: theme.colors.background,
                    color: theme.colors.text,
                    borderColor: colors.textSecondary
                  }]}
                  placeholder="1"
                  placeholderTextColor={colors.textSecondary}
                  value={freeMonths}
                  onChangeText={setFreeMonths}
                  keyboardType="number-pad"
                />
                <Text style={[styles.helperText, { color: colors.textSecondary }]}>
                  Enter a number between 1 and 12. This will extend their subscription by the specified number of months.
                </Text>
              </View>
            )}

            {selectedAction?.action === 'pause' && (
              <View style={styles.modalBody}>
                <Text style={[styles.inputLabel, { color: theme.colors.text }]}>
                  Pause Duration (Days)
                </Text>
                <TextInput
                  style={[styles.modalInput, { 
                    backgroundColor: theme.colors.background,
                    color: theme.colors.text,
                    borderColor: colors.textSecondary
                  }]}
                  placeholder="30"
                  placeholderTextColor={colors.textSecondary}
                  value={pauseDays}
                  onChangeText={setPauseDays}
                  keyboardType="number-pad"
                />
                <Text style={[styles.helperText, { color: colors.textSecondary }]}>
                  Enter the number of days to extend their subscription. This effectively pauses billing for the specified period.
                </Text>
              </View>
            )}

            {selectedAction?.action === 'cancel' && (
              <View style={styles.modalBody}>
                <Text style={[styles.warningText, { color: '#FF6B6B' }]}>
                  This will immediately cancel the user&apos;s subscription and revoke their access. This action cannot be undone.
                </Text>
              </View>
            )}

            {selectedAction?.action === 'refund' && (
              <View style={styles.modalBody}>
                <Text style={[styles.inputLabel, { color: theme.colors.text }]}>
                  Refund Amount ($)
                </Text>
                <TextInput
                  style={[styles.modalInput, { 
                    backgroundColor: theme.colors.background,
                    color: theme.colors.text,
                    borderColor: colors.textSecondary
                  }]}
                  placeholder="5.00"
                  placeholderTextColor={colors.textSecondary}
                  value={refundAmount}
                  onChangeText={setRefundAmount}
                  keyboardType="decimal-pad"
                />
                <Text style={[styles.helperText, { color: colors.textSecondary }]}>
                  Enter the refund amount. This will cancel their subscription. You must process the actual refund through RevenueCat or your payment provider.
                </Text>
              </View>
            )}

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton, { borderColor: colors.textSecondary }]}
                onPress={closeModal}
                disabled={actionLoading}
              >
                <Text style={[styles.cancelButtonText, { color: colors.textSecondary }]}>
                  Cancel
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalButton, styles.confirmButton, { 
                  backgroundColor: selectedAction?.action === 'cancel' || selectedAction?.action === 'refund' 
                    ? '#FF6B6B' 
                    : colors.primary 
                }]}
                onPress={() => {
                  if (selectedAction?.action === 'free_months') handleGrantFreeMonths();
                  else if (selectedAction?.action === 'cancel') handleCancelSubscription();
                  else if (selectedAction?.action === 'pause') handlePauseSubscription();
                  else if (selectedAction?.action === 'refund') handleIssueRefund();
                }}
                disabled={actionLoading}
              >
                {actionLoading ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Text style={styles.confirmButtonText}>
                    {selectedAction?.action === 'free_months' && 'Grant'}
                    {selectedAction?.action === 'cancel' && 'Cancel Subscription'}
                    {selectedAction?.action === 'pause' && 'Pause'}
                    {selectedAction?.action === 'refund' && 'Issue Refund'}
                  </Text>
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
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
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
    padding: 8,
  },
  refreshButton: {
    padding: 8,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    flex: 1,
    textAlign: 'center',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
    marginHorizontal: 16,
    marginBottom: 16,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
  },
  statsCard: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 16,
    borderRadius: 12,
    boxShadow: '0px 2px 8px rgba(0, 0, 0, 0.1)',
    elevation: 3,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    textAlign: 'center',
  },
  statDivider: {
    width: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.1)',
    marginHorizontal: 8,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 100,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 16,
    marginTop: 16,
    textAlign: 'center',
  },
  userCard: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    boxShadow: '0px 2px 8px rgba(0, 0, 0, 0.1)',
    elevation: 3,
  },
  userHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 12,
  },
  userIconContainer: {
    width: 40,
    height: 40,
  },
  userInfo: {
    flex: 1,
  },
  userEmail: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  userDate: {
    fontSize: 12,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    alignSelf: 'flex-start',
    marginBottom: 12,
  },
  statusText: {
    fontSize: 13,
    fontWeight: '600',
  },
  endDateContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 12,
  },
  endDateText: {
    fontSize: 13,
  },
  actionsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
  },
  actionButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
  errorText: {
    fontSize: 18,
    marginTop: 16,
    marginBottom: 24,
  },
  button: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  loadingText: {
    fontSize: 16,
    marginTop: 16,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  modalSubtitle: {
    fontSize: 14,
    marginBottom: 24,
  },
  modalBody: {
    marginBottom: 24,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  modalInput: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 8,
  },
  helperText: {
    fontSize: 13,
    lineHeight: 18,
  },
  warningText: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '500',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButton: {
    borderWidth: 2,
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  confirmButton: {
    minHeight: 48,
  },
  confirmButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
