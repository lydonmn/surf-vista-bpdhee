
import React, { useEffect } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from "react-native";
import { useTheme } from "@react-navigation/native";
import { useAuth } from "@/contexts/AuthContext";
import { router } from "expo-router";
import { colors } from "@/styles/commonStyles";
import { mockSurfReports } from "@/data/mockData";
import { IconSymbol } from "@/components/IconSymbol";

export default function ReportScreen() {
  const theme = useTheme();
  const { user, profile, checkSubscription, isLoading, isInitialized } = useAuth();
  const isSubscribed = checkSubscription();

  useEffect(() => {
    console.log('ReportScreen - Auth state:', {
      hasUser: !!user,
      hasProfile: !!profile,
      isSubscribed,
      isLoading,
      isInitialized,
      profileData: profile ? {
        is_admin: profile.is_admin,
        is_subscribed: profile.is_subscribed,
        subscription_end_date: profile.subscription_end_date
      } : null
    });
  }, [user, profile, isSubscribed, isLoading, isInitialized]);

  // Show loading state while auth is initializing or profile is being loaded
  if (!isInitialized || isLoading) {
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
    console.log('ReportScreen - Showing locked content');
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
            Subscribe to access detailed surf reports
          </Text>
          {user && (
            <Text style={[styles.debugText, { color: colors.textSecondary }]}>
              You are signed in but not subscribed
            </Text>
          )}
          <TouchableOpacity
            style={[styles.subscribeButton, { backgroundColor: colors.accent }]}
            onPress={() => router.push('/login')}
          >
            <Text style={styles.subscribeButtonText}>
              {user ? 'Subscribe Now' : 'Sign In / Subscribe'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  console.log('ReportScreen - Showing surf reports');
  return (
    <ScrollView 
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      contentContainerStyle={styles.scrollContent}
    >
      <View style={styles.header}>
        <Text style={[styles.headerTitle, { color: theme.colors.text }]}>
          Surf Report
        </Text>
        <Text style={[styles.headerSubtitle, { color: colors.textSecondary }]}>
          Folly Beach, South Carolina
        </Text>
      </View>

      {mockSurfReports.map((report, index) => (
        <View 
          key={index}
          style={[styles.reportCard, { backgroundColor: theme.colors.card }]}
        >
          <View style={styles.reportHeader}>
            <Text style={[styles.reportDate, { color: theme.colors.text }]}>
              {new Date(report.date).toLocaleDateString('en-US', {
                weekday: 'long',
                month: 'long',
                day: 'numeric'
              })}
            </Text>
            <View style={[styles.ratingBadge, { backgroundColor: colors.accent }]}>
              <Text style={styles.ratingText}>{report.rating}/10</Text>
            </View>
          </View>

          <View style={styles.conditionsGrid}>
            <View style={styles.conditionRow}>
              <View style={styles.conditionItem}>
                <IconSymbol
                  ios_icon_name="water.waves"
                  android_material_icon_name="waves"
                  size={24}
                  color={colors.primary}
                />
                <View style={styles.conditionTextContainer}>
                  <Text style={[styles.conditionLabel, { color: colors.textSecondary }]}>
                    Wave Height
                  </Text>
                  <Text style={[styles.conditionValue, { color: theme.colors.text }]}>
                    {report.waveHeight}
                  </Text>
                </View>
              </View>

              <View style={styles.conditionItem}>
                <IconSymbol
                  ios_icon_name="wind"
                  android_material_icon_name="air"
                  size={24}
                  color={colors.primary}
                />
                <View style={styles.conditionTextContainer}>
                  <Text style={[styles.conditionLabel, { color: colors.textSecondary }]}>
                    Wind Speed
                  </Text>
                  <Text style={[styles.conditionValue, { color: theme.colors.text }]}>
                    {report.windSpeed}
                  </Text>
                </View>
              </View>
            </View>

            <View style={styles.conditionRow}>
              <View style={styles.conditionItem}>
                <IconSymbol
                  ios_icon_name="location.north.fill"
                  android_material_icon_name="navigation"
                  size={24}
                  color={colors.primary}
                />
                <View style={styles.conditionTextContainer}>
                  <Text style={[styles.conditionLabel, { color: colors.textSecondary }]}>
                    Wind Direction
                  </Text>
                  <Text style={[styles.conditionValue, { color: theme.colors.text }]}>
                    {report.windDirection}
                  </Text>
                </View>
              </View>

              <View style={styles.conditionItem}>
                <IconSymbol
                  ios_icon_name="thermometer"
                  android_material_icon_name="thermostat"
                  size={24}
                  color={colors.primary}
                />
                <View style={styles.conditionTextContainer}>
                  <Text style={[styles.conditionLabel, { color: colors.textSecondary }]}>
                    Water Temp
                  </Text>
                  <Text style={[styles.conditionValue, { color: theme.colors.text }]}>
                    {report.waterTemp}
                  </Text>
                </View>
              </View>
            </View>

            <View style={styles.tideContainer}>
              <IconSymbol
                ios_icon_name="arrow.up.arrow.down"
                android_material_icon_name="swap_vert"
                size={24}
                color={colors.primary}
              />
              <View style={styles.conditionTextContainer}>
                <Text style={[styles.conditionLabel, { color: colors.textSecondary }]}>
                  Tide
                </Text>
                <Text style={[styles.conditionValue, { color: theme.colors.text }]}>
                  {report.tide}
                </Text>
              </View>
            </View>
          </View>

          <View style={[styles.conditionsBox, { backgroundColor: colors.highlight }]}>
            <Text style={[styles.conditionsTitle, { color: theme.colors.text }]}>
              Conditions
            </Text>
            <Text style={[styles.conditionsText, { color: theme.colors.text }]}>
              {report.conditions}
            </Text>
          </View>
        </View>
      ))}

      <View style={[styles.infoCard, { backgroundColor: theme.colors.card }]}>
        <IconSymbol
          ios_icon_name="info.circle.fill"
          android_material_icon_name="info"
          size={24}
          color={colors.primary}
        />
        <Text style={[styles.infoText, { color: colors.textSecondary }]}>
          Reports are updated daily at 6:00 AM EST with the latest conditions and forecasts.
        </Text>
      </View>
    </ScrollView>
  );
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
  },
  loadingText: {
    fontSize: 16,
    marginTop: 16,
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
    alignItems: 'center',
    marginBottom: 20,
  },
  reportDate: {
    fontSize: 18,
    fontWeight: 'bold',
    flex: 1,
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
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  conditionsBox: {
    padding: 12,
    borderRadius: 8,
  },
  conditionsTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  conditionsText: {
    fontSize: 14,
    lineHeight: 20,
  },
  infoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    gap: 12,
    boxShadow: '0px 2px 8px rgba(0, 0, 0, 0.1)',
    elevation: 3,
  },
  infoText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
  },
});
