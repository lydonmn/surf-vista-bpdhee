
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
  const { user, checkSubscription, isLoading, isInitialized, profile, isAdmin } = useAuth();
  const [latestVideo, setLatestVideo] = useState<Video | null>(null);
  const [todayReport, setTodayReport] = useState<SurfReport | null>(null);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Use the surf data hook for weather and forecast
  const { weatherData, weatherForecast, refreshData } = useSurfData();

  useEffect(() => {
    console.log('[HomeScreen iOS] State update:', {
      isInitialized,
      isLoading,
      hasUser: !!user,
      hasProfile: !!profile,
      profileData: profile ? {
        email: profile.email,
        is_admin: profile.is_admin,
        is_subscribed: profile.is_subscribed
      } : null,
      hasSubscription: checkSubscription()
    });

    // Only load data when fully initialized, not loading, has user, and has subscription
    if (isInitialized && !isLoading && user && profile && checkSubscription()) {
      console.log('[HomeScreen iOS] Loading content data...');
      loadData();
    } else if (isInitialized && !isLoading) {
      console.log('[HomeScreen iOS] Not loading data - conditions not met');
      setIsLoadingData(false);
    }
  }, [user, isInitialized, profile, isLoading]);

  const loadData = async () => {
    try {
      console.log('[HomeScreen iOS] Fetching videos and reports...');
      
      // Load latest video
      const { data: videoData, error: videoError } = await supabase
        .from('videos')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (videoError) {
        console.log('[HomeScreen iOS] Video fetch error:', videoError.message);
      } else if (videoData) {
        console.log('[HomeScreen iOS] Video loaded:', videoData.title);
        setLatestVideo(videoData);
      }

      // Load today's surf report
      const today = new Date().toISOString().split('T')[0];
      const { data: reportData, error: reportError } = await supabase
        .from('surf_reports')
        .select('*')
        .eq('date', today)
        .single();

      if (reportError) {
        console.log('[HomeScreen iOS] Report fetch error:', reportError.message);
      } else if (reportData) {
        console.log('[HomeScreen iOS] Report loaded for:', today);
        setTodayReport(reportData);
      }
    } catch (error) {
      console.log('[HomeScreen iOS] Error loading data:', error);
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
    console.log('[HomeScreen iOS] Rendering: Not initialized');
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
    console.log('[HomeScreen iOS] Rendering: Loading profile');
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
  if (!user) {
    console.log('[HomeScreen iOS] Rendering: Not logged in');
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <View style={styles.centerContent}>
          <Text style={[styles.appTitle, { color: colors.primary }]}>SurfVista</Text>
          <Text style={[styles.tagline, { color: colors.textSecondary }]}>
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
            style={[styles.loginButton, { backgroundColor: colors.primary }]}
            onPress={() => router.push('/login')}
          >
            <Text style={styles.loginButtonText}>Sign In / Subscribe</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // Logged in but no subscription - show subscribe prompt
  if (!checkSubscription()) {
    console.log('[HomeScreen iOS] Rendering: No subscription');
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
          <Text style={[styles.text, { color: colors.textSecondary }]}>
            Subscribe to access exclusive drone footage and daily surf reports for just $5/month
          </Text>
          <TouchableOpacity
            style={[styles.subscribeButton, { backgroundColor: colors.accent }]}
            onPress={() => {
              console.log('[HomeScreen iOS] Opening subscription flow');
              router.push('/(tabs)/profile');
            }}
          >
            <Text style={styles.subscribeButtonText}>Subscribe Now</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // Subscribed - show content
  console.log('[HomeScreen iOS] Rendering: Subscribed content');
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
        <Text style={[styles.headerTitle, { color: colors.primary }]}>SurfVista</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          Folly Beach, South Carolina
        </Text>
      </View>

      {/* Current Conditions */}
      <View style={styles.contentContainer}>
        <CurrentConditions weather={weatherData} surfReport={todayReport} />

        {/* 7-Day Forecast */}
        {weatherForecast.length > 0 && (
          <WeeklyForecast forecast={weatherForecast} />
        )}

        {/* Latest Video Section */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
            Latest Drone Footage
          </Text>
          {latestVideo ? (
            <TouchableOpacity
              style={[styles.videoCard, { backgroundColor: theme.colors.card }]}
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
            <View style={[styles.emptyCard, { backgroundColor: theme.colors.card }]}>
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
              ios_icon_name="film.stack"
              android_material_icon_name="movie"
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

        {isAdmin() && (
          <TouchableOpacity
            style={[styles.adminButton, { backgroundColor: colors.accent }]}
            onPress={() => router.push('/admin')}
          >
            <IconSymbol
              ios_icon_name="gear"
              android_material_icon_name="settings"
              size={20}
              color="#FFFFFF"
            />
            <Text style={styles.adminButtonText}>Admin Panel</Text>
          </TouchableOpacity>
        )}
      </View>
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
  contentContainer: {
    paddingHorizontal: 16,
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    gap: 24,
  },
  loadingText: {
    fontSize: 16,
    marginTop: 16,
  },
  appTitle: {
    fontSize: 48,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  header: {
    alignItems: 'center',
    marginBottom: 24,
    paddingHorizontal: 16,
    gap: 8,
  },
  headerTitle: {
    fontSize: 32,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  subtitle: {
    fontSize: 16,
    fontWeight: '500',
  },
  tagline: {
    fontSize: 18,
    textAlign: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  text: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
  },
  description: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
  },
  loginButton: {
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 12,
    minWidth: 200,
  },
  loginButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  subscribeButton: {
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 12,
    minWidth: 250,
  },
  subscribeButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  videoCard: {
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  videoPlaceholder: {
    width: '100%',
    height: 200,
    justifyContent: 'center',
    alignItems: 'center',
  },
  videoInfo: {
    padding: 12,
  },
  videoTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  videoDescription: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 4,
  },
  videoDate: {
    fontSize: 14,
  },
  emptyCard: {
    borderRadius: 12,
    padding: 32,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  emptyText: {
    fontSize: 14,
  },
  quickLinks: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 24,
  },
  quickLinkCard: {
    flex: 1,
    minWidth: 80,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  quickLinkText: {
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
  adminButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    marginTop: 16,
    gap: 8,
  },
  adminButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
