
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

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

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
  daily_report_notifications: boolean | null;
  video_notifications: boolean | null;
  min_wave_height: number | null;
}

interface StatCard {
  label: string;
  value: string;
  icon_ios: string;
  icon_android: string;
  accent: string;
}

interface HourBucket {
  hour: number;
  label: string;
  count: number;
  isPeak: boolean;
}

interface VideoStat {
  title: string;
  watchCount: number;
  totalSeconds: number;
  avgSeconds: number;
}

interface VideoWatchEvent {
  videoTitle: string;
  userName: string;
  durationSeconds: number;
  createdAt: string;
}

interface ForecastDay {
  date: string;
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

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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

function pct(num: number, denom: number): string {
  if (denom === 0) return '0%';
  return `${Math.round((num / denom) * 100)}%`;
}

// ---------------------------------------------------------------------------
// Section header component
// ---------------------------------------------------------------------------

function SectionHeader({
  icon_ios,
  icon_android,
  title,
  badge,
}: {
  icon_ios: string;
  icon_android: string;
  title: string;
  badge?: string | number;
}) {
  const badgeText = badge !== undefined ? String(badge) : undefined;
  return (
    <View style={styles.sectionHeader}>
      <IconSymbol
        ios_icon_name={icon_ios}
        android_material_icon_name={icon_android}
        size={18}
        color={colors.primary}
      />
      <Text style={styles.sectionTitle}>{title}</Text>
      {badgeText !== undefined && (
        <Text style={styles.sectionCount}>{badgeText}</Text>
      )}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Main screen
// ---------------------------------------------------------------------------

export default function AdminUsageScreen() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Section 1 — Summary cards
  const [statCards, setStatCards] = useState<StatCard[]>([]);

  // Section 2 — Hourly heatmap
  const [hourBuckets, setHourBuckets] = useState<HourBucket[]>([]);

  // Section 3 — Most watched videos
  const [videoStats, setVideoStats] = useState<VideoStat[]>([]);

  // Section 4 — Individual video watch events
  const [videoWatchEvents, setVideoWatchEvents] = useState<VideoWatchEvent[]>([]);

  // Section 5 — Notification stats
  const [notifStats, setNotifStats] = useState<{
    totalUsers: number;
    dailyReportOptIn: number;
    videoAlertsOptIn: number;
    swellAlertsOptIn: number;
    notificationOpens: number;
  } | null>(null);

  // Section 6 — Forecast usage (last 14 days)
  const [forecastDays, setForecastDays] = useState<ForecastDay[]>([]);

  // Section 7 — Per-user breakdown
  const [userStats, setUserStats] = useState<UserStat[]>([]);

  const fetchData = useCallback(async () => {
    console.log('[AdminUsage] Fetching full analytics data');
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
          .select('id, email, full_name, daily_report_notifications, video_notifications, min_wave_height'),
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
      for (const p of profiles) profileMap.set(p.id, p);

      // -----------------------------------------------------------------------
      // Section 1 — Summary cards
      // -----------------------------------------------------------------------
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

      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      const recentIdentities = new Set(
        events
          .filter(e => new Date(e.created_at) >= sevenDaysAgo)
          .map(e => e.user_id ?? (e.device_id ? `device:${e.device_id}` : null))
          .filter((id): id is string => id !== null)
      );
      const activeUsers = recentIdentities.size;

      const totalUsersCount = profiles.length;
      const dailyReportOptInCount = profiles.filter(p => p.daily_report_notifications === true).length;
      const notifOptInRate = totalUsersCount > 0
        ? `${Math.round((dailyReportOptInCount / totalUsersCount) * 100)}%`
        : '0%';

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
          label: 'Active Users (7d)',
          value: String(activeUsers),
          icon_ios: 'person.2.fill',
          icon_android: 'group',
          accent: '#EF4444',
        },
        {
          label: 'Videos Watched',
          value: String(totalVideos),
          icon_ios: 'play.rectangle.fill',
          icon_android: 'play_circle',
          accent: '#F59E0B',
        },
        {
          label: 'Notif Opt-in',
          value: notifOptInRate,
          icon_ios: 'bell.fill',
          icon_android: 'notifications',
          accent: '#8B5CF6',
        },
      ];
      setStatCards(cards);

      // -----------------------------------------------------------------------
      // Section 2 — Hourly heatmap (app_open events by hour of day)
      // -----------------------------------------------------------------------
      const hourCounts = new Array(24).fill(0) as number[];
      for (const e of appOpenEvents) {
        const hour = new Date(e.created_at).getHours();
        hourCounts[hour] += 1;
      }
      // Find top 3 peak hours
      const sortedHours = hourCounts
        .map((count, hour) => ({ hour, count }))
        .sort((a, b) => b.count - a.count);
      const peakHours = new Set(sortedHours.slice(0, 3).map(h => h.hour));

      const buckets: HourBucket[] = hourCounts.map((count, hour) => {
        const ampm = hour < 12 ? 'am' : 'pm';
        const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
        return {
          hour,
          label: `${displayHour}${ampm}`,
          count,
          isPeak: peakHours.has(hour),
        };
      });
      setHourBuckets(buckets);

      // -----------------------------------------------------------------------
      // Section 3 — Most watched videos (top 10)
      // -----------------------------------------------------------------------
      const videoMap = new Map<string, { count: number; totalSecs: number }>();
      for (const e of videoEvents) {
        const title = e.video_title || e.video_id || 'Unknown';
        const existing = videoMap.get(title) ?? { count: 0, totalSecs: 0 };
        existing.count += 1;
        const dur = Number(e.duration_seconds);
        if (!isNaN(dur) && dur > 0) existing.totalSecs += dur;
        videoMap.set(title, existing);
      }
      const videoStatsList: VideoStat[] = Array.from(videoMap.entries())
        .map(([title, data]) => ({
          title,
          watchCount: data.count,
          totalSeconds: data.totalSecs,
          avgSeconds: data.count > 0 ? data.totalSecs / data.count : 0,
        }))
        .sort((a, b) => b.watchCount - a.watchCount)
        .slice(0, 10);
      setVideoStats(videoStatsList);

      // -----------------------------------------------------------------------
      // Section 4 — Individual video watch events (sorted by created_at desc)
      // -----------------------------------------------------------------------
      const watchEventsList: VideoWatchEvent[] = videoEvents.slice(0, 50).map(e => {
        const profile = e.user_id ? profileMap.get(e.user_id) : null;
        const userName = profile?.full_name || profile?.email || (e.user_id ? `User ${e.user_id.slice(0, 8)}` : `Device ${(e.device_id ?? 'unknown').slice(0, 8)}`);
        return {
          videoTitle: e.video_title || e.video_id || 'Unknown',
          userName,
          durationSeconds: Number(e.duration_seconds) || 0,
          createdAt: e.created_at,
        };
      });
      setVideoWatchEvents(watchEventsList);

      // -----------------------------------------------------------------------
      // Section 5 — Notification stats
      // -----------------------------------------------------------------------
      const notifOpenCount = events.filter(e => e.event_type === 'notification_open').length;
      setNotifStats({
        totalUsers: totalUsersCount,
        dailyReportOptIn: dailyReportOptInCount,
        videoAlertsOptIn: profiles.filter(p => p.video_notifications === true).length,
        swellAlertsOptIn: profiles.filter(p => p.min_wave_height !== null && p.min_wave_height !== undefined).length,
        notificationOpens: notifOpenCount,
      });

      // -----------------------------------------------------------------------
      // Section 6 — Forecast usage (last 14 days)
      // -----------------------------------------------------------------------
      const forecastEvents = events.filter(e => e.event_type === 'forecast_view');
      const forecastDaysList: ForecastDay[] = [];
      for (let i = 0; i < 14; i++) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const dateStr = d.toISOString().slice(0, 10);
        const count = forecastEvents.filter(e => e.created_at.slice(0, 10) === dateStr).length;
        forecastDaysList.push({ date: formatShortDate(d.toISOString()), count });
      }
      setForecastDays(forecastDaysList);

      // -----------------------------------------------------------------------
      // Section 7 — Per-user breakdown
      // -----------------------------------------------------------------------
      const deviceToUserId = new Map<string, string>();
      for (const e of events) {
        if (e.device_id && e.user_id) deviceToUserId.set(e.device_id, e.user_id);
      }

      const userMap = new Map<string, {
        sessions: number;
        bgDurations: number[];
        videos: number;
        lastSeen: string;
      }>();

      for (const e of events) {
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

      console.log('[AdminUsage] Analytics computed — users:', userStatsList.length, 'video titles:', videoStatsList.length);
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

  const maxHourCount = hourBuckets.length > 0 ? Math.max(...hourBuckets.map(h => h.count), 1) : 1;

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
          {/* ---------------------------------------------------------------- */}
          {/* Section 1 — Summary Cards                                        */}
          {/* ---------------------------------------------------------------- */}
          <View style={styles.section}>
            <SectionHeader
              icon_ios="chart.bar.fill"
              icon_android="bar_chart"
              title="Summary"
            />
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

          {/* ---------------------------------------------------------------- */}
          {/* Section 2 — Peak Usage Heatmap                                   */}
          {/* ---------------------------------------------------------------- */}
          <View style={styles.section}>
            <SectionHeader
              icon_ios="clock.fill"
              icon_android="schedule"
              title="Peak Usage (by Hour)"
            />
            {hourBuckets.every(h => h.count === 0) ? (
              <View style={styles.emptyInline}>
                <Text style={styles.emptyText}>No session data yet</Text>
              </View>
            ) : (
              hourBuckets.map((bucket) => {
                const barFlex = bucket.count > 0 ? Math.max(bucket.count / maxHourCount, 0.02) : 0;
                const barColor = bucket.isPeak ? '#F59E0B' : colors.primary;
                return (
                  <View key={bucket.hour} style={styles.dayRow}>
                    <Text style={[styles.dayLabel, bucket.isPeak && styles.peakLabel]}>{bucket.label}</Text>
                    <View style={styles.dayBarTrack}>
                      <View style={[styles.dayBarFill, { flex: barFlex, backgroundColor: barColor }]} />
                      <View style={{ flex: 1 - barFlex }} />
                    </View>
                    <Text style={[styles.dayCount, bucket.isPeak && { color: '#F59E0B' }]}>{bucket.count}</Text>
                    {bucket.isPeak && (
                      <Text style={styles.peakBadge}>★</Text>
                    )}
                  </View>
                );
              })
            )}
          </View>

          {/* ---------------------------------------------------------------- */}
          {/* Section 3 — Most Watched Videos                                  */}
          {/* ---------------------------------------------------------------- */}
          <View style={styles.section}>
            <SectionHeader
              icon_ios="play.rectangle.fill"
              icon_android="play_circle"
              title="Most Watched Videos"
              badge={videoStats.length}
            />
            {videoStats.length === 0 ? (
              <View style={styles.emptyInline}>
                <Text style={styles.emptyText}>No video watch data yet</Text>
              </View>
            ) : (
              videoStats.map((v, i) => {
                const totalTimeText = v.totalSeconds > 0 ? formatDuration(v.totalSeconds) : '—';
                const avgTimeText = v.avgSeconds > 0 ? formatDuration(v.avgSeconds) : '—';
                return (
                  <View key={i} style={styles.videoCard}>
                    <View style={styles.videoCardTop}>
                      <View style={styles.videoRankCircle}>
                        <Text style={styles.videoRankText}>{i + 1}</Text>
                      </View>
                      <Text style={styles.videoTitle} numberOfLines={2}>{v.title}</Text>
                    </View>
                    <View style={styles.videoStatsRow}>
                      <View style={styles.videoStat}>
                        <Text style={styles.videoStatValue}>{v.watchCount}</Text>
                        <Text style={styles.videoStatLabel}>Views</Text>
                      </View>
                      <View style={styles.videoStatDivider} />
                      <View style={styles.videoStat}>
                        <Text style={styles.videoStatValue}>{totalTimeText}</Text>
                        <Text style={styles.videoStatLabel}>Total Time</Text>
                      </View>
                      <View style={styles.videoStatDivider} />
                      <View style={styles.videoStat}>
                        <Text style={styles.videoStatValue}>{avgTimeText}</Text>
                        <Text style={styles.videoStatLabel}>Avg/View</Text>
                      </View>
                    </View>
                  </View>
                );
              })
            )}
          </View>

          {/* ---------------------------------------------------------------- */}
          {/* Section 4 — Individual Video Watch Events                        */}
          {/* ---------------------------------------------------------------- */}
          <View style={styles.section}>
            <SectionHeader
              icon_ios="film.fill"
              icon_android="movie"
              title="Video Watch Log"
              badge={videoWatchEvents.length}
            />
            {videoWatchEvents.length === 0 ? (
              <View style={styles.emptyInline}>
                <Text style={styles.emptyText}>No video watch events yet</Text>
              </View>
            ) : (
              videoWatchEvents.map((e, i) => {
                const durText = e.durationSeconds > 0 ? formatDuration(e.durationSeconds) : '—';
                const dtText = formatDateTime(e.createdAt);
                return (
                  <View key={i} style={styles.watchEventRow}>
                    <View style={styles.watchEventLeft}>
                      <Text style={styles.watchEventTitle} numberOfLines={1}>{e.videoTitle}</Text>
                      <Text style={styles.watchEventUser} numberOfLines={1}>{e.userName}</Text>
                    </View>
                    <View style={styles.watchEventRight}>
                      <Text style={styles.watchEventDuration}>{durText}</Text>
                      <Text style={styles.watchEventDate}>{dtText}</Text>
                    </View>
                  </View>
                );
              })
            )}
          </View>

          {/* ---------------------------------------------------------------- */}
          {/* Section 5 — Notification Stats                                   */}
          {/* ---------------------------------------------------------------- */}
          <View style={styles.section}>
            <SectionHeader
              icon_ios="bell.fill"
              icon_android="notifications"
              title="Notification Stats"
            />
            {notifStats === null ? (
              <View style={styles.emptyInline}>
                <Text style={styles.emptyText}>No data</Text>
              </View>
            ) : (
              <>
                <View style={styles.notifRow}>
                  <Text style={styles.notifLabel}>Total Users</Text>
                  <Text style={styles.notifValue}>{notifStats.totalUsers}</Text>
                </View>
                <View style={styles.notifRow}>
                  <Text style={styles.notifLabel}>Daily Reports Opt-in</Text>
                  <View style={styles.notifValueRow}>
                    <Text style={styles.notifValue}>{notifStats.dailyReportOptIn}</Text>
                    <Text style={styles.notifPct}>{pct(notifStats.dailyReportOptIn, notifStats.totalUsers)}</Text>
                  </View>
                </View>
                <View style={styles.notifRow}>
                  <Text style={styles.notifLabel}>Video Alerts Opt-in</Text>
                  <View style={styles.notifValueRow}>
                    <Text style={styles.notifValue}>{notifStats.videoAlertsOptIn}</Text>
                    <Text style={styles.notifPct}>{pct(notifStats.videoAlertsOptIn, notifStats.totalUsers)}</Text>
                  </View>
                </View>
                <View style={styles.notifRow}>
                  <Text style={styles.notifLabel}>Swell Alerts Opt-in</Text>
                  <View style={styles.notifValueRow}>
                    <Text style={styles.notifValue}>{notifStats.swellAlertsOptIn}</Text>
                    <Text style={styles.notifPct}>{pct(notifStats.swellAlertsOptIn, notifStats.totalUsers)}</Text>
                  </View>
                </View>
                <View style={[styles.notifRow, styles.notifRowLast]}>
                  <Text style={styles.notifLabel}>Notification Opens</Text>
                  <Text style={[styles.notifValue, { color: colors.primary }]}>{notifStats.notificationOpens}</Text>
                </View>
              </>
            )}
          </View>

          {/* ---------------------------------------------------------------- */}
          {/* Section 6 — Forecast Usage (last 14 days)                        */}
          {/* ---------------------------------------------------------------- */}
          <View style={styles.section}>
            <SectionHeader
              icon_ios="calendar"
              icon_android="calendar_today"
              title="Forecast Views (Last 14 Days)"
            />
            {forecastDays.every(d => d.count === 0) ? (
              <View style={styles.emptyInline}>
                <Text style={styles.emptyText}>No forecast view data yet</Text>
              </View>
            ) : (
              forecastDays.map((day, i) => (
                <View key={i} style={styles.forecastRow}>
                  <Text style={styles.forecastDate}>{day.date}</Text>
                  <Text style={styles.forecastCount}>{day.count}</Text>
                  <Text style={styles.forecastUnit}>views</Text>
                </View>
              ))
            )}
          </View>

          {/* ---------------------------------------------------------------- */}
          {/* Section 7 — Per-User Breakdown                                   */}
          {/* ---------------------------------------------------------------- */}
          <View style={styles.section}>
            <SectionHeader
              icon_ios="person.3.fill"
              icon_android="group"
              title="Per-User Breakdown"
              badge={userStats.length}
            />
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
                const avatarLetter = (u.name[0] ?? '?').toUpperCase();
                return (
                  <View key={i} style={styles.userCard}>
                    <View style={styles.userCardTop}>
                      <View style={styles.userAvatarCircle}>
                        <Text style={styles.userAvatarLetter}>{avatarLetter}</Text>
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
  // Hourly heatmap / daily bars
  dayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
  },
  dayLabel: {
    fontSize: 12,
    color: '#9CA3AF',
    width: 40,
    textAlign: 'right',
  },
  peakLabel: {
    color: '#F59E0B',
    fontWeight: '700',
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
    borderRadius: 5,
  },
  dayCount: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
    width: 24,
    textAlign: 'right',
  },
  peakBadge: {
    fontSize: 10,
    color: '#F59E0B',
    width: 14,
  },
  // Video cards
  videoCard: {
    backgroundColor: '#1a1a1a',
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#2a2a2a',
  },
  videoCardTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 10,
  },
  videoRankCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.primary + '33',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  videoRankText: {
    fontSize: 13,
    fontWeight: 'bold',
    color: colors.primary,
  },
  videoTitle: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
    lineHeight: 20,
  },
  videoStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#111111',
    borderRadius: 8,
    paddingVertical: 8,
  },
  videoStat: {
    flex: 1,
    alignItems: 'center',
  },
  videoStatValue: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  videoStatLabel: {
    fontSize: 11,
    color: '#6B7280',
    marginTop: 2,
  },
  videoStatDivider: {
    width: 1,
    height: 24,
    backgroundColor: '#2a2a2a',
  },
  // Watch event log
  watchEventRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#1f1f1f',
    gap: 10,
  },
  watchEventLeft: {
    flex: 1,
  },
  watchEventTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  watchEventUser: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  watchEventRight: {
    alignItems: 'flex-end',
  },
  watchEventDuration: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.primary,
  },
  watchEventDate: {
    fontSize: 11,
    color: '#6B7280',
    marginTop: 2,
  },
  // Notification stats
  notifRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#1f1f1f',
  },
  notifRowLast: {
    borderBottomWidth: 0,
  },
  notifLabel: {
    fontSize: 14,
    color: '#9CA3AF',
    flex: 1,
  },
  notifValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  notifValue: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  notifPct: {
    fontSize: 13,
    color: '#6B7280',
    backgroundColor: '#1f1f1f',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  // Forecast rows
  forecastRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#1f1f1f',
    gap: 10,
  },
  forecastDate: {
    fontSize: 13,
    color: '#9CA3AF',
    width: 64,
  },
  forecastCount: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  forecastUnit: {
    fontSize: 12,
    color: '#6B7280',
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
