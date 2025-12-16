
import React from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image } from "react-native";
import { useTheme } from "@react-navigation/native";
import { useAuth } from "@/contexts/AuthContext";
import { router } from "expo-router";
import { colors } from "@/styles/commonStyles";
import { mockSurfReports, mockVideos } from "@/data/mockData";
import { IconSymbol } from "@/components/IconSymbol";
import SurfVistaLogo from "@/components/SurfVistaLogo";

export default function HomeScreen() {
  const theme = useTheme();
  const { user, checkSubscription } = useAuth();
  const isSubscribed = checkSubscription();
  const latestReport = mockSurfReports[0];
  const latestVideo = mockVideos[0];

  if (!user) {
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <View style={styles.centerContent}>
          <SurfVistaLogo size="large" />
          <Text style={[styles.tagline, { color: colors.textSecondary }]}>
            Exclusive Surf Reports from Folly Beach, SC
          </Text>
          <TouchableOpacity
            style={[styles.loginButton, { backgroundColor: colors.primary }]}
            onPress={() => router.push('/login')}
          >
            <Text style={styles.loginButtonText}>Login / Subscribe</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (!isSubscribed) {
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <View style={styles.centerContent}>
          <SurfVistaLogo size="large" />
          <Text style={[styles.title, { color: theme.colors.text }]}>
            Subscribe to Access Premium Content
          </Text>
          <Text style={[styles.text, { color: colors.textSecondary }]}>
            Get daily drone footage and exclusive surf reports for just $5/month
          </Text>
          <TouchableOpacity
            style={[styles.subscribeButton, { backgroundColor: colors.accent }]}
            onPress={() => {
              console.log('Opening subscription flow');
              // In production, this would trigger Superwall
            }}
          >
            <Text style={styles.subscribeButtonText}>Subscribe Now - $5/month</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <ScrollView 
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      contentContainerStyle={styles.scrollContent}
    >
      <View style={styles.header}>
        <SurfVistaLogo size="medium" />
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          Folly Beach, South Carolina
        </Text>
      </View>

      {/* Latest Video Section */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
          Latest Drone Footage
        </Text>
        <TouchableOpacity
          style={[styles.videoCard, { backgroundColor: theme.colors.card }]}
          onPress={() => router.push({
            pathname: '/video-player',
            params: { videoId: latestVideo.id }
          })}
        >
          <Image
            source={{ uri: latestVideo.thumbnailUrl }}
            style={styles.thumbnail}
          />
          <View style={styles.playOverlay}>
            <IconSymbol
              ios_icon_name="play.circle.fill"
              android_material_icon_name="play_circle"
              size={64}
              color="#FFFFFF"
            />
          </View>
          <View style={styles.videoInfo}>
            <Text style={[styles.videoTitle, { color: theme.colors.text }]}>
              {latestVideo.title}
            </Text>
            <Text style={[styles.videoDate, { color: colors.textSecondary }]}>
              {new Date(latestVideo.date).toLocaleDateString()} • {latestVideo.duration}
            </Text>
          </View>
        </TouchableOpacity>
      </View>

      {/* Today's Conditions */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
          Today&apos;s Conditions
        </Text>
        <View style={[styles.reportCard, { backgroundColor: theme.colors.card }]}>
          <View style={styles.ratingContainer}>
            <Text style={[styles.ratingNumber, { color: colors.accent }]}>
              {latestReport.rating}/10
            </Text>
            <Text style={[styles.ratingLabel, { color: colors.textSecondary }]}>
              Surf Rating
            </Text>
          </View>
          
          <View style={styles.conditionsGrid}>
            <View style={styles.conditionItem}>
              <IconSymbol
                ios_icon_name="water.waves"
                android_material_icon_name="waves"
                size={24}
                color={colors.primary}
              />
              <Text style={[styles.conditionLabel, { color: colors.textSecondary }]}>
                Wave Height
              </Text>
              <Text style={[styles.conditionValue, { color: theme.colors.text }]}>
                {latestReport.waveHeight}
              </Text>
            </View>

            <View style={styles.conditionItem}>
              <IconSymbol
                ios_icon_name="wind"
                android_material_icon_name="air"
                size={24}
                color={colors.primary}
              />
              <Text style={[styles.conditionLabel, { color: colors.textSecondary }]}>
                Wind
              </Text>
              <Text style={[styles.conditionValue, { color: theme.colors.text }]}>
                {latestReport.windSpeed}
              </Text>
            </View>

            <View style={styles.conditionItem}>
              <IconSymbol
                ios_icon_name="thermometer"
                android_material_icon_name="thermostat"
                size={24}
                color={colors.primary}
              />
              <Text style={[styles.conditionLabel, { color: colors.textSecondary }]}>
                Water Temp
              </Text>
              <Text style={[styles.conditionValue, { color: theme.colors.text }]}>
                {latestReport.waterTemp}
              </Text>
            </View>
          </View>

          <View style={styles.conditionsText}>
            <Text style={[styles.conditionsDescription, { color: theme.colors.text }]}>
              {latestReport.conditions}
            </Text>
          </View>

          <TouchableOpacity
            style={[styles.viewMoreButton, { backgroundColor: colors.primary }]}
            onPress={() => router.push('/(tabs)/report')}
          >
            <Text style={styles.viewMoreButtonText}>View Full Report</Text>
          </TouchableOpacity>
        </View>
      </View>

      {user.isAdmin && (
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
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: 16,
    paddingHorizontal: 16,
    paddingBottom: 100,
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    gap: 24,
  },
  header: {
    alignItems: 'center',
    marginBottom: 24,
    gap: 8,
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
  thumbnail: {
    width: '100%',
    height: 200,
    resizeMode: 'cover',
  },
  playOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 60,
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
  videoDate: {
    fontSize: 14,
  },
  reportCard: {
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  ratingContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  ratingNumber: {
    fontSize: 48,
    fontWeight: 'bold',
  },
  ratingLabel: {
    fontSize: 14,
    marginTop: 4,
  },
  conditionsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 20,
  },
  conditionItem: {
    alignItems: 'center',
    flex: 1,
  },
  conditionLabel: {
    fontSize: 12,
    marginTop: 8,
    marginBottom: 4,
  },
  conditionValue: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  conditionsText: {
    marginBottom: 16,
  },
  conditionsDescription: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  viewMoreButton: {
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  viewMoreButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
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
