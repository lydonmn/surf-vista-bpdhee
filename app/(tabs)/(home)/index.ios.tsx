
import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl } from "react-native";
import { useTheme } from "@react-navigation/native";
import { useAuth } from "@/contexts/AuthContext";
import { useSubscription } from "@/contexts/SubscriptionContext";
import { openPaywall } from "@/utils/paywallHelper";
import { router } from "expo-router";
import { colors } from "@/styles/commonStyles";
import { IconSymbol } from "@/components/IconSymbol";
import { useSurfData } from "@/hooks/useSurfData";
import { ReportTextDisplay } from "@/components/ReportTextDisplay";
import { supabase } from "@/app/integrations/supabase/client";
import { Video } from "@/types";
import { VideoPreviewThumbnail } from "@/components/VideoPreviewThumbnail";
import { formatWaterTemp, getESTDate, getESTDateOffset } from "@/utils/surfDataFormatter";
import { useLocation } from "@/contexts/LocationContext";
import { selectNarrativeText, isCustomNarrative } from "@/utils/reportNarrativeSelector";
import { LocationSelector } from "@/components/LocationSelector";
import { useSafeAreaInsets } from "react-native-safe-area-context";


function calculateSurfRating(surfData: any): number {
  if (!surfData) return 5;
  
  const surfHeightStr = surfData.surf_height || surfData.wave_height || '0';
  const periodStr = surfData.wave_period || '0';
  const windSpeedStr = surfData.wind_speed || '0';
  const windDirStr = surfData.wind_direction || '';
  
  if (surfHeightStr === 'N/A' || surfHeightStr === '' || surfHeightStr === 'null') {
    return 5;
  }
  
  const parseValue = (str: string): number => {
    const cleaned = String(str).replace(/[^0-9.-]/g, '');
    const parsed = parseFloat(cleaned);
    return isNaN(parsed) ? 0 : parsed;
  };
  
  let surfHeight = 0;
  const cleanedStr = String(surfHeightStr).trim();
  
  if (cleanedStr.includes('-')) {
    const parts = cleanedStr.split('-');
    const low = parseValue(parts[0]);
    const high = parseValue(parts[1]);
    surfHeight = (low + high) / 2;
  } else {
    surfHeight = parseValue(cleanedStr);
  }
  
  const period = parseValue(periodStr);
  const windSpeed = parseValue(windSpeedStr);
  const windDir = windDirStr.toLowerCase();
  const isOffshore = windDir.includes('w') || windDir.includes('n');

  let rating = 3;

  if (surfHeight >= 6) {
    rating += 5;
  } else if (surfHeight >= 4) {
    rating += 4;
  } else if (surfHeight >= 3) {
    rating += 3;
  } else if (surfHeight >= 2) {
    rating += 2;
  } else if (surfHeight >= 1.5) {
    rating += 1;
  } else if (surfHeight >= 1) {
    rating += 0;
  } else {
    rating -= 1;
  }

  if (period >= 12) {
    rating += 2;
  } else if (period >= 10) {
    rating += 1;
  } else if (period >= 8) {
    rating += 0;
  } else if (period >= 6) {
    rating -= 1;
  } else if (period > 0) {
    rating -= 2;
  }

  if (isOffshore) {
    if (windSpeed < 5) {
      rating += 1;
    } else if (windSpeed < 10) {
      rating += 1;
    } else if (windSpeed < 15) {
      rating += 0;
    } else {
      rating -= 1;
    }
  } else {
    if (windSpeed < 5) {
      rating += 0;
    } else if (windSpeed < 10) {
      rating -= 1;
    } else if (windSpeed < 15) {
      rating -= 2;
    } else {
      rating -= 3;
    }
  }

  const finalRating = Math.max(1, Math.min(10, Math.round(rating)));
  
  return finalRating;
}

function getRatingColor(rating: number): string {
  if (rating >= 8) return '#22C55E';
  if (rating >= 6) return '#FFC107';
  if (rating >= 4) return '#FF9800';
  return '#F44336';
}

export default function HomeScreen() {
  console.log('[HomeScreen iOS] ===== COMPONENT RENDERING =====');
  
  // 🚨 CRITICAL FIX: ALL hooks must be called unconditionally at the top level
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { isLoading, isLoading: authLoading, isInitialized, profile } = useAuth();
  const { isSubscribed, loading: rcLoading } = useSubscription();
  const { currentLocation, locationData } = useLocation();
  
  // 🚨 CRITICAL FIX: Pass currentLocation as parameter instead of calling useLocation inside hook
  const { surfReports, surfConditions, weatherData, weatherForecast, isLoading: surfLoading, error, refreshData } = useSurfData(currentLocation);
  
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [latestVideo, setLatestVideo] = useState<Video | null>(null);
  const [isLoadingVideo, setIsLoadingVideo] = useState(false);
  const hasLoadedVideoRef = useRef(false);
  const todayDate = useMemo(() => getESTDate(), []);

  const locationSurfReports = useMemo(() => {
    return surfReports.filter(report => report.location === currentLocation);
  }, [surfReports, currentLocation]);

  const locationWeatherForecast = useMemo(() => {
    return weatherForecast.filter(forecast => forecast.location === currentLocation);
  }, [weatherForecast, currentLocation]);

  const todaysReport = useMemo(() => {
    const todayReports = locationSurfReports.filter(report => {
      if (!report.date) return false;
      const reportDate = report.date.split('T')[0];
      return reportDate === todayDate;
    });
    
    if (todayReports.length > 0) {
      return todayReports[0];
    }
    
    const sortedReports = [...locationSurfReports].sort((a, b) => {
      const dateA = new Date(a.date).getTime();
      const dateB = new Date(b.date).getTime();
      return dateB - dateA;
    });
    
    return sortedReports[0] || null;
  }, [locationSurfReports, todayDate]);

  const todaysWeatherForecast = useMemo(() => {
    return locationWeatherForecast.find(f => f.date.split('T')[0] === todayDate);
  }, [locationWeatherForecast, todayDate]);

  const ratingValue = useMemo(() => {
    if (todaysReport?.rating !== null && todaysReport?.rating !== undefined) {
      return todaysReport.rating;
    }
    
    if (surfConditions) {
      return calculateSurfRating(surfConditions);
    }
    
    if (todaysReport) {
      return calculateSurfRating(todaysReport);
    }
    
    return 5;
  }, [surfConditions, todaysReport]);

  const loadLatestVideo = useCallback(async () => {
    try {
      setIsLoadingVideo(true);
      
      const { data: videoData } = await supabase
        .from('videos')
        .select('*')
        .eq('location', currentLocation)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (videoData) {
        setLatestVideo(videoData);
        hasLoadedVideoRef.current = true;
      } else {
        setLatestVideo(null);
      }
    } catch (error) {
      console.error('[HomeScreen iOS] Error loading video:', error);
    } finally {
      setIsLoadingVideo(false);
    }
  }, [currentLocation]);

  useEffect(() => {
    console.log('[HomeScreen iOS] loadLatestVideo effect triggered, location:', currentLocation);
    if (isInitialized && !isLoading) {
      hasLoadedVideoRef.current = false;
      loadLatestVideo();
    }
  }, [currentLocation, isInitialized, isLoading, loadLatestVideo]);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await Promise.all([refreshData(), loadLatestVideo()]);
    setIsRefreshing(false);
  }, [refreshData, loadLatestVideo]);

  const handleVideoPress = useCallback(async () => {
    console.log('[HomeScreen] Video preview tapped');
    if (!latestVideo) return;

    // Use DB subscription state as immediate fallback while RevenueCat loads
    const dbSubscribed = !!profile?.is_subscribed || !!profile?.is_admin;
    const hasAccess = isSubscribed || dbSubscribed || rcLoading || authLoading || !isInitialized;

    if (!hasAccess) {
      console.log('[HomeScreen] Non-subscriber tapped video preview — opening paywall');
      await openPaywall();
      return;
    }

    console.log('[HomeScreen] Opening video player for:', latestVideo.id);
    router.push({
      pathname: '/video-player-v2',
      params: {
        videoId: latestVideo.id,
        locationId: currentLocation,
      }
    });
  }, [latestVideo, currentLocation, isSubscribed, profile, rcLoading, authLoading, isInitialized]);



  const narrativeText = todaysReport ? selectNarrativeText(todaysReport) : null;
  const isCustomReport = todaysReport ? isCustomNarrative(todaysReport) : false;
  const isReportFromToday = todaysReport ? todaysReport.date.split('T')[0] === todayDate : false;

  const surfHeightValue = surfConditions?.surf_height || (todaysReport as any)?.surf_height;
  const waveHeightValue = surfConditions?.wave_height || todaysReport?.wave_height;
  
  const surfHeightDisplay = (surfHeightValue && surfHeightValue !== 'N/A' && surfHeightValue !== null) 
    ? surfHeightValue 
    : (waveHeightValue && waveHeightValue !== 'N/A' && waveHeightValue !== null) 
      ? waveHeightValue 
      : 'N/A';
  
  const isValidValue = (val: any): boolean => {
    if (val === null || val === undefined) return false;
    if (typeof val === 'string') {
      const trimmed = val.trim();
      if (trimmed === '' || trimmed.toLowerCase() === 'n/a') return false;
      return true;
    }
    if (typeof val === 'number') return !isNaN(val);
    return true;
  };
  
  const windSpeedValue = isValidValue(weatherData?.wind_speed) 
    ? weatherData.wind_speed 
    : isValidValue(surfConditions?.wind_speed)
      ? surfConditions.wind_speed
      : isValidValue(todaysReport?.wind_speed)
        ? todaysReport.wind_speed
        : null;
  
  const windDirValue = isValidValue(weatherData?.wind_direction)
    ? weatherData.wind_direction
    : isValidValue(surfConditions?.wind_direction)
      ? surfConditions.wind_direction
      : isValidValue(todaysReport?.wind_direction)
        ? todaysReport.wind_direction
        : null;
  
  const windSpeedFormatted = windSpeedValue 
    ? (typeof windSpeedValue === 'string' && windSpeedValue.includes('mph') 
        ? windSpeedValue 
        : `${Math.round(Number(windSpeedValue))} mph`)
    : null;
  
  const windDisplay = windSpeedFormatted && windDirValue 
    ? `${windSpeedFormatted} ${String(windDirValue).trim()}`
    : 'N/A';
  
  // Use weatherData (current conditions) directly — no date guard so stale-but-present data
  // is still shown rather than falling through to N/A. Fall back to forecast then report.
  const airTempValue = isValidValue(weatherData?.temperature)
    ? weatherData!.temperature
    : isValidValue(todaysWeatherForecast?.high_temp)
      ? todaysWeatherForecast!.high_temp
      : isValidValue(todaysReport?.air_temp)
        ? todaysReport!.air_temp
        : null;

  console.log('[HomeScreen] airTempValue:', airTempValue, '| weatherData?.temperature:', weatherData?.temperature, '| forecast high_temp:', todaysWeatherForecast?.high_temp);

  const airTempDisplay = airTempValue !== null && airTempValue !== undefined
    ? `${Math.round(Number(airTempValue))}°F`
    : 'N/A';

  const weatherDescDisplay = isValidValue(weatherData?.conditions)
    ? String(weatherData!.conditions)
    : isValidValue(weatherData?.forecast)
      ? String(weatherData!.forecast)
      : isValidValue(todaysWeatherForecast?.conditions)
        ? String(todaysWeatherForecast!.conditions)
        : isValidValue(todaysReport?.weather_conditions)
          ? String(todaysReport!.weather_conditions)
          : 'N/A';

  console.log('[HomeScreen] weatherDescDisplay:', weatherDescDisplay, '| weatherData?.conditions:', weatherData?.conditions);
  
  const waterTempValue = surfConditions?.water_temp || todaysReport?.water_temp;
  const waterTempDisplay = formatWaterTemp(waterTempValue);
  
  const ratingColorValue = getRatingColor(ratingValue);

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <ScrollView 
        style={styles.container}
        contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + 16 }]}
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
              <Text style={styles.errorText}>Unable to fetch surf data</Text>
              <Text style={styles.errorSubtext}>{error}</Text>
            </View>
          </View>
        )}

        <View style={styles.screenHeader}>
          <Text style={[styles.screenTitle, { color: theme.colors.text }]}>
            SurfVista
          </Text>
        </View>

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
                <VideoPreviewThumbnail
                  videoUrl={latestVideo.video_url}
                  thumbnailUrl={latestVideo.thumbnail_url}
                  style={styles.videoPreview}
                />
                
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
              </View>
            </TouchableOpacity>
          ) : (
            <View style={styles.emptyState}>
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                No videos available yet for {locationData?.displayName}
              </Text>
            </View>
          )}
        </View>

        <View style={styles.locationSelectorContainer}>
          <LocationSelector />
        </View>

        <View style={styles.dateContainer}>
          <Text style={[styles.dateText, { color: theme.colors.text }]}>
            {new Date().toLocaleDateString('en-US', {
              timeZone: 'America/New_York',
              weekday: 'long',
              month: 'long',
              day: 'numeric'
            })}
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
                Showing most recent report
              </Text>
            </View>
          )}
        </View>

        {surfLoading && !isRefreshing ? (
          <View style={styles.centerContent}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
              Loading surf reports for {locationData?.displayName}...
            </Text>
          </View>
        ) : !todaysReport && !surfConditions ? (
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
              Surf reports for {locationData.displayName} will be generated automatically each morning at 6 AM EST.
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
                Current Conditions
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
                        Air Temp
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
                        Weather
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
                        Surf Height
                      </Text>
                      <Text style={[styles.conditionValue, { color: theme.colors.text }]}>
                        {surfHeightDisplay}
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
                        Wind
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
                        Water Temp
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
                        Stoke Rating
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

            {narrativeText && (
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
                    Surf Report
                  </Text>
                </View>
                
                <ReportTextDisplay 
                  text={narrativeText}
                  isCustom={isCustomReport}
                />
                {todaysReport?.report_text && todaysReport.edited_at && (
                  <Text style={[styles.editedNote, { color: colors.textSecondary }]}>
                    Edited {new Date(todaysReport.edited_at).toLocaleDateString()}
                  </Text>
                )}
              </View>
            )}

            {!narrativeText && (
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
                    Surf Report
                  </Text>
                </View>
                <Text style={[styles.noReportText, { color: colors.textSecondary }]}>
                  No surf conditions narrative available for {locationData?.displayName}.
                </Text>
              </View>
            )}

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
                7-Day Forecast
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
                      swell
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
                  No forecast data available yet. Pull down to refresh or check back later.
                </Text>
              </View>
            )}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: 16,
    paddingBottom: 100,
  },
  screenHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  screenTitle: {
    fontSize: 28,
    fontWeight: 'bold',
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
  lockedOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  lockedContent: {
    alignItems: 'center',
    paddingHorizontal: 32,
    maxWidth: 400,
  },
  lockedTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginTop: 16,
    marginBottom: 8,
  },
  lockedText: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 24,
  },
  lockedDebugText: {
    fontSize: 12,
    textAlign: 'center',
    marginBottom: 16,
    fontStyle: 'italic',
  },
  lockedButton: {
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 12,
  },
  lockedButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
});
