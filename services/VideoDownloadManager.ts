
import * as FileSystem from 'expo-file-system/legacy';
import { logError } from '@/utils/errorLogger';

const VIDEO_CACHE_DIRECTORY = `${FileSystem.cacheDirectory}videos/`;

class VideoDownloadManagerClass {
  private isInitialized = false;

  /**
   * Initializes the video download manager.
   * This method is now simplified to only ensure the video cache directory exists.
   * Background task registration and complex caching logic have been removed.
   */
  public async initialize(): Promise<void> {
    if (this.isInitialized) {
      console.log('[VideoDownloadManager] Already initialized.');
      return;
    }

    console.log('[VideoDownloadManager] Initializing...');
    try {
      const dirInfo = await FileSystem.getInfoAsync(VIDEO_CACHE_DIRECTORY);
      if (!dirInfo.exists) {
        console.log('[VideoDownloadManager] Creating video cache directory:', VIDEO_CACHE_DIRECTORY);
        await FileSystem.makeDirectoryAsync(VIDEO_CACHE_DIRECTORY, { intermediates: true });
      } else {
        console.log('[VideoDownloadManager] Video cache directory exists:', VIDEO_CACHE_DIRECTORY);
      }

      this.isInitialized = true;
      console.log('[VideoDownloadManager] Initialization complete.');
    } catch (error) {
      logError(error, 'VideoDownloadManager initialization failed');
      console.error('[VideoDownloadManager] Failed to initialize:', error);
      // Don't re-throw, allow app to continue with degraded functionality
    }
  }

  /**
   * Retrieves statistics about the video cache directory.
   * Calculates total size and file count by reading the directory.
   */
  public async getCacheStats(): Promise<{ totalSize: number; fileCount: number }> {
    try {
      const dirInfo = await FileSystem.getInfoAsync(VIDEO_CACHE_DIRECTORY);
      if (!dirInfo.exists) {
        return { totalSize: 0, fileCount: 0 };
      }

      const files = await FileSystem.readDirectoryAsync(VIDEO_CACHE_DIRECTORY);
      let totalSize = 0;
      for (const file of files) {
        const fileUri = `${VIDEO_CACHE_DIRECTORY}${file}`;
        const fileInfo = await FileSystem.getInfoAsync(fileUri);
        if (fileInfo.exists && fileInfo.size) {
          totalSize += fileInfo.size;
        }
      }
      return { totalSize, fileCount: files.length };
    } catch (error) {
      logError(error, 'Failed to get video cache stats');
      console.error('[VideoDownloadManager] Failed to get cache stats:', error);
      return { totalSize: 0, fileCount: 0 };
    }
  }

  /**
   * Indicates whether background video download functionality is available.
   * Currently returns false as the feature is temporarily disabled.
   */
  public isBackgroundDownloadAvailable(): boolean {
    return false; // Background download feature temporarily disabled
  }
}

export const VideoDownloadManager = new VideoDownloadManagerClass();
