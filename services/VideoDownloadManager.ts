
import * as FileSystem from 'expo-file-system/legacy';
import CryptoJS from 'crypto-js';
import { Platform } from 'react-native';

// Conditional import for react-native-background-downloader
let RNBackgroundDownloader: any = null;
try {
  RNBackgroundDownloader = require('react-native-background-downloader').default;
  console.log('[VideoDownloadManager] ✅ react-native-background-downloader loaded successfully');
} catch (error) {
  console.warn('[VideoDownloadManager] ⚠️ react-native-background-downloader not available, falling back to streaming-only mode:', error);
}

interface DownloadTask {
  id: string;
  url: string;
  localPath: string;
  progress: number;
  status: 'pending' | 'downloading' | 'completed' | 'failed';
  task?: any;
}

interface CacheEntry {
  url: string;
  localPath: string;
  size: number;
  lastAccessed: number;
}

const MAX_CACHE_SIZE_BYTES = 500 * 1024 * 1024; // 500MB

// Fallback to FileSystem.cacheDirectory if native module is unavailable
const getCacheDirectory = (): string => {
  if (RNBackgroundDownloader?.documents) {
    return `${RNBackgroundDownloader.documents}/videos/`;
  }
  return `${FileSystem.cacheDirectory}videos/`;
};

class VideoDownloadManagerClass {
  private downloads: Map<string, DownloadTask> = new Map();
  private cache: Map<string, CacheEntry> = new Map();
  private initialized = false;
  private CACHE_DIR: string = '';

  /**
   * Initialize the download manager and cache directory
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    console.log('[VideoDownloadManager] 🚀 Initializing...');

    try {
      // Set cache directory with fallback
      this.CACHE_DIR = getCacheDirectory();
      console.log('[VideoDownloadManager] Using cache directory:', this.CACHE_DIR);

      if (!RNBackgroundDownloader) {
        console.log('[VideoDownloadManager] ⚠️ Operating in streaming-only mode (no background downloads)');
      }

      // Create cache directory if it doesn't exist
      const dirInfo = await FileSystem.getInfoAsync(this.CACHE_DIR);
      if (!dirInfo.exists) {
        console.log('[VideoDownloadManager] Creating cache directory:', this.CACHE_DIR);
        await FileSystem.makeDirectoryAsync(this.CACHE_DIR, { intermediates: true });
      }

      // Load existing cache entries
      await this.loadCacheIndex();

      this.initialized = true;
      console.log('[VideoDownloadManager] ✅ Initialized successfully');
    } catch (error) {
      console.error('[VideoDownloadManager] ❌ Initialization failed:', error);
      // Don't throw - allow app to continue without caching
      this.initialized = true;
    }
  }

  /**
   * Load cache index from disk
   */
  private async loadCacheIndex(): Promise<void> {
    try {
      const files = await FileSystem.readDirectoryAsync(this.CACHE_DIR);
      console.log('[VideoDownloadManager] Found', files.length, 'cached files');

      for (const file of files) {
        if (file.endsWith('.m3u8') || file.endsWith('.mp4')) {
          const filePath = `${this.CACHE_DIR}${file}`;
          const fileInfo = await FileSystem.getInfoAsync(filePath);

          if (fileInfo.exists && fileInfo.size) {
            // Extract original URL from filename (reverse hash)
            // For now, we'll just track the file
            this.cache.set(file, {
              url: '', // We'll populate this when accessed
              localPath: filePath,
              size: fileInfo.size,
              lastAccessed: Date.now(),
            });
          }
        }
      }

      console.log('[VideoDownloadManager] Loaded', this.cache.size, 'cache entries');
    } catch (error) {
      console.error('[VideoDownloadManager] Error loading cache index:', error);
    }
  }

  /**
   * Strip query parameters from URL to get base URL
   * This ensures consistent cache keys for Supabase storage URLs with rotating tokens
   */
  private getBaseUrl(url: string): string {
    return url.split('?')[0];
  }

  /**
   * Generate a consistent hash for a URL
   * Uses base URL (without query params) to ensure same video = same cache key
   */
  private hashUrl(url: string): string {
    const baseUrl = this.getBaseUrl(url);
    const hash = CryptoJS.MD5(baseUrl).toString();
    return hash;
  }

  /**
   * Get the local file path for a URL
   */
  private getLocalPath(url: string): string {
    const hash = this.hashUrl(url);
    const extension = url.includes('.m3u8') ? '.m3u8' : '.mp4';
    return `${this.CACHE_DIR}${hash}${extension}`;
  }

  /**
   * Check if a video is already cached locally
   */
  async getLocalPathIfCached(url: string): Promise<string | null> {
    if (!this.initialized) {
      await this.initialize();
    }

    const baseUrl = this.getBaseUrl(url);
    const localPath = this.getLocalPath(url);
    
    try {
      const fileInfo = await FileSystem.getInfoAsync(localPath);
      
      if (fileInfo.exists && fileInfo.size && fileInfo.size > 0) {
        console.log('[Cache] HIT for:', baseUrl);
        
        // Update last accessed time
        const hash = this.hashUrl(url);
        const fileName = `${hash}${url.includes('.m3u8') ? '.m3u8' : '.mp4'}`;
        const cacheEntry = this.cache.get(fileName);
        
        if (cacheEntry) {
          cacheEntry.lastAccessed = Date.now();
          cacheEntry.url = url;
        } else {
          this.cache.set(fileName, {
            url,
            localPath,
            size: fileInfo.size,
            lastAccessed: Date.now(),
          });
        }

        return localPath;
      }
    } catch (error) {
      console.log('[VideoDownloadManager] Cache MISS for:', baseUrl);
    }

    return null;
  }

  /**
   * Preload a video in the background
   */
  async preloadVideo(url: string): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }

    const baseUrl = this.getBaseUrl(url);

    // If native module is not available, skip downloading
    if (!RNBackgroundDownloader) {
      console.log('[VideoDownloadManager] ⚠️ Preload skipped (native module unavailable), will stream:', baseUrl);
      return;
    }

    // Check if already cached
    const cachedPath = await this.getLocalPathIfCached(url);
    if (cachedPath) {
      console.log('[VideoDownloadManager] Video already cached, skipping download');
      return;
    }

    // Check if already downloading
    if (this.downloads.has(url)) {
      const existing = this.downloads.get(url)!;
      if (existing.status === 'downloading' || existing.status === 'completed') {
        console.log('[VideoDownloadManager] Video already downloading or completed');
        return;
      }
    }

    const localPath = this.getLocalPath(url);
    const taskId = this.hashUrl(url);

    console.log('[VideoDownloadManager] 📥 Starting background download for:', baseUrl);

    try {
      // Create download task
      const task = RNBackgroundDownloader.download({
        id: taskId,
        url: url,
        destination: localPath,
      });

      const downloadTask: DownloadTask = {
        id: taskId,
        url,
        localPath,
        progress: 0,
        status: 'downloading',
        task,
      };

      this.downloads.set(url, downloadTask);

      // Set up progress listener
      task.begin((expectedBytes: number) => {
        console.log('[VideoDownloadManager] Download started, expected size:', expectedBytes);
      });

      task.progress((percent: number) => {
        downloadTask.progress = percent;
        if (percent % 25 === 0) {
          console.log('[VideoDownloadManager] Download progress:', Math.round(percent), '%');
        }
      });

      task.done(() => {
        const baseUrl = this.getBaseUrl(url);
        console.log('[VideoDownloadManager] ✅ Download completed:', baseUrl);
        downloadTask.status = 'completed';

        // Add to cache
        FileSystem.getInfoAsync(localPath).then((fileInfo) => {
          if (fileInfo.exists && fileInfo.size) {
            const hash = this.hashUrl(url);
            const fileName = `${hash}${url.includes('.m3u8') ? '.m3u8' : '.mp4'}`;
            
            this.cache.set(fileName, {
              url,
              localPath,
              size: fileInfo.size,
              lastAccessed: Date.now(),
            });

            // Check cache size and evict if needed
            this.evictLRUIfNeeded();
          }
        });
      });

      task.error((error: string) => {
        console.error('[VideoDownloadManager] ❌ Download failed:', error);
        downloadTask.status = 'failed';
        this.downloads.delete(url);
      });
    } catch (error) {
      console.error('[VideoDownloadManager] Error starting download:', error);
      // Don't throw - allow app to continue with streaming
    }
  }

  /**
   * Evict least recently used cache entries if cache exceeds limit
   */
  private async evictLRUIfNeeded(): Promise<void> {
    try {
      // Calculate total cache size
      let totalSize = 0;
      for (const entry of this.cache.values()) {
        totalSize += entry.size;
      }

      console.log('[VideoDownloadManager] Current cache size:', (totalSize / 1024 / 1024).toFixed(2), 'MB');

      if (totalSize <= MAX_CACHE_SIZE_BYTES) {
        return;
      }

      console.log('[VideoDownloadManager] ⚠️ Cache size exceeds limit, evicting LRU entries...');

      // Sort by last accessed (oldest first)
      const sortedEntries = Array.from(this.cache.entries()).sort(
        (a, b) => a[1].lastAccessed - b[1].lastAccessed
      );

      // Evict until we're under the limit
      for (const [fileName, entry] of sortedEntries) {
        if (totalSize <= MAX_CACHE_SIZE_BYTES * 0.8) {
          // Stop when we're at 80% of limit
          break;
        }

        const baseUrl = this.getBaseUrl(entry.url);
        console.log('[VideoDownloadManager] Evicting:', baseUrl);

        try {
          await FileSystem.deleteAsync(entry.localPath, { idempotent: true });
          this.cache.delete(fileName);
          totalSize -= entry.size;
        } catch (error) {
          console.error('[VideoDownloadManager] Error evicting file:', error);
        }
      }

      console.log('[VideoDownloadManager] ✅ Cache eviction complete, new size:', (totalSize / 1024 / 1024).toFixed(2), 'MB');
    } catch (error) {
      console.error('[VideoDownloadManager] Error during cache eviction:', error);
    }
  }

  /**
   * Clear all cached videos
   */
  async clearCache(): Promise<void> {
    console.log('[VideoDownloadManager] 🗑️ Clearing all cached videos...');

    try {
      // Cancel all active downloads (only if native module is available)
      if (RNBackgroundDownloader) {
        for (const download of this.downloads.values()) {
          if (download.task && download.status === 'downloading') {
            try {
              download.task.stop();
            } catch (error) {
              console.error('[VideoDownloadManager] Error stopping download:', error);
            }
          }
        }
      }

      this.downloads.clear();

      // Delete cache directory
      const dirInfo = await FileSystem.getInfoAsync(this.CACHE_DIR);
      if (dirInfo.exists) {
        await FileSystem.deleteAsync(this.CACHE_DIR, { idempotent: true });
        await FileSystem.makeDirectoryAsync(this.CACHE_DIR, { intermediates: true });
      }

      this.cache.clear();

      console.log('[VideoDownloadManager] ✅ Cache cleared successfully');
    } catch (error) {
      console.error('[VideoDownloadManager] Error clearing cache:', error);
      throw error;
    }
  }

  /**
   * Get cache statistics
   */
  async getCacheStats(): Promise<{ totalSize: number; fileCount: number }> {
    let totalSize = 0;
    let fileCount = 0;

    for (const entry of this.cache.values()) {
      totalSize += entry.size;
      fileCount++;
    }

    return { totalSize, fileCount };
  }

  /**
   * Cancel a specific download
   */
  cancelDownload(url: string): void {
    if (!RNBackgroundDownloader) {
      console.log('[VideoDownloadManager] Cannot cancel download: native module unavailable');
      return;
    }

    const download = this.downloads.get(url);
    if (download && download.task && download.status === 'downloading') {
      const baseUrl = this.getBaseUrl(url);
      console.log('[VideoDownloadManager] Cancelling download:', baseUrl);
      download.task.stop();
      this.downloads.delete(url);
    }
  }

  /**
   * Get download progress for a URL
   */
  getDownloadProgress(url: string): number {
    const download = this.downloads.get(url);
    return download?.progress || 0;
  }

  /**
   * Check if a video is currently downloading
   */
  isDownloading(url: string): boolean {
    const download = this.downloads.get(url);
    return download?.status === 'downloading';
  }

  /**
   * Check if background downloading is available
   */
  isBackgroundDownloadAvailable(): boolean {
    return RNBackgroundDownloader !== null;
  }
}

// Export singleton instance
export const VideoDownloadManager = new VideoDownloadManagerClass();
