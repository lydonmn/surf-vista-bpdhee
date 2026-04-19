import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Switch,
  ScrollView,
  ActivityIndicator,
  Alert,
  Platform,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import {
  getDailyReportNotificationStatus,
  setDailyReportNotifications,
  getNotificationLocations,
  setNotificationLocations,
} from '@/utils/pushNotifications';

const WAVE_HEIGHT_OPTIONS = [1, 2, 3, 4, 5, 6];
const VIDEO_NOTIFICATIONS_KEY = 'video_notifications_enabled';

interface Location {
  id: string;
  display_name: string;
}

export default function NotificationPreferencesScreen() {
  const router = useRouter();
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Daily report toggle
  const [dailyReportEnabled, setDailyReportEnabled] = useState(false);

  // New video notifications toggle
  const [videoNotificationsEnabled, setVideoNotificationsEnabled] = useState(true);

  // Swell alert state
  const [swellAlertEnabled, setSwellAlertEnabled] = useState(false);
  const [minWaveHeight, setMinWaveHeight] = useState<number>(3);

  // Per-location preferences
  const [locations, setLocations] = useState<Location[]>([]);
  const [enabledLocationIds, setEnabledLocationIds] = useState<string[]>([]);

  const loadPreferences = useCallback(async () => {
    if (!user?.id) return;
    console.log('[NotificationPreferences] Loading preferences for user:', user.id);
    setLoading(true);
    try {
      const [dailyStatus, locationIds, locationsResult, profileResult, storedVideoNotif] =
        await Promise.all([
          getDailyReportNotificationStatus(user.id),
          getNotificationLocations(user.id),
          supabase
            .from('locations')
            .select('id, display_name')
            .eq('is_active', true)
            .order('display_name'),
          supabase
            .from('profiles')
            .select('min_wave_height')
            .eq('id', user.id)
            .single(),
          AsyncStorage.getItem(VIDEO_NOTIFICATIONS_KEY),
        ]);

      setDailyReportEnabled(dailyStatus);
      setEnabledLocationIds(locationIds);

      if (locationsResult.data) {
        setLocations(locationsResult.data);
      }

      const savedMinHeight = profileResult.data?.min_wave_height;
      if (savedMinHeight !== null && savedMinHeight !== undefined) {
        setSwellAlertEnabled(true);
        setMinWaveHeight(savedMinHeight);
      } else {
        setSwellAlertEnabled(false);
        setMinWaveHeight(3);
      }

      // Default to true if never set
      setVideoNotificationsEnabled(storedVideoNotif !== 'false');

      console.log('[NotificationPreferences] Preferences loaded:', {
        dailyReport: dailyStatus,
        swellAlert: savedMinHeight !== null && savedMinHeight !== undefined,
        minWaveHeight: savedMinHeight,
        videoNotifications: storedVideoNotif !== 'false',
        locationCount: locationsResult.data?.length ?? 0,
      });
    } catch (err) {
      console.error('[NotificationPreferences] Error loading preferences:', err);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    loadPreferences();
  }, [loadPreferences]);

  const handleDailyReportToggle = async (value: boolean) => {
    if (!user?.id) return;
    console.log('[NotificationPreferences] Daily report toggle pressed:', value);
    setSaving(true);
    try {
      const success = await setDailyReportNotifications(user.id, value);
      if (success) {
        setDailyReportEnabled(value);
        console.log('[NotificationPreferences] Daily report notifications set to:', value);
      }
    } finally {
      setSaving(false);
    }
  };

  const handleVideoNotificationsToggle = async (value: boolean) => {
    console.log('[NotificationPreferences] Video notifications toggle pressed:', value);
    setSaving(true);
    try {
      await AsyncStorage.setItem(VIDEO_NOTIFICATIONS_KEY, value ? 'true' : 'false');
      setVideoNotificationsEnabled(value);
      console.log('[NotificationPreferences] Video notifications saved to AsyncStorage:', value);
      // NOTE: Requires a DB column `video_notifications boolean default true` on profiles
      // to persist cross-device. Currently stored locally via AsyncStorage.
    } catch (err) {
      console.error('[NotificationPreferences] Error saving video notifications:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleSwellAlertToggle = async (value: boolean) => {
    if (!user?.id) return;
    console.log('[NotificationPreferences] Swell alert toggle pressed:', value);
    setSaving(true);
    try {
      const newHeight = value ? minWaveHeight : null;
      const { error } = await supabase
        .from('profiles')
        .update({ min_wave_height: newHeight })
        .eq('id', user.id);

      if (error) {
        console.error('[NotificationPreferences] Error saving swell alert:', error);
        Alert.alert('Error', 'Failed to save swell alert preference.');
      } else {
        setSwellAlertEnabled(value);
        console.log('[NotificationPreferences] Swell alert set to:', value, 'threshold:', newHeight);
      }
    } finally {
      setSaving(false);
    }
  };

  const handleWaveHeightSelect = async (height: number) => {
    if (!user?.id) return;
    console.log('[NotificationPreferences] Wave height threshold selected:', height);
    setMinWaveHeight(height);
    if (!swellAlertEnabled) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ min_wave_height: height })
        .eq('id', user.id);
      if (error) {
        console.error('[NotificationPreferences] Error saving wave height:', error);
      } else {
        console.log('[NotificationPreferences] Wave height threshold saved:', height);
      }
    } finally {
      setSaving(false);
    }
  };

  const handleLocationToggle = async (locationId: string, value: boolean) => {
    if (!user?.id) return;
    console.log('[NotificationPreferences] Location toggle pressed:', locationId, value);
    const updated = value
      ? [...enabledLocationIds, locationId]
      : enabledLocationIds.filter((id) => id !== locationId);
    setEnabledLocationIds(updated);
    setSaving(true);
    try {
      await setNotificationLocations(user.id, updated);
      console.log('[NotificationPreferences] Location preferences saved:', updated);
    } finally {
      setSaving(false);
    }
  };

  const handleOpenSettings = () => {
    console.log('[NotificationPreferences] Open Settings pressed');
    if (Platform.OS === 'ios') {
      Linking.openURL('app-settings:');
    } else {
      Linking.openSettings();
    }
  };

  if (!user) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Text style={styles.backButtonText}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Notifications</Text>
          <View style={styles.headerSpacer} />
        </View>
        <View style={styles.centered}>
          <Text style={styles.emptyText}>Sign in to manage notification preferences.</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Text style={styles.backButtonText}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Notifications</Text>
          <View style={styles.headerSpacer} />
        </View>
        <View style={styles.centered}>
          <ActivityIndicator color="#0EA5E9" size="large" />
        </View>
      </SafeAreaView>
    );
  }

  const waveChipLabels: Record<number, string> = {
    1: '1ft',
    2: '2ft',
    3: '3ft',
    4: '4ft',
    5: '5ft',
    6: '6ft+',
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Notifications</Text>
        <View style={styles.headerSpacer}>
          {saving && <ActivityIndicator color="#0EA5E9" size="small" />}
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Daily Report Section */}
        <Text style={styles.sectionLabel}>DAILY SURF REPORT</Text>
        <View style={styles.card}>
          <View style={styles.row}>
            <View style={styles.rowTextGroup}>
              <Text style={styles.rowTitle}>Morning Report</Text>
              <Text style={styles.rowSubtitle}>Receive your daily surf report at 6 AM EST</Text>
            </View>
            <Switch
              value={dailyReportEnabled}
              onValueChange={handleDailyReportToggle}
              trackColor={{ false: '#3A3A3C', true: '#0EA5E9' }}
              thumbColor="#fff"
              ios_backgroundColor="#3A3A3C"
            />
          </View>
        </View>

        {/* New Video Notifications Section */}
        <Text style={styles.sectionLabel}>VIDEO UPDATES</Text>
        <View style={styles.card}>
          <View style={styles.row}>
            <View style={styles.rowTextGroup}>
              <Text style={styles.rowTitle}>New Video Alerts</Text>
              <Text style={styles.rowSubtitle}>Get notified when new surf videos are posted</Text>
            </View>
            <Switch
              value={videoNotificationsEnabled}
              onValueChange={handleVideoNotificationsToggle}
              trackColor={{ false: '#3A3A3C', true: '#0EA5E9' }}
              thumbColor="#fff"
              ios_backgroundColor="#3A3A3C"
            />
          </View>
        </View>

        {/* Swell Alert Section */}
        <Text style={styles.sectionLabel}>SWELL ALERTS</Text>
        <View style={styles.card}>
          <View style={styles.row}>
            <View style={styles.rowTextGroup}>
              <Text style={styles.rowTitle}>Swell Alert</Text>
              <Text style={styles.rowSubtitle}>Get notified when waves reach your threshold</Text>
            </View>
            <Switch
              value={swellAlertEnabled}
              onValueChange={handleSwellAlertToggle}
              trackColor={{ false: '#3A3A3C', true: '#0EA5E9' }}
              thumbColor="#fff"
              ios_backgroundColor="#3A3A3C"
            />
          </View>

          <View style={styles.divider} />
          <Text style={styles.thresholdLabel}>
            {swellAlertEnabled
              ? 'Minimum wave height — tap to change'
              : 'Set a minimum wave height (enable above to activate)'}
          </Text>
          <View style={styles.waveHeightRow}>
            {WAVE_HEIGHT_OPTIONS.map((height) => {
              const isSelected = minWaveHeight === height;
              const chipLabel = waveChipLabels[height];
              const isDisabled = !swellAlertEnabled;
              return (
                <TouchableOpacity
                  key={height}
                  style={[
                    styles.waveChip,
                    isSelected && styles.waveChipSelected,
                    isDisabled && styles.waveChipDisabled,
                  ]}
                  onPress={() => handleWaveHeightSelect(height)}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.waveChipText,
                      isSelected && styles.waveChipTextSelected,
                      isDisabled && styles.waveChipTextDisabled,
                    ]}
                  >
                    {chipLabel}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Per-Location Section — always visible when locations exist */}
        {locations.length > 0 && (
          <>
            <Text style={styles.sectionLabel}>REPORT LOCATIONS</Text>
            <Text style={styles.sectionHint}>
              {dailyReportEnabled
                ? 'Choose which locations to receive daily reports for'
                : 'Enable Morning Report above to activate location alerts'}
            </Text>
            <View style={[styles.card, !dailyReportEnabled && styles.cardDisabled]}>
              {locations.map((loc, index) => {
                const isEnabled = enabledLocationIds.includes(loc.id);
                const isLast = index === locations.length - 1;
                return (
                  <View key={loc.id}>
                    <View style={styles.row}>
                      <Text style={[styles.rowTitle, !dailyReportEnabled && styles.textDisabled]}>
                        {loc.display_name}
                      </Text>
                      <Switch
                        value={isEnabled && dailyReportEnabled}
                        onValueChange={(val) => handleLocationToggle(loc.id, val)}
                        disabled={!dailyReportEnabled}
                        trackColor={{ false: '#3A3A3C', true: '#0EA5E9' }}
                        thumbColor="#fff"
                        ios_backgroundColor="#3A3A3C"
                      />
                    </View>
                    {!isLast && <View style={styles.divider} />}
                  </View>
                );
              })}
            </View>
          </>
        )}

        {/* Settings link */}
        <Text style={styles.sectionLabel}>DEVICE SETTINGS</Text>
        <View style={styles.card}>
          <TouchableOpacity style={styles.row} onPress={handleOpenSettings} activeOpacity={0.7}>
            <View style={styles.rowTextGroup}>
              <Text style={styles.rowTitle}>Notification Settings</Text>
              <Text style={styles.rowSubtitle}>Manage system-level notification permissions</Text>
            </View>
            <Text style={styles.chevron}>›</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.bottomPad} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
  },
  backButton: {
    width: 70,
  },
  backButtonText: {
    fontSize: 16,
    color: '#0EA5E9',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#F1F5F9',
  },
  headerSpacer: {
    width: 70,
    alignItems: 'flex-end',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: 24,
    paddingHorizontal: 16,
    paddingBottom: 40,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    color: '#64748B',
    fontSize: 15,
    textAlign: 'center',
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
    letterSpacing: 0.8,
    marginBottom: 8,
    marginLeft: 4,
  },
  sectionHint: {
    fontSize: 13,
    color: '#475569',
    marginBottom: 8,
    marginLeft: 4,
    marginTop: -4,
  },
  card: {
    backgroundColor: '#1E293B',
    borderRadius: 14,
    marginBottom: 24,
    overflow: 'hidden',
  },
  cardDisabled: {
    opacity: 0.5,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  rowTextGroup: {
    flex: 1,
    marginRight: 12,
  },
  rowTitle: {
    fontSize: 16,
    color: '#F1F5F9',
    fontWeight: '500',
  },
  rowSubtitle: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 2,
  },
  textDisabled: {
    color: '#475569',
  },
  divider: {
    height: 1,
    backgroundColor: '#0F172A',
    marginHorizontal: 16,
  },
  thresholdLabel: {
    fontSize: 13,
    color: '#94A3B8',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 10,
  },
  waveHeightRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingBottom: 16,
    gap: 8,
    flexWrap: 'wrap',
  },
  waveChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#0F172A',
    borderWidth: 1,
    borderColor: '#334155',
  },
  waveChipSelected: {
    backgroundColor: '#0EA5E9',
    borderColor: '#0EA5E9',
  },
  waveChipDisabled: {
    opacity: 0.4,
  },
  waveChipText: {
    fontSize: 14,
    color: '#94A3B8',
    fontWeight: '500',
  },
  waveChipTextSelected: {
    color: '#fff',
  },
  waveChipTextDisabled: {
    color: '#475569',
  },
  chevron: {
    fontSize: 22,
    color: '#475569',
  },
  bottomPad: {
    height: 40,
  },
});
