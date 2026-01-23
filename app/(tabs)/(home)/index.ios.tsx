
import React, { useEffect, useState, useCallback, useMemo } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl, Alert } from "react-native";
import { useTheme } from "@react-navigation/native";
import { useAuth } from "@/contexts/AuthContext";
import { router } from "expo-router";
import { colors } from "@/styles/commonStyles";
import { IconSymbol } from "@/components/IconSymbol";
import { supabase } from "@/app/integrations/supabase/client";
import { SurfReport } from "@/types";
import { useSurfData } from "@/hooks/useSurfData";
import { CurrentConditions } from "@/components/CurrentConditions";
import { WeeklyForecast } from "@/components/WeeklyForecast";
import { ReportTextDisplay } from "@/components/ReportTextDisplay";
import { presentPaywall, isPaymentSystemAvailable } from "@/utils/superwallConfig";

// Get today's date in EST timezone - FIXED to use toLocaleDateString
function getESTDate(): string {
  const now = new Date();
  
  // Get the date in EST timezone using toLocaleDateString (more reliable)
  const estDateString = now.toLocaleDateString('en-US', { 
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  
  // Parse the date string (format: "MM/DD/YYYY")
  const [month, day, year] = estDateString.split('/');
  
  const estDate = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  
  console.log('[getESTDate iOS] Raw EST date string:', estDateString);
  console.log('[getESTDate iOS] Parsed components:', { month, day, year });
  console.log('[getESTDate iOS] Current EST date:', estDate);
  
  return estDate;
}

export default function HomeScreen() {
  const theme = useTheme();
  const { user, session, checkSubscription, isLoading, isInitialized, profile, refreshProfile } = useAuth();
  const [todayReport, setTodayReport] = useState<SurfReport | null>(null);
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSubscribing, setIsSubscribing] = useState(false);
  
  // Use the surf data hook for weather and forecast
  const { weatherData, weatherForecast, refreshData, lastUpdated, error } = useSurfData();

  // Memoize subscription status to prevent recalculation
  const hasSubscription = useMemo(() => {
    if (!profile) return false;
    return checkSubscription();
  }, [profile, checkSubscription]);

  // Memoize loadData to prevent recreation on every render
  const loadData = useCallback(async () => {
    if (isLoadingData) {
      console.log('[HomeScreen iOS] Already loading data, skipping...');
      return;
    }

    try {
      setIsLoadingData(true);
      console.log('[HomeScreen iOS] Fetching reports...');

      // Load today's surf report
      const today = getESTDate();
      const { data: reportData, error: reportError } = await supabase
        .from('surf_reports')
        .select('*')
        .eq('date', today)
        .maybeSingle();

      if (reportError) {
        console.log('[HomeScreen iOS] Report fetch error:', reportError.message);
      } else if (reportData) {
        console.log('[HomeScreen iOS] Report loaded for:', today, 'Rating:', reportData.rating);
        setTodayReport(reportData);
      } else {
        console.log('[HomeScreen iOS] No report found for today');
        setTodayReport(null);
      }
    } catch (error) {
      console.error('[HomeScreen iOS] Error loading data:', error);
    } finally {
      setIsLoadingData(false);
    }
  }, [isLoadingData]);

  // Only load data when conditions are met - use separate effect
  useEffect(() => {
    console.log('[HomeScreen iOS] State update:', {
      isInitialized,
      isLoading,
      hasUser: !!user,
      hasSession: !!session,
      hasProfile: !!profile,
      hasSubscription
    });

    // Only load data when fully initialized, not loading, has user, profile, and subscription
    if (isInitialized && !isLoading && user && profile && hasSubscription) {
      console.log('[HomeScreen iOS] Conditions met, loading content data...');
      loadData();
    } else {
      console.log('[HomeScreen iOS] Not loading data - conditions not met');
    }
  }, [isInitialized, isLoading, user, profile, hasSubscription, session, loadData]);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await Promise.all([loadData(), refreshData()]);
    setIsRefreshing(false);
  }, [loadData, refreshData]);

  const formatLastUpdated = useCallback((date: Date | null) => {
    if (!date) return 'Never';
    
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    
    return date.toLocaleDateString();
  }, []);

  const handleSubscribeNow = useCallback(async () => {
    console.log('[HomeScreen iOS] Subscribe Now button tapped');
    
    // Check if payment system is available FIRST
    if (!isPaymentSystemAvailable()) {
      console.log('[HomeScreen iOS] Payment system not available - navigating to demo paywall');
      router.push('/demo-paywall');
      return;
    }

    setIsSubscribing(true);

    try {
      console.log('[HomeScreen iOS] Opening subscription paywall...');
      
      // Present the RevenueCat Paywall
      const result = await presentPaywall(user?.id, user?.email || undefined);
      
      console.log('[HomeScreen iOS] Paywall result:', result);
      
      // Check if demo mode error
      if (result.state === 'error' && result.message === 'DEMO_MODE') {
        console.log('[HomeScreen iOS] Demo mode detected - navigating to demo paywall');
        router.push('/demo-paywall');
        setIsSubscribing(false);
        return;
      }
      
      // Refresh profile to get updated subscription status
      await refreshProfile();
      
      if (result.state === 'purchased' || result.state === 'restored') {
        Alert.alert(
          'Success!',
          result.message || 'Subscription activated successfully!',
          [{ text: 'OK' }]
        );
      } else if (result.state === 'error') {
        Alert.alert(
          'Subscribe Failed',
          result.message || 'Unable to complete purchase. Please try again.',
          [{ text: 'OK' }]
        );
      }
      // If declined, do nothing (user cancelled)
      
    } catch (error: any) {
      console.error('[HomeScreen iOS] Subscribe error:', error);
      
      // Check if it's a demo mode error
      if (error?.message?.includes('DEMO_MODE')) {
        console.log('[HomeScreen iOS] Demo mode error caught - navigating to demo paywall');
        router.push('/demo-paywall');
      } else {
        Alert.alert(
          'Subscribe Failed',
          error.message || 'Unable to open subscription page. Please try again later.',
          [{ text: 'OK' }]
        );
      }
    } finally {
      setIsSubscribing(false);
    }
  }, [user, refreshProfile]);

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
  if (!user || !session) {
    console.log('[HomeScreen iOS] Rendering: Not logged in');
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
              console.log('[HomeScreen iOS] Navigating to login...');
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
    console.log('[HomeScreen iOS] Rendering: Waiting for profile');
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
  if (!hasSubscription) {
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
          <Text style={[styles.description, { color: colors.textSecondary }]}>
            Subscribe to access exclusive drone footage and daily surf reports for just $10.99/month
          </Text>
          <TouchableOpacity
            style={[styles.ctaButton, { backgroundColor: colors.accent }]}
            onPress={handleSubscribeNow}
            disabled={isSubscribing}
          >
            {isSubscribing ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text style={styles.ctaButtonText}>Subscribe Now</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // Subscribed - show content
  console.log('[HomeScreen iOS] Rendering: Subscribed content');
  
  // CRITICAL FIX: Always show today's report text and rating
  // Use today's report for both text and rating to ensure consistency with report page
  const reportTextDisplay = todayReport?.report_text || todayReport?.conditions || '';
  const isCustomReport = !!todayReport?.report_text;
  
  // CRITICAL FIX: Use today's actual rating, not a default
  // This ensures consistency between home page and report page
  const todayRating = todayReport?.rating ?? null;
  
  console.log('[HomeScreen iOS] Today\'s report:', {
    hasReport: !!todayReport,
    rating: todayRating,
    hasText: !!reportTextDisplay,
    date: todayReport?.date
  });
  
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
        <Text style={[styles.location, { color: colors.textSecondary }]}>The Real Folly Surf Report</Text>
        
        {/* Last Updated Info */}
        <View style={styles.updateInfo}>
          <IconSymbol
            ios_icon_name="clock.fill"
            android_material_icon_name="schedule"
            size={14}
            color={colors.textSecondary}
          />
          <Text style={[styles.updateText, { color: colors.textSecondary }]}>
            Updated {formatLastUpdated(lastUpdated)}
          </Text>
          <TouchableOpacity 
            onPress={handleRefresh}
            style={styles.refreshButton}
            disabled={isRefreshing}
          >
            <IconSymbol
              ios_icon_name="arrow.clockwise"
              android_material_icon_name="refresh"
              size={16}
              color={colors.primary}
            />
          </TouchableOpacity>
        </View>

        {/* Error Message */}
        {error && (
          <View style={[styles.errorBanner, { backgroundColor: 'rgba(255, 59, 48, 0.1)' }]}>
            <IconSymbol
              ios_icon_name="exclamationmark.triangle.fill"
              android_material_icon_name="warning"
              size={16}
              color="#FF3B30"
            />
            <Text style={[styles.errorText, { color: '#FF3B30' }]}>
              {error}
            </Text>
          </View>
        )}
      </View>

      {/* Current Conditions - Pass today's rating explicitly */}
      <CurrentConditions 
        weather={weatherData} 
        surfReport={todayReport}
      />

      {/* Today's Report Text - ALWAYS show if we have today's report */}
      {todayReport && reportTextDisplay && (
        <View style={[styles.reportCard, { backgroundColor: theme.colors.card }]}>
          <View style={styles.reportHeader}>
            <IconSymbol
              ios_icon_name="doc.text.fill"
              android_material_icon_name="description"
              size={20}
              color={colors.primary}
            />
            <Text style={[styles.reportTitle, { color: theme.colors.text }]}>
              Today&apos;s Surf Report
            </Text>
          </View>
          <View style={[styles.reportTextContainer, { backgroundColor: colors.reportBackground }]}>
            <ReportTextDisplay 
              text={reportTextDisplay}
              isCustom={isCustomReport}
            />
          </View>
          {todayReport.report_text && todayReport.edited_at && (
            <Text style={[styles.editedNote, { color: colors.textSecondary }]}>
              Edited {new Date(todayReport.edited_at).toLocaleDateString()}
            </Text>
          )}
        </View>
      )}

      {/* 7-Day Forecast */}
      {weatherForecast.length > 0 && (
        <WeeklyForecast forecast={weatherForecast} />
      )}

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
          onPress={() => router.push('/(tabs)/forecast')}
        >
          <IconSymbol
            ios_icon_name="water.waves"
            android_material_icon_name="waves"
            size={32}
            color={colors.primary}
          />
          <Text style={[styles.quickLinkText, { color: theme.colors.text }]}>
            Forecast
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
    marginBottom: 12,
  },
  updateInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
  },
  updateText: {
    fontSize: 12,
  },
  refreshButton: {
    padding: 4,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    marginTop: 12,
  },
  errorText: {
    fontSize: 12,
    flex: 1,
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
    marginTop: 16,
    marginBottom: 8,
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
  reportCard: {
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 16,
    boxShadow: '0px 2px 8px rgba(0, 0, 0, 0.1)',
    elevation: 3,
  },
  reportHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  reportTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  reportTextContainer: {
    padding: 12,
    borderRadius: 8,
  },
  editedNote: {
    fontSize: 11,
    fontStyle: 'italic',
    marginTop: 8,
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
