
import * as FileSystem from 'expo-file-system/legacy';
import RNBackgroundDownloader from 'react-native-background-downloader';
import CryptoJS from 'crypto-js';
import { Platform } from 'react-native';

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
const CACHE_DIR = `${FileSystem.cacheDirectory}videos/`;

class VideoDownloadManagerClass {
  private downloads: Map<string, DownloadTask> = new Map();
  private cache: Map<string, CacheEntry> = new Map();
  private initialized = false;

  /**
   * Initialize the download manager and cache directory
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    console.log('[VideoDownloadManager] 🚀 Initializing...');

    try {
      // Create cache directory if it doesn't exist
      const dirInfo = await FileSystem.getInfoAsync(CACHE_DIR);
      if (!dirInfo.exists) {
        console.log('[VideoDownloadManager] Creating cache directory:', CACHE_DIR);
        await FileSystem.makeDirectoryAsync(CACHE_DIR, { intermediates: true });
      }

      // Load existing cache entries
      await this.loadCacheIndex();

      this.initialized = true;
      console.log('[VideoDownloadManager] ✅ Initialized successfully');
    } catch (error) {
      console.error('[VideoDownloadManager] ❌ Initialization failed:', error);
      throw error;
    }
  }

  /**
   * Load cache index from disk
   */
  private async loadCacheIndex(): Promise<void> {
    try {
      const files = await FileSystem.readDirectoryAsync(CACHE_DIR);
      console.log('[VideoDownloadManager] Found', files.length, 'cached files');

      for (const file of files) {
        if (file.endsWith('.m3u8') || file.endsWith('.mp4')) {
          const filePath = `${CACHE_DIR}${file}`;
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
   * Generate a consistent hash for a URL
   */
  private hashUrl(url: string): string {
    const hash = CryptoJS.MD5(url).toString();
    return hash;
  }

  /**
   * Get the local file path for a URL
   */
  private getLocalPath(url: string): string {
    const hash = this.hashUrl(url);
    const extension = url.includes('.m3u8') ? '.m3u8' : '.mp4';
    return `${CACHE_DIR}${hash}${extension}`;
  }

  /**
   * Check if a video is already cached locally
   */
  async getLocalPathIfCached(url: string): Promise<string | null> {
    if (!this.initialized) {
      await this.initialize();
    }

    const localPath = this.getLocalPath(url);
    
    try {
      const fileInfo = await FileSystem.getInfoAsync(localPath);
      
      if (fileInfo.exists && fileInfo.size && fileInfo.size > 0) {
        console.log('[VideoDownloadManager] ✅ Cache HIT for:', url.substring(0, 60));
        
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
      console.log('[VideoDownloadManager] Cache MISS for:', url.substring(0, 60));
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

    console.log('[VideoDownloadManager] 📥 Starting background download for:', url.substring(0, 60));

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
      task.begin((expectedBytes) => {
        console.log('[VideoDownloadManager] Download started, expected size:', expectedBytes);
      });

      task.progress((percent) => {
        downloadTask.progress = percent;
        if (percent % 25 === 0) {
          console.log('[VideoDownloadManager] Download progress:', Math.round(percent), '%');
        }
      });

      task.done(() => {
        console.log('[VideoDownloadManager] ✅ Download completed:', url.substring(0, 60));
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

      task.error((error) => {
        console.error('[VideoDownloadManager] ❌ Download failed:', error);
        downloadTask.status = 'failed';
        this.downloads.delete(url);
      });
    } catch (error) {
      console.error('[VideoDownloadManager] Error starting download:', error);
      throw error;
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

        console.log('[VideoDownloadManager] Evicting:', entry.url.substring(0, 60));

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
      // Cancel all active downloads
      for (const download of this.downloads.values()) {
        if (download.task && download.status === 'downloading') {
          try {
            download.task.stop();
          } catch (error) {
            console.error('[VideoDownloadManager] Error stopping download:', error);
          }
        }
      }

      this.downloads.clear();

      // Delete cache directory
      const dirInfo = await FileSystem.getInfoAsync(CACHE_DIR);
      if (dirInfo.exists) {
        await FileSystem.deleteAsync(CACHE_DIR, { idempotent: true });
        await FileSystem.makeDirectoryAsync(CACHE_DIR, { intermediates: true });
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
    const download = this.downloads.get(url);
    if (download && download.task && download.status === 'downloading') {
      console.log('[VideoDownloadManager] Cancelling download:', url.substring(0, 60));
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
}

// Export singleton instance
export const VideoDownloadManager = new VideoDownloadManagerClass();
