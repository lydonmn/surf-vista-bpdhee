
import React, { useEffect, useState, useMemo } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl } from "react-native";
import { useTheme } from "@react-navigation/native";
import { useAuth } from "@/contexts/AuthContext";
import { router } from "expo-router";
import { colors } from "@/styles/commonStyles";
import { IconSymbol } from "@/components/IconSymbol";
import { useSurfData } from "@/hooks/useSurfData";
import { ReportTextDisplay } from "@/components/ReportTextDisplay";
import { supabase } from "@/app/integrations/supabase/client";
import { Video } from "@/types";
import { Video as ExpoVideo, ResizeMode } from 'expo-av';

export default function ReportScreen() {
  const theme = useTheme();
  const { user, profile, checkSubscription, isLoading: authLoading, isInitialized } = useAuth();
  const isSubscribed = checkSubscription();
  const { surfReports, weatherData, tideData, isLoading, error, refreshData, updateAllData, lastUpdated } = useSurfData();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [latestVideo, setLatestVideo] = useState<Video | null>(null);
  const [isLoadingVideo, setIsLoadingVideo] = useState(false);
  const videoRef = React.useRef<ExpoVideo>(null);

  // Filter to show only today's report (EST timezone)
  const todaysReport = useMemo(() => {
    try {
      // Get current date in EST timezone
      const now = new Date();
      const estDateString = now.toLocaleString('en-US', { 
        timeZone: 'America/New_York',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      });
      
      // Parse the EST date string (format: MM/DD/YYYY)
      const [month, day, year] = estDateString.split(',')[0].split('/');
      const today = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
      
      console.log('Filtering reports for EST date:', today);
      return surfReports.filter(report => {
        if (!report.date) return false;
        return report.date === today;
      });
    } catch (error) {
      console.error('Error filtering reports:', error);
      return [];
    }
  }, [surfReports]);

  // Load latest video
  const loadLatestVideo = React.useCallback(async () => {
    try {
      setIsLoadingVideo(true);
      console.log('[ReportScreen] Fetching latest video...');
      
      const { data: videoData, error: videoError } = await supabase
        .from('videos')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (videoError) {
        console.log('[ReportScreen] Video fetch error:', videoError.message);
      } else if (videoData) {
        console.log('[ReportScreen] Video loaded:', videoData.title);
        setLatestVideo(videoData);
      } else {
        console.log('[ReportScreen] No videos found');
        setLatestVideo(null);
      }
    } catch (error) {
      console.error('[ReportScreen] Error loading video:', error);
    } finally {
      setIsLoadingVideo(false);
    }
  }, []);

  useEffect(() => {
    console.log('ReportScreen - Auth state:', {
      hasUser: !!user,
      hasProfile: !!profile,
      isSubscribed,
      authLoading,
      isInitialized,
      profileData: profile ? {
        is_admin: profile.is_admin,
        is_subscribed: profile.is_subscribed,
        subscription_end_date: profile.subscription_end_date
      } : null
    });
  }, [user, profile, isSubscribed, authLoading, isInitialized]);

  // Load video when user is subscribed
  useEffect(() => {
    if (isInitialized && !authLoading && user && profile && isSubscribed) {
      loadLatestVideo();
    }
  }, [isInitialized, authLoading, user, profile, isSubscribed, loadLatestVideo]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await Promise.all([refreshData(), loadLatestVideo()]);
    setIsRefreshing(false);
  };

  const handleUpdateData = async () => {
    setIsRefreshing(true);
    await updateAllData();
    setIsRefreshing(false);
  };

  const handleVideoPress = React.useCallback(() => {
    if (latestVideo) {
      console.log('[ReportScreen] Opening video player for:', latestVideo.id);
      router.push({
        pathname: '/video-player',
        params: { videoId: latestVideo.id }
      });
    }
  }, [latestVideo]);

  const handleVideoPlaybackStatusUpdate = React.useCallback((status: any) => {
    // Stop video after it finishes playing once
    if (status.didJustFinish) {
      console.log('[ReportScreen] Video finished playing');
      if (videoRef.current) {
        videoRef.current.setPositionAsync(0);
        videoRef.current.pauseAsync();
      }
    }
  }, []);

  const getSwellDirectionIcon = (direction: string | null) => {
    if (!direction) return { ios: 'arrow.up', android: 'north' };
    
    const upper = direction.toUpperCase().trim();
    
    // Handle cardinal and intercardinal directions
    if (upper === 'N' || upper === 'NORTH') {
      return { ios: 'arrow.up', android: 'north' };
    } else if (upper === 'NE' || upper === 'NORTHEAST' || upper.includes('NORTH') && upper.includes('EAST')) {
      return { ios: 'arrow.up.right', android: 'north_east' };
    } else if (upper === 'E' || upper === 'EAST') {
      return { ios: 'arrow.right', android: 'east' };
    } else if (upper === 'SE' || upper === 'SOUTHEAST' || upper.includes('SOUTH') && upper.includes('EAST')) {
      return { ios: 'arrow.down.right', android: 'south_east' };
    } else if (upper === 'S' || upper === 'SOUTH') {
      return { ios: 'arrow.down', android: 'south' };
    } else if (upper === 'SW' || upper === 'SOUTHWEST' || upper.includes('SOUTH') && upper.includes('WEST')) {
      return { ios: 'arrow.down.left', android: 'south_west' };
    } else if (upper === 'W' || upper === 'WEST') {
      return { ios: 'arrow.left', android: 'west' };
    } else if (upper === 'NW' || upper === 'NORTHWEST' || upper.includes('NORTH') && upper.includes('WEST')) {
      return { ios: 'arrow.up.left', android: 'north_west' };
    }
    
    // Handle degree-based directions (0-360)
    const degreeMatch = direction.match(/(\d+)/);
    if (degreeMatch) {
      const degrees = parseInt(degreeMatch[1]);
      if (degrees >= 0 && degrees <= 360) {
        if (degrees >= 337.5 || degrees < 22.5) {
          return { ios: 'arrow.up', android: 'north' };
        } else if (degrees >= 22.5 && degrees < 67.5) {
          return { ios: 'arrow.up.right', android: 'north_east' };
        } else if (degrees >= 67.5 && degrees < 112.5) {
          return { ios: 'arrow.right', android: 'east' };
        } else if (degrees >= 112.5 && degrees < 157.5) {
          return { ios: 'arrow.down.right', android: 'south_east' };
        } else if (degrees >= 157.5 && degrees < 202.5) {
          return { ios: 'arrow.down', android: 'south' };
        } else if (degrees >= 202.5 && degrees < 247.5) {
          return { ios: 'arrow.down.left', android: 'south_west' };
        } else if (degrees >= 247.5 && degrees < 292.5) {
          return { ios: 'arrow.left', android: 'west' };
        } else if (degrees >= 292.5 && degrees < 337.5) {
          return { ios: 'arrow.up.left', android: 'north_west' };
        }
      }
    }
    
    // Default to navigation icon if direction format is unknown
    return { ios: 'location.north.fill', android: 'navigation' };
  };

  const renderReportCard = (report: any, index: number) => {
    const swellIcon = getSwellDirectionIcon(report.swell_direction);
    const reportKey = report.id ? `report-${report.id}` : `report-index-${index}`;
    
    return (
      <View 
        key={reportKey}
        style={[styles.reportCard, { backgroundColor: theme.colors.card }]}
      >
        <View style={styles.reportHeader}>
          <Text style={[styles.reportDate, { color: theme.colors.text }]}>
            {new Date(report.date).toLocaleDateString('en-US', {
              weekday: 'long',
              month: 'long',
              day: 'numeric'
            })}
          </Text>
          <View style={[styles.ratingBadge, { backgroundColor: getRatingColor(report.rating || 5) }]}>
            <Text style={styles.ratingText}>{report.rating || 5}/10</Text>
          </View>
        </View>

        <View style={styles.conditionsGrid}>
          <View style={styles.conditionRow}>
            <View style={styles.conditionItem}>
              <IconSymbol
                ios_icon_name="water.waves"
                android_material_icon_name="waves"
                size={24}
                color={colors.primary}
              />
              <View style={styles.conditionTextContainer}>
                <Text style={[styles.conditionLabel, { color: colors.textSecondary }]}>
                  Wave Height
                </Text>
                <Text style={[styles.conditionValue, { color: colors.reportBoldText }]}>
                  {report.wave_height}
                </Text>
              </View>
            </View>

            <View style={styles.conditionItem}>
              <IconSymbol
                ios_icon_name="wind"
                android_material_icon_name="air"
                size={24}
                color={colors.primary}
              />
              <View style={styles.conditionTextContainer}>
                <Text style={[styles.conditionLabel, { color: colors.textSecondary }]}>
                  Wind Speed
                </Text>
                <Text style={[styles.conditionValue, { color: colors.reportBoldText }]}>
                  {report.wind_speed}
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.conditionRow}>
            <View style={styles.conditionItem}>
              <IconSymbol
                ios_icon_name="location.north.fill"
                android_material_icon_name="navigation"
                size={24}
                color={colors.primary}
              />
              <View style={styles.conditionTextContainer}>
                <Text style={[styles.conditionLabel, { color: colors.textSecondary }]}>
                  Wind Direction
                </Text>
                <Text style={[styles.conditionValue, { color: colors.reportBoldText }]}>
                  {report.wind_direction}
                </Text>
              </View>
            </View>

            <View style={styles.conditionItem}>
              <IconSymbol
                ios_icon_name="thermometer"
                android_material_icon_name="thermostat"
                size={24}
                color={colors.primary}
              />
              <View style={styles.conditionTextContainer}>
                <Text style={[styles.conditionLabel, { color: colors.textSecondary }]}>
                  Water Temp
                </Text>
                <Text style={[styles.conditionValue, { color: colors.reportBoldText }]}>
                  {report.water_temp}
                </Text>
              </View>
            </View>
          </View>

          {(report.wave_period || report.swell_direction) && (
            <View style={styles.conditionRow}>
              {report.wave_period && (
                <View style={styles.conditionItem}>
                  <IconSymbol
                    ios_icon_name="timer"
                    android_material_icon_name="schedule"
                    size={24}
                    color={colors.primary}
                  />
                  <View style={styles.conditionTextContainer}>
                    <Text style={[styles.conditionLabel, { color: colors.textSecondary }]}>
                      Wave Period
                    </Text>
                    <Text style={[styles.conditionValue, { color: colors.reportBoldText }]}>
                      {report.wave_period}
                    </Text>
                  </View>
                </View>
              )}

              {report.swell_direction && (
                <View style={styles.conditionItem}>
                  <IconSymbol
                    ios_icon_name={swellIcon.ios}
                    android_material_icon_name={swellIcon.android}
                    size={24}
                    color={colors.primary}
                  />
                  <View style={styles.conditionTextContainer}>
                    <Text style={[styles.conditionLabel, { color: colors.textSecondary }]}>
                      Swell Direction
                    </Text>
                    <Text style={[styles.conditionValue, { color: colors.reportBoldText }]}>
                      {report.swell_direction}
                    </Text>
                  </View>
                </View>
              )}
            </View>
          )}

          <View style={styles.tideContainer}>
            <View style={styles.conditionTextContainer}>
              <Text style={[styles.conditionLabel, { color: colors.textSecondary }]}>
                Tide
              </Text>
              <Text style={[styles.conditionValue, { color: colors.reportBoldText }]}>
                {report.tide}
              </Text>
            </View>
          </View>
        </View>

        <View style={[styles.conditionsBox, { backgroundColor: colors.reportBackground }]}>
          <View style={styles.conditionsHeader}>
            <Text style={[styles.conditionsTitle, { color: colors.reportBoldText }]}>
              Surf Conditions
            </Text>
            {profile?.is_admin && (
              <TouchableOpacity
                style={styles.editButton}
                onPress={() => router.push(`/edit-report?id=${report.id}`)}
              >
                <IconSymbol
                  ios_icon_name="pencil"
                  android_material_icon_name="edit"
                  size={16}
                  color={colors.primary}
                />
                <Text style={[styles.editButtonText, { color: colors.primary }]}>
                  Edit
                </Text>
              </TouchableOpacity>
            )}
          </View>
          <ReportTextDisplay 
            text={report.report_text || report.conditions}
            isCustom={!!report.report_text}
          />
          {report.report_text && report.edited_at && (
            <Text style={[styles.editedNote, { color: colors.textSecondary }]}>
              Edited {new Date(report.edited_at).toLocaleDateString()}
            </Text>
          )}
        </View>
      </View>
    );
  };

  // Show loading state while auth is initializing or profile is being loaded
  if (!isInitialized || authLoading) {
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
    console.log('ReportScreen - Showing locked content');
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
            Subscribe to access detailed surf reports with live NOAA weather data, tide schedules, and surf conditions
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

  console.log('ReportScreen - Showing surf reports');
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
      <View style={styles.header}>
        <Text style={[styles.headerTitle, { color: theme.colors.text }]}>
          Today&apos;s Surf Report
        </Text>
        <Text style={[styles.headerSubtitle, { color: colors.textSecondary }]}>
          Folly Beach, South Carolina
        </Text>
        {lastUpdated && (
          <Text style={[styles.lastUpdated, { color: colors.textSecondary }]}>
            Last updated: {lastUpdated.toLocaleTimeString()}
          </Text>
        )}
      </View>

      {profile?.is_admin && (
        <TouchableOpacity
          style={[styles.updateButton, { backgroundColor: colors.primary }]}
          onPress={handleUpdateData}
          disabled={isRefreshing}
        >
          <IconSymbol
            ios_icon_name="arrow.clockwise"
            android_material_icon_name="refresh"
            size={20}
            color="#FFFFFF"
          />
          <Text style={styles.updateButtonText}>
            Update All Data from NOAA
          </Text>
        </TouchableOpacity>
      )}

      {error && (
        <View style={[styles.errorCard, { backgroundColor: colors.errorBackground }]}>
          <IconSymbol
            ios_icon_name="exclamationmark.triangle.fill"
            android_material_icon_name="warning"
            size={24}
            color="#FFFFFF"
          />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {isLoading && !isRefreshing ? (
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
            Loading surf reports...
          </Text>
        </View>
      ) : todaysReport.length === 0 ? (
        <View style={[styles.emptyCard, { backgroundColor: theme.colors.card }]}>
          <IconSymbol
            ios_icon_name="water.waves"
            android_material_icon_name="waves"
            size={48}
            color={colors.textSecondary}
          />
          <Text style={[styles.emptyTitle, { color: theme.colors.text }]}>
            No Report Available Today
          </Text>
          <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
            Today&apos;s surf report will be generated automatically from NOAA data.
          </Text>
          {profile?.is_admin && (
            <TouchableOpacity
              style={[styles.generateButton, { backgroundColor: colors.accent }]}
              onPress={handleUpdateData}
            >
              <Text style={styles.generateButtonText}>
                Generate Today&apos;s Report
              </Text>
            </TouchableOpacity>
          )}
        </View>
      ) : (
        todaysReport.map((report, index) => renderReportCard(report, index))
      )}

      {/* Latest Drone Video Section */}
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
              <ExpoVideo
                ref={videoRef}
                source={{ uri: latestVideo.video_url }}
                style={styles.videoPreview}
                resizeMode={ResizeMode.COVER}
                shouldPlay={true}
                isLooping={false}
                isMuted={true}
                onPlaybackStatusUpdate={handleVideoPlaybackStatusUpdate}
              />
              <View style={styles.videoOverlay}>
                <IconSymbol
                  ios_icon_name="play.circle.fill"
                  android_material_icon_name="play_circle"
                  size={64}
                  color="rgba(255, 255, 255, 0.9)"
                />
              </View>
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
              No videos available yet
            </Text>
          </View>
        )}
      </View>

      <View style={[styles.infoCard, { backgroundColor: theme.colors.card }]}>
        <IconSymbol
          ios_icon_name="info.circle.fill"
          android_material_icon_name="info"
          size={24}
          color={colors.primary}
        />
        <View style={styles.infoTextContainer}>
          <Text style={[styles.infoText, { color: colors.textSecondary }]}>
            Reports are automatically generated from NOAA weather data, buoy readings, and tide schedules for Folly Beach, SC.
          </Text>
          <Text style={[styles.infoSubtext, { color: colors.textSecondary }]}>
            Data sources: NOAA Weather Service, NOAA Buoy 41004, NOAA Tides & Currents
          </Text>
          <Text style={[styles.infoSubtext, { color: colors.textSecondary, marginTop: 8 }]}>
            Previous day&apos;s reports are automatically removed after midnight EST.
          </Text>
        </View>
      </View>
    </ScrollView>
  );
}

function getRatingColor(rating: number): string {
  if (rating >= 8) return '#22C55E'; // Vibrant Green
  if (rating >= 6) return '#FFC107'; // Bright Yellow
  if (rating >= 4) return '#FF9800'; // Warm Orange
  return '#F44336'; // Bold Red
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: 48,
    paddingHorizontal: 16,
    paddingBottom: 100,
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
  header: {
    marginBottom: 24,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 16,
    marginBottom: 4,
  },
  lastUpdated: {
    fontSize: 12,
    fontStyle: 'italic',
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
  updateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    marginBottom: 16,
    gap: 8,
  },
  updateButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  errorCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    gap: 12,
  },
  errorText: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  emptyCard: {
    alignItems: 'center',
    padding: 32,
    borderRadius: 12,
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
  generateButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 8,
  },
  generateButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  reportCard: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    boxShadow: '0px 2px 8px rgba(0, 0, 0, 0.1)',
    elevation: 3,
  },
  reportHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  reportDate: {
    fontSize: 18,
    fontWeight: 'bold',
    flex: 1,
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
  conditionsGrid: {
    marginBottom: 16,
  },
  conditionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  conditionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
  },
  conditionTextContainer: {
    flex: 1,
  },
  conditionLabel: {
    fontSize: 12,
    marginBottom: 2,
  },
  conditionValue: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  tideContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  conditionsBox: {
    padding: 16,
    borderRadius: 8,
  },
  conditionsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  conditionsTitle: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  editButtonText: {
    fontSize: 12,
    fontWeight: '600',
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
  videoSection: {
    borderRadius: 12,
    padding: 16,
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
  },
  videoPreview: {
    width: '100%',
    height: '100%',
  },
  videoOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
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
  infoCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 16,
    borderRadius: 12,
    gap: 12,
    boxShadow: '0px 2px 8px rgba(0, 0, 0, 0.1)',
    elevation: 3,
  },
  infoTextContainer: {
    flex: 1,
  },
  infoText: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 8,
  },
  infoSubtext: {
    fontSize: 12,
    lineHeight: 18,
    fontStyle: 'italic',
  },
});
