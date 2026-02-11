
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
  header: {
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 20,
    backgroundColor: colors.primary,
  },
  headerTitle: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  headerSubtitle: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.9)',
  },
  section: {
    padding: 20,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 16,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  videoCard: {
    backgroundColor: colors.card,
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  videoThumbnail: {
    width: '100%',
    height: 200,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  playButton: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  videoInfo: {
    padding: 16,
  },
  videoTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 8,
  },
  videoDate: {
    fontSize: 14,
    color: colors.textSecondary,
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
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: 12,
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

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>SurfVista</Text>
        <Text style={styles.headerSubtitle}>Folly Beach, SC</Text>
      </View>

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
        <View style={styles.section}>
          <LocationSelector />
        </View>

        {latestVideo && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Latest Report</Text>
            <TouchableOpacity
              style={styles.videoCard}
              onPress={() => handleVideoPress(latestVideo.id)}
            >
              <ImageBackground
                source={resolveImageSource(latestVideo.thumbnail_url)}
                style={styles.videoThumbnail}
                resizeMode="cover"
              >
                <View style={styles.playButton}>
                  <IconSymbol
                    ios_icon_name="play.fill"
                    android_material_icon_name="play-arrow"
                    size={32}
                    color={colors.primary}
                  />
                </View>
              </ImageBackground>
              <View style={styles.videoInfo}>
                <Text style={styles.videoTitle}>{latestVideo.title}</Text>
                <Text style={styles.videoDate}>
                  {new Date(latestVideo.created_at).toLocaleDateString()}
                </Text>
              </View>
            </TouchableOpacity>
          </View>
        )}

        {todayReport && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Current Conditions</Text>
            <CurrentConditions report={todayReport} />
          </View>
        )}

        {todayReport && todayReport.narrative && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Today's Report</Text>
            <View style={styles.card}>
              <ReportTextDisplay text={todayReport.narrative} />
            </View>
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>7-Day Forecast</Text>
          <WeeklyForecast />
        </View>
      </ScrollView>
    </View>
  );
}
