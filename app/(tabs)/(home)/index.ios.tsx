
import { LocationSelector } from "@/components/LocationSelector";
import { WeeklyForecast } from "@/components/WeeklyForecast";
import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { SurfReport } from "@/types";
import { useAuth } from "@/contexts/AuthContext";
import { IconSymbol } from "@/components/IconSymbol";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl, Alert, ImageBackground, ImageSourcePropType, useColorScheme } from "react-native";
import { useSurfData } from "@/hooks/useSurfData";
import { useVideos } from "@/hooks/useVideos";
import { colors } from "@/styles/commonStyles";
import { router } from "expo-router";
import { presentPaywall } from "@/utils/superwallConfig";
import { selectNarrativeText } from "@/utils/reportNarrativeSelector";
import { useLocation } from "@/contexts/LocationContext";

function resolveImageSource(source: string | number | ImageSourcePropType | undefined): ImageSourcePropType {
  if (!source) return { uri: '' };
  if (typeof source === 'string') return { uri: source };
  return source as ImageSourcePropType;
}

function getESTDate(): string {
  const now = new Date();
  const estOffset = -5 * 60;
  const localOffset = now.getTimezoneOffset();
  const estTime = new Date(now.getTime() + (estOffset - localOffset) * 60 * 1000);
  return estTime.toISOString().split('T')[0];
}

export default function HomeScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  
  const { user, profile, checkSubscription, session, isLoading: authLoading, isInitialized } = useAuth();
  const { videos, refreshVideos } = useVideos();
  const { surfReports, weatherData, weatherForecast, refreshData } = useSurfData();
  const { currentLocation, locationData } = useLocation();
  
  const [refreshing, setRefreshing] = useState(false);
  const hasInitialLoadedRef = useRef(false);
  const previousLocationRef = useRef(currentLocation);

  const hasSubscription = useMemo(() => {
    return checkSubscription();
  }, [checkSubscription]);

  const isLoading = useMemo(() => {
    return authLoading || !isInitialized;
  }, [authLoading, isInitialized]);

  // ✅ CRITICAL FIX: Only load data on initial mount when auth is ready
  useEffect(() => {
    if (isInitialized && !isLoading && user && profile && session && !hasInitialLoadedRef.current) {
      console.log('[HomeScreen] Initial auth ready, loading data for location:', currentLocation);
      hasInitialLoadedRef.current = true;
      
      // Load data without creating new callbacks
      Promise.all([
        refreshVideos(),
        refreshData()
      ]).catch(error => {
        console.error('[HomeScreen] Error loading initial data:', error);
      });
    }
  }, [isInitialized, isLoading, user, profile, session]);

  // ✅ CRITICAL FIX: Handle location changes separately without triggering full reload
  useEffect(() => {
    if (previousLocationRef.current !== currentLocation && hasInitialLoadedRef.current) {
      console.log('[HomeScreen] Location changed from', previousLocationRef.current, 'to', currentLocation);
      previousLocationRef.current = currentLocation;
      
      // useSurfData and useVideos will automatically refresh when location changes
      // No need to manually trigger refresh here
    }
  }, [currentLocation]);

  const handleRefresh = useCallback(async () => {
    console.log('[HomeScreen] Manual refresh triggered');
    setRefreshing(true);
    try {
      await Promise.all([
        refreshVideos(),
        refreshData()
      ]);
    } catch (error) {
      console.error('[HomeScreen] Error refreshing data:', error);
    } finally {
      setRefreshing(false);
    }
  }, [refreshVideos, refreshData]);

  const handleVideoPress = useCallback((videoId: string) => {
    console.log('[HomeScreen] Video pressed:', videoId);
    router.push(`/video-player?videoId=${videoId}`);
  }, []);

  const handleSubscribe = useCallback(async () => {
    console.log('[HomeScreen] Subscribe button pressed');
    try {
      await presentPaywall();
    } catch (error) {
      console.error('[HomeScreen] Error presenting paywall:', error);
      Alert.alert('Error', 'Failed to open subscription page. Please try again.');
    }
  }, []);

  const handleSignIn = useCallback(() => {
    console.log('[HomeScreen] Sign In button pressed');
    router.push('/login');
  }, []);

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: isDark ? '#000000' : colors.background,
    },
    scrollContent: {
      paddingBottom: 100,
    },
    welcomeText: {
      fontSize: 18,
      color: isDark ? '#B0B0B0' : colors.textSecondary,
      textAlign: 'center',
      marginTop: 20,
      marginBottom: 8,
    },
    videoCard: {
      marginHorizontal: 20,
      marginBottom: 20,
      borderRadius: 16,
      overflow: 'hidden',
      backgroundColor: isDark ? '#1A1A1A' : colors.card,
    },
    videoThumbnail: {
      width: '100%',
      height: 250,
      justifyContent: 'center',
      alignItems: 'center',
    },
    videoOverlay: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.3)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    surfVistaTitle: {
      fontSize: 48,
      fontWeight: 'bold',
      color: '#5B9BD5',
      textAlign: 'center',
      marginBottom: 16,
    },
    playButton: {
      width: 60,
      height: 60,
      borderRadius: 30,
      backgroundColor: 'rgba(91, 155, 213, 0.9)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    locationSection: {
      marginHorizontal: 20,
      marginBottom: 20,
    },
    updatedRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 12,
      gap: 8,
    },
    updatedText: {
      fontSize: 14,
      color: isDark ? '#B0B0B0' : colors.textSecondary,
    },
    conditionsCard: {
      marginHorizontal: 20,
      marginBottom: 20,
      backgroundColor: isDark ? '#1A1A1A' : colors.card,
      borderRadius: 16,
      padding: 16,
    },
    conditionsTitle: {
      fontSize: 18,
      fontWeight: 'bold',
      color: isDark ? '#FFFFFF' : colors.text,
      marginBottom: 12,
    },
    conditionsGrid: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: 12,
    },
    conditionItem: {
      flex: 1,
    },
    temperatureText: {
      fontSize: 32,
      fontWeight: 'bold',
      color: isDark ? '#FFFFFF' : colors.text,
    },
    weatherText: {
      fontSize: 14,
      color: isDark ? '#B0B0B0' : colors.textSecondary,
      marginTop: 4,
    },
    stokeRatingContainer: {
      alignItems: 'flex-end',
    },
    stokeLabel: {
      fontSize: 12,
      color: isDark ? '#B0B0B0' : colors.textSecondary,
      marginBottom: 4,
    },
    stokeRating: {
      fontSize: 32,
      fontWeight: 'bold',
      color: '#FF6B35',
    },
    weatherDetailsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 16,
      paddingTop: 12,
      borderTopWidth: 1,
      borderTopColor: isDark ? '#333333' : colors.secondary,
    },
    weatherDetail: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    weatherDetailText: {
      fontSize: 13,
      color: isDark ? '#FFFFFF' : colors.text,
    },
    reportCard: {
      marginHorizontal: 20,
      marginBottom: 20,
      backgroundColor: isDark ? '#1A1A1A' : colors.card,
      borderRadius: 16,
      padding: 16,
    },
    reportHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 12,
      gap: 8,
    },
    reportTitle: {
      fontSize: 18,
      fontWeight: 'bold',
      color: isDark ? '#FFFFFF' : colors.text,
    },
    reportText: {
      fontSize: 14,
      color: isDark ? '#FFFFFF' : colors.text,
      lineHeight: 20,
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: 20,
      backgroundColor: isDark ? '#000000' : colors.background,
    },
    loadingText: {
      marginTop: 12,
      fontSize: 16,
      color: isDark ? '#B0B0B0' : colors.textSecondary,
    },
    welcomeContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: 20,
      backgroundColor: isDark ? '#000000' : colors.background,
    },
    logoContainer: {
      width: 120,
      height: 120,
      borderRadius: 60,
      backgroundColor: colors.primary,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 24,
    },
    appTitle: {
      fontSize: 32,
      fontWeight: 'bold',
      color: isDark ? '#FFFFFF' : colors.text,
      marginBottom: 8,
    },
    appSubtitle: {
      fontSize: 16,
      color: isDark ? '#B0B0B0' : colors.textSecondary,
      marginBottom: 40,
    },
    signInButton: {
      backgroundColor: colors.primary,
      paddingHorizontal: 48,
      paddingVertical: 16,
      borderRadius: 12,
      marginBottom: 16,
      minWidth: 200,
      alignItems: 'center',
    },
    signInButtonText: {
      color: '#FFFFFF',
      fontSize: 18,
      fontWeight: '600',
    },
    signUpButton: {
      backgroundColor: 'transparent',
      paddingHorizontal: 48,
      paddingVertical: 16,
      borderRadius: 12,
      borderWidth: 2,
      borderColor: colors.primary,
      minWidth: 200,
      alignItems: 'center',
    },
    signUpButtonText: {
      color: colors.primary,
      fontSize: 18,
      fontWeight: '600',
    },
    errorContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: 20,
      backgroundColor: isDark ? '#000000' : colors.background,
    },
    errorText: {
      fontSize: 16,
      color: colors.error,
      textAlign: 'center',
      marginBottom: 16,
    },
    subscribeButton: {
      backgroundColor: colors.primary,
      paddingHorizontal: 24,
      paddingVertical: 12,
      borderRadius: 8,
      marginTop: 16,
    },
    subscribeButtonText: {
      color: '#FFFFFF',
      fontSize: 16,
      fontWeight: '600',
    },
  });

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  // Show welcome screen with sign-in buttons if not authenticated
  if (!user) {
    return (
      <View style={styles.welcomeContainer}>
        <View style={styles.logoContainer}>
          <IconSymbol
            ios_icon_name="waveform"
            android_material_icon_name="waves"
            size={64}
            color="#FFFFFF"
          />
        </View>
        <Text style={styles.appTitle}>SurfVista</Text>
        <Text style={styles.appSubtitle}>Folly Beach, SC</Text>
        
        <TouchableOpacity
          style={styles.signInButton}
          onPress={handleSignIn}
        >
          <Text style={styles.signInButtonText}>Sign In</Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={styles.signUpButton}
          onPress={handleSignIn}
        >
          <Text style={styles.signUpButtonText}>Sign Up</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!hasSubscription) {
    return (
      <View style={styles.errorContainer}>
        <IconSymbol
          ios_icon_name="lock.circle"
          android_material_icon_name="lock"
          size={64}
          color={colors.primary}
        />
        <Text style={styles.errorText}>Subscribe to access exclusive surf reports and videos</Text>
        <TouchableOpacity
          style={styles.subscribeButton}
          onPress={handleSubscribe}
        >
          <Text style={styles.subscribeButtonText}>Subscribe Now</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const latestVideo = videos && videos.length > 0 ? videos[0] : null;
  const todayDate = getESTDate();
  
  // CRITICAL: Filter reports by current location to prevent crossover
  const locationSurfReports = surfReports?.filter((report: SurfReport) => report.location === currentLocation) || [];
  const todayReport = locationSurfReports.find((report: SurfReport) => report.date === todayDate);
  const todayWeatherForecast = weatherForecast?.find((w) => w.date === todayDate);

  // Get air temperature from weather_data (current conditions) or weather_forecast
  // CRITICAL: Try multiple sources to ensure we always show temperature
  const airTempFromData = weatherData?.temperature ? parseFloat(String(weatherData.temperature)) : null;
  const airTempFromForecast = todayWeatherForecast?.temperature || todayWeatherForecast?.high_temp;
  const airTemp = airTempFromData || airTempFromForecast;
  
  const temperatureText = airTemp ? `${Math.round(airTemp)}°F` : '--°F';
  
  // Get water temperature from surf report
  const waterTempRaw = todayReport?.water_temp;
  const waterTempNum = waterTempRaw ? parseFloat(waterTempRaw.replace(/[^\d.-]/g, '')) : null;
  const waterTempText = waterTempNum ? `${Math.round(waterTempNum)}°F` : '--°F';
  
  // Get weather condition with multiple fallbacks
  const weatherCondition = weatherData?.conditions || 
                          todayWeatherForecast?.conditions || 
                          todayWeatherForecast?.short_forecast || 
                          'Loading...';
  const windSpeedRaw = todayReport?.wind_speed;
  const windSpeed = windSpeedRaw ? `${Math.round(parseFloat(windSpeedRaw.replace(/[^\d.-]/g, '')))} mph` : '--';
  const windDirection = todayReport?.wind_direction || 'SW';
  // Get humidity with fallbacks
  const humidityFromData = weatherData?.humidity;
  const humidityFromForecast = todayWeatherForecast?.humidity;
  const humidityValue = humidityFromData ?? humidityFromForecast;
  const humidity = humidityValue !== null && humidityValue !== undefined 
    ? `${Math.round(humidityValue)}%` 
    : '--%';
  const stokeRating = todayReport?.rating ? `${todayReport.rating}/10` : '--/10';
  
  // ✅ USE SHARED UTILITY - Ensures identical narrative selection as report page
  const narrativeText = selectNarrativeText(todayReport);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.scrollContent}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={handleRefresh}
          tintColor={colors.primary}
        />
      }
    >
      <Text style={styles.welcomeText}>Welcome to</Text>

      {latestVideo && (
        <TouchableOpacity
          style={styles.videoCard}
          onPress={() => handleVideoPress(latestVideo.id)}
        >
          <ImageBackground
            source={resolveImageSource(latestVideo.thumbnail_url)}
            style={styles.videoThumbnail}
            resizeMode="cover"
          >
            <View style={styles.videoOverlay}>
              <Text style={styles.surfVistaTitle}>SurfVista</Text>
              <View style={styles.playButton}>
                <IconSymbol
                  ios_icon_name="play.fill"
                  android_material_icon_name="play-arrow"
                  size={32}
                  color="#FFFFFF"
                />
              </View>
            </View>
          </ImageBackground>
        </TouchableOpacity>
      )}

      <View style={styles.locationSection}>
        <LocationSelector />
        <View style={styles.updatedRow}>
          <IconSymbol
            ios_icon_name="clock"
            android_material_icon_name="schedule"
            size={16}
            color={isDark ? '#B0B0B0' : colors.textSecondary}
          />
          <Text style={styles.updatedText}>Updated Just now</Text>
          <TouchableOpacity onPress={handleRefresh}>
            <IconSymbol
              ios_icon_name="arrow.clockwise"
              android_material_icon_name="refresh"
              size={20}
              color={colors.primary}
            />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.conditionsCard}>
        <Text style={styles.conditionsTitle}>Current Conditions</Text>
        <View style={styles.conditionsGrid}>
          <View style={styles.conditionItem}>
            <Text style={styles.temperatureText}>{temperatureText}</Text>
            <Text style={styles.weatherText}>{weatherCondition}</Text>
          </View>
          <View style={styles.stokeRatingContainer}>
            <Text style={styles.stokeLabel}>Stoke Rating</Text>
            <Text style={styles.stokeRating}>{stokeRating}</Text>
          </View>
        </View>
        <View style={styles.weatherDetailsRow}>
          <View style={styles.weatherDetail}>
            <IconSymbol
              ios_icon_name="wind"
              android_material_icon_name="air"
              size={16}
              color={isDark ? '#FFFFFF' : colors.text}
            />
            <Text style={styles.weatherDetailText}>{windSpeed} {windDirection}</Text>
          </View>
          <View style={styles.weatherDetail}>
            <IconSymbol
              ios_icon_name="drop.fill"
              android_material_icon_name="water_drop"
              size={16}
              color={isDark ? '#FFFFFF' : colors.text}
            />
            <Text style={styles.weatherDetailText}>Water: {waterTempText}</Text>
          </View>
          <View style={styles.weatherDetail}>
            <Text style={styles.weatherDetailText}>Humidity: {humidity}</Text>
          </View>
        </View>
      </View>

      {todayReport && narrativeText && (
        <View style={styles.reportCard}>
          <View style={styles.reportHeader}>
            <IconSymbol
              ios_icon_name="doc.text"
              android_material_icon_name="description"
              size={20}
              color={colors.primary}
            />
            <Text style={styles.reportTitle}>Today&apos;s Surf Report</Text>
          </View>
          <Text style={styles.reportText}>{narrativeText}</Text>
        </View>
      )}

      {weatherForecast && weatherForecast.length > 0 && (
        <WeeklyForecast forecast={weatherForecast} />
      )}
    </ScrollView>
  );
}
