
import { VideoDownloadManager } from '@/services/VideoDownloadManager';
import { Platform } from 'react-native';

/**
 * Initialize video download manager on app startup
 * This ensures the cache directory is created and ready
 */
export async function initializeVideoDownloads(): Promise<void> {
  try {
    console.log('[VideoDownloadInit] 🚀 Initializing video download system...');
    
    await VideoDownloadManager.initialize();
    
    const stats = await VideoDownloadManager.getCacheStats();
    const isBackgroundAvailable = VideoDownloadManager.isBackgroundDownloadAvailable();
    
    console.log('[VideoDownloadInit] ✅ Video download system ready');
    console.log('[VideoDownloadInit] Background downloads:', isBackgroundAvailable ? 'ENABLED' : 'DISABLED (streaming only)');
    console.log('[VideoDownloadInit] Cache stats:', {
      totalSize: `${(stats.totalSize / 1024 / 1024).toFixed(2)} MB`,
      fileCount: stats.fileCount,
    });
  } catch (error) {
    console.error('[VideoDownloadInit] ❌ Failed to initialize video downloads:', error);
    // Don't throw - allow app to continue
  }
}

/**
 * Configure platform-specific background download settings
 */
export function configureBackgroundDownloads(): void {
  if (Platform.OS === 'ios') {
    console.log('[VideoDownloadInit] iOS background modes configured in app.json');
    console.log('[VideoDownloadInit] - fetch: Enabled');
    console.log('[VideoDownloadInit] - processing: Enabled');
  } else if (Platform.OS === 'android') {
    console.log('[VideoDownloadInit] Android WorkManager will handle background downloads');
    console.log('[VideoDownloadInit] - WAKE_LOCK permission: Enabled');
    console.log('[VideoDownloadInit] - FOREGROUND_SERVICE permission: Enabled');
  }
}
