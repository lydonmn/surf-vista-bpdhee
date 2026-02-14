
import { useEffect, useState, useCallback, useMemo, useRef } from "react";
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
import { formatWaterTemp, getESTDate, getESTDateOffset } from "@/utils/surfDataFormatter";
import { useLocation } from "@/contexts/LocationContext";
import { selectNarrativeText, isCustomNarrative } from "@/utils/reportNarrativeSelector";
import { LocationSelector } from "@/components/LocationSelector";
import { openPaywall } from "@/utils/paywallHelper";

export default function HomeScreen() {
  const theme = useTheme();
  const { user, profile, checkSubscription, isLoading, isInitialized, refreshProfile } = useAuth();
  const isSubscribed = checkSubscription();
  const { currentLocation, locationData } = useLocation();
  const { surfReports, surfConditions, weatherData, weatherForecast, isLoading: surfLoading, error, refreshData } = useSurfData();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [latestVideo, setLatestVideo] = useState<Video | null>(null);
  const [isLoadingVideo, setIsLoadingVideo] = useState(false);
  const [videoReady, setVideoReady] = useState(false);
  const hasLoadedVideoRef = useRef(false);
  const [isSubscribing, setIsSubscribing] = useState(false);
  
  // ✅ FIX: Track if we've loaded data to prevent reload on every focus
  const hasLoadedDataRef = useRef(false);

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
        console.log('[HomeScreen] wave_height:', report.wave_height);
        console.log('[HomeScreen] surf_height:', (report as any).surf_height);
        console.log('[HomeScreen] wind_speed:', report.wind_speed);
        console.log('[HomeScreen] wind_direction:', report.wind_direction);
        console.log('[HomeScreen] Has report_text (edited):', !!report.report_text);
        console.log('[HomeScreen] Has conditions (auto):', !!report.conditions);
        return report;
      } else {
        console.log('[HomeScreen] No report for today, checking for most recent report...');
        
        const sortedReports = [...locationSurfReports].sort((a, b) => {
          const dateA = new Date(a.date).getTime();
          const dateB = new Date(b.date).getTime();
          return dateB - dateA;
        });
        
        if (sortedReports.length > 0) {
          const mostRecentReport = sortedReports[0];
          console.log('[HomeScreen] ===== USING MOST RECENT REPORT =====');
          console.log('[HomeScreen] Report ID:', mostRecentReport.id);
          console.log('[HomeScreen] Report date:', mostRecentReport.date);
          console.log('[HomeScreen] Report location:', mostRecentReport.location);
          console.log('[HomeScreen] wave_height:', mostRecentReport.wave_height);
          console.log('[HomeScreen] surf_height:', (mostRecentReport as any).surf_height);
          return mostRecentReport;
        }
        
        console.log('[HomeScreen] ❌ No reports found at all for', locationData.displayName);
        return null;
      }
    } catch (error) {
      console.error('[HomeScreen] Error filtering reports:', error);
      return null;
    }
  }, [locationSurfReports, todayDate, currentLocation, locationData.displayName]);

  const locationWeatherForecast = useMemo(() => {
    const filtered = weatherForecast.filter(forecast => forecast.location === currentLocation);
    console.log('[HomeScreen] Filtered weather forecast for location:', currentLocation, 'count:', filtered.length);
    return filtered;
  }, [weatherForecast, currentLocation]);

  const videoPlayer = useVideoPlayer(latestVideo?.video_url || '', (player) => {
    if (latestVideo?.video_url) {
      console.log('[HomeScreen] Initializing video preview player with caching');
      player.loop = true;
      player.muted = true;
      player.volume = 0;
      console.log('[HomeScreen] ✅ Video preview caching: ENABLED');
    }
  });

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
        hasLoadedVideoRef.current = true;
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

  // ✅ FIX: Handle screen focus/blur to prevent data reload loop
  useFocusEffect(
    useCallback(() => {
      console.log('[HomeScreen] Screen focused');
      
      // Resume video playback if we have a video loaded
      if (latestVideo?.video_url && videoPlayer && videoReady) {
        console.log('[HomeScreen] Resuming video preview playback');
        videoPlayer.play();
      }
      
      // Only load data if we haven't loaded it yet
      if (isInitialized && !isLoading && user && profile && isSubscribed) {
        if (!hasLoadedDataRef.current) {
          console.log('[HomeScreen] First load - fetching data');
          refreshData();
          hasLoadedDataRef.current = true;
        } else {
          console.log('[HomeScreen] Data already loaded, skipping refresh');
        }
        
        if (!hasLoadedVideoRef.current) {
          console.log('[HomeScreen] First load - fetching video');
          loadLatestVideo();
        }
      }

      // Cleanup: Pause video when screen loses focus
      return () => {
        console.log('[HomeScreen] Screen blurred - pausing video playback');
        if (videoPlayer && videoReady) {
          videoPlayer.pause();
        }
      };
    }, [isInitialized, isLoading, user, profile, isSubscribed, refreshData, loadLatestVideo, locationData.displayName, latestVideo, videoPlayer, videoReady])
  );

  // ✅ FIX: Only reload data and video when location changes
  useEffect(() => {
    if (isInitialized && !isLoading && user && profile && isSubscribed) {
      console.log('[HomeScreen] Location changed to:', currentLocation, locationData.displayName);
      console.log('[HomeScreen] Reloading data and video for new location');
      hasLoadedDataRef.current = false;
      hasLoadedVideoRef.current = false;
      refreshData();
      loadLatestVideo();
    }
  }, [currentLocation]);

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

  const handleSubscribeNow = async () => {
    console.log('[HomeScreen] 🔘 Subscribe button pressed');
    
    if (!user) {
      console.log('[HomeScreen] No user, redirecting to login');
      router.push('/login');
      return;
    }
    
    setIsSubscribing(true);
    
    await openPaywall(user.id, user.email || undefined, async () => {
      console.log('[HomeScreen] ✅ Subscription successful, refreshing profile');
      await refreshProfile();
    });
    
    setIsSubscribing(false);
  };

  if (!isInitialized || isLoading) {
    const loadingTextContent = 'Loading your profile...';
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
            {loadingTextContent}
          </Text>
        </View>
      </View>
    );
  }

  if (!user || !isSubscribed) {
    console.log('[HomeScreen] Showing locked content');
    const titleText = 'Subscriber Only Content';
    const descriptionText = 'Subscribe to access exclusive 6K drone footage and detailed surf reports';
    const debugText = 'You are signed in but not subscribed';
    const buttonText = user ? 'Subscribe Now' : 'Sign In / Subscribe';
    
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
            {titleText}
          </Text>
          <Text style={[styles.text, { color: colors.textSecondary }]}>
            {descriptionText}
          </Text>
          {user && (
            <Text style={[styles.debugText, { color: colors.textSecondary }]}>
              {debugText}
            </Text>
          )}
          <TouchableOpacity
            style={[styles.subscribeButton, { backgroundColor: colors.accent }]}
            onPress={handleSubscribeNow}
            disabled={isSubscribing}
          >
            {isSubscribing ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text style={styles.subscribeButtonText}>
                {buttonText}
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  console.log('[HomeScreen] Showing content for', locationData.displayName);
  console.log('[HomeScreen] Surf conditions available:', !!surfConditions);
  console.log('[HomeScreen] Surf conditions:', surfConditions);
  console.log('[HomeScreen] Weather data available:', !!weatherData);
  console.log('[HomeScreen] Weather data:', weatherData);

  const narrativeText = todaysReport ? selectNarrativeText(todaysReport) : null;
  const isCustomReport = todaysReport ? isCustomNarrative(todaysReport) : false;
  const isReportFromToday = todaysReport ? todaysReport.date.split('T')[0] === todayDate : false;

  console.log('[HomeScreen] ===== NARRATIVE DISPLAY =====');
  console.log('[HomeScreen] Location:', locationData.displayName);
  console.log('[HomeScreen] Report location:', todaysReport?.location);
  console.log('[HomeScreen] Narrative length:', narrativeText?.length || 0);
  console.log('[HomeScreen] Is custom (edited):', isCustomReport);
  console.log('[HomeScreen] Source:', isCustomReport ? 'report_text (edited)' : 'conditions (auto)');
  console.log('[HomeScreen] Is from today:', isReportFromToday);

  const surfHeightValue = surfConditions?.surf_height || (todaysReport as any)?.surf_height;
  const waveHeightValue = surfConditions?.wave_height || todaysReport?.wave_height;
  
  console.log('[HomeScreen] ===== WAVE DATA CHECK =====');
  console.log('[HomeScreen] surfConditions surf_height:', surfConditions?.surf_height);
  console.log('[HomeScreen] surfConditions wave_height:', surfConditions?.wave_height);
  console.log('[HomeScreen] todaysReport surf_height:', (todaysReport as any)?.surf_height);
  console.log('[HomeScreen] todaysReport wave_height:', todaysReport?.wave_height);
  console.log('[HomeScreen] Final surfHeightValue:', surfHeightValue);
  console.log('[HomeScreen] Final waveHeightValue:', waveHeightValue);
  console.log('[HomeScreen] ===========================');
  
  const waveHeightDisplay = (surfHeightValue && surfHeightValue !== 'N/A' && surfHeightValue !== null) 
    ? surfHeightValue 
    : (waveHeightValue && waveHeightValue !== 'N/A' && waveHeightValue !== null) 
      ? waveHeightValue 
      : 'N/A';
  
  console.log('[HomeScreen] Final wave height display:', waveHeightDisplay);
  
  const windSpeedValue = surfConditions?.wind_speed || weatherData?.wind_speed || todaysReport?.wind_speed;
  const windDirValue = surfConditions?.wind_direction || weatherData?.wind_direction || todaysReport?.wind_direction;
  const windDisplay = windSpeedValue && windDirValue ? `${windSpeedValue} ${windDirValue}` : 'N/A';
  
  const airTempValue = weatherData?.temperature || todaysReport?.air_temp;
  const airTempDisplay = airTempValue ? `${Math.round(Number(airTempValue))}°F` : 'N/A';
  
  const weatherDescDisplay = weatherData?.conditions || todaysReport?.weather_conditions || 'N/A';
  
  const waterTempValue = surfConditions?.water_temp || todaysReport?.water_temp;
  const waterTempDisplay = formatWaterTemp(waterTempValue);
  
  const ratingValue = todaysReport?.rating ?? 5;
  const ratingColorValue = getRatingColor(ratingValue);
  const ratingLabel = 'Stoke Rating';

  console.log('[HomeScreen] ===== CURRENT CONDITIONS DATA SOURCES =====');
  console.log('[HomeScreen] Wave height:', waveHeightDisplay, '(from', surfConditions ? 'surf_conditions' : 'report', ')');
  console.log('[HomeScreen] Wind:', windDisplay, '(from', surfConditions ? 'surf_conditions' : weatherData ? 'weatherData' : 'report', ')');
  console.log('[HomeScreen] Air temp:', airTempDisplay, '(from', weatherData ? 'weatherData' : 'report', ')');
  console.log('[HomeScreen] Weather:', weatherDescDisplay, '(from', weatherData ? 'weatherData' : 'report', ')');
  console.log('[HomeScreen] Water temp:', waterTempDisplay, '(from', surfConditions ? 'surf_conditions' : 'report', ')');
  console.log('[HomeScreen] ================================================');

  const errorTitleText = 'Unable to fetch surf data';
  const emptyVideoText = `No videos available yet for ${locationData.displayName}`;
  const currentDateText = new Date().toLocaleDateString('en-US', {
    timeZone: 'America/New_York',
    weekday: 'long',
    month: 'long',
    day: 'numeric'
  });
  const oldDataBadgeText = 'Showing most recent report';
  const loadingReportsText = `Loading surf reports for ${locationData.displayName}...`;
  const noReportTitleText = 'No Report Available';
  const noReportDescText = `Surf reports for ${locationData.displayName} will be generated automatically each morning at 6 AM EST.`;
  const currentConditionsTitle = 'Current Conditions';
  const airTempLabel = 'Air Temp';
  const weatherLabel = 'Weather';
  const waveHeightLabel = 'Wave Height';
  const windLabel = 'Wind';
  const waterTempLabel = 'Water Temp';
  const surfReportTitle = 'Surf Report';
  const noNarrativeText = `No surf conditions narrative available for ${locationData.displayName}.`;
  const editedNotePrefix = 'Edited ';
  const viewFullReportText = 'View Full Report';
  const forecastTitle = '7-Day Forecast';
  const swellLabel = 'swell';
  const noForecastText = 'No forecast data available yet. Pull down to refresh or check back later.';

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
      {error && (
        <View style={[styles.errorCard, { backgroundColor: colors.errorBackground }]}>
          <IconSymbol
            ios_icon_name="exclamationmark.triangle.fill"
            android_material_icon_name="warning"
            size={24}
            color="#FFFFFF"
          />
          <View style={styles.errorTextContainer}>
            <Text style={styles.errorText}>{errorTitleText}</Text>
            <Text style={styles.errorSubtext}>
              {error}
            </Text>
          </View>
        </View>
      )}

      <View style={[styles.videoSection, { backgroundColor: theme.colors.card }]}>
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
                  </View>
                  <View style={styles.videoTitleOverlay}>
                    <Text style={styles.videoTitleOnVideo}>SurfVista</Text>
                  </View>
                </View>
              )}
            </View>
          </TouchableOpacity>
        ) : (
          <View style={styles.emptyState}>
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
              {emptyVideoText}
            </Text>
          </View>
        )}
      </View>

      <View style={styles.locationSelectorContainer}>
        <LocationSelector />
      </View>

      <View style={styles.dateContainer}>
        <Text style={[styles.dateText, { color: theme.colors.text }]}>
          {currentDateText}
        </Text>
        {todaysReport && !isReportFromToday && (
          <View style={styles.oldDataBadge}>
            <IconSymbol
              ios_icon_name="clock"
              android_material_icon_name="schedule"
              size={12}
              color={colors.accent}
            />
            <Text style={[styles.oldDataText, { color: colors.accent }]}>
              {oldDataBadgeText}
            </Text>
          </View>
        )}
      </View>

      {surfLoading && !isRefreshing ? (
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
            {loadingReportsText}
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
            {noReportTitleText}
          </Text>
          <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
            {noReportDescText}
          </Text>
        </View>
      ) : (
        <View style={[
          styles.reportCard, 
          { 
            backgroundColor: theme.colors.card,
            borderWidth: 1,
            borderColor: theme.dark ? 'rgba(255, 255, 255, 0.15)' : 'rgba(0, 0, 0, 0.12)'
          }
        ]}>
          <View style={styles.conditionsSection}>
            <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
              {currentConditionsTitle}
            </Text>
            
            <View style={styles.conditionsGrid}>
              <View style={styles.conditionRow}>
                <View style={[styles.conditionItem, {
                  backgroundColor: theme.dark ? 'rgba(0, 122, 255, 0.12)' : 'rgba(0, 122, 255, 0.08)',
                  borderWidth: 1,
                  borderColor: theme.dark ? 'rgba(0, 122, 255, 0.2)' : 'rgba(0, 122, 255, 0.15)'
                }]}>
                  <IconSymbol
                    ios_icon_name="thermometer"
                    android_material_icon_name="thermostat"
                    size={18}
                    color={colors.primary}
                  />
                  <View style={styles.conditionTextContainer}>
                    <Text style={[styles.conditionLabel, { color: colors.textSecondary }]}>
                      {airTempLabel}
                    </Text>
                    <Text style={[styles.conditionValue, { color: theme.colors.text }]}>
                      {airTempDisplay}
                    </Text>
                  </View>
                </View>

                <View style={[styles.conditionItem, {
                  backgroundColor: theme.dark ? 'rgba(0, 122, 255, 0.12)' : 'rgba(0, 122, 255, 0.08)',
                  borderWidth: 1,
                  borderColor: theme.dark ? 'rgba(0, 122, 255, 0.2)' : 'rgba(0, 122, 255, 0.15)'
                }]}>
                  <IconSymbol
                    ios_icon_name="cloud.fill"
                    android_material_icon_name="cloud"
                    size={18}
                    color={colors.primary}
                  />
                  <View style={styles.conditionTextContainer}>
                    <Text style={[styles.conditionLabel, { color: colors.textSecondary }]}>
                      {weatherLabel}
                    </Text>
                    <Text style={[styles.conditionValue, { color: theme.colors.text }]} numberOfLines={1}>
                      {weatherDescDisplay}
                    </Text>
                  </View>
                </View>
              </View>

              <View style={styles.conditionRow}>
                <View style={[styles.conditionItem, {
                  backgroundColor: theme.dark ? 'rgba(0, 122, 255, 0.12)' : 'rgba(0, 122, 255, 0.08)',
                  borderWidth: 1,
                  borderColor: theme.dark ? 'rgba(0, 122, 255, 0.2)' : 'rgba(0, 122, 255, 0.15)'
                }]}>
                  <IconSymbol
                    ios_icon_name="water.waves"
                    android_material_icon_name="waves"
                    size={18}
                    color={colors.primary}
                  />
                  <View style={styles.conditionTextContainer}>
                    <Text style={[styles.conditionLabel, { color: colors.textSecondary }]}>
                      {waveHeightLabel}
                    </Text>
                    <Text style={[styles.conditionValue, { color: theme.colors.text }]}>
                      {waveHeightDisplay}
                    </Text>
                  </View>
                </View>

                <View style={[styles.conditionItem, {
                  backgroundColor: theme.dark ? 'rgba(0, 122, 255, 0.12)' : 'rgba(0, 122, 255, 0.08)',
                  borderWidth: 1,
                  borderColor: theme.dark ? 'rgba(0, 122, 255, 0.2)' : 'rgba(0, 122, 255, 0.15)'
                }]}>
                  <IconSymbol
                    ios_icon_name="wind"
                    android_material_icon_name="air"
                    size={18}
                    color={colors.primary}
                  />
                  <View style={styles.conditionTextContainer}>
                    <Text style={[styles.conditionLabel, { color: colors.textSecondary }]}>
                      {windLabel}
                    </Text>
                    <Text style={[styles.conditionValue, { color: theme.colors.text }]}>
                      {windDisplay}
                    </Text>
                  </View>
                </View>
              </View>

              <View style={styles.conditionRow}>
                <View style={[styles.conditionItem, {
                  backgroundColor: theme.dark ? 'rgba(0, 122, 255, 0.12)' : 'rgba(0, 122, 255, 0.08)',
                  borderWidth: 1,
                  borderColor: theme.dark ? 'rgba(0, 122, 255, 0.2)' : 'rgba(0, 122, 255, 0.15)'
                }]}>
                  <IconSymbol
                    ios_icon_name="drop.fill"
                    android_material_icon_name="water-drop"
                    size={18}
                    color={colors.primary}
                  />
                  <View style={styles.conditionTextContainer}>
                    <Text style={[styles.conditionLabel, { color: colors.textSecondary }]}>
                      {waterTempLabel}
                    </Text>
                    <Text style={[styles.conditionValue, { color: theme.colors.text }]}>
                      {waterTempDisplay}
                    </Text>
                  </View>
                </View>

                <View style={[styles.conditionItem, {
                  backgroundColor: theme.dark ? 'rgba(0, 122, 255, 0.12)' : 'rgba(0, 122, 255, 0.08)',
                  borderWidth: 1,
                  borderColor: theme.dark ? 'rgba(0, 122, 255, 0.2)' : 'rgba(0, 122, 255, 0.15)'
                }]}>
                  <IconSymbol
                    ios_icon_name="star.fill"
                    android_material_icon_name="star"
                    size={18}
                    color={ratingColorValue}
                  />
                  <View style={styles.conditionTextContainer}>
                    <Text style={[styles.conditionLabel, { color: colors.textSecondary }]}>
                      {ratingLabel}
                    </Text>
                    <Text style={[styles.conditionValue, { color: ratingColorValue }]}>
                      {ratingValue}
                      <Text style={[styles.ratingOutOf, { color: colors.textSecondary }]}>
                        /10
                      </Text>
                    </Text>
                  </View>
                </View>
              </View>
            </View>
          </View>

          <View style={[
            styles.reportNarrativeSection, 
            { 
              borderTopColor: theme.dark ? 'rgba(255, 255, 255, 0.15)' : 'rgba(0, 0, 0, 0.12)',
              backgroundColor: theme.dark ? 'rgba(0, 122, 255, 0.08)' : 'rgba(0, 122, 255, 0.04)',
              borderRadius: 12,
              padding: 16,
              marginTop: 8
            }
          ]}>
            <View style={styles.reportTitleRow}>
              <IconSymbol
                ios_icon_name="doc.text.fill"
                android_material_icon_name="description"
                size={20}
                color={colors.primary}
              />
              <Text style={[styles.sectionTitle, { color: theme.colors.text, marginBottom: 0 }]}>
                {surfReportTitle}
              </Text>
            </View>
            
            {narrativeText ? (
              <>
                <ReportTextDisplay 
                  text={narrativeText}
                  isCustom={isCustomReport}
                />
                {todaysReport.report_text && todaysReport.edited_at && (
                  <Text style={[styles.editedNote, { color: colors.textSecondary }]}>
                    {editedNotePrefix}{new Date(todaysReport.edited_at).toLocaleDateString()}
                  </Text>
                )}
              </>
            ) : (
              <Text style={[styles.noReportText, { color: colors.textSecondary }]}>
                {noNarrativeText}
              </Text>
            )}
          </View>

          <TouchableOpacity
            style={[styles.detailsButton, { backgroundColor: colors.primary }]}
            onPress={() => router.push('/(tabs)/report')}
          >
            <Text style={styles.detailsButtonText}>{viewFullReportText}</Text>
            <IconSymbol
              ios_icon_name="chevron.right"
              android_material_icon_name="chevron-right"
              size={20}
              color="#FFFFFF"
            />
          </TouchableOpacity>
        </View>
      )}

      {!surfLoading && (
        <View style={[styles.forecastCard, { backgroundColor: theme.colors.card }]}>
          <View style={styles.forecastHeader}>
            <IconSymbol
              ios_icon_name="calendar"
              android_material_icon_name="calendar-today"
              size={24}
              color={colors.primary}
            />
            <Text style={[styles.forecastTitle, { color: theme.colors.text }]}>
              {forecastTitle}
            </Text>
          </View>
          
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.forecastScrollContent}
          >
            {Array.from({ length: 7 }).map((_, index) => {
              const forecastDateStr = getESTDateOffset(index);
              
              const dayReport = locationSurfReports.find(r => r.date.split('T')[0] === forecastDateStr);
              const dayWeatherForecast = locationWeatherForecast.find(f => f.date.split('T')[0] === forecastDateStr);
              
              const dayName = index === 0 ? 'Today' : 
                            index === 1 ? 'Tomorrow' : 
                            new Date(forecastDateStr + 'T12:00:00').toLocaleDateString('en-US', { 
                              timeZone: 'America/New_York',
                              weekday: 'short' 
                            });
              
              const monthDay = new Date(forecastDateStr + 'T12:00:00').toLocaleDateString('en-US', {
                timeZone: 'America/New_York',
                month: 'short',
                day: 'numeric'
              });
              
              const highTempDisplay = dayWeatherForecast?.high_temp ? `${Math.round(dayWeatherForecast.high_temp)}°` : dayReport?.air_temp ? `${Math.round(Number(dayReport.air_temp))}°` : '--';
              const lowTempDisplay = dayWeatherForecast?.low_temp ? `${Math.round(dayWeatherForecast.low_temp)}°` : '--';
              
              const daySurfHeight = (dayReport as any)?.surf_height;
              const dayWaveHeight = dayReport?.wave_height;
              const waveDisplay = dayWeatherForecast?.swell_height_range || 
                                 (daySurfHeight && daySurfHeight !== 'N/A' && daySurfHeight !== null ? daySurfHeight : 
                                  (dayWaveHeight && dayWaveHeight !== 'N/A' && dayWaveHeight !== null ? dayWaveHeight : '--'));
              
              const weatherDesc = dayWeatherForecast?.conditions || dayReport?.weather_conditions || 'N/A';
              
              console.log('[HomeScreen] Forecast day', index, ':', {
                date: forecastDateStr,
                dayName,
                monthDay,
                hasReport: !!dayReport,
                hasForecast: !!dayWeatherForecast,
                surf_height: daySurfHeight,
                wave_height: dayWaveHeight,
                waveDisplay,
                highTemp: highTempDisplay,
                lowTemp: lowTempDisplay,
                weather: weatherDesc
              });
              
              return (
                <View key={index} style={[styles.forecastDay, { 
                  backgroundColor: theme.dark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.04)',
                  borderWidth: 1,
                  borderColor: theme.dark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.08)'
                }]}>
                  <Text style={[styles.forecastDayName, { color: theme.colors.text }]}>
                    {dayName}
                  </Text>
                  <Text style={[styles.forecastDate, { color: colors.textSecondary }]}>
                    {monthDay}
                  </Text>
                  <Text style={[styles.forecastWaveHeight, { color: colors.primary }]}>
                    {waveDisplay}
                  </Text>
                  <Text style={[styles.forecastLabel, { color: colors.textSecondary }]}>
                    {swellLabel}
                  </Text>
                  <View style={styles.forecastTempRow}>
                    <Text style={[styles.forecastTemp, { color: theme.colors.text }]}>
                      {highTempDisplay}
                    </Text>
                    <Text style={[styles.forecastTempDivider, { color: colors.textSecondary }]}>
                      /
                    </Text>
                    <Text style={[styles.forecastTempLabel, { color: colors.textSecondary }]}>
                      {lowTempDisplay}
                    </Text>
                  </View>
                  <Text style={[styles.forecastWeather, { color: theme.colors.text }]} numberOfLines={2}>
                    {weatherDesc}
                  </Text>
                </View>
              );
            })}
          </ScrollView>
          
          {locationWeatherForecast.length === 0 && locationSurfReports.length === 0 && (
            <View style={styles.noForecastContainer}>
              <Text style={[styles.noForecastText, { color: colors.textSecondary }]}>
                {noForecastText}
              </Text>
            </View>
          )}
        </View>
      )}
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
    paddingTop: 16,
    paddingBottom: 100,
  },
  locationSelectorContainer: {
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  dateContainer: {
    paddingHorizontal: 16,
    marginBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  dateText: {
    fontSize: 18,
    fontWeight: '600',
  },
  oldDataBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: 'rgba(255, 152, 0, 0.1)',
    borderRadius: 12,
  },
  oldDataText: {
    fontSize: 11,
    fontWeight: '600',
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
    lineHeight: 20,
  },
  emptyState: {
    paddingVertical: 32,
    alignItems: 'center',
  },
  videoSection: {
    borderRadius: 16,
    marginHorizontal: 16,
    marginBottom: 16,
    overflow: 'hidden',
    boxShadow: '0px 4px 12px rgba(0, 0, 0, 0.1)',
    elevation: 4,
  },
  videoCard: {
    width: '100%',
  },
  videoPreviewContainer: {
    width: '100%',
    height: 280,
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
  videoTitleOverlay: {
    position: 'absolute',
    top: 20,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  videoTitleOnVideo: {
    color: 'rgba(255, 255, 255, 0.95)',
    fontSize: 32,
    fontWeight: 'bold',
    textShadowColor: 'rgba(0, 0, 0, 0.7)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  reportCard: {
    borderRadius: 16,
    padding: 20,
    marginHorizontal: 16,
    marginBottom: 16,
    boxShadow: '0px 6px 16px rgba(0, 0, 0, 0.15)',
    elevation: 6,
  },
  conditionsSection: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  conditionsGrid: {
    gap: 12,
  },
  conditionRow: {
    flexDirection: 'row',
    gap: 12,
  },
  conditionItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderRadius: 12,
  },
  conditionTextContainer: {
    flex: 1,
  },
  conditionLabel: {
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 2,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  conditionValue: {
    fontSize: 15,
    fontWeight: '700',
  },
  ratingOutOf: {
    fontSize: 13,
    fontWeight: '500',
  },
  reportNarrativeSection: {
    borderTopWidth: 1,
    marginBottom: 16,
  },
  reportTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  noReportText: {
    fontSize: 14,
    lineHeight: 22,
    fontStyle: 'italic',
  },
  editedNote: {
    fontSize: 11,
    fontStyle: 'italic',
    marginTop: 10,
  },
  detailsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    gap: 8,
  },
  detailsButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  forecastCard: {
    borderRadius: 16,
    padding: 20,
    marginHorizontal: 16,
    marginBottom: 16,
    boxShadow: '0px 4px 12px rgba(0, 0, 0, 0.1)',
    elevation: 4,
  },
  forecastHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  forecastTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  forecastScrollContent: {
    gap: 12,
    paddingRight: 16,
  },
  forecastDay: {
    width: 110,
    padding: 14,
    borderRadius: 12,
    alignItems: 'center',
    gap: 6,
  },
  forecastDayName: {
    fontSize: 15,
    fontWeight: '700',
  },
  forecastDate: {
    fontSize: 11,
    marginBottom: 6,
    fontWeight: '500',
  },
  forecastWaveHeight: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  forecastLabel: {
    fontSize: 10,
    marginBottom: 6,
    fontWeight: '500',
  },
  forecastTempRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginBottom: 6,
  },
  forecastTemp: {
    fontSize: 15,
    fontWeight: '700',
  },
  forecastTempDivider: {
    fontSize: 13,
    fontWeight: '500',
  },
  forecastTempLabel: {
    fontSize: 13,
    fontWeight: '500',
  },
  forecastWeather: {
    fontSize: 11,
    textAlign: 'center',
    lineHeight: 14,
    fontWeight: '500',
  },
  noForecastContainer: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  noForecastText: {
    fontSize: 14,
    textAlign: 'center',
    fontStyle: 'italic',
  },
});
