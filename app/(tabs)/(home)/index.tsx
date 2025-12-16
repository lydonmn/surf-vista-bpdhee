
import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Dimensions, ActivityIndicator } from "react-native";
import { useTheme } from "@react-navigation/native";
import { useAuth } from "@/contexts/AuthContext";
import { router } from "expo-router";
import { colors } from "@/styles/commonStyles";
import { IconSymbol } from "@/components/IconSymbol";
import { supabase } from "@/app/integrations/supabase/client";
import { Video, SurfReport } from "@/types";

const { width } = Dimensions.get('window');

export default function HomeScreen() {
  const theme = useTheme();
  const { user, checkSubscription, isLoading, isInitialized, profile } = useAuth();
  const [latestVideo, setLatestVideo] = useState<Video | null>(null);
  const [todayReport, setTodayReport] = useState<SurfReport | null>(null);
  const [isLoadingData, setIsLoadingData] = useState(true);

  useEffect(() => {
    console.log('[HomeScreen] State update:', {
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
      console.log('[HomeScreen] Loading content data...');
      loadData();
    } else if (isInitialized && !isLoading) {
      console.log('[HomeScreen] Not loading data - conditions not met');
      setIsLoadingData(false);
    }
  }, [user, isInitialized, profile, isLoading]);

  const loadData = async () => {
    try {
      console.log('[HomeScreen] Fetching videos and reports...');
      
      // Load latest video
      const { data: videoData, error: videoError } = await supabase
        .from('videos')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (videoError) {
        console.log('[HomeScreen] Video fetch error:', videoError.message);
      } else if (videoData) {
        console.log('[HomeScreen] Video loaded:', videoData.title);
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
        console.log('[HomeScreen] Report fetch error:', reportError.message);
      } else if (reportData) {
        console.log('[HomeScreen] Report loaded for:', today);
        setTodayReport(reportData);
      }
    } catch (error) {
      console.log('[HomeScreen] Error loading data:', error);
    } finally {
      setIsLoadingData(false);
    }
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
  if (!user) {
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
            onPress={() => router.push('/login')}
          >
            <Text style={styles.ctaButtonText}>Sign In / Subscribe</Text>
          </TouchableOpacity>
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

        {latestVideo ? (
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

      {/* Today's Surf Report */}
      <View style={[styles.section, { backgroundColor: theme.colors.card }]}>
        <View style={styles.sectionHeader}>
          <IconSymbol
            ios_icon_name="water.waves"
            android_material_icon_name="waves"
            size={24}
            color={colors.primary}
          />
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
            Today&apos;s Conditions
          </Text>
        </View>

        {todayReport ? (
          <View style={styles.reportCard}>
            <View style={styles.reportRow}>
              <View style={styles.reportItem}>
                <Text style={[styles.reportLabel, { color: colors.textSecondary }]}>
                  Wave Height
                </Text>
                <Text style={[styles.reportValue, { color: theme.colors.text }]}>
                  {todayReport.wave_height}
                </Text>
              </View>
              <View style={styles.reportItem}>
                <Text style={[styles.reportLabel, { color: colors.textSecondary }]}>
                  Wind
                </Text>
                <Text style={[styles.reportValue, { color: theme.colors.text }]}>
                  {todayReport.wind_speed} {todayReport.wind_direction}
                </Text>
              </View>
            </View>

            <View style={styles.reportRow}>
              <View style={styles.reportItem}>
                <Text style={[styles.reportLabel, { color: colors.textSecondary }]}>
                  Water Temp
                </Text>
                <Text style={[styles.reportValue, { color: theme.colors.text }]}>
                  {todayReport.water_temp}
                </Text>
              </View>
              <View style={styles.reportItem}>
                <Text style={[styles.reportLabel, { color: colors.textSecondary }]}>
                  Rating
                </Text>
                <Text style={[styles.reportValue, { color: colors.primary }]}>
                  {todayReport.rating}/10
                </Text>
              </View>
            </View>

            <View style={styles.conditionsContainer}>
              <Text style={[styles.reportLabel, { color: colors.textSecondary }]}>
                Conditions
              </Text>
              <Text style={[styles.conditionsText, { color: theme.colors.text }]}>
                {todayReport.conditions}
              </Text>
            </View>

            <TouchableOpacity
              style={[styles.viewMoreButton, { backgroundColor: colors.secondary }]}
              onPress={() => router.push('/(tabs)/report')}
            >
              <Text style={[styles.viewMoreText, { color: colors.text }]}>
                View Full Report
              </Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.emptyState}>
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
              No surf report available for today
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
            ios_icon_name="film.fill"
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
            ios_icon_name="chart.bar.fill"
            android_material_icon_name="bar_chart"
            size={32}
            color={colors.primary}
          />
          <Text style={[styles.quickLinkText, { color: theme.colors.text }]}>
            Surf Reports
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
  reportCard: {
    gap: 16,
  },
  reportRow: {
    flexDirection: 'row',
    gap: 16,
  },
  reportItem: {
    flex: 1,
  },
  reportLabel: {
    fontSize: 12,
    marginBottom: 4,
  },
  reportValue: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  conditionsContainer: {
    gap: 4,
  },
  conditionsText: {
    fontSize: 14,
    lineHeight: 20,
  },
  viewMoreButton: {
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  viewMoreText: {
    fontSize: 16,
    fontWeight: '600',
  },
  quickLinks: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 16,
    marginBottom: 16,
  },
  quickLinkCard: {
    flex: 1,
    padding: 20,
    borderRadius: 12,
    alignItems: 'center',
    gap: 8,
    boxShadow: '0px 2px 8px rgba(0, 0, 0, 0.1)',
    elevation: 3,
  },
  quickLinkText: {
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
});
