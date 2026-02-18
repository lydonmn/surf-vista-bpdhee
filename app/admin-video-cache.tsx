
import { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Modal } from 'react-native';
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
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [isBackgroundDownloadAvailable, setIsBackgroundDownloadAvailable] = useState(false);

  const loadCacheStats = useCallback(async () => {
    try {
      setIsLoading(true);
      console.log('[AdminVideoCache] Loading cache statistics...');
      
      await VideoDownloadManager.initialize();
      const stats = await VideoDownloadManager.getCacheStats();
      const bgAvailable = VideoDownloadManager.isBackgroundDownloadAvailable();
      
      console.log('[AdminVideoCache] Cache stats:', stats);
      console.log('[AdminVideoCache] Background downloads available:', bgAvailable);
      
      setCacheStats(stats);
      setIsBackgroundDownloadAvailable(bgAvailable);
    } catch (error) {
      console.error('[AdminVideoCache] Error loading cache stats:', error);
      // Don't show alert - just log the error
      setCacheStats({ totalSize: 0, fileCount: 0 });
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
    try {
      setIsClearing(true);
      setShowConfirmModal(false);
      console.log('[AdminVideoCache] Clearing cache...');
      
      await VideoDownloadManager.clearCache();
      
      console.log('[AdminVideoCache] ✅ Cache cleared');
      
      // Reload stats
      await loadCacheStats();
    } catch (error) {
      console.error('[AdminVideoCache] Error clearing cache:', error);
    } finally {
      setIsClearing(false);
    }
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
            {!isBackgroundDownloadAvailable && (
              <View style={[styles.warningCard, { backgroundColor: '#FFF3CD', borderColor: '#FFC107' }]}>
                <IconSymbol
                  ios_icon_name="exclamationmark.triangle.fill"
                  android_material_icon_name="warning"
                  size={24}
                  color="#FF9800"
                />
                <View style={styles.warningTextContainer}>
                  <Text style={[styles.warningTitle, { color: '#856404' }]}>
                    Streaming Mode
                  </Text>
                  <Text style={[styles.warningText, { color: '#856404' }]}>
                    Background downloading is not available. Videos will stream directly without caching.
                  </Text>
                </View>
              </View>
            )}

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
                {isBackgroundDownloadAvailable ? (
                  <>
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
                  </>
                ) : (
                  <>
                    <Text style={[styles.infoText, { color: colors.textSecondary }]}>
                      • Background downloading is not available in this environment
                    </Text>
                    <Text style={[styles.infoText, { color: colors.textSecondary }]}>
                      • Videos will stream directly from the server
                    </Text>
                    <Text style={[styles.infoText, { color: colors.textSecondary }]}>
                      • This is normal in Expo Go or simulator
                    </Text>
                    <Text style={[styles.infoText, { color: colors.textSecondary }]}>
                      • Background downloads will work in production builds
                    </Text>
                  </>
                )}
              </View>
            </View>

            <TouchableOpacity
              style={[
                styles.clearButton, 
                { 
                  backgroundColor: '#F44336',
                  opacity: (isClearing || (cacheStats?.fileCount || 0) === 0) ? 0.5 : 1
                }
              ]}
              onPress={() => setShowConfirmModal(true)}
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
                {isBackgroundDownloadAvailable 
                  ? 'No videos cached yet. Videos will be cached automatically as you watch them.'
                  : 'Background downloading is not available. Videos will stream directly.'}
              </Text>
            )}
          </>
        )}
      </ScrollView>

      {/* Confirmation Modal */}
      <Modal
        visible={showConfirmModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowConfirmModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.colors.card }]}>
            <Text style={[styles.modalTitle, { color: theme.colors.text }]}>
              Clear Video Cache
            </Text>
            <Text style={[styles.modalMessage, { color: colors.textSecondary }]}>
              This will delete all cached videos. They will need to be downloaded again. Continue?
            </Text>
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, { backgroundColor: colors.textSecondary }]}
                onPress={() => setShowConfirmModal(false)}
              >
                <Text style={styles.modalButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, { backgroundColor: '#F44336' }]}
                onPress={handleClearCache}
              >
                <Text style={styles.modalButtonText}>Clear Cache</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
  warningCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 16,
    borderRadius: 12,
    gap: 12,
    marginBottom: 16,
    borderWidth: 1,
  },
  warningTextContainer: {
    flex: 1,
    gap: 4,
  },
  warningTitle: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  warningText: {
    fontSize: 13,
    lineHeight: 20,
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    borderRadius: 12,
    padding: 24,
    width: '100%',
    maxWidth: 400,
    gap: 16,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  modalMessage: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  modalButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
