import { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Alert,
  ActivityIndicator,
  SafeAreaView,
} from 'react-native';
import { router } from 'expo-router';
import { supabase } from '@/app/integrations/supabase/client';
import { IconSymbol } from '@/components/IconSymbol';
import { useAuth } from '@/contexts/AuthContext';

const SUPABASE_URL = 'https://ucbilksfpnmltrkwvzft.supabase.co';
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVjYmlsa3NmcG5tbHRya3d6ZnQiLCJyb2xlIjoiYW5vbiIsImlhdCI6MTc2NTg0MzYyNywiZXhwIjoyMDgxNDE5NjI3fQ.pQkSbD0JzvRV4_lj0rAmeaQFZqK1QVW0EkVlhYM-KA8';
const EDGE_FN_URL = `${SUPABASE_URL}/functions/v1/send-custom-notification`;

type Audience = 'all' | 'subscribers' | 'specific';

interface UserProfile {
  id: string;
  email: string | null;
  full_name: string | null;
  is_subscribed: boolean | null;
  push_token: string | null;
}

export default function AdminNotificationsScreen() {
  const { profile } = useAuth();

  const [notifTitle, setNotifTitle] = useState('');
  const [notifBody, setNotifBody] = useState('');
  const [audience, setAudience] = useState<Audience>('all');
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(new Set());
  const [userSearch, setUserSearch] = useState('');
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [sending, setSending] = useState(false);

  // Guard: only admins
  useEffect(() => {
    if (profile && !profile.is_admin) {
      Alert.alert('Access Denied', 'Admin privileges required.');
      router.back();
    }
  }, [profile]);

  // Fetch all profiles on mount
  useEffect(() => {
    const fetchUsers = async () => {
      console.log('[AdminNotifications] Fetching user profiles...');
      setLoadingUsers(true);
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('id, email, full_name, is_subscribed, push_token')
          .order('full_name', { ascending: true });

        if (error) {
          console.error('[AdminNotifications] Error fetching profiles:', error);
          Alert.alert('Error', 'Failed to load users: ' + error.message);
        } else {
          console.log('[AdminNotifications] Loaded', data?.length ?? 0, 'profiles');
          setUsers((data as UserProfile[]) ?? []);
        }
      } finally {
        setLoadingUsers(false);
      }
    };
    fetchUsers();
  }, []);

  // Filtered users for search
  const filteredUsers = useMemo(() => {
    const q = userSearch.toLowerCase().trim();
    if (!q) return users;
    return users.filter(
      (u) =>
        (u.full_name ?? '').toLowerCase().includes(q) ||
        (u.email ?? '').toLowerCase().includes(q)
    );
  }, [users, userSearch]);

  // Eligible recipient count based on audience
  const recipientCount = useMemo(() => {
    const hasToken = (u: UserProfile) =>
      u.push_token && u.push_token.startsWith('ExponentPushToken[');
    if (audience === 'all') return users.filter(hasToken).length;
    if (audience === 'subscribers')
      return users.filter((u) => u.is_subscribed && hasToken(u)).length;
    if (audience === 'specific') {
      return users.filter((u) => selectedUserIds.has(u.id) && hasToken(u)).length;
    }
    return 0;
  }, [audience, users, selectedUserIds]);

  const toggleUser = (id: string) => {
    console.log('[AdminNotifications] Toggling user selection:', id);
    setSelectedUserIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleSend = async () => {
    if (!notifTitle.trim() || !notifBody.trim()) return;

    const userIdsArray = Array.from(selectedUserIds);
    if (audience === 'specific' && userIdsArray.length === 0) {
      Alert.alert('No Users Selected', 'Please select at least one user.');
      return;
    }

    console.log('[AdminNotifications] Sending notification — title:', notifTitle, '| audience:', audience, '| recipientCount:', recipientCount);
    setSending(true);

    try {
      const payload: Record<string, unknown> = {
        title: notifTitle.trim(),
        body: notifBody.trim(),
        audience,
      };
      if (audience === 'specific') {
        payload.userIds = userIdsArray;
      }

      console.log('[AdminNotifications] POST', EDGE_FN_URL, JSON.stringify(payload));

      const response = await fetch(EDGE_FN_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errText = await response.text();
        console.error('[AdminNotifications] Edge function error:', response.status, errText);
        throw new Error(`Server error ${response.status}: ${errText}`);
      }

      const result = await response.json();
      console.log('[AdminNotifications] Send result:', JSON.stringify(result));

      if (result.success) {
        Alert.alert(
          'Notification Sent',
          `Successfully sent to ${result.sent} user${result.sent !== 1 ? 's' : ''}!${result.failed > 0 ? ` (${result.failed} failed)` : ''}`,
          [
            {
              text: 'OK',
              onPress: () => {
                console.log('[AdminNotifications] Clearing form after successful send');
                setNotifTitle('');
                setNotifBody('');
                setAudience('all');
                setSelectedUserIds(new Set());
                setUserSearch('');
              },
            },
          ]
        );
      } else {
        throw new Error(result.error ?? 'Unknown error from edge function');
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error('[AdminNotifications] Send failed:', message);
      Alert.alert('Send Failed', message);
    } finally {
      setSending(false);
    }
  };

  const canSend = notifTitle.trim().length > 0 && notifBody.trim().length > 0 && !sending;

  const sendButtonLabel = sending
    ? 'Sending...'
    : `Send to ${recipientCount} User${recipientCount !== 1 ? 's' : ''}`;

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => {
            console.log('[AdminNotifications] Back button pressed');
            router.back();
          }}
        >
          <IconSymbol
            ios_icon_name="chevron.left"
            android_material_icon_name="arrow_back"
            size={22}
            color="#FFFFFF"
          />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Send Notification</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">

        {/* Title field */}
        <Text style={styles.label}>Title</Text>
        <TextInput
          style={styles.input}
          placeholder="Notification title..."
          placeholderTextColor="#6B7280"
          value={notifTitle}
          onChangeText={(t) => {
            console.log('[AdminNotifications] Title changed');
            setNotifTitle(t);
          }}
          returnKeyType="next"
        />

        {/* Message field */}
        <Text style={styles.label}>Message</Text>
        <TextInput
          style={[styles.input, styles.messageInput]}
          placeholder="Write your message..."
          placeholderTextColor="#6B7280"
          value={notifBody}
          onChangeText={(t) => {
            console.log('[AdminNotifications] Body changed');
            setNotifBody(t);
          }}
          multiline
          numberOfLines={4}
          textAlignVertical="top"
        />

        {/* Audience selector */}
        <Text style={styles.label}>Audience</Text>
        <View style={styles.audienceRow}>
          {(['all', 'subscribers', 'specific'] as Audience[]).map((opt) => {
            const isActive = audience === opt;
            const labelMap: Record<Audience, string> = {
              all: 'All Users',
              subscribers: 'Subscribers Only',
              specific: 'Select Users',
            };
            return (
              <TouchableOpacity
                key={opt}
                style={[styles.audiencePill, isActive && styles.audiencePillActive]}
                onPress={() => {
                  console.log('[AdminNotifications] Audience selected:', opt);
                  setAudience(opt);
                }}
              >
                <Text style={[styles.audiencePillText, isActive && styles.audiencePillTextActive]}>
                  {labelMap[opt]}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* User picker (only for "specific") */}
        {audience === 'specific' && (
          <View style={styles.userPickerContainer}>
            <View style={styles.userPickerHeader}>
              <Text style={styles.label}>Select Users</Text>
              {selectedUserIds.size > 0 && (
                <Text style={styles.selectedCount}>
                  {selectedUserIds.size}
                  {' '}
                  {selectedUserIds.size === 1 ? 'user' : 'users'}
                  {' '}
                  selected
                </Text>
              )}
            </View>
            <View style={styles.searchContainer}>
              <IconSymbol
                ios_icon_name="magnifyingglass"
                android_material_icon_name="search"
                size={16}
                color="#6B7280"
              />
              <TextInput
                style={styles.searchInput}
                placeholder="Search by name or email..."
                placeholderTextColor="#6B7280"
                value={userSearch}
                onChangeText={(t) => {
                  console.log('[AdminNotifications] User search changed');
                  setUserSearch(t);
                }}
              />
            </View>
            {loadingUsers ? (
              <ActivityIndicator color="#4682B4" style={{ marginVertical: 16 }} />
            ) : (
              <View style={styles.userList}>
                {filteredUsers.map((u) => {
                  const isChecked = selectedUserIds.has(u.id);
                  const displayName = u.full_name || u.email || u.id;
                  const subText = u.full_name ? u.email ?? '' : '';
                  const hasToken = u.push_token && u.push_token.startsWith('ExponentPushToken[');
                  return (
                    <TouchableOpacity
                      key={u.id}
                      style={[styles.userRow, isChecked && styles.userRowChecked]}
                      onPress={() => toggleUser(u.id)}
                    >
                      <View style={[styles.checkbox, isChecked && styles.checkboxChecked]}>
                        {isChecked && (
                          <IconSymbol
                            ios_icon_name="checkmark"
                            android_material_icon_name="check"
                            size={12}
                            color="#FFFFFF"
                          />
                        )}
                      </View>
                      <View style={styles.userInfo}>
                        <Text style={styles.userName}>{displayName}</Text>
                        {subText ? <Text style={styles.userEmail}>{subText}</Text> : null}
                      </View>
                      <View style={styles.userBadges}>
                        {u.is_subscribed && (
                          <View style={styles.badge}>
                            <Text style={styles.badgeText}>Pro</Text>
                          </View>
                        )}
                        {!hasToken && (
                          <View style={[styles.badge, styles.badgeGray]}>
                            <Text style={styles.badgeText}>No token</Text>
                          </View>
                        )}
                      </View>
                    </TouchableOpacity>
                  );
                })}
                {filteredUsers.length === 0 && (
                  <Text style={styles.emptyText}>No users found</Text>
                )}
              </View>
            )}
          </View>
        )}

        {/* Preview card */}
        {(notifTitle.trim() || notifBody.trim()) && (
          <View style={styles.previewCard}>
            <View style={styles.previewHeader}>
              <IconSymbol
                ios_icon_name="bell.fill"
                android_material_icon_name="notifications"
                size={14}
                color="#9CA3AF"
              />
              <Text style={styles.previewLabel}>Preview</Text>
            </View>
            <View style={styles.previewBubble}>
              <Text style={styles.previewTitle}>{notifTitle || 'Notification title...'}</Text>
              <Text style={styles.previewBody}>{notifBody || 'Your message will appear here.'}</Text>
            </View>
          </View>
        )}

        {/* Send button */}
        <TouchableOpacity
          style={[styles.sendButton, !canSend && styles.sendButtonDisabled]}
          onPress={() => {
            console.log('[AdminNotifications] Send button pressed — audience:', audience, '| recipientCount:', recipientCount);
            handleSend();
          }}
          disabled={!canSend}
        >
          {sending ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <IconSymbol
              ios_icon_name="paperplane.fill"
              android_material_icon_name="send"
              size={18}
              color="#FFFFFF"
            />
          )}
          <Text style={styles.sendButtonText}>{sendButtonLabel}</Text>
        </TouchableOpacity>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#111827',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#1F2937',
    borderBottomWidth: 1,
    borderBottomColor: '#374151',
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  headerSpacer: {
    width: 30,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 60,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#9CA3AF',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 8,
    marginTop: 16,
  },
  input: {
    backgroundColor: '#1F2937',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#374151',
  },
  messageInput: {
    minHeight: 100,
    paddingTop: 12,
  },
  audienceRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  audiencePill: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: '#374151',
    backgroundColor: '#1F2937',
  },
  audiencePillActive: {
    backgroundColor: '#4682B4',
    borderColor: '#4682B4',
  },
  audiencePillText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#9CA3AF',
  },
  audiencePillTextActive: {
    color: '#FFFFFF',
  },
  userPickerContainer: {
    marginTop: 8,
  },
  userPickerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  selectedCount: {
    fontSize: 13,
    color: '#4682B4',
    fontWeight: '600',
    marginTop: 16,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1F2937',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#374151',
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
    marginBottom: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: '#FFFFFF',
  },
  userList: {
    borderRadius: 10,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#374151',
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: '#1F2937',
    borderBottomWidth: 1,
    borderBottomColor: '#374151',
    gap: 12,
  },
  userRowChecked: {
    backgroundColor: '#1E3A5F',
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#4B5563',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: '#4682B4',
    borderColor: '#4682B4',
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  userEmail: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 2,
  },
  userBadges: {
    flexDirection: 'row',
    gap: 4,
  },
  badge: {
    backgroundColor: '#4682B4',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  badgeGray: {
    backgroundColor: '#374151',
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  emptyText: {
    textAlign: 'center',
    color: '#6B7280',
    paddingVertical: 20,
    fontSize: 14,
  },
  previewCard: {
    marginTop: 20,
    backgroundColor: '#1F2937',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#374151',
  },
  previewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 10,
  },
  previewLabel: {
    fontSize: 12,
    color: '#9CA3AF',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  previewBubble: {
    backgroundColor: '#111827',
    borderRadius: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: '#374151',
  },
  previewTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  previewBody: {
    fontSize: 14,
    color: '#D1D5DB',
    lineHeight: 20,
  },
  sendButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: '#4682B4',
    borderRadius: 12,
    paddingVertical: 16,
    marginTop: 24,
  },
  sendButtonDisabled: {
    opacity: 0.4,
  },
  sendButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
