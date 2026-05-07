
import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { IconSymbol } from '@/components/IconSymbol';
import { colors } from '@/styles/commonStyles';
import { supabase } from '@/integrations/supabase/client';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface UsageEvent {
  id: string;
  user_id: string | null;
  device_id: string | null;
  event_type: string;
  session_id: string | null;
  duration_seconds: number | null;
  video_id: string | null;
  video_title: string | null;
  created_at: string;
}

interface UserProfile {
  id: string;
  email: string | null;
  full_name: string | null;
  created_at: string | null;
  is_subscribed: boolean | null;
  subscription_end_date: string | null;
  subscription_source: string | null;
  min_wave_height: number | null;
  video_notifications: boolean | null;
  daily_report_notifications: boolean | null;
}

interface SessionEntry {
  sessionId: string | null;
  openedAt: string;
  durationSeconds: number | null;
}

interface VideoEntry {
  videoTitle: string;
  durationSeconds: number;
  watchedAt: string;
}

interface NotifEntry {
  notifType: string;
  occurredAt: string;
}

interface ForecastSummary {
  count: number;
  firstDate: string | null;
  lastDate: string | null;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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

function formatDateTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  } catch {
    return iso;
  }
}

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}m ${secs}s`;
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function SectionCard({
  icon_ios,
  icon_android,
  title,
  badge,
  children,
}: {
  icon_ios: string;
  icon_android: string;
  title: string;
  badge?: string | number;
  children: React.ReactNode;
}) {
  const badgeText = badge !== undefined ? String(badge) : undefined;
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <IconSymbol
          ios_icon_name={icon_ios}
          android_material_icon_name={icon_android}
          size={18}
          color={colors.primary}
        />
        <Text style={styles.sectionTitle}>{title}</Text>
        {badgeText !== undefined && (
          <Text style={styles.sectionBadge}>{badgeText}</Text>
        )}
      </View>
      {children}
    </View>
  );
}

function InfoRow({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={[styles.infoValue, accent ? { color: accent } : undefined]}>{value}</Text>
    </View>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <View style={styles.emptyInline}>
      <Text style={styles.emptyText}>{text}</Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Main screen
// ---------------------------------------------------------------------------

export default function AdminUserDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ userId: string; deviceId: string }>();
  const userId = params.userId ?? '';
  const deviceId = params.deviceId ?? '';

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [sessions, setSessions] = useState<SessionEntry[]>([]);
  const [videos, setVideos] = useState<VideoEntry[]>([]);
  const [notifs, setNotifs] = useState<NotifEntry[]>([]);
  const [forecastSummary, setForecastSummary] = useState<ForecastSummary>({ count: 0, firstDate: null, lastDate: null });

  const fetchData = useCallback(async () => {
    console.log('[AdminUserDetail] Fetching data for userId:', userId, 'deviceId:', deviceId);
    setIsLoading(true);
    setError(null);

    try {
      // Determine the real user UUID (strip 'device:' prefix if anonymous)
      const isAnonymous = userId.startsWith('device:');
      const realUserId = isAnonymous ? null : userId;
      const rawDeviceId = deviceId || (isAnonymous ? userId.replace('device:', '') : null);

      // Build event query: match by user_id OR device_id
      let eventsQuery = supabase
        .from('app_usage_events')
        .select('id, user_id, device_id, event_type, session_id, duration_seconds, video_id, video_title, created_at')
        .order('created_at', { ascending: false });

      if (realUserId && rawDeviceId) {
        eventsQuery = eventsQuery.or(`user_id.eq.${realUserId},device_id.eq.${rawDeviceId}`);
      } else if (realUserId) {
        eventsQuery = eventsQuery.eq('user_id', realUserId);
      } else if (rawDeviceId) {
        eventsQuery = eventsQuery.eq('device_id', rawDeviceId);
      }

      // Fetch profile (only if we have a real user id)
      const [eventsResult, profileResult] = await Promise.all([
        eventsQuery,
        realUserId
          ? supabase
              .from('profiles')
              .select('id, email, full_name, created_at, is_subscribed, subscription_end_date, subscription_source, min_wave_height, video_notifications, daily_report_notifications')
              .eq('id', realUserId)
              .single()
          : Promise.resolve({ data: null, error: null }),
      ]);

      if (eventsResult.error) {
        console.error('[AdminUserDetail] Events fetch error:', eventsResult.error);
        throw new Error(eventsResult.error.message || 'Failed to fetch events');
      }

      const events: UsageEvent[] = eventsResult.data ?? [];
      console.log('[AdminUserDetail] Loaded', events.length, 'events');

      if (profileResult.data) {
        setProfile(profileResult.data as UserProfile);
      }

      // --- Session timeline ---
      const openEvents = events.filter(e => e.event_type === 'app_open');
      const bgEvents = events.filter(e => e.event_type === 'app_background');

      // Build a map from session_id → duration
      const sessionDurationMap = new Map<string, number>();
      for (const e of bgEvents) {
        if (e.session_id && e.duration_seconds != null) {
          sessionDurationMap.set(e.session_id, Number(e.duration_seconds));
        }
      }

      const sessionList: SessionEntry[] = openEvents.map(e => ({
        sessionId: e.session_id,
        openedAt: e.created_at,
        durationSeconds: e.session_id ? (sessionDurationMap.get(e.session_id) ?? null) : null,
      }));
      setSessions(sessionList);

      // --- Videos watched ---
      const videoList: VideoEntry[] = events
        .filter(e => e.event_type === 'video_watch')
        .map(e => ({
          videoTitle: e.video_title || e.video_id || 'Unknown',
          durationSeconds: Number(e.duration_seconds) || 0,
          watchedAt: e.created_at,
        }));
      setVideos(videoList);

      // --- Notification activity ---
      const notifList: NotifEntry[] = events
        .filter(e => e.event_type === 'notification_open')
        .map(e => ({
          notifType: e.video_title || 'unknown',
          occurredAt: e.created_at,
        }));
      setNotifs(notifList);

      // --- Forecast views ---
      const forecastEvents = events.filter(e => e.event_type === 'forecast_view');
      const forecastDates = forecastEvents.map(e => e.created_at).sort();
      setForecastSummary({
        count: forecastEvents.length,
        firstDate: forecastDates.length > 0 ? forecastDates[0] : null,
        lastDate: forecastDates.length > 0 ? forecastDates[forecastDates.length - 1] : null,
      });

      console.log('[AdminUserDetail] Computed — sessions:', sessionList.length, 'videos:', videoList.length, 'notifs:', notifList.length, 'forecasts:', forecastEvents.length);
    } catch (err: any) {
      console.error('[AdminUserDetail] Failed to load user detail:', err);
      setError(err.message || 'Failed to load user data');
    } finally {
      setIsLoading(false);
    }
  }, [userId, deviceId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Derived display values
  const displayName = profile?.full_name || profile?.email || (userId.startsWith('device:') ? `Device ${userId.replace('device:', '').slice(0, 12)}` : `User ${userId.slice(0, 12)}`);
  const joinDate = profile?.created_at ? formatDate(profile.created_at) : '—';
  const subscriptionStatus = profile?.is_subscribed ? 'Active' : 'Free';
  const subscriptionSource = profile?.subscription_source || '—';
  const subscriptionEndDate = profile?.subscription_end_date ? formatDate(profile.subscription_end_date) : '—';
  const minWaveHeight = profile?.min_wave_height != null ? `${profile.min_wave_height} ft` : 'Not set';
  const videoNotifs = profile?.video_notifications ? 'On' : 'Off';
  const dailyReportNotifs = profile?.daily_report_notifications ? 'On' : 'Off';

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => {
            console.log('[AdminUserDetail] Back button pressed');
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
          <Text style={styles.headerTitle} numberOfLines={1}>{displayName}</Text>
          <Text style={styles.headerSubtitle}>User behavior profile</Text>
        </View>
        <TouchableOpacity
          onPress={() => {
            console.log('[AdminUserDetail] Refresh button pressed');
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
          <Text style={styles.centerStateText}>Loading user profile…</Text>
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
              console.log('[AdminUserDetail] Retry button pressed');
              fetchData();
            }}
          >
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      )}

      {!isLoading && !error && (
        <>
          {/* ---------------------------------------------------------------- */}
          {/* Section 1 — User Header                                          */}
          {/* ---------------------------------------------------------------- */}
          <SectionCard
            icon_ios="person.fill"
            icon_android="person"
            title="User Info"
          >
            <View style={styles.avatarRow}>
              <View style={styles.avatarCircle}>
                <Text style={styles.avatarLetter}>{(displayName[0] ?? '?').toUpperCase()}</Text>
              </View>
              <View style={styles.avatarInfo}>
                <Text style={styles.avatarName}>{displayName}</Text>
                {profile?.email && profile.email !== profile.full_name && (
                  <Text style={styles.avatarEmail}>{profile.email}</Text>
                )}
              </View>
              <View style={[styles.subBadge, profile?.is_subscribed ? styles.subBadgeActive : styles.subBadgeFree]}>
                <Text style={styles.subBadgeText}>{subscriptionStatus}</Text>
              </View>
            </View>
            <InfoRow label="Joined" value={joinDate} />
            <InfoRow label="Subscription" value={subscriptionStatus} accent={profile?.is_subscribed ? '#10B981' : '#6B7280'} />
            <InfoRow label="Source" value={subscriptionSource} />
          </SectionCard>

          {/* ---------------------------------------------------------------- */}
          {/* Section 2 — Session Timeline                                     */}
          {/* ---------------------------------------------------------------- */}
          <SectionCard
            icon_ios="clock.fill"
            icon_android="schedule"
            title="Session Timeline"
            badge={sessions.length}
          >
            {sessions.length === 0 ? (
              <EmptyState text="No sessions recorded" />
            ) : (
              sessions.map((s, i) => {
                const dateText = formatDateTime(s.openedAt);
                const durText = s.durationSeconds != null && s.durationSeconds > 0
                  ? formatDuration(s.durationSeconds)
                  : '—';
                return (
                  <View key={i} style={[styles.timelineRow, i === sessions.length - 1 && styles.timelineRowLast]}>
                    <View style={styles.timelineDot} />
                    <View style={styles.timelineContent}>
                      <Text style={styles.timelineDate}>{dateText}</Text>
                      <Text style={styles.timelineDuration}>{durText}</Text>
                    </View>
                  </View>
                );
              })
            )}
          </SectionCard>

          {/* ---------------------------------------------------------------- */}
          {/* Section 3 — Videos Watched                                       */}
          {/* ---------------------------------------------------------------- */}
          <SectionCard
            icon_ios="play.rectangle.fill"
            icon_android="play_circle"
            title="Videos Watched"
            badge={videos.length}
          >
            {videos.length === 0 ? (
              <EmptyState text="No videos watched" />
            ) : (
              videos.map((v, i) => {
                const durText = v.durationSeconds > 0 ? formatDuration(v.durationSeconds) : '—';
                const dateText = formatDateTime(v.watchedAt);
                return (
                  <View key={i} style={[styles.listRow, i === videos.length - 1 && styles.listRowLast]}>
                    <View style={styles.listRowLeft}>
                      <Text style={styles.listRowTitle} numberOfLines={1}>{v.videoTitle}</Text>
                      <Text style={styles.listRowSub}>{dateText}</Text>
                    </View>
                    <Text style={styles.listRowAccent}>{durText}</Text>
                  </View>
                );
              })
            )}
          </SectionCard>

          {/* ---------------------------------------------------------------- */}
          {/* Section 4 — Notification Activity                                */}
          {/* ---------------------------------------------------------------- */}
          <SectionCard
            icon_ios="bell.fill"
            icon_android="notifications"
            title="Notification Activity"
            badge={notifs.length}
          >
            {notifs.length === 0 ? (
              <EmptyState text="No notification opens recorded" />
            ) : (
              notifs.map((n, i) => {
                const dateText = formatDateTime(n.occurredAt);
                return (
                  <View key={i} style={[styles.listRow, i === notifs.length - 1 && styles.listRowLast]}>
                    <View style={styles.listRowLeft}>
                      <Text style={styles.listRowTitle}>{n.notifType}</Text>
                      <Text style={styles.listRowSub}>{dateText}</Text>
                    </View>
                    <IconSymbol
                      ios_icon_name="bell.badge.fill"
                      android_material_icon_name="notifications_active"
                      size={16}
                      color={colors.primary}
                    />
                  </View>
                );
              })
            )}
          </SectionCard>

          {/* ---------------------------------------------------------------- */}
          {/* Section 5 — Forecast Views                                       */}
          {/* ---------------------------------------------------------------- */}
          <SectionCard
            icon_ios="calendar"
            icon_android="calendar_today"
            title="Forecast Views"
          >
            {forecastSummary.count === 0 ? (
              <EmptyState text="No forecast views recorded" />
            ) : (
              <>
                <InfoRow label="Total Views" value={String(forecastSummary.count)} accent={colors.primary} />
                <InfoRow label="First View" value={forecastSummary.firstDate ? formatDateTime(forecastSummary.firstDate) : '—'} />
                <InfoRow label="Last View" value={forecastSummary.lastDate ? formatDateTime(forecastSummary.lastDate) : '—'} />
              </>
            )}
          </SectionCard>

          {/* ---------------------------------------------------------------- */}
          {/* Section 6 — Subscription Info                                    */}
          {/* ---------------------------------------------------------------- */}
          <SectionCard
            icon_ios="creditcard.fill"
            icon_android="credit_card"
            title="Subscription Info"
          >
            <InfoRow label="Status" value={subscriptionStatus} accent={profile?.is_subscribed ? '#10B981' : '#6B7280'} />
            <InfoRow label="End Date" value={subscriptionEndDate} />
            <InfoRow label="Source" value={subscriptionSource} />
            <InfoRow label="Min Wave Height" value={minWaveHeight} />
            <InfoRow label="Video Notifications" value={videoNotifs} accent={profile?.video_notifications ? '#10B981' : '#6B7280'} />
            <InfoRow label="Daily Reports" value={dailyReportNotifs} accent={profile?.daily_report_notifications ? '#10B981' : '#6B7280'} />
          </SectionCard>
        </>
      )}
    </ScrollView>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

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
    fontSize: 20,
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
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFFFFF',
    flex: 1,
  },
  sectionBadge: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6B7280',
    backgroundColor: '#1f1f1f',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  // Avatar row
  avatarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 14,
  },
  avatarCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.primary + '33',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarLetter: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.primary,
  },
  avatarInfo: {
    flex: 1,
  },
  avatarName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  avatarEmail: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 2,
  },
  subBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  subBadgeActive: {
    backgroundColor: '#10B98122',
  },
  subBadgeFree: {
    backgroundColor: '#1f1f1f',
  },
  subBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  // Info rows
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 9,
    borderBottomWidth: 1,
    borderBottomColor: '#1f1f1f',
  },
  infoLabel: {
    fontSize: 14,
    color: '#9CA3AF',
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
    textAlign: 'right',
    flexShrink: 1,
    marginLeft: 12,
  },
  // Timeline
  timelineRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#1f1f1f',
  },
  timelineRowLast: {
    borderBottomWidth: 0,
  },
  timelineDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary,
    marginTop: 5,
    flexShrink: 0,
  },
  timelineContent: {
    flex: 1,
  },
  timelineDate: {
    fontSize: 14,
    color: '#FFFFFF',
    fontWeight: '500',
  },
  timelineDuration: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  // Generic list rows
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#1f1f1f',
    gap: 10,
  },
  listRowLast: {
    borderBottomWidth: 0,
  },
  listRowLeft: {
    flex: 1,
  },
  listRowTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  listRowSub: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  listRowAccent: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.primary,
  },
  // Empty state
  emptyInline: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
  },
});
