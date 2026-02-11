
import { LocationSelector } from "@/components/LocationSelector";
import { WeeklyForecast } from "@/components/WeeklyForecast";
import { useEffect, useState, useCallback, useMemo } from "react";
import { SurfReport } from "@/types";
import { useAuth } from "@/contexts/AuthContext";
import { IconSymbol } from "@/components/IconSymbol";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl, Alert, ImageBackground, ImageSourcePropType, useColorScheme } from "react-native";
import { useSurfData } from "@/hooks/useSurfData";
import { useVideos } from "@/hooks/useVideos";
import { colors } from "@/styles/commonStyles";
import { router } from "expo-router";
import { presentPaywall } from "@/utils/superwallConfig";

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
  const { surfReports, weatherForecast, refreshData } = useSurfData();
  
  const [refreshing, setRefreshing] = useState(false);

  const hasSubscription = useMemo(() => {
    return checkSubscription();
  }, [checkSubscription]);

  const isLoading = useMemo(() => {
    return authLoading || !isInitialized;
  }, [authLoading, isInitialized]);

  const loadData = useCallback(async () => {
    console.log('[HomeScreen] Loading data...');
    console.log('[HomeScreen] User:', user?.id);
    console.log('[HomeScreen] Has subscription:', hasSubscription);
    
    if (!user) {
      console.log('[HomeScreen] No user, skipping data load');
      return;
    }

    try {
      await Promise.all([
        refreshVideos(),
        refreshData()
      ]);
      console.log('[HomeScreen] Data loaded successfully');
    } catch (error) {
      console.error('[HomeScreen] Error loading data:', error);
    }
  }, [user, refreshVideos, refreshData, hasSubscription]);

  useEffect(() => {
    if (isInitialized && !isLoading && user && profile && hasSubscription && session) {
      console.log('[HomeScreen] Auth ready, loading data...');
      loadData();
    }
  }, [isInitialized, isLoading, user, profile, hasSubscription, session, loadData]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, [loadData]);

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
    retryButton: {
      backgroundColor: colors.primary,
      paddingHorizontal: 24,
      paddingVertical: 12,
      borderRadius: 8,
    },
    retryButtonText: {
      color: '#FFFFFF',
      fontSize: 16,
      fontWeight: '600',
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

  if (!user) {
    return (
      <View style={styles.errorContainer}>
        <IconSymbol
          ios_icon_name="person.crop.circle.badge.exclamationmark"
          android_material_icon_name="error"
          size={64}
          color={colors.error}
        />
        <Text style={styles.errorText}>Please log in to view content</Text>
        <TouchableOpacity
          style={styles.retryButton}
          onPress={() => router.push('/login')}
        >
          <Text style={styles.retryButtonText}>Go to Login</Text>
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
  const todayReport = surfReports?.find((report: SurfReport) => report.date === todayDate);

  const temperatureText = todayReport?.air_temp ? `${Math.round(todayReport.air_temp)}°F` : '--°F';
  const weatherCondition = todayReport?.weather_condition || 'Sunny';
  const windSpeed = todayReport?.wind_speed ? `${Math.round(todayReport.wind_speed)} mph` : '--';
  const windDirection = todayReport?.wind_direction || 'SW';
  const humidity = todayReport?.humidity ? `${Math.round(todayReport.humidity)}%` : '--%';
  const stokeRating = todayReport?.rating ? `${todayReport.rating}/10` : '--/10';

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
            <Text style={styles.weatherDetailText}>Humidity: {humidity}</Text>
          </View>
        </View>
      </View>

      {todayReport && todayReport.narrative && (
        <View style={styles.reportCard}>
          <View style={styles.reportHeader}>
            <IconSymbol
              ios_icon_name="doc.text"
              android_material_icon_name="description"
              size={20}
              color={colors.primary}
            />
            <Text style={styles.reportTitle}>Today's Surf Report</Text>
          </View>
          <Text style={styles.reportText}>{todayReport.narrative}</Text>
        </View>
      )}

      {weatherForecast && weatherForecast.length > 0 && (
        <WeeklyForecast forecast={weatherForecast} />
      )}
    </ScrollView>
  );
}
