
import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl, Image } from "react-native";
import { useTheme } from "@react-navigation/native";
import { useAuth } from "@/contexts/AuthContext";
import { router } from "expo-router";
import { colors } from "@/styles/commonStyles";
import { IconSymbol } from "@/components/IconSymbol";
import { useSurfData } from "@/hooks/useSurfData";
import { ReportTextDisplay } from "@/components/ReportTextDisplay";
import { supabase } from "@/app/integrations/supabase/client";
import { Video } from "@/types";
import { formatWaterTemp, getESTDate, getESTDateOffset } from "@/utils/surfDataFormatter";
import { useLocation } from "@/contexts/LocationContext";
import { selectNarrativeText, isCustomNarrative } from "@/utils/reportNarrativeSelector";
import { LocationSelector } from "@/components/LocationSelector";
import { openPaywall } from "@/utils/paywallHelper";

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
  const theme = useTheme();
  const { user, profile, checkSubscription, isLoading, isInitialized, refreshProfile } = useAuth();
  const isSubscribed = checkSubscription();
  const { currentLocation, locationData } = useLocation();
  const { surfReports, surfConditions, weatherData, weatherForecast, isLoading: surfLoading, error, refreshData } = useSurfData();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [latestVideo, setLatestVideo] = useState<Video | null>(null);
  const [isLoadingVideo, setIsLoadingVideo] = useState(false);
  const hasLoadedVideoRef = useRef(false);
  const [isSubscribing, setIsSubscribing] = useState(false);
  const [signedThumbnailUrl, setSignedThumbnailUrl] = useState<string | null>(null);

  const todayDate = useMemo(() => getESTDate(), []);

  const locationSurfReports = useMemo(() => {
    const filtered = surfReports.filter(report => report.location === currentLocation);
    return filtered;
  }, [surfReports, currentLocation]);

  const locationWeatherForecast = useMemo(() => {
    const filtered = weatherForecast.filter(forecast => forecast.location === currentLocation);
    return filtered;
  }, [weatherForecast, currentLocation]);

  const todaysReport = useMemo(() => {
    try {
      const todayReports = locationSurfReports.filter(report => {
        if (!report.date) return false;
        const reportDate = report.date.split('T')[0];
        const isToday = reportDate === todayDate;
        return isToday;
      });
      
      if (todayReports.length > 0) {
        return todayReports[0];
      } else {
        const sortedReports = [...locationSurfReports].sort((a, b) => {
          const dateA = new Date(a.date).getTime();
          const dateB = new Date(b.date).getTime();
          return dateB - dateA;
        });
        
        if (sortedReports.length > 0) {
          return sortedReports[0];
        }
        
        return null;
      }
    } catch (error) {
      console.error('[HomeScreen] Error filtering reports:', error);
      return null;
    }
  }, [locationSurfReports, todayDate]);
  
  const ratingValue = useMemo(() => {
    if (surfConditions) {
      const rating = calculateSurfRating(surfConditions);
      return rating;
    }
    
    if (todaysReport?.rating) {
      return todaysReport.rating;
    }
    
    if (todaysReport) {
      const rating = calculateSurfRating(todaysReport);
      return rating;
    }
    
    return 5;
  }, [surfConditions, todaysReport]);

  const loadLatestVideo = useCallback(async () => {
    if (hasLoadedVideoRef.current) return;
    
    try {
      setIsLoadingVideo(true);
      console.log('[HomeScreen] Loading video for location:', currentLocation);
      
      const { data: videoData, error: videoError } = await supabase
        .from('videos')
        .select('*')
        .eq('location', currentLocation)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (videoError) {
        console.log('[HomeScreen] Video error:', videoError.message);
        setLatestVideo(null);
        setSignedThumbnailUrl(null);
        return;
      }
      
      if (!videoData) {
        console.log('[HomeScreen] No videos found');
        setLatestVideo(null);
        setSignedThumbnailUrl(null);
        return;
      }

      console.log('[HomeScreen] Video loaded:', videoData.title);
      console.log('[HomeScreen] Thumbnail URL from DB:', videoData.thumbnail_url);
      setLatestVideo(videoData as Video);
      
      if (videoData.thumbnail_url) {
        try {
          let thumbnailFileName = '';
          const thumbUrl = videoData.thumbnail_url;
          
          if (thumbUrl.includes('/object/public/thumbnails/')) {
            const parts = thumbUrl.split('/object/public/thumbnails/');
            if (parts.length === 2) {
              thumbnailFileName = parts[1].split('?')[0];
            }
          } else if (thumbUrl.includes('/thumbnails/')) {
            const parts = thumbUrl.split('/thumbnails/');
            if (parts.length === 2) {
              thumbnailFileName = parts[1].split('?')[0];
            }
          } else {
            try {
              const url = new URL(thumbUrl);
              const pathParts = url.pathname.split('/');
              thumbnailFileName = pathParts[pathParts.length - 1];
            } catch (urlError) {
              console.error('[HomeScreen] URL parse error:', urlError);
              thumbnailFileName = thumbUrl.split('/').pop()?.split('?')[0] || '';
            }
          }
          
          if (thumbnailFileName) {
            console.log('[HomeScreen] Extracted thumbnail filename:', thumbnailFileName);
            console.log('[HomeScreen] Generating signed URL for thumbnail');
            
            const { data: signedData, error: signedError } = await supabase.storage
              .from('thumbnails')
              .createSignedUrl(thumbnailFileName, 7200);

            if (signedError) {
              console.error('[HomeScreen] Thumbnail signed URL error:', signedError);
              setSignedThumbnailUrl(null);
            } else if (signedData?.signedUrl) {
              console.log('[HomeScreen] Thumbnail signed URL ready:', signedData.signedUrl);
              setSignedThumbnailUrl(signedData.signedUrl);
            } else {
              console.log('[HomeScreen] No signed URL returned');
              setSignedThumbnailUrl(null);
            }
          } else {
            console.log('[HomeScreen] Could not extract thumbnail filename from:', thumbUrl);
            setSignedThumbnailUrl(null);
          }
        } catch (e) {
          console.error('[HomeScreen] Thumbnail URL processing error:', e);
          setSignedThumbnailUrl(null);
        }
      } else {
        console.log('[HomeScreen] No thumbnail URL in video data');
        setSignedThumbnailUrl(null);
      }
      
      hasLoadedVideoRef.current = true;
    } catch (error) {
      console.error('[HomeScreen] Load video error:', error);
      setLatestVideo(null);
      setSignedThumbnailUrl(null);
    } finally {
      setIsLoadingVideo(false);
    }
  }, [currentLocation]);

  useEffect(() => {
    if (isInitialized && !isLoading && user && profile && isSubscribed) {
      console.log('[HomeScreen] Triggering video load');
      hasLoadedVideoRef.current = false;
      loadLatestVideo();
    }
  }, [currentLocation, isInitialized, isLoading, user, profile, isSubscribed, loadLatestVideo]);

  const handleRefresh = async () => {
    console.log('[HomeScreen] User initiated refresh');
    setIsRefreshing(true);
    hasLoadedVideoRef.current = false;
    await Promise.all([refreshData(), loadLatestVideo()]);
    setIsRefreshing(false);
  };

  const handleVideoPress = useCallback(() => {
    if (latestVideo) {
      console.log('[HomeScreen] Opening video player for:', latestVideo.id);
      
      router.push({
        pathname: '/video-player',
        params: {
          videoId: latestVideo.id
        }
      });
    }
  }, [latestVideo]);

  const handleSubscribeNow = async () => {
    console.log('[HomeScreen] Subscribe button pressed');
    
    if (!user) {
      console.log('[HomeScreen] No user, redirecting to login');
      router.push('/login');
      return;
    }
    
    setIsSubscribing(true);
    
    await openPaywall(user.id, user.email || undefined, async () => {
      console.log('[HomeScreen] Subscription successful, refreshing profile');
      await refreshProfile();
    });
    
    setIsSubscribing(false);
  };

  if (!isInitialized || isLoading) {
    const loadingTextContent = 'Loading...';
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
  
  const windSpeedValue = surfConditions?.wind_speed || weatherData?.wind_speed || todaysReport?.wind_speed;
  const windDirValue = surfConditions?.wind_direction || weatherData?.wind_direction || todaysReport?.wind_direction;
  const windDisplay = windSpeedValue && windDirValue ? `${windSpeedValue} ${windDirValue}` : 'N/A';
  
  const airTempValue = weatherData?.temperature || todaysReport?.air_temp;
  const airTempDisplay = airTempValue ? `${Math.round(Number(airTempValue))}°F` : 'N/A';
  
  const weatherDescDisplay = weatherData?.conditions || todaysReport?.weather_conditions || 'N/A';
  
  const waterTempValue = surfConditions?.water_temp || todaysReport?.water_temp;
  const waterTempDisplay = formatWaterTemp(waterTempValue);
  
  const ratingColorValue = getRatingColor(ratingValue);
  const ratingLabel = 'Stoke Rating';

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
  const surfHeightLabel = 'Surf Height';
  const windLabel = 'Wind';
  const waterTempLabel = 'Water Temp';
  const surfReportTitle = 'Surf Report';
  const noNarrativeText = `No surf conditions narrative available for ${locationData.displayName}.`;
  const editedNotePrefix = 'Edited ';
  const viewFullReportText = 'View Full Report';
  const forecastTitle = '7-Day Forecast';
  const swellLabel = 'swell';
  const noForecastText = 'No forecast data available yet. Pull down to refresh or check back later.';
  const tapToPlayText = 'Tap to Play Video';

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
              {signedThumbnailUrl ? (
                <Image
                  source={{ uri: signedThumbnailUrl }}
                  style={styles.thumbnailImage}
                  resizeMode="cover"
                  onError={(e) => {
                    console.log('[HomeScreen] Thumbnail load error:', e.nativeEvent.error);
                    setSignedThumbnailUrl(null);
                  }}
                  onLoad={() => {
                    console.log('[HomeScreen] Thumbnail loaded successfully');
                  }}
                />
              ) : (
                <View style={styles.thumbnailPlaceholder}>
                  <IconSymbol
                    ios_icon_name="photo"
                    android_material_icon_name="image"
                    size={48}
                    color="rgba(255, 255, 255, 0.3)"
                  />
                </View>
              )}
              <View style={styles.videoOverlay}>
                <View style={styles.videoTitleOverlay}>
                  <IconSymbol
                    ios_icon_name="play.circle.fill"
                    android_material_icon_name="play-circle-filled"
                    size={80}
                    color="rgba(255, 255, 255, 0.95)"
                  />
                  <Text style={styles.videoTitleOnVideo}>SurfVista</Text>
                  <Text style={styles.tapToPlayText}>{tapToPlayText}</Text>
                </View>
              </View>
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
                      {surfHeightLabel}
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
  thumbnailImage: {
    width: '100%',
    height: '100%',
  },
  thumbnailPlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: '#1a1a1a',
    justifyContent: 'center',
    alignItems: 'center',
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
  videoTitleOverlay: {
    alignItems: 'center',
    gap: 12,
  },
  videoTitleOnVideo: {
    color: 'rgba(255, 255, 255, 0.95)',
    fontSize: 32,
    fontWeight: 'bold',
    textShadowColor: 'rgba(0, 0, 0, 0.7)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  tapToPlayText: {
    color: 'rgba(255, 255, 255, 0.85)',
    fontSize: 14,
    fontWeight: '600',
    textShadowColor: 'rgba(0, 0, 0, 0.7)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
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
