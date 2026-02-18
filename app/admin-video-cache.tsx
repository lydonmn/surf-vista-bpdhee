
import { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { router } from 'expo-router';
import { useTheme } from '@react-navigation/native';
import { colors } from '@/styles/commonStyles';
import { IconSymbol } from '@/components/IconSymbol';
import { useAuth } from '@/contexts/AuthContext';
import { VideoDownloadManager } from '@/services/VideoDownloadManager';

export default function AdminVideoCacheScreen() {
  const theme = useTheme();
  const { user, profile } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [cacheStats, setCacheStats] = useState<{ totalSize: number; fileCount: number } | null>(null);
  const [isClearing, setIsClearing] = useState(false);

  const loadCacheStats = useCallback(async () => {
    try {
      setIsLoading(true);
      console.log('[AdminVideoCache] Loading cache statistics...');
      
      await VideoDownloadManager.initialize();
      const stats = await VideoDownloadManager.getCacheStats();
      
      console.log('[AdminVideoCache] Cache stats:', stats);
      setCacheStats(stats);
    } catch (error) {
      console.error('[AdminVideoCache] Error loading cache stats:', error);
      Alert.alert('Error', 'Failed to load cache statistics');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user && profile?.is_admin) {
      loadCacheStats();
    }
  }, [user, profile, loadCacheStats]);

  const handleClearCache = useCallback(async () => {
    Alert.alert(
      'Clear Video Cache',
      'This will delete all cached videos. They will need to be downloaded again. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear Cache',
          style: 'destructive',
          onPress: async () => {
            try {
              setIsClearing(true);
              console.log('[AdminVideoCache] Clearing cache...');
              
              await VideoDownloadManager.clearCache();
              
              console.log('[AdminVideoCache] ✅ Cache cleared');
              Alert.alert('Success', 'Video cache cleared successfully');
              
              // Reload stats
              await loadCacheStats();
            } catch (error) {
              console.error('[AdminVideoCache] Error clearing cache:', error);
              Alert.alert('Error', 'Failed to clear cache');
            } finally {
              setIsClearing(false);
            }
          },
        },
      ]
    );
  }, [loadCacheStats]);

  const handleGoBack = useCallback(() => {
    router.back();
  }, []);

  if (!user || !profile?.is_admin) {
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
            Admin Access Required
          </Text>
        </View>
      </View>
    );
  }

  const cacheSizeMB = cacheStats ? (cacheStats.totalSize / 1024 / 1024).toFixed(2) : '0.00';
  const cachePercentage = cacheStats ? ((cacheStats.totalSize / (500 * 1024 * 1024)) * 100).toFixed(1) : '0.0';

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={[styles.header, { paddingTop: 48 }]}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={handleGoBack}
        >
          <IconSymbol
            ios_icon_name="chevron.left"
            android_material_icon_name="arrow-back"
            size={24}
            color={colors.primary}
          />
          <Text style={[styles.backButtonText, { color: colors.primary }]}>
            Back
          </Text>
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.colors.text }]}>
          Video Cache Management
        </Text>
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {isLoading ? (
          <View style={styles.centerContent}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
              Loading cache statistics...
            </Text>
          </View>
        ) : (
          <>
            <View style={[styles.statsCard, { backgroundColor: theme.colors.card }]}>
              <View style={styles.statsHeader}>
                <IconSymbol
                  ios_icon_name="internaldrive.fill"
                  android_material_icon_name="storage"
                  size={32}
                  color={colors.primary}
                />
                <Text style={[styles.statsTitle, { color: theme.colors.text }]}>
                  Cache Statistics
                </Text>
              </View>

              <View style={styles.statRow}>
                <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
                  Total Size
                </Text>
                <Text style={[styles.statValue, { color: theme.colors.text }]}>
                  {cacheSizeMB} MB
                </Text>
              </View>

              <View style={styles.statRow}>
                <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
                  Files Cached
                </Text>
                <Text style={[styles.statValue, { color: theme.colors.text }]}>
                  {cacheStats?.fileCount || 0}
                </Text>
              </View>

              <View style={styles.statRow}>
                <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
                  Cache Usage
                </Text>
                <Text style={[styles.statValue, { color: theme.colors.text }]}>
                  {cachePercentage}% of 500 MB
                </Text>
              </View>

              <View style={styles.progressBarContainer}>
                <View 
                  style={[
                    styles.progressBar, 
                    { 
                      width: `${cachePercentage}%`,
                      backgroundColor: parseFloat(cachePercentage) > 80 ? '#FF9800' : colors.primary
                    }
                  ]} 
                />
              </View>
            </View>

            <View style={[styles.infoCard, { backgroundColor: theme.colors.card }]}>
              <IconSymbol
                ios_icon_name="info.circle.fill"
                android_material_icon_name="info"
                size={24}
                color={colors.primary}
              />
              <View style={styles.infoTextContainer}>
                <Text style={[styles.infoTitle, { color: theme.colors.text }]}>
                  How Video Caching Works
                </Text>
                <Text style={[styles.infoText, { color: colors.textSecondary }]}>
                  • Videos are downloaded in the background, even when the app is minimized
                </Text>
                <Text style={[styles.infoText, { color: colors.textSecondary }]}>
                  • The next 2-3 videos are automatically preloaded for instant playback
                </Text>
                <Text style={[styles.infoText, { color: colors.textSecondary }]}>
                  • Cache limit is 500MB with automatic LRU (Least Recently Used) eviction
                </Text>
                <Text style={[styles.infoText, { color: colors.textSecondary }]}>
                  • Cached videos play instantly without buffering
                </Text>
                <Text style={[styles.infoText, { color: colors.textSecondary }]}>
                  • Downloads resume aggressively when app returns to foreground
                </Text>
              </View>
            </View>

            <TouchableOpacity
              style={[styles.clearButton, { backgroundColor: '#F44336' }]}
              onPress={handleClearCache}
              disabled={isClearing || (cacheStats?.fileCount || 0) === 0}
            >
              {isClearing ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <IconSymbol
                    ios_icon_name="trash.fill"
                    android_material_icon_name="delete"
                    size={20}
                    color="#FFFFFF"
                  />
                  <Text style={styles.clearButtonText}>
                    Clear All Cached Videos
                  </Text>
                </>
              )}
            </TouchableOpacity>

            {(cacheStats?.fileCount || 0) === 0 && (
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                No videos cached yet. Videos will be cached automatically as you watch them.
              </Text>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    gap: 12,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
  },
  backButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 100,
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  loadingText: {
    fontSize: 16,
    marginTop: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginTop: 16,
  },
  statsCard: {
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
    boxShadow: '0px 2px 8px rgba(0, 0, 0, 0.1)',
    elevation: 3,
  },
  statsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 20,
  },
  statsTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(128, 128, 128, 0.2)',
  },
  statLabel: {
    fontSize: 14,
    fontWeight: '500',
  },
  statValue: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  progressBarContainer: {
    height: 8,
    backgroundColor: 'rgba(128, 128, 128, 0.2)',
    borderRadius: 4,
    marginTop: 16,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    borderRadius: 4,
  },
  infoCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 16,
    borderRadius: 12,
    gap: 12,
    marginBottom: 16,
    boxShadow: '0px 2px 8px rgba(0, 0, 0, 0.1)',
    elevation: 3,
  },
  infoTextContainer: {
    flex: 1,
    gap: 8,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  infoText: {
    fontSize: 13,
    lineHeight: 20,
  },
  clearButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  clearButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  emptyText: {
    fontSize: 14,
    textAlign: 'center',
    fontStyle: 'italic',
  },
});
