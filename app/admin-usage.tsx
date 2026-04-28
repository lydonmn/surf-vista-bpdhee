
import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { IconSymbol } from '@/components/IconSymbol';
import { colors } from '@/styles/commonStyles';
import { supabase } from '@/integrations/supabase/client';

interface UsageEvent {
  user_id: string | null;
  device_id: string | null;
  event_type: string;
  session_id: string | null;
  duration_seconds: number | null;
  video_id: string | null;
  video_title: string | null;
  created_at: string;
}

interface Profile {
  id: string;
  email: string | null;
  full_name: string | null;
}

interface StatCard {
  label: string;
  value: string;
  icon_ios: string;
  icon_android: string;
  accent: string;
}

interface DayActivity {
  date: string;
  label: string;
  count: number;
}

interface UserStat {
  userId: string;
  name: string;
  sessions: number;
  totalTimeSeconds: number;
  videosWatched: number;
  lastSeen: string;
}

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}m ${secs}s`;
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return iso;
  }
}

function formatShortDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return iso;
  }
}

export default function AdminUsageScreen() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [statCards, setStatCards] = useState<StatCard[]>([]);
  const [dailyActivity, setDailyActivity] = useState<DayActivity[]>([]);
  const [userStats, setUserStats] = useState<UserStat[]>([]);

  const fetchData = useCallback(async () => {
    console.log('[AdminUsage] Fetching usage analytics data');
    setIsLoading(true);
    setError(null);

    try {
      const [eventsResult, profilesResult] = await Promise.all([
        supabase
          .from('app_usage_events')
          .select('user_id, device_id, event_type, session_id, duration_seconds, video_id, video_title, created_at')
          .order('created_at', { ascending: false }),
        supabase
          .from('profiles')
          .select('id, email, full_name'),
      ]);

      if (eventsResult.error) {
        console.error('[AdminUsage] Error fetching events:', eventsResult.error);
        throw new Error(eventsResult.error.message || 'Failed to fetch usage events');
      }
      if (profilesResult.error) {
        console.error('[AdminUsage] Error fetching profiles:', profilesResult.error);
        throw new Error(profilesResult.error.message || 'Failed to fetch profiles');
      }

      const events: UsageEvent[] = eventsResult.data ?? [];
      const profiles: Profile[] = profilesResult.data ?? [];
      console.log('[AdminUsage] Loaded events:', events.length, 'profiles:', profiles.length);

      const profileMap = new Map<string, Profile>();
      for (const p of profiles) {
        profileMap.set(p.id, p);
      }

      // --- Summary stats ---
      const appOpenEvents = events.filter(e => e.event_type === 'app_open');
      const appBgEvents = events.filter(e => e.event_type === 'app_background');
      const videoEvents = events.filter(e => e.event_type === 'video_watch');

      const totalSessions = appOpenEvents.length;

      const bgDurations = appBgEvents
        .map(e => Number(e.duration_seconds))
        .filter(d => !isNaN(d) && d > 0);
      const avgSessionSecs = bgDurations.length > 0
        ? bgDurations.reduce((a, b) => a + b, 0) / bgDurations.length
        : 0;

      const totalVideos = videoEvents.length;

      const videoDurations = videoEvents
        .map(e => Number(e.duration_seconds))
        .filter(d => !isNaN(d) && d > 0);
      const avgVideoSecs = videoDurations.length > 0
        ? videoDurations.reduce((a, b) => a + b, 0) / videoDurations.length
        : 0;

      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      // Count distinct identities (user_id when available, otherwise device_id) active in last 7 days
      const recentIdentities = new Set(
        events
          .filter(e => new Date(e.created_at) >= sevenDaysAgo)
          .map(e => e.user_id ?? (e.device_id ? `device:${e.device_id}` : null))
          .filter((id): id is string => id !== null)
      );
      const activeUsers = recentIdentities.size;

      const cards: StatCard[] = [
        {
          label: 'Total Sessions',
          value: String(totalSessions),
          icon_ios: 'iphone',
          icon_android: 'smartphone',
          accent: '#3B82F6',
        },
        {
          label: 'Avg Session',
          value: avgSessionSecs > 0 ? formatDuration(avgSessionSecs) : '—',
          icon_ios: 'clock.fill',
          icon_android: 'schedule',
          accent: '#10B981',
        },
        {
          label: 'Videos Watched',
          value: String(totalVideos),
          icon_ios: 'play.rectangle.fill',
          icon_android: 'play_circle',
          accent: '#F59E0B',
        },
        {
          label: 'Avg Video',
          value: avgVideoSecs > 0 ? formatDuration(avgVideoSecs) : '—',
          icon_ios: 'film.fill',
          icon_android: 'movie',
          accent: '#8B5CF6',
        },
        {
          label: 'Active Users (7d)',
          value: String(activeUsers),
          icon_ios: 'person.2.fill',
          icon_android: 'group',
          accent: '#EF4444',
        },
      ];
      setStatCards(cards);

      // --- Daily activity (last 14 days) ---
      const days: DayActivity[] = [];
      for (let i = 0; i < 14; i++) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const dateStr = d.toISOString().slice(0, 10);
        const label = formatShortDate(d.toISOString());
        const count = appOpenEvents.filter(e => e.created_at.slice(0, 10) === dateStr).length;
        days.push({ date: dateStr, label, count });
      }
      setDailyActivity(days);

      // --- Per-user breakdown ---
      // Step 1: Build a map from device_id → authenticated user_id (if any event for that device has a user_id)
      const deviceToUserId = new Map<string, string>();
      for (const e of events) {
        if (e.device_id && e.user_id) {
          deviceToUserId.set(e.device_id, e.user_id);
        }
      }

      // Step 2: Aggregate events, merging anonymous device sessions under the authenticated user
      const userMap = new Map<string, {
        sessions: number;
        bgDurations: number[];
        videos: number;
        lastSeen: string;
      }>();

      for (const e of events) {
        // Resolve the canonical identity key:
        // - If event has a user_id, use it directly
        // - If event is anonymous but the device has authenticated elsewhere, merge under that user_id
        // - Otherwise fall back to device:xxx
        let uid: string;
        if (e.user_id) {
          uid = e.user_id;
        } else if (e.device_id && deviceToUserId.has(e.device_id)) {
          uid = deviceToUserId.get(e.device_id)!;
        } else {
          uid = `device:${e.device_id ?? 'unknown'}`;
        }

        if (!userMap.has(uid)) {
          userMap.set(uid, { sessions: 0, bgDurations: [], videos: 0, lastSeen: e.created_at });
        }
        const u = userMap.get(uid)!;
        if (e.event_type === 'app_open') u.sessions += 1;
        if (e.event_type === 'app_background' && e.duration_seconds != null) {
          u.bgDurations.push(Number(e.duration_seconds));
        }
        if (e.event_type === 'video_watch') u.videos += 1;
        if (e.created_at > u.lastSeen) u.lastSeen = e.created_at;
      }

      const userStatsList: UserStat[] = [];
      for (const [uid, data] of userMap.entries()) {
        const isDevice = uid.startsWith('device:');
        const profile = isDevice ? null : profileMap.get(uid);
        // Prefer full_name → email → device:xxx
        const name = profile?.full_name || profile?.email || (isDevice ? uid : `User ${uid.slice(0, 8)}`);
        const totalTime = data.bgDurations.reduce((a, b) => a + b, 0);
        userStatsList.push({
          userId: uid,
          name,
          sessions: data.sessions,
          totalTimeSeconds: totalTime,
          videosWatched: data.videos,
          lastSeen: data.lastSeen,
        });
      }

      userStatsList.sort((a, b) => (b.lastSeen > a.lastSeen ? 1 : -1));
      setUserStats(userStatsList);
      console.log('[AdminUsage] Device→user merge complete. deviceToUserId entries:', deviceToUserId.size);

      console.log('[AdminUsage] Analytics computed — users:', userStatsList.length);
    } catch (err: any) {
      console.error('[AdminUsage] Failed to load analytics:', err);
      setError(err.message || 'Failed to load usage analytics');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const maxDayCount = dailyActivity.length > 0
    ? Math.max(...dailyActivity.map(d => d.count), 1)
    : 1;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => {
            console.log('[AdminUsage] Back button pressed');
            router.back();
          }}
          style={styles.backButton}
        >
          <IconSymbol
            ios_icon_name="chevron.left"
            android_material_icon_name="arrow-back"
            size={24}
            color={colors.primary}
          />
        </TouchableOpacity>
        <View style={styles.headerTextContainer}>
          <Text style={styles.headerTitle}>Usage Analytics</Text>
          <Text style={styles.headerSubtitle}>App engagement overview</Text>
        </View>
        <TouchableOpacity
          onPress={() => {
            console.log('[AdminUsage] Refresh button pressed');
            fetchData();
          }}
          style={styles.refreshButton}
          disabled={isLoading}
        >
          <IconSymbol
            ios_icon_name="arrow.clockwise"
            android_material_icon_name="refresh"
            size={22}
            color={isLoading ? '#4B5563' : colors.primary}
          />
        </TouchableOpacity>
      </View>

      {/* Loading */}
      {isLoading && (
        <View style={styles.centerState}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.centerStateText}>Loading analytics...</Text>
        </View>
      )}

      {/* Error */}
      {!isLoading && error && (
        <View style={styles.centerState}>
          <IconSymbol
            ios_icon_name="exclamationmark.triangle.fill"
            android_material_icon_name="warning"
            size={40}
            color="#EF4444"
          />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity
            style={styles.retryButton}
            onPress={() => {
              console.log('[AdminUsage] Retry button pressed');
              fetchData();
            }}
          >
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      )}

      {!isLoading && !error && (
        <>
          {/* Summary Cards */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <IconSymbol
                ios_icon_name="chart.bar.fill"
                android_material_icon_name="bar_chart"
                size={18}
                color={colors.primary}
              />
              <Text style={styles.sectionTitle}>Summary</Text>
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.cardsRow}
            >
              {statCards.map((card, i) => (
                <View key={i} style={styles.statCard}>
                  <View style={[styles.statIconCircle, { backgroundColor: card.accent + '22' }]}>
                    <IconSymbol
                      ios_icon_name={card.icon_ios}
                      android_material_icon_name={card.icon_android}
                      size={20}
                      color={card.accent}
                    />
                  </View>
                  <Text style={styles.statValue}>{card.value}</Text>
                  <Text style={styles.statLabel}>{card.label}</Text>
                </View>
              ))}
            </ScrollView>
          </View>

          {/* Daily Activity */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <IconSymbol
                ios_icon_name="calendar"
                android_material_icon_name="calendar_today"
                size={18}
                color={colors.primary}
              />
              <Text style={styles.sectionTitle}>Daily Sessions (Last 14 Days)</Text>
            </View>
            {dailyActivity.every(d => d.count === 0) ? (
              <View style={styles.emptyInline}>
                <Text style={styles.emptyText}>No session data yet</Text>
              </View>
            ) : (
              dailyActivity.map((day, i) => {
                const barFlex = maxDayCount > 0 ? day.count / maxDayCount : 0;
                const clampedFlex = day.count > 0 ? Math.max(barFlex, 0.02) : 0;
                return (
                  <View key={i} style={styles.dayRow}>
                    <Text style={styles.dayLabel}>{day.label}</Text>
                    <View style={styles.dayBarTrack}>
                      <View style={[styles.dayBarFill, { flex: clampedFlex }]} />
                      <View style={{ flex: 1 - clampedFlex }} />
                    </View>
                    <Text style={styles.dayCount}>{day.count}</Text>
                  </View>
                );
              })
            )}
          </View>

          {/* Per-User Breakdown */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <IconSymbol
                ios_icon_name="person.3.fill"
                android_material_icon_name="group"
                size={18}
                color={colors.primary}
              />
              <Text style={styles.sectionTitle}>Per-User Breakdown</Text>
              <Text style={styles.sectionCount}>{userStats.length}</Text>
            </View>
            {userStats.length === 0 ? (
              <View style={styles.emptyInline}>
                <Text style={styles.emptyText}>
                  No usage data yet — data will appear after users open the app
                </Text>
              </View>
            ) : (
              userStats.map((u, i) => {
                const lastSeenDisplay = formatDate(u.lastSeen);
                const totalTimeDisplay = u.totalTimeSeconds > 0
                  ? formatDuration(u.totalTimeSeconds)
                  : '—';
                return (
                  <View key={i} style={styles.userCard}>
                    <View style={styles.userCardTop}>
                      <View style={styles.userAvatarCircle}>
                        <Text style={styles.userAvatarLetter}>
                          {(u.name[0] ?? '?').toUpperCase()}
                        </Text>
                      </View>
                      <View style={styles.userCardInfo}>
                        <Text style={styles.userName} numberOfLines={1}>{u.name}</Text>
                        <Text style={styles.userLastSeen}>Last seen {lastSeenDisplay}</Text>
                      </View>
                    </View>
                    <View style={styles.userStatsRow}>
                      <View style={styles.userStat}>
                        <Text style={styles.userStatValue}>{u.sessions}</Text>
                        <Text style={styles.userStatLabel}>Sessions</Text>
                      </View>
                      <View style={styles.userStatDivider} />
                      <View style={styles.userStat}>
                        <Text style={styles.userStatValue}>{totalTimeDisplay}</Text>
                        <Text style={styles.userStatLabel}>Time in App</Text>
                      </View>
                      <View style={styles.userStatDivider} />
                      <View style={styles.userStat}>
                        <Text style={styles.userStatValue}>{u.videosWatched}</Text>
                        <Text style={styles.userStatLabel}>Videos</Text>
                      </View>
                    </View>
                  </View>
                );
              })
            )}
          </View>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  contentContainer: {
    paddingBottom: 60,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 60,
    paddingBottom: 16,
    backgroundColor: '#111111',
    borderBottomWidth: 1,
    borderBottomColor: '#1f1f1f',
  },
  backButton: {
    marginRight: 12,
    padding: 4,
  },
  headerTextContainer: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  headerSubtitle: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 2,
  },
  refreshButton: {
    padding: 8,
  },
  centerState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 64,
    paddingHorizontal: 32,
  },
  centerStateText: {
    fontSize: 16,
    color: '#6B7280',
    marginTop: 16,
  },
  errorText: {
    fontSize: 15,
    color: '#EF4444',
    textAlign: 'center',
    marginTop: 16,
    lineHeight: 22,
  },
  retryButton: {
    marginTop: 20,
    backgroundColor: colors.primary,
    paddingVertical: 10,
    paddingHorizontal: 28,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
  section: {
    backgroundColor: '#111111',
    marginTop: 16,
    marginHorizontal: 16,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#1f1f1f',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFFFFF',
    flex: 1,
  },
  sectionCount: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6B7280',
    backgroundColor: '#1f1f1f',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  // Stat cards
  cardsRow: {
    gap: 10,
    paddingRight: 4,
  },
  statCard: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    minWidth: 110,
    borderWidth: 1,
    borderColor: '#2a2a2a',
  },
  statIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  statValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#9CA3AF',
    textAlign: 'center',
  },
  // Daily activity
  dayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    gap: 10,
  },
  dayLabel: {
    fontSize: 13,
    color: '#9CA3AF',
    width: 56,
  },
  dayBarTrack: {
    flex: 1,
    height: 10,
    backgroundColor: '#1f1f1f',
    borderRadius: 5,
    overflow: 'hidden',
    flexDirection: 'row',
  },
  dayBarFill: {
    height: '100%',
    backgroundColor: colors.primary,
    borderRadius: 5,
  },
  dayCount: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FFFFFF',
    width: 28,
    textAlign: 'right',
  },
  // Empty state
  emptyInline: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 20,
  },
  // User cards
  userCard: {
    backgroundColor: '#1a1a1a',
    borderRadius: 10,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#2a2a2a',
  },
  userCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 12,
  },
  userAvatarCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.primary + '33',
    alignItems: 'center',
    justifyContent: 'center',
  },
  userAvatarLetter: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.primary,
  },
  userCardInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  userLastSeen: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  userStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#111111',
    borderRadius: 8,
    paddingVertical: 10,
  },
  userStat: {
    flex: 1,
    alignItems: 'center',
  },
  userStatValue: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  userStatLabel: {
    fontSize: 11,
    color: '#6B7280',
    marginTop: 2,
  },
  userStatDivider: {
    width: 1,
    height: 28,
    backgroundColor: '#2a2a2a',
  },
});
