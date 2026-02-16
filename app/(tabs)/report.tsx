
import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl, Alert } from "react-native";
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
import { formatWaterTemp, formatLastUpdated, getESTDate, formatDateString } from "@/utils/surfDataFormatter";
import { useLocation } from "@/contexts/LocationContext";
import { selectNarrativeText, isCustomNarrative } from "@/utils/reportNarrativeSelector";
import { openPaywall } from "@/utils/paywallHelper";

// 🚨 CRITICAL FIX: More conservative stoke meter calculation matching backend
function calculateSurfRating(surfData: any): number {
  if (!surfData) return 5;
  
  const surfHeightStr = surfData.surf_height || surfData.wave_height || '0';
  const periodStr = surfData.wave_period || '0';
  const windSpeedStr = surfData.wind_speed || '0';
  const windDirStr = surfData.wind_direction || '';
  
  console.log('[calculateSurfRating] Input:', { surfHeightStr, periodStr, windSpeedStr, windDirStr });
  
  if (surfHeightStr === 'N/A' || surfHeightStr === '' || surfHeightStr === 'null') {
    console.log('[calculateSurfRating] Wave sensors offline - returning neutral rating of 5');
    return 5;
  }
  
  // Parse wave height - handle ranges like "1.0-1.5 ft"
  const parseValue = (str: string): number => {
    const cleaned = String(str).replace(/[^0-9.-]/g, '');
    const parsed = parseFloat(cleaned);
    return isNaN(parsed) ? 0 : parsed;
  };
  
  let surfHeight = 0;
  const cleanedStr = String(surfHeightStr).trim();
  
  if (cleanedStr.includes('-')) {
    // It's a range, take the average
    const parts = cleanedStr.split('-');
    const low = parseValue(parts[0]);
    const high = parseValue(parts[1]);
    surfHeight = (low + high) / 2;
    console.log('[calculateSurfRating] Parsed range:', { low, high, average: surfHeight });
  } else {
    surfHeight = parseValue(cleanedStr);
    console.log('[calculateSurfRating] Parsed single value:', surfHeight);
  }
  
  const period = parseValue(periodStr);
  const windSpeed = parseValue(windSpeedStr);
  const windDir = windDirStr.toLowerCase();
  const isOffshore = windDir.includes('w') || windDir.includes('n');

  console.log('[calculateSurfRating] Numeric values:', { surfHeight, period, windSpeed, isOffshore });

  // 🚨 CRITICAL FIX: Start at 3 instead of 5 for more realistic ratings
  let rating = 3;

  // Height contribution (more conservative)
  if (surfHeight >= 6) {
    rating += 5; // 8/10 for overhead
  } else if (surfHeight >= 4) {
    rating += 4; // 7/10 for chest-head high
  } else if (surfHeight >= 3) {
    rating += 3; // 6/10 for waist-chest high
  } else if (surfHeight >= 2) {
    rating += 2; // 5/10 for waist high
  } else if (surfHeight >= 1.5) {
    rating += 1; // 4/10 for knee-waist
  } else if (surfHeight >= 1) {
    rating += 0; // 3/10 for ankle-knee (base rating)
  } else {
    rating -= 1; // 2/10 for less than 1 foot
  }

  // Period contribution (more conservative)
  if (period >= 12) {
    rating += 2; // Long period groundswell
  } else if (period >= 10) {
    rating += 1; // Good period
  } else if (period >= 8) {
    rating += 0; // Moderate period (no change)
  } else if (period >= 6) {
    rating -= 1; // Short period
  } else if (period > 0) {
    rating -= 2; // Very short period wind swell
  }

  // Wind contribution (check direction too)
  if (isOffshore) {
    // Offshore wind is good
    if (windSpeed < 5) {
      rating += 1; // Light offshore, glassy
    } else if (windSpeed < 10) {
      rating += 1; // Offshore grooming
    } else if (windSpeed < 15) {
      rating += 0; // Strong offshore (no change)
    } else {
      rating -= 1; // Too strong offshore
    }
  } else {
    // Onshore wind is bad
    if (windSpeed < 5) {
      rating += 0; // Light onshore (no change)
    } else if (windSpeed < 10) {
      rating -= 1; // Moderate onshore
    } else if (windSpeed < 15) {
      rating -= 2; // Strong onshore
    } else {
      rating -= 3; // Very strong onshore, blown out
    }
  }

  const finalRating = Math.max(1, Math.min(10, Math.round(rating)));
  console.log(`[calculateSurfRating] ✅ Final rating: ${finalRating}/10 (height=${surfHeight}ft, period=${period}s, wind=${windSpeed}mph ${isOffshore ? 'offshore' : 'onshore'})`);
  
  return finalRating;
}

export default function ReportScreen() {
  const theme = useTheme();
  const { user, profile, checkSubscription, isLoading: authLoading, isInitialized, refreshProfile } = useAuth();
  const isSubscribed = checkSubscription();
  const { currentLocation, locationData } = useLocation();
  const { surfReports, surfConditions, weatherData, tideData, isLoading, error, refreshData, updateAllData, lastUpdated } = useSurfData();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [latestVideo, setLatestVideo] = useState<Video | null>(null);
  const [isLoadingVideo, setIsLoadingVideo] = useState(false);
  const [videoReady, setVideoReady] = useState(false);
  const [isSubscribing, setIsSubscribing] = useState(false);
  
  // ✅ FIX: Track if we've loaded data to prevent reload on every focus
  const hasLoadedDataRef = useRef(false);
  const hasLoadedVideoRef = useRef(false);

  const videoPlayer = useVideoPlayer(latestVideo?.video_url || '', (player) => {
    if (latestVideo?.video_url) {
      console.log('[ReportScreen] Initializing video preview player with caching');
      player.loop = true;
      player.muted = true;
      player.volume = 0;
      console.log('[ReportScreen] ✅ Video preview caching: ENABLED');
    }
  });

  const isDarkMode = theme.dark;

  const isValidValue = (value: any): boolean => {
    if (value === null || value === undefined) return false;
    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (trimmed === '' || trimmed === 'N/A' || trimmed.toLowerCase() === 'n/a') return false;
    }
    return true;
  };

  const hasValidSurfData = useCallback((data: any) => {
    if (!data) return false;
    
    const surfHeight = data.surf_height || data.wave_height;
    const wavePeriod = data.wave_period;
    const swellDirection = data.swell_direction;
    
    const hasValidSurfHeight = isValidValue(surfHeight);
    const hasValidWavePeriod = isValidValue(wavePeriod);
    const hasValidSwellDirection = isValidValue(swellDirection);
    
    return hasValidSurfHeight && hasValidWavePeriod && hasValidSwellDirection;
  }, []);

  const todayDate = useMemo(() => getESTDate(), []);

  const locationSurfReports = useMemo(() => {
    const filtered = surfReports.filter(report => report.location === currentLocation);
    console.log('[ReportScreen] Filtered reports for location:', currentLocation, 'count:', filtered.length);
    return filtered;
  }, [surfReports, currentLocation]);

  const todaysReport = useMemo(() => {
    try {
      console.log('[ReportScreen] ===== FINDING TODAY\'S REPORT =====');
      console.log('[ReportScreen] Current EST date:', todayDate);
      console.log('[ReportScreen] Current location:', currentLocation, locationData.displayName);
      console.log('[ReportScreen] Total reports for this location:', locationSurfReports.length);
      
      const todayReports = locationSurfReports.filter(report => {
        if (!report.date) return false;
        const reportDate = report.date.split('T')[0];
        return reportDate === todayDate;
      });
      
      console.log('[ReportScreen] Found', todayReports.length, 'reports for today at', locationData.displayName);
      
      if (todayReports.length > 0) {
        const report = todayReports[0];
        console.log('[ReportScreen] ===== USING TODAY\'S REPORT =====');
        console.log('[ReportScreen] Report ID:', report.id);
        console.log('[ReportScreen] Report location:', report.location);
        console.log('[ReportScreen] Has report_text (edited):', !!report.report_text);
        console.log('[ReportScreen] Has conditions (auto):', !!report.conditions);
        console.log('[ReportScreen] report_text length:', report.report_text?.length || 0);
        console.log('[ReportScreen] conditions length:', report.conditions?.length || 0);
        return report;
      } else {
        console.log('[ReportScreen] ❌ No report found for today at', locationData.displayName);
        return null;
      }
    } catch (error) {
      console.error('[ReportScreen] Error filtering reports:', error);
      return null;
    }
  }, [locationSurfReports, todayDate, currentLocation, locationData.displayName]);

  const lastValidReport = useMemo(() => {
    const sortedReports = [...locationSurfReports].sort((a, b) => {
      const dateA = new Date(a.date).getTime();
      const dateB = new Date(b.date).getTime();
      return dateB - dateA;
    });
    
    const validReport = sortedReports.find(report => hasValidSurfData(report));
    
    console.log('[ReportScreen] Last valid report search for', locationData.displayName, ':', {
      totalReports: sortedReports.length,
      foundValid: !!validReport,
      validReportDate: validReport?.date,
      validReportLocation: validReport?.location,
      validReportSurfHeight: validReport?.surf_height,
      validReportWaveHeight: validReport?.wave_height
    });
    
    return validReport;
  }, [locationSurfReports, hasValidSurfData, locationData.displayName]);

  const displayReport = useMemo(() => {
    if (todaysReport) {
      console.log('[ReportScreen] ✅ Using today\'s report for display at', locationData.displayName);
      return todaysReport;
    }
    
    if (lastValidReport) {
      console.log('[ReportScreen] Using last valid report from:', lastValidReport.date, 'at', locationData.displayName);
      return lastValidReport;
    }
    
    console.log('[ReportScreen] ❌ No report to display for', locationData.displayName);
    return null;
  }, [todaysReport, lastValidReport, locationData.displayName]);

  // 🚨 DATA FLOW ARCHITECTURE:
  // 1. Scheduled CRON job (6 AM daily) pulls fresh data from buoy → surf_conditions table
  // 2. Report page displays data from surf_conditions table (most up-to-date)
  // 3. Manual "Regenerate Text" button uses this SAME surf_conditions data (no fresh pull)
  // 4. This ensures report generator always uses the data that's already on the report page
  
  // 🚨 CRITICAL FIX: Calculate rating from most current surf_conditions data
  const currentRating = useMemo(() => {
    console.log('[ReportScreen] ===== CALCULATING CURRENT RATING =====');
    console.log('[ReportScreen] Has surfConditions:', !!surfConditions);
    console.log('[ReportScreen] Has todaysReport:', !!todaysReport);
    
    // ALWAYS use surf_conditions if available (most current data from scheduled updates)
    if (surfConditions) {
      const rating = calculateSurfRating(surfConditions);
      console.log('[ReportScreen] ✅ Using rating from surf_conditions (from scheduled updates):', rating);
      return rating;
    }
    
    // Fallback to report rating if no surf_conditions
    if (todaysReport?.rating) {
      console.log('[ReportScreen] Using rating from report (stored):', todaysReport.rating);
      return todaysReport.rating;
    }
    
    // Last resort: calculate from report data
    if (todaysReport) {
      const rating = calculateSurfRating(todaysReport);
      console.log('[ReportScreen] Calculated rating from report data:', rating);
      return rating;
    }
    
    console.log('[ReportScreen] No data available, using default rating: 5');
    return 5;
  }, [surfConditions, todaysReport]);

  const loadLatestVideo = useCallback(async () => {
    try {
      setIsLoadingVideo(true);
      setVideoReady(false);
      console.log('[ReportScreen] Fetching latest video for location:', currentLocation, locationData.displayName);
      
      const { data: videoData, error: videoError } = await supabase
        .from('videos')
        .select('*')
        .eq('location', currentLocation)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (videoError) {
        console.log('[ReportScreen] Video fetch error:', videoError.message);
      } else if (videoData) {
        console.log('[ReportScreen] Video loaded:', videoData.title, 'for location:', videoData.location, locationData.displayName);
        setLatestVideo(videoData);
        hasLoadedVideoRef.current = true;
      } else {
        console.log('[ReportScreen] No videos found for location:', currentLocation, locationData.displayName);
        setLatestVideo(null);
      }
    } catch (error) {
      console.error('[ReportScreen] Error loading video:', error);
    } finally {
      setIsLoadingVideo(false);
    }
  }, [currentLocation, locationData.displayName]);

  // ✅ FIX: Only load data once on mount, not on every focus
  useFocusEffect(
    useCallback(() => {
      console.log('[ReportScreen] Screen focused');
      
      // Resume video playback if we have a video loaded
      if (latestVideo?.video_url && videoPlayer && videoReady) {
        console.log('[ReportScreen] Resuming video preview playback');
        videoPlayer.play();
      }
      
      // Only load data if we haven't loaded it yet
      if (isInitialized && !authLoading && user && profile && isSubscribed) {
        if (!hasLoadedDataRef.current) {
          console.log('[ReportScreen] First load - fetching data for', locationData.displayName);
          refreshData();
          hasLoadedDataRef.current = true;
        } else {
          console.log('[ReportScreen] Data already loaded, skipping refresh');
        }
        
        if (!hasLoadedVideoRef.current) {
          console.log('[ReportScreen] First load - fetching video');
          loadLatestVideo();
        }
      }

      // Cleanup: Pause video when screen loses focus
      return () => {
        console.log('[ReportScreen] Screen blurred - pausing video playback');
        if (videoPlayer && videoReady) {
          videoPlayer.pause();
        }
      };
    }, [isInitialized, authLoading, user, profile, isSubscribed, refreshData, loadLatestVideo, locationData.displayName, latestVideo, videoPlayer, videoReady])
  );

  // ✅ FIX: Only reload data when location changes
  useEffect(() => {
    if (isInitialized && !authLoading && user && profile && isSubscribed) {
      console.log('[ReportScreen] Location changed to:', currentLocation, locationData.displayName);
      console.log('[ReportScreen] Reloading data and video for new location');
      hasLoadedDataRef.current = false;
      hasLoadedVideoRef.current = false;
      refreshData();
      loadLatestVideo();
    }
  }, [currentLocation, isInitialized, authLoading, user, profile, isSubscribed, refreshData, loadLatestVideo, locationData.displayName]);

  const handleRefresh = async () => {
    console.log('[ReportScreen] User initiated refresh for location:', currentLocation, locationData.displayName);
    setIsRefreshing(true);
    await Promise.all([refreshData(), loadLatestVideo()]);
    setIsRefreshing(false);
  };

  const handleUpdateData = async () => {
    setIsRefreshing(true);
    try {
      console.log('[ReportScreen] Starting data update for location:', currentLocation, locationData.displayName);
      await updateAllData();
      console.log('[ReportScreen] Data update completed successfully for', locationData.displayName);
      
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      await refreshData();
      
      Alert.alert(
        'Update Complete',
        `Surf data has been updated from NOAA for ${locationData.displayName}. The display has been refreshed.`,
        [{ text: 'OK' }]
      );
    } catch (error) {
      console.error('[ReportScreen] Update error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      let userMessage = errorMessage;
      let detailMessage = 'Please check your internet connection and try again.';
      
      if (errorMessage.includes('Weather:') || errorMessage.includes('Surf:')) {
        userMessage = 'Failed to update surf data';
        detailMessage = errorMessage + '\n\nPlease check your internet connection and try again.';
      } else if (errorMessage.includes('Network error') || errorMessage.includes('Failed to fetch')) {
        userMessage = 'Network Error';
        detailMessage = 'Unable to connect to NOAA servers. Please check your internet connection and try again.';
      } else if (errorMessage.includes('timeout')) {
        userMessage = 'Request Timeout';
        detailMessage = 'The request took too long. NOAA servers may be slow. Please try again in a few moments.';
      }
      
      Alert.alert(
        userMessage,
        detailMessage,
        [{ text: 'OK' }]
      );
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleVideoPress = useCallback(() => {
    if (latestVideo) {
      console.log('[ReportScreen] Opening fullscreen video player for:', latestVideo.id);
      console.log('[ReportScreen] ✅ Passing preloaded URL for instant playback');
      
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

  const handleEditReport = useCallback(() => {
    console.log('[ReportScreen] Opening edit report screen for today\'s report at', locationData.displayName);
    router.push('/edit-report');
  }, [locationData.displayName]);

  const handleSubscribeNow = async () => {
    console.log('[ReportScreen] 🔘 Subscribe button pressed');
    
    if (!user) {
      console.log('[ReportScreen] No user, redirecting to login');
      router.push('/login');
      return;
    }
    
    setIsSubscribing(true);
    
    await openPaywall(user.id, user.email || undefined, async () => {
      console.log('[ReportScreen] ✅ Subscription successful, refreshing profile');
      await refreshProfile();
    });
    
    setIsSubscribing(false);
  };

  useEffect(() => {
    if (latestVideo?.video_url && videoPlayer) {
      console.log('[ReportScreen] Loading video preview with caching enabled');
      videoPlayer.replace(latestVideo.video_url);
      videoPlayer.play();
      setVideoReady(true);
    }
  }, [latestVideo?.video_url, videoPlayer]);

  const getSwellDirectionIcon = (direction: string | null) => {
    if (!direction) return { ios: 'arrow.up', android: 'north' };
    
    const upper = direction.toUpperCase().trim();
    
    if (upper === 'N' || upper === 'NORTH') {
      return { ios: 'arrow.up', android: 'north' };
    } else if (upper === 'NE' || upper === 'NORTHEAST' || upper.includes('NORTH') && upper.includes('EAST')) {
      return { ios: 'arrow.up.right', android: 'north-east' };
    } else if (upper === 'E' || upper === 'EAST') {
      return { ios: 'arrow.right', android: 'east' };
    } else if (upper === 'SE' || upper === 'SOUTHEAST' || upper.includes('SOUTH') && upper.includes('EAST')) {
      return { ios: 'arrow.down.right', android: 'south-east' };
    } else if (upper === 'S' || upper === 'SOUTH') {
      return { ios: 'arrow.down', android: 'south' };
    } else if (upper === 'SW' || upper === 'SOUTHWEST' || upper.includes('SOUTH') && upper.includes('WEST')) {
      return { ios: 'arrow.down.left', android: 'south-west' };
    } else if (upper === 'W' || upper === 'WEST') {
      return { ios: 'arrow.left', android: 'west' };
    } else if (upper === 'NW' || upper === 'NORTHWEST' || upper.includes('NORTH') && upper.includes('WEST')) {
      return { ios: 'arrow.up.left', android: 'north-west' };
    }
    
    const degreeMatch = direction.match(/(\d+)/);
    if (degreeMatch) {
      const degrees = parseInt(degreeMatch[1]);
      if (degrees >= 0 && degrees <= 360) {
        if (degrees >= 337.5 || degrees < 22.5) {
          return { ios: 'arrow.up', android: 'north' };
        } else if (degrees >= 22.5 && degrees < 67.5) {
          return { ios: 'arrow.up.right', android: 'north-east' };
        } else if (degrees >= 67.5 && degrees < 112.5) {
          return { ios: 'arrow.right', android: 'east' };
        } else if (degrees >= 112.5 && degrees < 157.5) {
          return { ios: 'arrow.down.right', android: 'south-east' };
        } else if (degrees >= 157.5 && degrees < 202.5) {
          return { ios: 'arrow.down', android: 'south' };
        } else if (degrees >= 202.5 && degrees < 247.5) {
          return { ios: 'arrow.down.left', android: 'south-west' };
        } else if (degrees >= 247.5 && degrees < 292.5) {
          return { ios: 'arrow.left', android: 'west' };
        } else if (degrees >= 292.5 && degrees < 337.5) {
          return { ios: 'arrow.up.left', android: 'north-west' };
        }
      }
    }
    
    return { ios: 'location.north.fill', android: 'navigation' };
  };

  const renderReportCard = (report: any, index: number) => {
    // 🚨 CRITICAL FIX: Use current rating calculated from surf_conditions
    const displayRating = currentRating;
    
    const displayData = surfConditions || report;
    const hasValidWaveData = hasValidSurfData(displayData);
    
    const reportDateStr = report.date.split('T')[0];
    const isToday = reportDateStr === todayDate;
    
    console.log('[ReportScreen] ===== RENDER REPORT CARD =====');
    console.log('[ReportScreen] Today\'s date (EST):', todayDate);
    console.log('[ReportScreen] Report date:', reportDateStr, '(isToday:', isToday + ')');
    console.log('[ReportScreen] Report location:', report.location, locationData.displayName);
    console.log('[ReportScreen] Current location:', currentLocation);
    console.log('[ReportScreen] Using data from:', surfConditions ? 'surf_conditions (real-time)' : 'report (stored)');
    console.log('[ReportScreen] Has valid wave data:', hasValidWaveData);
    console.log('[ReportScreen] Display data surf_height:', displayData.surf_height);
    console.log('[ReportScreen] Display data wave_height:', displayData.wave_height);
    console.log('[ReportScreen] Display data wind_speed:', displayData.wind_speed);
    console.log('[ReportScreen] Display data wind_direction:', displayData.wind_direction);
    console.log('[ReportScreen] 🎯 STOKE METER RATING:', displayRating);
    
    const swellIcon = getSwellDirectionIcon(displayData.swell_direction);
    const reportKey = report.id ? `report-${report.id}` : `report-index-${index}`;

    const labelColor = isDarkMode ? colors.reportLabel : colors.textSecondary;
    const valueColor = isDarkMode ? colors.reportBoldText : colors.text;
    
    const surfHeightValue = displayData.surf_height || displayData.wave_height;
    const surfHeightDisplay = isValidValue(surfHeightValue) ? surfHeightValue : null;
    
    const windSpeedValue = displayData.wind_speed;
    const windSpeedDisplay = isValidValue(windSpeedValue) ? windSpeedValue : null;
    
    const windDirectionValue = displayData.wind_direction;
    const windDirectionDisplay = isValidValue(windDirectionValue) ? windDirectionValue : null;
    
    const waterTempValue = displayData.water_temp;
    const waterTempFormatted = isValidValue(waterTempValue) ? formatWaterTemp(waterTempValue) : null;
    
    const wavePeriodValue = displayData.wave_period;
    const wavePeriodDisplay = isValidValue(wavePeriodValue) ? wavePeriodValue : null;
    
    const swellDirectionValue = displayData.swell_direction;
    const swellDirectionDisplay = isValidValue(swellDirectionValue) ? swellDirectionValue : null;
    
    console.log('[ReportScreen] Surf height to display:', surfHeightDisplay);
    console.log('[ReportScreen] Wind to display:', windSpeedDisplay, windDirectionDisplay);
    
    const dataUpdatedAt = displayData.updated_at || report.updated_at;
    const dataUpdatedText = formatLastUpdated(dataUpdatedAt);
    
    const reportTides = tideData.filter(tide => {
      const tideDate = tide.date.split('T')[0];
      return tideDate === todayDate && tide.location === currentLocation;
    });
    
    console.log('[ReportScreen] Tides for', locationData.displayName, ':', reportTides.length);
    
    const todayDisplayDate = formatDateString(todayDate);
    
    const narrativeText = selectNarrativeText(report);
    const isCustomReport = isCustomNarrative(report);
    
    console.log('[ReportScreen] ===== NARRATIVE DISPLAY =====');
    console.log('[ReportScreen] Location:', locationData.displayName);
    console.log('[ReportScreen] Report location:', report.location);
    console.log('[ReportScreen] Narrative length:', narrativeText?.length || 0);
    console.log('[ReportScreen] Is custom (edited):', isCustomReport);
    console.log('[ReportScreen] Source:', isCustomReport ? 'report_text (edited)' : 'conditions (auto)');
    
    return (
      <View 
        key={reportKey}
        style={[styles.reportCard, { backgroundColor: theme.colors.card }]}
      >
        <View style={styles.reportHeader}>
          <View style={styles.reportHeaderLeft}>
            <Text style={[styles.reportDate, { color: theme.colors.text }]}>
              {todayDisplayDate}
            </Text>
            <Text style={[styles.reportSubtitle, { color: colors.textSecondary }]}>
              Report for {locationData.displayName}
            </Text>
            {dataUpdatedAt && (
              <View style={styles.lastUpdatedContainer}>
                <IconSymbol
                  ios_icon_name="clock.fill"
                  android_material_icon_name="schedule"
                  size={12}
                  color={colors.textSecondary}
                />
                <Text style={[styles.lastUpdatedText, { color: colors.textSecondary }]}>
                  Buoy last checked {dataUpdatedText}
                </Text>
              </View>
            )}
          </View>
          <View style={[styles.ratingBadge, { backgroundColor: getRatingColor(displayRating) }]}>
            <Text style={styles.ratingText}>{displayRating}/10</Text>
          </View>
        </View>

        {hasValidWaveData ? (
          <View style={styles.liveIndicator}>
            <View style={styles.liveDot} />
            <Text style={[styles.liveText, { color: colors.primary }]}>
              Live Buoy Data - Wave sensors reporting
            </Text>
          </View>
        ) : (
          <View style={[styles.liveIndicator, { backgroundColor: 'rgba(255, 152, 0, 0.1)' }]}>
            <IconSymbol
              ios_icon_name="info.circle"
              android_material_icon_name="info"
              size={14}
              color="#FF9800"
            />
            <Text style={[styles.liveText, { color: '#FF9800' }]}>
              Buoy online - Wave sensors temporarily offline (wind & water temp available)
            </Text>
          </View>
        )}

        <View style={styles.conditionsGrid}>
          <View style={styles.conditionRow}>
            {surfHeightDisplay && (
              <View style={styles.conditionItem}>
                <IconSymbol
                  ios_icon_name="water.waves"
                  android_material_icon_name="waves"
                  size={24}
                  color={colors.primary}
                />
                <View style={styles.conditionTextContainer}>
                  <Text style={[styles.conditionLabel, { color: labelColor }]}>
                    Surf Height
                  </Text>
                  <Text style={[styles.conditionValue, { color: valueColor }]}>
                    {surfHeightDisplay}
                  </Text>
                </View>
              </View>
            )}

            {windSpeedDisplay && (
              <View style={styles.conditionItem}>
                <IconSymbol
                  ios_icon_name="wind"
                  android_material_icon_name="air"
                  size={24}
                  color={colors.primary}
                />
                <View style={styles.conditionTextContainer}>
                  <Text style={[styles.conditionLabel, { color: labelColor }]}>
                    Wind Speed
                  </Text>
                  <Text style={[styles.conditionValue, { color: valueColor }]}>
                    {windSpeedDisplay}
                  </Text>
                </View>
              </View>
            )}
          </View>

          <View style={styles.conditionRow}>
            {windDirectionDisplay && (
              <View style={styles.conditionItem}>
                <IconSymbol
                  ios_icon_name="location.north.fill"
                  android_material_icon_name="navigation"
                  size={24}
                  color={colors.primary}
                />
                <View style={styles.conditionTextContainer}>
                  <Text style={[styles.conditionLabel, { color: labelColor }]}>
                    Wind Direction
                  </Text>
                  <Text style={[styles.conditionValue, { color: valueColor }]}>
                    {windDirectionDisplay}
                  </Text>
                </View>
              </View>
            )}

            {waterTempFormatted && (
              <View style={styles.conditionItem}>
                <IconSymbol
                  ios_icon_name="thermometer"
                  android_material_icon_name="thermostat"
                  size={24}
                  color={colors.primary}
                />
                <View style={styles.conditionTextContainer}>
                  <Text style={[styles.conditionLabel, { color: labelColor }]}>
                    Water Temp
                  </Text>
                  <Text style={[styles.conditionValue, { color: valueColor }]}>
                    {waterTempFormatted}
                  </Text>
                </View>
              </View>
            )}
          </View>

          {(wavePeriodDisplay || swellDirectionDisplay) && (
            <View style={styles.conditionRow}>
              {wavePeriodDisplay && (
                <View style={styles.conditionItem}>
                  <IconSymbol
                    ios_icon_name="timer"
                    android_material_icon_name="schedule"
                    size={24}
                    color={colors.primary}
                  />
                  <View style={styles.conditionTextContainer}>
                    <Text style={[styles.conditionLabel, { color: labelColor }]}>
                      Wave Period
                    </Text>
                    <Text style={[styles.conditionValue, { color: valueColor }]}>
                      {wavePeriodDisplay}
                    </Text>
                  </View>
                </View>
              )}

              {swellDirectionDisplay && (
                <View style={styles.conditionItem}>
                  <IconSymbol
                    ios_icon_name={swellIcon.ios}
                    android_material_icon_name={swellIcon.android}
                    size={24}
                    color={colors.primary}
                  />
                  <View style={styles.conditionTextContainer}>
                    <Text style={[styles.conditionLabel, { color: labelColor }]}>
                      Swell Direction
                    </Text>
                    <Text style={[styles.conditionValue, { color: valueColor }]}>
                      {swellDirectionDisplay}
                    </Text>
                  </View>
                </View>
              )}
            </View>
          )}

          <View style={styles.tideContainer}>
            <View style={styles.tideHeader}>
              <IconSymbol
                ios_icon_name="arrow.up.arrow.down"
                android_material_icon_name="swap-vert"
                size={20}
                color={colors.primary}
              />
              <Text style={[styles.conditionLabel, { color: labelColor }]}>
                Tide Schedule
              </Text>
            </View>
            {reportTides.length > 0 ? (
              <View style={styles.tideTimesContainer}>
                {reportTides.map((tide, tideIndex) => {
                  const isHighTide = tide.type === 'high' || tide.type === 'High';
                  const tideIconColor = isHighTide ? '#2196F3' : '#FF9800';
                  const tideTime = new Date(`2000-01-01T${tide.time}`).toLocaleTimeString('en-US', {
                    hour: 'numeric',
                    minute: '2-digit',
                    hour12: true
                  });
                  const tideTypeText = isHighTide ? 'High' : 'Low';
                  const tideHeightText = `${Number(tide.height).toFixed(1)} ft`;
                  
                  return (
                    <View key={tideIndex} style={styles.tideTimeItem}>
                      <IconSymbol
                        ios_icon_name={isHighTide ? 'arrow.up' : 'arrow.down'}
                        android_material_icon_name={isHighTide ? 'north' : 'south'}
                        size={16}
                        color={tideIconColor}
                      />
                      <Text style={[styles.tideTimeText, { color: valueColor }]}>
                        {tideTypeText}
                      </Text>
                      <Text style={[styles.tideTimeText, { color: valueColor }]}>
                        {tideTime}
                      </Text>
                      <Text style={[styles.tideHeightText, { color: colors.textSecondary }]}>
                        {tideHeightText}
                      </Text>
                    </View>
                  );
                })}
              </View>
            ) : (
              <Text style={[styles.conditionValue, { color: valueColor }]}>
                No tide data available for {locationData.displayName}
              </Text>
            )}
          </View>
        </View>

        <View style={[styles.conditionsBox, { backgroundColor: colors.reportBackground }]}>
          <View style={styles.conditionsHeader}>
            <Text style={[styles.conditionsTitle, { color: colors.reportText }]}>
              Surf Conditions
            </Text>
            {profile?.is_admin && (
              <TouchableOpacity
                style={styles.editButton}
                onPress={handleEditReport}
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
          {narrativeText ? (
            <>
              <ReportTextDisplay 
                text={narrativeText}
                isCustom={isCustomReport}
              />
              {report.report_text && report.edited_at && (
                <Text style={[styles.editedNote, { color: colors.textSecondary }]}>
                  Edited {new Date(report.edited_at).toLocaleDateString()}
                </Text>
              )}
            </>
          ) : (
            <Text style={[styles.conditionsText, { color: colors.reportText }]}>
              No surf conditions narrative available for {locationData.displayName}.
            </Text>
          )}
        </View>
      </View>
    );
  };

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
    console.log('[ReportScreen] Showing locked content');
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
            onPress={handleSubscribeNow}
            disabled={isSubscribing}
          >
            {isSubscribing ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text style={styles.subscribeButtonText}>
                {user ? 'Subscribe Now' : 'Sign In / Subscribe'}
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  console.log('[ReportScreen] Showing surf reports for', locationData.displayName);
  console.log('[ReportScreen] Surf conditions available:', !!surfConditions);
  console.log('[ReportScreen] Weather data available:', !!weatherData);
  
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
          {locationData.displayName}
        </Text>
        {lastUpdated && (
          <Text style={[styles.lastUpdated, { color: colors.textSecondary }]}>
            Last updated: {lastUpdated.toLocaleTimeString()}
          </Text>
        )}
      </View>

      {profile?.is_admin && (
        <View style={styles.adminButtonsRow}>
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
              Update Data
            </Text>
          </TouchableOpacity>
          
          {todaysReport && (
            <TouchableOpacity
              style={[styles.editReportButton, { backgroundColor: colors.accent }]}
              onPress={handleEditReport}
            >
              <IconSymbol
                ios_icon_name="pencil"
                android_material_icon_name="edit"
                size={20}
                color="#FFFFFF"
              />
              <Text style={styles.updateButtonText}>
                Edit Report
              </Text>
            </TouchableOpacity>
          )}
        </View>
      )}

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
            <Text style={styles.errorSubtext}>
              Please check your internet connection and try again.
            </Text>
          </View>
        </View>
      )}

      {isLoading && !isRefreshing ? (
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
            Loading surf reports for {locationData.displayName}...
          </Text>
        </View>
      ) : !displayReport ? (
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
          {profile?.is_admin && (
            <TouchableOpacity
              style={[styles.generateButton, { backgroundColor: colors.accent }]}
              onPress={handleUpdateData}
            >
              <Text style={styles.generateButtonText}>
                Generate Report
              </Text>
            </TouchableOpacity>
          )}
        </View>
      ) : (
        renderReportCard(displayReport, 0)
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

      <View style={[styles.infoCard, { backgroundColor: theme.colors.card }]}>
        <IconSymbol
          ios_icon_name="info.circle.fill"
          android_material_icon_name="info"
          size={24}
          color={colors.primary}
        />
        <View style={styles.infoTextContainer}>
          <Text style={[styles.infoText, { color: colors.textSecondary }]}>
            Live surf conditions are automatically updated from official NOAA data sources - the most reliable and accurate surf and weather data available.
          </Text>
          <Text style={[styles.infoSubtext, { color: colors.textSecondary, marginTop: 8 }]}>
            <Text style={{ fontWeight: 'bold' }}>Data Sources for {locationData.displayName}:</Text>
          </Text>
          <Text style={[styles.infoSubtext, { color: colors.textSecondary }]}>
            • NOAA Buoy {locationData.buoyId} - Wave height, period, swell direction
          </Text>
          <Text style={[styles.infoSubtext, { color: colors.textSecondary }]}>
            • NOAA Weather Service - Forecasts and wind conditions
          </Text>
          <Text style={[styles.infoSubtext, { color: colors.textSecondary }]}>
            • NOAA Tides & Currents (Station {locationData.tideStationId}) - Tide predictions
          </Text>
          <Text style={[styles.infoSubtext, { color: colors.textSecondary, marginTop: 8 }]}>
            Surf height shown is the rideable face height (calculated from wave height and period). When wave sensors are temporarily offline, wind and water temperature data are still available from the buoy.
          </Text>
        </View>
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
  adminButtonsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  updateButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    gap: 8,
  },
  editReportButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    gap: 8,
  },
  updateButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: 'bold',
  },
  errorCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 16,
    borderRadius: 12,
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
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  reportHeaderLeft: {
    flex: 1,
    gap: 4,
  },
  reportDate: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  reportSubtitle: {
    fontSize: 14,
    fontWeight: '600',
    marginTop: 2,
  },
  lastUpdatedContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  lastUpdatedText: {
    fontSize: 11,
    fontStyle: 'italic',
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
  liveIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 16,
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: 'rgba(0, 122, 255, 0.1)',
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary,
  },
  liveText: {
    fontSize: 12,
    fontWeight: '600',
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
    marginTop: 8,
  },
  tideHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  tideTimesContainer: {
    gap: 8,
  },
  tideTimeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 4,
  },
  tideTimeText: {
    fontSize: 14,
    fontWeight: '600',
  },
  tideHeightText: {
    fontSize: 12,
    marginLeft: 'auto',
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
