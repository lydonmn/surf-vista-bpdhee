
import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl } from "react-native";
import { useTheme } from "@react-navigation/native";
import { useAuth } from "@/contexts/AuthContext";
import { router } from "expo-router";
import { colors } from "@/styles/commonStyles";
import { IconSymbol } from "@/components/IconSymbol";
import { supabase } from "@/app/integrations/supabase/client";
import { Video, SurfReport } from "@/types";
import { useSurfData } from "@/hooks/useSurfData";
import { CurrentConditions } from "@/components/CurrentConditions";
import { WeeklyForecast } from "@/components/WeeklyForecast";

export default function HomeScreen() {
  const theme = useTheme();
  const { user, session, checkSubscription, isLoading, isInitialized, profile } = useAuth();
  const [latestVideo, setLatestVideo] = useState<Video | null>(null);
  const [todayReport, setTodayReport] = useState<SurfReport | null>(null);
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  // Use the surf data hook for weather and forecast
  const { weatherData, weatherForecast, refreshData } = useSurfData();

  useEffect(() => {
    console.log('[HomeScreen] State update:', {
      isInitialized,
      isLoading,
      hasUser: !!user,
      hasSession: !!session,
      hasProfile: !!profile,
      profileData: profile ? {
        email: profile.email,
        is_admin: profile.is_admin,
        is_subscribed: profile.is_subscribed
      } : null,
      hasSubscription: checkSubscription()
    });

    // Only load data when fully initialized, not loading, has user, profile, and subscription
    if (isInitialized && !isLoading && user && profile && checkSubscription()) {
      console.log('[HomeScreen] Conditions met, loading content data...');
      loadData();
    } else {
      console.log('[HomeScreen] Not loading data - conditions not met');
    }
  }, [user, session, isInitialized, profile, isLoading]);

  const loadData = async () => {
    if (isLoadingData) {
      console.log('[HomeScreen] Already loading data, skipping...');
      return;
    }

    try {
      setIsLoadingData(true);
      console.log('[HomeScreen] Fetching videos and reports...');
      
      // Load latest video
      const { data: videoData, error: videoError } = await supabase
        .from('videos')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (videoError) {
        console.log('[HomeScreen] Video fetch error:', videoError.message);
      } else if (videoData) {
        console.log('[HomeScreen] Video loaded:', videoData.title);
        setLatestVideo(videoData);
      } else {
        console.log('[HomeScreen] No videos found');
      }

      // Load today's surf report
      const today = new Date().toISOString().split('T')[0];
      const { data: reportData, error: reportError } = await supabase
        .from('surf_reports')
        .select('*')
        .eq('date', today)
        .maybeSingle();

      if (reportError) {
        console.log('[HomeScreen] Report fetch error:', reportError.message);
      } else if (reportData) {
        console.log('[HomeScreen] Report loaded for:', today);
        setTodayReport(reportData);
      } else {
        console.log('[HomeScreen] No report found for today');
      }
    } catch (error) {
      console.error('[HomeScreen] Error loading data:', error);
    } finally {
      setIsLoadingData(false);
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await Promise.all([loadData(), refreshData()]);
    setIsRefreshing(false);
  };

  // Show loading state while auth is initializing
  if (!isInitialized) {
    console.log('[HomeScreen] Rendering: Not initialized');
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
            Initializing...
          </Text>
        </View>
      </View>
    );
  }

  // Show loading state while profile is being loaded
  if (isLoading) {
    console.log('[HomeScreen] Rendering: Loading profile');
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

  // Not logged in - show sign in prompt
  if (!user || !session) {
    console.log('[HomeScreen] Rendering: Not logged in');
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <View style={styles.centerContent}>
          <Text style={[styles.appTitle, { color: colors.primary }]}>SurfVista</Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            Exclusive Surf Reports from Folly Beach, SC
          </Text>
          <IconSymbol
            ios_icon_name="water.waves"
            android_material_icon_name="waves"
            size={80}
            color={colors.primary}
          />
          <Text style={[styles.description, { color: theme.colors.text }]}>
            Get access to daily 6K drone footage and exclusive surf reports
          </Text>
          <TouchableOpacity
            style={[styles.ctaButton, { backgroundColor: colors.primary }]}
            onPress={() => {
              console.log('[HomeScreen] Navigating to login...');
              router.push('/login');
            }}
          >
            <Text style={styles.ctaButtonText}>Sign In / Subscribe</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // Wait for profile to load
  if (!profile) {
    console.log('[HomeScreen] Rendering: Waiting for profile');
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

  // Logged in but no subscription - show subscribe prompt
  if (!checkSubscription()) {
    console.log('[HomeScreen] Rendering: No subscription');
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <View style={styles.centerContent}>
          <IconSymbol
            ios_icon_name="lock.fill"
            android_material_icon_name="lock"
            size={80}
            color={colors.textSecondary}
          />
          <Text style={[styles.title, { color: theme.colors.text }]}>
            Subscription Required
          </Text>
          <Text style={[styles.description, { color: colors.textSecondary }]}>
            Subscribe to access exclusive drone footage and daily surf reports for just $5/month
          </Text>
          <TouchableOpacity
            style={[styles.ctaButton, { backgroundColor: colors.accent }]}
            onPress={() => {
              console.log('[HomeScreen] Opening subscription flow');
              router.push('/(tabs)/profile');
            }}
          >
            <Text style={styles.ctaButtonText}>Subscribe Now</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // Subscribed - show content
  console.log('[HomeScreen] Rendering: Subscribed content');
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
        <Text style={[styles.welcomeText, { color: colors.textSecondary }]}>
          Welcome to
        </Text>
        <Text style={[styles.appTitle, { color: colors.primary }]}>SurfVista</Text>
        <Text style={[styles.location, { color: colors.textSecondary }]}>
          Folly Beach, South Carolina
        </Text>
      </View>

      {/* Current Conditions */}
      <CurrentConditions weather={weatherData} surfReport={todayReport} />

      {/* 7-Day Forecast */}
      {weatherForecast.length > 0 && (
        <WeeklyForecast forecast={weatherForecast} />
      )}

      {/* Latest Video Section */}
      <View style={[styles.section, { backgroundColor: theme.colors.card }]}>
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

        {isLoadingData ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="small" color={colors.primary} />
          </View>
        ) : latestVideo ? (
          <TouchableOpacity
            style={styles.videoCard}
            onPress={() => router.push({
              pathname: '/video-player',
              params: { videoUrl: latestVideo.video_url, title: latestVideo.title }
            })}
          >
            <View style={[styles.videoPlaceholder, { backgroundColor: colors.highlight }]}>
              <IconSymbol
                ios_icon_name="play.circle.fill"
                android_material_icon_name="play_circle"
                size={64}
                color={colors.primary}
              />
            </View>
            <View style={styles.videoInfo}>
              <Text style={[styles.videoTitle, { color: theme.colors.text }]}>
                {latestVideo.title}
              </Text>
              {latestVideo.description && (
                <Text style={[styles.videoDescription, { color: colors.textSecondary }]}>
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

      {/* Quick Links */}
      <View style={styles.quickLinks}>
        <TouchableOpacity
          style={[styles.quickLinkCard, { backgroundColor: theme.colors.card }]}
          onPress={() => router.push('/(tabs)/videos')}
        >
          <IconSymbol
            ios_icon_name="play.rectangle.on.rectangle.fill"
            android_material_icon_name="video_library"
            size={32}
            color={colors.primary}
          />
          <Text style={[styles.quickLinkText, { color: theme.colors.text }]}>
            Video Library
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.quickLinkCard, { backgroundColor: theme.colors.card }]}
          onPress={() => router.push('/(tabs)/report')}
        >
          <IconSymbol
            ios_icon_name="doc.text.fill"
            android_material_icon_name="description"
            size={32}
            color={colors.primary}
          />
          <Text style={[styles.quickLinkText, { color: theme.colors.text }]}>
            Full Reports
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.quickLinkCard, { backgroundColor: theme.colors.card }]}
          onPress={() => router.push('/(tabs)/weather')}
        >
          <IconSymbol
            ios_icon_name="cloud.sun.fill"
            android_material_icon_name="cloud"
            size={32}
            color={colors.primary}
          />
          <Text style={[styles.quickLinkText, { color: theme.colors.text }]}>
            Weather
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.quickLinkCard, { backgroundColor: theme.colors.card }]}
          onPress={() => router.push('/(tabs)/weather')}
        >
          <IconSymbol
            ios_icon_name="water.waves"
            android_material_icon_name="waves"
            size={32}
            color={colors.primary}
          />
          <Text style={[styles.quickLinkText, { color: theme.colors.text }]}>
            Tides
          </Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 100,
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
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
    alignItems: 'center',
    paddingTop: 40,
    paddingBottom: 24,
    paddingHorizontal: 16,
  },
  welcomeText: {
    fontSize: 16,
    marginBottom: 4,
  },
  appTitle: {
    fontSize: 42,
    fontWeight: 'bold',
    letterSpacing: 1,
    marginBottom: 4,
  },
  location: {
    fontSize: 14,
  },
  subtitle: {
    fontSize: 18,
    textAlign: 'center',
    marginBottom: 32,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginTop: 24,
    marginBottom: 16,
  },
  description: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 32,
  },
  ctaButton: {
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 12,
  },
  ctaButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
  section: {
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 12,
    padding: 16,
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
  videoPlaceholder: {
    width: '100%',
    height: 200,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
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
  emptyState: {
    paddingVertical: 32,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
  },
  quickLinks: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 12,
    marginBottom: 16,
    flexWrap: 'wrap',
  },
  quickLinkCard: {
    flex: 1,
    minWidth: 80,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    gap: 8,
    boxShadow: '0px 2px 8px rgba(0, 0, 0, 0.1)',
    elevation: 3,
  },
  quickLinkText: {
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
});
