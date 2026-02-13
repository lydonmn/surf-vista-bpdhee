
import { useEffect, useState, useCallback, useMemo } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl } from "react-native";
import { useTheme } from "@react-navigation/native";
import { useAuth } from "@/contexts/AuthContext";
import { router, useFocusEffect } from "expo-router";
import { colors } from "@/styles/commonStyles";
import { IconSymbol } from "@/components/IconSymbol";
import { useSurfData } from "@/hooks/useSurfData";
import { ReportTextDisplay } from "@/components/ReportTextDisplay";
import { supabase } from "@/app/integrations/supabase/client";
import { Video } from "@/types";
import { VideoView, useVideoPlayer } from 'expo-video';
import { formatWaterTemp, getESTDate } from "@/utils/surfDataFormatter";
import { useLocation } from "@/contexts/LocationContext";
import { selectNarrativeText, isCustomNarrative } from "@/utils/reportNarrativeSelector";
import { CurrentConditions } from "@/components/CurrentConditions";
import { LocationSelector } from "@/components/LocationSelector";

export default function HomeScreen() {
  const theme = useTheme();
  const { user, profile, checkSubscription, isLoading, isInitialized } = useAuth();
  const isSubscribed = checkSubscription();
  const { currentLocation, locationData } = useLocation();
  const { surfReports, weatherData, isLoading: surfLoading, error, refreshData } = useSurfData();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [latestVideo, setLatestVideo] = useState<Video | null>(null);
  const [isLoadingVideo, setIsLoadingVideo] = useState(false);
  const [videoReady, setVideoReady] = useState(false);

  const videoPlayer = useVideoPlayer(latestVideo?.video_url || '', (player) => {
    if (latestVideo?.video_url) {
      console.log('[HomeScreen] Initializing video preview player with caching');
      player.loop = true;
      player.muted = true;
      player.volume = 0;
      console.log('[HomeScreen] ✅ Video preview caching: ENABLED');
    }
  });

  const todayDate = useMemo(() => getESTDate(), []);

  const locationSurfReports = useMemo(() => {
    const filtered = surfReports.filter(report => report.location === currentLocation);
    console.log('[HomeScreen] Filtered reports for location:', currentLocation, 'count:', filtered.length);
    return filtered;
  }, [surfReports, currentLocation]);

  const todaysReport = useMemo(() => {
    try {
      console.log('[HomeScreen] ===== FINDING TODAY\'S REPORT =====');
      console.log('[HomeScreen] Current EST date:', todayDate);
      console.log('[HomeScreen] Current location:', currentLocation, locationData.displayName);
      console.log('[HomeScreen] Total reports for this location:', locationSurfReports.length);
      
      const todayReports = locationSurfReports.filter(report => {
        if (!report.date) return false;
        const reportDate = report.date.split('T')[0];
        const isToday = reportDate === todayDate;
        console.log('[HomeScreen] Checking report:', reportDate, 'vs today:', todayDate, '=', isToday);
        return isToday;
      });
      
      console.log('[HomeScreen] Found', todayReports.length, 'reports for today at', locationData.displayName);
      
      if (todayReports.length > 0) {
        const report = todayReports[0];
        console.log('[HomeScreen] ===== USING TODAY\'S REPORT =====');
        console.log('[HomeScreen] Report ID:', report.id);
        console.log('[HomeScreen] Report date:', report.date);
        console.log('[HomeScreen] Report location:', report.location);
        console.log('[HomeScreen] Has report_text (edited):', !!report.report_text);
        console.log('[HomeScreen] Has conditions (auto):', !!report.conditions);
        console.log('[HomeScreen] report_text length:', report.report_text?.length || 0);
        console.log('[HomeScreen] conditions length:', report.conditions?.length || 0);
        return report;
      } else {
        console.log('[HomeScreen] ❌ No report found for today at', locationData.displayName);
        return null;
      }
    } catch (error) {
      console.error('[HomeScreen] Error filtering reports:', error);
      return null;
    }
  }, [locationSurfReports, todayDate, currentLocation, locationData.displayName]);

  const loadLatestVideo = useCallback(async () => {
    try {
      setIsLoadingVideo(true);
      setVideoReady(false);
      console.log('[HomeScreen] Fetching latest video for location:', currentLocation, locationData.displayName);
      
      const { data: videoData, error: videoError } = await supabase
        .from('videos')
        .select('*')
        .eq('location', currentLocation)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (videoError) {
        console.log('[HomeScreen] Video fetch error:', videoError.message);
      } else if (videoData) {
        console.log('[HomeScreen] Video loaded:', videoData.title, 'for location:', videoData.location, locationData.displayName);
        setLatestVideo(videoData);
      } else {
        console.log('[HomeScreen] No videos found for location:', currentLocation, locationData.displayName);
        setLatestVideo(null);
      }
    } catch (error) {
      console.error('[HomeScreen] Error loading video:', error);
    } finally {
      setIsLoadingVideo(false);
    }
  }, [currentLocation, locationData.displayName]);

  useFocusEffect(
    useCallback(() => {
      console.log('[HomeScreen] Screen focused - refreshing data for', locationData.displayName);
      if (isInitialized && !isLoading && user && profile && isSubscribed) {
        refreshData();
        loadLatestVideo();
      }
    }, [isInitialized, isLoading, user, profile, isSubscribed, refreshData, loadLatestVideo, locationData.displayName])
  );

  useEffect(() => {
    if (isInitialized && !isLoading && user && profile && isSubscribed) {
      console.log('[HomeScreen] Loading data for location:', currentLocation, locationData.displayName);
      loadLatestVideo();
    }
  }, [isInitialized, isLoading, user, profile, isSubscribed, loadLatestVideo, currentLocation, locationData.displayName]);

  useEffect(() => {
    if (latestVideo?.video_url && videoPlayer) {
      console.log('[HomeScreen] Loading video preview with caching enabled');
      videoPlayer.replace(latestVideo.video_url);
      videoPlayer.play();
      setVideoReady(true);
    }
  }, [latestVideo?.video_url, videoPlayer]);

  const handleRefresh = async () => {
    console.log('[HomeScreen] User initiated refresh for location:', currentLocation, locationData.displayName);
    setIsRefreshing(true);
    await Promise.all([refreshData(), loadLatestVideo()]);
    setIsRefreshing(false);
  };

  const handleVideoPress = useCallback(() => {
    if (latestVideo) {
      console.log('[HomeScreen] Opening fullscreen video player for:', latestVideo.id);
      console.log('[HomeScreen] ✅ Passing preloaded URL for instant playback');
      
      const params: any = { videoId: latestVideo.id };
      if (latestVideo.video_url) {
        params.preloadedUrl = latestVideo.video_url;
      }
      
      router.push({
        pathname: '/video-player',
        params
      });
    }
  }, [latestVideo]);

  if (!isInitialized || isLoading) {
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
            Loading your profile...
          </Text>
        </View>
      </View>
    );
  }

  if (!user || !isSubscribed) {
    console.log('[HomeScreen] Showing locked content');
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <View style={styles.centerContent}>
          <IconSymbol
            ios_icon_name="lock.fill"
            android_material_icon_name="lock"
            size={64}
            color={colors.textSecondary}
          />
          <Text style={[styles.title, { color: theme.colors.text }]}>
            Subscriber Only Content
          </Text>
          <Text style={[styles.text, { color: colors.textSecondary }]}>
            Subscribe to access exclusive 6K drone footage and detailed surf reports
          </Text>
          {user && (
            <Text style={[styles.debugText, { color: colors.textSecondary }]}>
              You are signed in but not subscribed
            </Text>
          )}
          <TouchableOpacity
            style={[styles.subscribeButton, { backgroundColor: colors.accent }]}
            onPress={() => router.push('/login')}
          >
            <Text style={styles.subscribeButtonText}>
              {user ? 'Subscribe Now' : 'Sign In / Subscribe'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  console.log('[HomeScreen] Showing content for', locationData.displayName);

  const narrativeText = todaysReport ? selectNarrativeText(todaysReport) : null;
  const isCustomReport = todaysReport ? isCustomNarrative(todaysReport) : false;

  console.log('[HomeScreen] ===== NARRATIVE DISPLAY =====');
  console.log('[HomeScreen] Location:', locationData.displayName);
  console.log('[HomeScreen] Report location:', todaysReport?.location);
  console.log('[HomeScreen] Narrative length:', narrativeText?.length || 0);
  console.log('[HomeScreen] Is custom (edited):', isCustomReport);
  console.log('[HomeScreen] Source:', isCustomReport ? 'report_text (edited)' : 'conditions (auto)');

  return (
    <ScrollView 
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      contentContainerStyle={styles.scrollContent}
      refreshControl={
        <RefreshControl
          refreshing={isRefreshing}
          onRefresh={handleRefresh}
          tintColor={colors.primary}
        />
      }
    >
      <View style={styles.headerSection}>
        <Text style={[styles.headerTitle, { color: theme.colors.text }]}>
          Today&apos;s Surf Report
        </Text>
        <LocationSelector />
      </View>

      <CurrentConditions weather={weatherData} surfReport={todaysReport} />

      {error && (
        <View style={[styles.errorCard, { backgroundColor: colors.errorBackground }]}>
          <IconSymbol
            ios_icon_name="exclamationmark.triangle.fill"
            android_material_icon_name="warning"
            size={24}
            color="#FFFFFF"
          />
          <View style={styles.errorTextContainer}>
            <Text style={styles.errorText}>Unable to fetch surf data</Text>
            <Text style={styles.errorSubtext}>
              {error}
            </Text>
          </View>
        </View>
      )}

      {surfLoading && !isRefreshing ? (
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
            Loading surf reports for {locationData.displayName}...
          </Text>
        </View>
      ) : !todaysReport ? (
        <View style={[styles.emptyCard, { backgroundColor: theme.colors.card }]}>
          <IconSymbol
            ios_icon_name="water.waves"
            android_material_icon_name="waves"
            size={48}
            color={colors.textSecondary}
          />
          <Text style={[styles.emptyTitle, { color: theme.colors.text }]}>
            No Report Available
          </Text>
          <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
            Surf reports for {locationData.displayName} will be generated automatically from NOAA data.
          </Text>
        </View>
      ) : (
        <View style={[styles.reportCard, { backgroundColor: theme.colors.card }]}>
          <View style={styles.reportHeader}>
            <View style={styles.reportHeaderLeft}>
              <Text style={[styles.reportDate, { color: theme.colors.text }]}>
                {new Date(todaysReport.date).toLocaleDateString('en-US', {
                  weekday: 'long',
                  month: 'long',
                  day: 'numeric'
                })}
              </Text>
              <Text style={[styles.reportSubtitle, { color: colors.textSecondary }]}>
                {locationData.displayName}
              </Text>
            </View>
            <View style={[styles.ratingBadge, { backgroundColor: getRatingColor(todaysReport.rating ?? 5) }]}>
              <Text style={styles.ratingText}>{todaysReport.rating ?? 5}/10</Text>
            </View>
          </View>

          <View style={[styles.conditionsBox, { backgroundColor: colors.reportBackground }]}>
            <Text style={[styles.conditionsTitle, { color: colors.reportText }]}>
              Surf Conditions
            </Text>
            {narrativeText ? (
              <>
                <ReportTextDisplay 
                  text={narrativeText}
                  isCustom={isCustomReport}
                />
                {todaysReport.report_text && todaysReport.edited_at && (
                  <Text style={[styles.editedNote, { color: colors.textSecondary }]}>
                    Edited {new Date(todaysReport.edited_at).toLocaleDateString()}
                  </Text>
                )}
              </>
            ) : (
              <Text style={[styles.conditionsText, { color: colors.reportText }]}>
                No surf conditions narrative available for {locationData.displayName}.
              </Text>
            )}
          </View>

          <View style={styles.quickStats}>
            <View style={styles.statItem}>
              <IconSymbol
                ios_icon_name="water.waves"
                android_material_icon_name="waves"
                size={20}
                color={colors.primary}
              />
              <View style={styles.statTextContainer}>
                <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
                  Wave Height
                </Text>
                <Text style={[styles.statValue, { color: theme.colors.text }]}>
                  {todaysReport.wave_height || 'N/A'}
                </Text>
              </View>
            </View>

            <View style={styles.statItem}>
              <IconSymbol
                ios_icon_name="wind"
                android_material_icon_name="air"
                size={20}
                color={colors.primary}
              />
              <View style={styles.statTextContainer}>
                <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
                  Wind
                </Text>
                <Text style={[styles.statValue, { color: theme.colors.text }]}>
                  {todaysReport.wind_speed} {todaysReport.wind_direction}
                </Text>
              </View>
            </View>

            <View style={styles.statItem}>
              <IconSymbol
                ios_icon_name="thermometer"
                android_material_icon_name="thermostat"
                size={20}
                color={colors.primary}
              />
              <View style={styles.statTextContainer}>
                <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
                  Water Temp
                </Text>
                <Text style={[styles.statValue, { color: theme.colors.text }]}>
                  {formatWaterTemp(todaysReport.water_temp)}
                </Text>
              </View>
            </View>
          </View>

          <TouchableOpacity
            style={[styles.detailsButton, { backgroundColor: colors.primary }]}
            onPress={() => router.push('/(tabs)/report')}
          >
            <Text style={styles.detailsButtonText}>View Full Report</Text>
            <IconSymbol
              ios_icon_name="chevron.right"
              android_material_icon_name="chevron-right"
              size={20}
              color="#FFFFFF"
            />
          </TouchableOpacity>
        </View>
      )}

      <View style={[styles.videoSection, { backgroundColor: theme.colors.card }]}>
        <View style={styles.sectionHeader}>
          <IconSymbol
            ios_icon_name="video.fill"
            android_material_icon_name="videocam"
            size={24}
            color={colors.primary}
          />
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
            Latest Drone Footage
          </Text>
        </View>

        {isLoadingVideo ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="small" color={colors.primary} />
          </View>
        ) : latestVideo ? (
          <TouchableOpacity
            style={styles.videoCard}
            onPress={handleVideoPress}
            activeOpacity={0.7}
          >
            <View style={styles.videoPreviewContainer}>
              {!videoReady && (
                <View style={styles.videoLoadingOverlay}>
                  <ActivityIndicator size="large" color={colors.primary} />
                </View>
              )}
              <VideoView
                style={[styles.videoPreview, !videoReady && styles.videoHidden]}
                player={videoPlayer}
                allowsFullscreen={false}
                allowsPictureInPicture={false}
                contentFit="cover"
                nativeControls={false}
              />
              {videoReady && (
                <View style={styles.videoOverlay}>
                  <View style={styles.playButtonContainer}>
                    <IconSymbol
                      ios_icon_name="play.circle.fill"
                      android_material_icon_name="play-circle"
                      size={64}
                      color="rgba(255, 255, 255, 0.9)"
                    />
                    <Text style={styles.tapToPlayText}>Tap to play fullscreen</Text>
                  </View>
                </View>
              )}
            </View>
            <View style={styles.videoInfo}>
              <Text style={[styles.videoTitle, { color: theme.colors.text }]}>
                {latestVideo.title}
              </Text>
              {latestVideo.description && (
                <Text style={[styles.videoDescription, { color: colors.textSecondary }]} numberOfLines={2}>
                  {latestVideo.description}
                </Text>
              )}
              <Text style={[styles.videoDate, { color: colors.textSecondary }]}>
                {new Date(latestVideo.created_at).toLocaleDateString()}
              </Text>
            </View>
          </TouchableOpacity>
        ) : (
          <View style={styles.emptyState}>
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
              No videos available yet for {locationData.displayName}
            </Text>
          </View>
        )}
      </View>
    </ScrollView>
  );
}

function getRatingColor(rating: number): string {
  if (rating >= 8) return '#22C55E';
  if (rating >= 6) return '#FFC107';
  if (rating >= 4) return '#FF9800';
  return '#F44336';
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: 48,
    paddingBottom: 100,
  },
  headerSection: {
    paddingHorizontal: 16,
    marginBottom: 16,
    gap: 12,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingVertical: 48,
  },
  loadingText: {
    fontSize: 16,
    marginTop: 16,
  },
  loadingContainer: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginTop: 16,
    marginBottom: 8,
  },
  text: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 24,
  },
  debugText: {
    fontSize: 12,
    textAlign: 'center',
    marginBottom: 16,
    fontStyle: 'italic',
  },
  subscribeButton: {
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 12,
  },
  subscribeButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
  errorCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 16,
    borderRadius: 12,
    marginHorizontal: 16,
    marginBottom: 16,
    gap: 12,
  },
  errorTextContainer: {
    flex: 1,
  },
  errorText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  errorSubtext: {
    color: '#FFFFFF',
    fontSize: 12,
    lineHeight: 18,
    opacity: 0.9,
  },
  emptyCard: {
    alignItems: 'center',
    padding: 32,
    borderRadius: 12,
    marginHorizontal: 16,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 16,
  },
  emptyState: {
    paddingVertical: 32,
    alignItems: 'center',
  },
  reportCard: {
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 16,
    boxShadow: '0px 2px 8px rgba(0, 0, 0, 0.1)',
    elevation: 3,
  },
  reportHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  reportHeaderLeft: {
    flex: 1,
    gap: 4,
  },
  reportDate: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  reportSubtitle: {
    fontSize: 14,
    fontWeight: '600',
    marginTop: 2,
  },
  ratingBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  ratingText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  conditionsBox: {
    padding: 16,
    borderRadius: 8,
    marginBottom: 16,
  },
  conditionsTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  conditionsText: {
    fontSize: 14,
    lineHeight: 20,
  },
  editedNote: {
    fontSize: 11,
    fontStyle: 'italic',
    marginTop: 8,
  },
  quickStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  statTextContainer: {
    flex: 1,
  },
  statLabel: {
    fontSize: 11,
    marginBottom: 2,
  },
  statValue: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  detailsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 8,
    gap: 8,
  },
  detailsButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  videoSection: {
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 16,
    boxShadow: '0px 2px 8px rgba(0, 0, 0, 0.1)',
    elevation: 3,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  videoCard: {
    gap: 12,
  },
  videoPreviewContainer: {
    width: '100%',
    height: 200,
    borderRadius: 8,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: '#000000',
  },
  videoPreview: {
    width: '100%',
    height: '100%',
  },
  videoHidden: {
    opacity: 0,
  },
  videoLoadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000000',
    zIndex: 10,
  },
  videoOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
  },
  playButtonContainer: {
    alignItems: 'center',
    gap: 8,
  },
  tapToPlayText: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: 14,
    fontWeight: '600',
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  videoInfo: {
    gap: 4,
  },
  videoTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  videoDescription: {
    fontSize: 14,
    lineHeight: 20,
  },
  videoDate: {
    fontSize: 12,
  },
});
