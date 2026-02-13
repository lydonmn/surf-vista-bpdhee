
import { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Modal, TextInput, KeyboardAvoidingView, Platform } from 'react-native';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@react-navigation/native';
import { supabase } from '@/integrations/supabase/client';
import { router } from 'expo-router';
import { colors } from '@/styles/commonStyles';
import { IconSymbol } from '@/components/IconSymbol';

interface UserProfile {
  id: string;
  email: string;
  is_admin: boolean;
  is_subscribed: boolean;
  subscription_end_date: string | null;
  created_at: string;
  daily_report_notifications: boolean;
  push_token: string | null;
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
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedAction, setSelectedAction] = useState<SubscriptionAction | null>(null);
  const [monthsInput, setMonthsInput] = useState('1');
  const [processing, setProcessing] = useState(false);

  const loadUsers = useCallback(async () => {
    try {
      setLoading(true);
      console.log('[AdminUsers] Loading all users');
      
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('[AdminUsers] Error loading users:', error);
        return;
      }

      console.log('[AdminUsers] Loaded', data.length, 'users');
      setUsers(data);
    } catch (error) {
      console.error('[AdminUsers] Exception loading users:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (profile?.is_admin) {
      loadUsers();
    }
  }, [profile?.is_admin, loadUsers]);

  const openActionModal = (userId: string, userEmail: string, action: SubscriptionAction['action']) => {
    setSelectedAction({ userId, userEmail, action });
    setModalVisible(true);
  };

  const closeModal = () => {
    setModalVisible(false);
    setSelectedAction(null);
    setMonthsInput('1');
  };

  const handleGrantFreeMonths = async () => {
    if (!selectedAction) return;

    const months = parseInt(monthsInput);
    if (isNaN(months) || months < 1 || months > 12) {
      return;
    }

    try {
      setProcessing(true);
      console.log('[AdminUsers] Granting', months, 'free months to user:', selectedAction.userEmail);

      const newEndDate = new Date();
      newEndDate.setMonth(newEndDate.getMonth() + months);

      const { error } = await supabase
        .from('profiles')
        .update({
          is_subscribed: true,
          subscription_end_date: newEndDate.toISOString(),
        })
        .eq('id', selectedAction.userId);

      if (error) {
        console.error('[AdminUsers] Error granting free months:', error);
        return;
      }

      console.log('[AdminUsers] ✅ Free months granted successfully');
      closeModal();
      await loadUsers();
    } catch (error) {
      console.error('[AdminUsers] Exception granting free months:', error);
    } finally {
      setProcessing(false);
    }
  };

  const handleCancelSubscription = async () => {
    if (!selectedAction) return;

    try {
      setProcessing(true);
      console.log('[AdminUsers] Canceling subscription for user:', selectedAction.userEmail);

      const { error } = await supabase
        .from('profiles')
        .update({
          is_subscribed: false,
          subscription_end_date: null,
        })
        .eq('id', selectedAction.userId);

      if (error) {
        console.error('[AdminUsers] Error canceling subscription:', error);
        return;
      }

      console.log('[AdminUsers] ✅ Subscription canceled successfully');
      closeModal();
      await loadUsers();
    } catch (error) {
      console.error('[AdminUsers] Exception canceling subscription:', error);
    } finally {
      setProcessing(false);
    }
  };

  const handlePauseSubscription = async () => {
    if (!selectedAction) return;

    try {
      setProcessing(true);
      console.log('[AdminUsers] Pausing subscription for user:', selectedAction.userEmail);

      const { error } = await supabase
        .from('profiles')
        .update({
          is_subscribed: false,
        })
        .eq('id', selectedAction.userId);

      if (error) {
        console.error('[AdminUsers] Error pausing subscription:', error);
        return;
      }

      console.log('[AdminUsers] ✅ Subscription paused successfully');
      closeModal();
      await loadUsers();
    } catch (error) {
      console.error('[AdminUsers] Exception pausing subscription:', error);
    } finally {
      setProcessing(false);
    }
  };

  const handleIssueRefund = async () => {
    if (!selectedAction) return;

    try {
      setProcessing(true);
      console.log('[AdminUsers] Issuing refund for user:', selectedAction.userEmail);

      const { error } = await supabase
        .from('profiles')
        .update({
          is_subscribed: false,
          subscription_end_date: null,
        })
        .eq('id', selectedAction.userId);

      if (error) {
        console.error('[AdminUsers] Error issuing refund:', error);
        return;
      }

      console.log('[AdminUsers] ✅ Refund issued successfully');
      closeModal();
      await loadUsers();
    } catch (error) {
      console.error('[AdminUsers] Exception issuing refund:', error);
    } finally {
      setProcessing(false);
    }
  };

  const getSubscriptionStatus = (user: UserProfile): string => {
    if (user.is_subscribed) {
      if (user.subscription_end_date) {
        const endDate = new Date(user.subscription_end_date);
        const now = new Date();
        if (endDate > now) {
          return `Active until ${formatDate(user.subscription_end_date)}`;
        } else {
          return 'Expired';
        }
      }
      return 'Active';
    }
    return 'Not Subscribed';
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

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
            Loading users...
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <IconSymbol
              ios_icon_name="chevron.left"
              android_material_icon_name="chevron-left"
              size={24}
              color={colors.primary}
            />
          </TouchableOpacity>
          <View style={styles.headerTextContainer}>
            <Text style={[styles.title, { color: theme.colors.text }]}>
              User Management
            </Text>
            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
              {users.length} total users
            </Text>
          </View>
        </View>

        {users.map((user) => (
          <View key={user.id} style={[styles.userCard, { backgroundColor: theme.colors.card }]}>
            <View style={styles.userHeader}>
              <View style={styles.userInfo}>
                <Text style={[styles.userEmail, { color: theme.colors.text }]}>
                  {user.email}
                </Text>
                <View style={styles.badgeRow}>
                  {user.is_admin && (
                    <View style={[styles.badge, { backgroundColor: colors.accent }]}>
                      <Text style={styles.badgeText}>Admin</Text>
                    </View>
                  )}
                  <View style={[
                    styles.badge,
                    { backgroundColor: user.is_subscribed ? colors.primary : colors.textSecondary }
                  ]}>
                    <Text style={styles.badgeText}>
                      {user.is_subscribed ? 'Subscribed' : 'Free'}
                    </Text>
                  </View>
                  {user.daily_report_notifications && (
                    <View style={[styles.badge, { backgroundColor: '#22C55E' }]}>
                      <Text style={styles.badgeText}>Notifications On</Text>
                    </View>
                  )}
                </View>
                <Text style={[styles.userStatus, { color: colors.textSecondary }]}>
                  {getSubscriptionStatus(user)}
                </Text>
                <Text style={[styles.userDate, { color: colors.textSecondary }]}>
                  Joined {formatDate(user.created_at)}
                </Text>
              </View>
            </View>

            <View style={styles.actionButtons}>
              <TouchableOpacity
                style={[styles.actionButton, { backgroundColor: colors.primary }]}
                onPress={() => openActionModal(user.id, user.email, 'free_months')}
              >
                <IconSymbol
                  ios_icon_name="gift.fill"
                  android_material_icon_name="card-giftcard"
                  size={16}
                  color="#FFFFFF"
                />
                <Text style={styles.actionButtonText}>Grant Free</Text>
              </TouchableOpacity>

              {user.is_subscribed && (
                <>
                  <TouchableOpacity
                    style={[styles.actionButton, { backgroundColor: '#FF9800' }]}
                    onPress={() => openActionModal(user.id, user.email, 'pause')}
                  >
                    <IconSymbol
                      ios_icon_name="pause.fill"
                      android_material_icon_name="pause"
                      size={16}
                      color="#FFFFFF"
                    />
                    <Text style={styles.actionButtonText}>Pause</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.actionButton, { backgroundColor: '#F44336' }]}
                    onPress={() => openActionModal(user.id, user.email, 'cancel')}
                  >
                    <IconSymbol
                      ios_icon_name="xmark.circle.fill"
                      android_material_icon_name="cancel"
                      size={16}
                      color="#FFFFFF"
                    />
                    <Text style={styles.actionButtonText}>Cancel</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.actionButton, { backgroundColor: '#9C27B0' }]}
                    onPress={() => openActionModal(user.id, user.email, 'refund')}
                  >
                    <IconSymbol
                      ios_icon_name="dollarsign.circle.fill"
                      android_material_icon_name="payment"
                      size={16}
                      color="#FFFFFF"
                    />
                    <Text style={styles.actionButtonText}>Refund</Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
          </View>
        ))}
      </ScrollView>

      <Modal
        visible={modalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={closeModal}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <View style={[styles.modalContent, { backgroundColor: theme.colors.card }]}>
            <Text style={[styles.modalTitle, { color: theme.colors.text }]}>
              {selectedAction?.action === 'free_months' && 'Grant Free Subscription'}
              {selectedAction?.action === 'cancel' && 'Cancel Subscription'}
              {selectedAction?.action === 'pause' && 'Pause Subscription'}
              {selectedAction?.action === 'refund' && 'Issue Refund'}
            </Text>
            <Text style={[styles.modalSubtitle, { color: colors.textSecondary }]}>
              {selectedAction?.userEmail}
            </Text>

            {selectedAction?.action === 'free_months' && (
              <View style={styles.inputContainer}>
                <Text style={[styles.inputLabel, { color: theme.colors.text }]}>
                  Number of months (1-12):
                </Text>
                <TextInput
                  style={[
                    styles.input,
                    {
                      backgroundColor: theme.colors.background,
                      color: theme.colors.text,
                      borderColor: colors.textSecondary,
                    }
                  ]}
                  value={monthsInput}
                  onChangeText={setMonthsInput}
                  keyboardType="number-pad"
                  maxLength={2}
                  placeholder="1"
                  placeholderTextColor={colors.textSecondary}
                />
              </View>
            )}

            {selectedAction?.action === 'cancel' && (
              <Text style={[styles.modalMessage, { color: colors.textSecondary }]}>
                This will immediately cancel the user&apos;s subscription. They will lose access to subscriber content.
              </Text>
            )}

            {selectedAction?.action === 'pause' && (
              <Text style={[styles.modalMessage, { color: colors.textSecondary }]}>
                This will pause the user&apos;s subscription. They will lose access but can resume later.
              </Text>
            )}

            {selectedAction?.action === 'refund' && (
              <Text style={[styles.modalMessage, { color: colors.textSecondary }]}>
                This will cancel the subscription and mark it for refund. Process the refund through your payment provider.
              </Text>
            )}

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, { backgroundColor: colors.textSecondary }]}
                onPress={closeModal}
                disabled={processing}
              >
                <Text style={styles.modalButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.modalButton,
                  {
                    backgroundColor:
                      selectedAction?.action === 'free_months' ? colors.primary :
                      selectedAction?.action === 'pause' ? '#FF9800' :
                      selectedAction?.action === 'cancel' ? '#F44336' :
                      '#9C27B0'
                  }
                ]}
                onPress={() => {
                  if (selectedAction?.action === 'free_months') handleGrantFreeMonths();
                  else if (selectedAction?.action === 'cancel') handleCancelSubscription();
                  else if (selectedAction?.action === 'pause') handlePauseSubscription();
                  else if (selectedAction?.action === 'refund') handleIssueRefund();
                }}
                disabled={processing}
              >
                {processing ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.modalButtonText}>Confirm</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
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
    padding: 16,
    paddingTop: 60,
    paddingBottom: 100,
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
    marginBottom: 24,
    gap: 12,
  },
  backButton: {
    padding: 8,
  },
  headerTextContainer: {
    flex: 1,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
  },
  subtitle: {
    fontSize: 16,
    marginTop: 4,
  },
  loadingText: {
    fontSize: 16,
    marginTop: 16,
  },
  errorText: {
    fontSize: 18,
    marginTop: 16,
    marginBottom: 24,
    textAlign: 'center',
  },
  button: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  userCard: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    boxShadow: '0px 2px 8px rgba(0, 0, 0, 0.1)',
    elevation: 3,
  },
  userHeader: {
    marginBottom: 12,
  },
  userInfo: {
    gap: 6,
  },
  userEmail: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: 'bold',
  },
  userStatus: {
    fontSize: 13,
  },
  userDate: {
    fontSize: 12,
  },
  actionButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  actionButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
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
    boxShadow: '0px 4px 16px rgba(0, 0, 0, 0.2)',
    elevation: 5,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  modalSubtitle: {
    fontSize: 14,
    marginBottom: 16,
  },
  modalMessage: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 16,
  },
  inputContainer: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 14,
    marginBottom: 8,
    fontWeight: '600',
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
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
    fontSize: 14,
    fontWeight: '600',
  },
});
