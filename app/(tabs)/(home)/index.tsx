
import { LocationSelector } from "@/components/LocationSelector";
import { useEffect, useState, useCallback, useMemo } from "react";
import { SurfReport } from "@/types";
import { useAuth } from "@/contexts/AuthContext";
import { IconSymbol } from "@/components/IconSymbol";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl, Alert, ImageBackground, ImageSourcePropType } from "react-native";
import { CurrentConditions } from "@/components/CurrentConditions";
import { useSurfData } from "@/hooks/useSurfData";
import { WeeklyForecast } from "@/components/WeeklyForecast";
import { useVideos } from "@/hooks/useVideos";
import { colors } from "@/styles/commonStyles";
import { ReportTextDisplay } from "@/components/ReportTextDisplay";
import { router } from "expo-router";
import { presentPaywall } from "@/utils/superwallConfig";

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    paddingBottom: 100,
  },
  welcomeText: {
    fontSize: 18,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: 20,
    marginBottom: 8,
  },
  videoCard: {
    marginHorizontal: 20,
    marginBottom: 20,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: colors.card,
  },
  videoThumbnail: {
    width: '100%',
    height: 350,
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
    fontSize: 56,
    fontWeight: 'bold',
    color: '#5B9BD5',
    textAlign: 'center',
    marginBottom: 20,
  },
  playButton: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: 'rgba(91, 155, 213, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  videoInfoSection: {
    padding: 20,
    alignItems: 'center',
  },
  videoTitle: {
    fontSize: 24,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 12,
  },
  instantPlaybackButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#5B9BD5',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    gap: 8,
  },
  instantPlaybackText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
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
    color: colors.textSecondary,
  },
  conditionsCard: {
    marginHorizontal: 20,
    marginBottom: 20,
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 20,
  },
  conditionsTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 16,
  },
  temperatureRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 8,
  },
  temperature: {
    fontSize: 56,
    fontWeight: 'bold',
    color: colors.text,
  },
  weatherText: {
    fontSize: 18,
    color: colors.textSecondary,
    marginBottom: 16,
  },
  weatherDetailsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 24,
  },
  weatherDetail: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  weatherDetailText: {
    fontSize: 16,
    color: colors.text,
  },
  surfConditionsCard: {
    marginHorizontal: 20,
    marginBottom: 20,
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 20,
  },
  surfConditionsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 8,
  },
  surfConditionsTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.text,
  },
  surfConditionsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  surfConditionItem: {
    flex: 1,
    alignItems: 'center',
  },
  surfConditionLabel: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 4,
  },
  surfConditionValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.text,
  },
  stokeRating: {
    color: '#FF6B35',
  },
  surfConditionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  surfConditionDetail: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  surfConditionDetailText: {
    fontSize: 14,
    color: colors.text,
  },
  reportCard: {
    marginHorizontal: 20,
    marginBottom: 20,
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 20,
  },
  reportHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 8,
  },
  reportTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.text,
  },
  reportText: {
    fontSize: 15,
    color: colors.text,
    lineHeight: 22,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: colors.textSecondary,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
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
  const { user, profile, checkSubscription, session, isLoading: authLoading, isInitialized } = useAuth();
  const { videos, refreshVideos } = useVideos();
  const { surfConditions, fetchSurfConditions } = useSurfData();
  
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
        fetchSurfConditions()
      ]);
      console.log('[HomeScreen] Data loaded successfully');
    } catch (error) {
      console.error('[HomeScreen] Error loading data:', error);
    }
  }, [user, refreshVideos, fetchSurfConditions, hasSubscription]);

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
  const todayReport = surfConditions?.find((report: SurfReport) => report.date === todayDate);

  const temperatureText = todayReport?.air_temp ? `${Math.round(todayReport.air_temp)}°F` : '--°F';
  const weatherCondition = todayReport?.weather_condition || 'Sunny';
  const windSpeed = todayReport?.wind_speed ? `${Math.round(todayReport.wind_speed)} mph` : '--';
  const windDirection = todayReport?.wind_direction || 'SW';
  const humidity = todayReport?.humidity ? `${Math.round(todayReport.humidity)}%` : '--%';
  
  const waterTemp = todayReport?.water_temp ? `${Math.round(todayReport.water_temp)}°F` : '--°F';
  const stokeRating = todayReport?.rating ? `${todayReport.rating}/10` : '--/10';
  const period = todayReport?.wave_period ? `${todayReport.wave_period} sec` : '-- sec';
  const swellDirection = todayReport?.swell_direction || 'SSW';
  const swellHeight = todayReport?.wave_height ? `${todayReport.wave_height} ft` : '-- ft';
  const swellAngle = todayReport?.swell_angle ? `${todayReport.swell_angle}°` : '--°';

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
                  size={36}
                  color="#FFFFFF"
                />
              </View>
            </View>
          </ImageBackground>
          <View style={styles.videoInfoSection}>
            <Text style={styles.videoTitle}>{latestVideo.title}</Text>
            <TouchableOpacity style={styles.instantPlaybackButton}>
              <IconSymbol
                ios_icon_name="bolt.fill"
                android_material_icon_name="flash-on"
                size={20}
                color="#FFFFFF"
              />
              <Text style={styles.instantPlaybackText}>Instant Playback</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      )}

      <View style={styles.locationSection}>
        <LocationSelector />
        <View style={styles.updatedRow}>
          <IconSymbol
            ios_icon_name="clock"
            android_material_icon_name="schedule"
            size={16}
            color={colors.textSecondary}
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
        <View style={styles.temperatureRow}>
          <Text style={styles.temperature}>{temperatureText}</Text>
        </View>
        <Text style={styles.weatherText}>{weatherCondition}</Text>
        <View style={styles.weatherDetailsRow}>
          <View style={styles.weatherDetail}>
            <IconSymbol
              ios_icon_name="wind"
              android_material_icon_name="air"
              size={20}
              color={colors.text}
            />
            <Text style={styles.weatherDetailText}>{windSpeed} {windDirection}</Text>
          </View>
          <View style={styles.weatherDetail}>
            <Text style={styles.weatherDetailText}>Humidity: {humidity}</Text>
          </View>
        </View>
      </View>

      <View style={styles.surfConditionsCard}>
        <View style={styles.surfConditionsHeader}>
          <IconSymbol
            ios_icon_name="waveform"
            android_material_icon_name="waves"
            size={24}
            color={colors.primary}
          />
          <Text style={styles.surfConditionsTitle}>Surf Conditions</Text>
        </View>
        <View style={styles.surfConditionsGrid}>
          <View style={styles.surfConditionItem}>
            <Text style={styles.surfConditionLabel}>Water Temp</Text>
            <Text style={styles.surfConditionValue}>{waterTemp}</Text>
          </View>
          <View style={styles.surfConditionItem}>
            <Text style={styles.surfConditionLabel}>Stoke Rating</Text>
            <Text style={[styles.surfConditionValue, styles.stokeRating]}>{stokeRating}</Text>
          </View>
        </View>
        <View style={styles.surfConditionsRow}>
          <View style={styles.surfConditionDetail}>
            <IconSymbol
              ios_icon_name="timer"
              android_material_icon_name="schedule"
              size={18}
              color={colors.text}
            />
            <Text style={styles.surfConditionDetailText}>Period: {period}</Text>
          </View>
          <View style={styles.surfConditionDetail}>
            <IconSymbol
              ios_icon_name="arrow.up"
              android_material_icon_name="arrow-upward"
              size={18}
              color={colors.text}
            />
            <Text style={styles.surfConditionDetailText}>Swell: {swellDirection} ({swellAngle})</Text>
          </View>
        </View>
      </View>

      {todayReport && todayReport.narrative && (
        <View style={styles.reportCard}>
          <View style={styles.reportHeader}>
            <IconSymbol
              ios_icon_name="doc.text"
              android_material_icon_name="description"
              size={24}
              color={colors.primary}
            />
            <Text style={styles.reportTitle}>Today's Surf Report</Text>
          </View>
          <Text style={styles.reportText}>{todayReport.narrative}</Text>
        </View>
      )}
    </ScrollView>
  );
}
