
import { useState, useEffect, useCallback, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { VideoDownloadManager } from '@/services/VideoDownloadManager';

interface VideoSource {
  uri: string;
}

interface UseVideoPreloaderResult {
  getSource: (url: string) => VideoSource;
  isPreloading: boolean;
  preloadProgress: Map<string, number>;
}

/**
 * Hook to manage video preloading queue
 * Preloads 2-3 videos ahead and returns the best available source (local or remote)
 */
export function useVideoPreloader(queue: string[]): UseVideoPreloaderResult {
  const [localPaths, setLocalPaths] = useState<Map<string, string>>(new Map());
  const [isPreloading, setIsPreloading] = useState(false);
  const [preloadProgress, setPreloadProgress] = useState<Map<string, number>>(new Map());
  const appState = useRef(AppState.currentState);
  const preloadQueueRef = useRef<string[]>([]);
  const isPreloadingRef = useRef(false);

  /**
   * Preload the next 2-3 videos in the queue
   */
  const preloadNextVideos = useCallback(async (currentQueue: string[]) => {
    if (isPreloadingRef.current) {
      console.log('[useVideoPreloader] Already preloading, skipping...');
      return;
    }

    if (currentQueue.length === 0) {
      console.log('[useVideoPreloader] Empty queue, nothing to preload');
      return;
    }

    isPreloadingRef.current = true;
    setIsPreloading(true);

    console.log('[useVideoPreloader] 📥 Starting preload for', Math.min(3, currentQueue.length), 'videos');

    try {
      // Initialize download manager
      await VideoDownloadManager.initialize();

      // Preload next 2-3 videos
      const videosToPreload = currentQueue.slice(0, 3);
      const newLocalPaths = new Map(localPaths);
      const newProgress = new Map(preloadProgress);

      for (const url of videosToPreload) {
        try {
          // Check if already cached
          const cachedPath = await VideoDownloadManager.getLocalPathIfCached(url);
          
          if (cachedPath) {
            console.log('[useVideoPreloader] ✅ Video already cached:', url.substring(0, 60));
            newLocalPaths.set(url, cachedPath);
            newProgress.set(url, 100);
          } else if (!VideoDownloadManager.isDownloading(url)) {
            console.log('[useVideoPreloader] 📥 Starting background download:', url.substring(0, 60));
            
            // Start background download
            VideoDownloadManager.preloadVideo(url).catch((error) => {
              console.error('[useVideoPreloader] Download error:', error);
            });

            // Monitor progress
            const progressInterval = setInterval(() => {
              const progress = VideoDownloadManager.getDownloadProgress(url);
              newProgress.set(url, progress);
              setPreloadProgress(new Map(newProgress));

              if (progress >= 100) {
                clearInterval(progressInterval);
                
                // Update local path when download completes
                VideoDownloadManager.getLocalPathIfCached(url).then((path) => {
                  if (path) {
                    newLocalPaths.set(url, path);
                    setLocalPaths(new Map(newLocalPaths));
                  }
                });
              }
            }, 500);

            // Clean up interval after 5 minutes
            setTimeout(() => clearInterval(progressInterval), 5 * 60 * 1000);
          }
        } catch (error) {
          console.error('[useVideoPreloader] Error preloading video:', error);
        }
      }

      setLocalPaths(newLocalPaths);
      setPreloadProgress(newProgress);
    } catch (error) {
      console.error('[useVideoPreloader] Preload error:', error);
    } finally {
      isPreloadingRef.current = false;
      setIsPreloading(false);
    }
  }, [localPaths, preloadProgress]);

  /**
   * Handle app state changes - resume preloading when app comes to foreground
   */
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
      console.log('[useVideoPreloader] App state changed:', appState.current, '->', nextAppState);

      if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
        console.log('[useVideoPreloader] 🔄 App returned to foreground - resuming aggressive preloading');
        
        // Resume preloading when app comes back to foreground
        if (preloadQueueRef.current.length > 0) {
          preloadNextVideos(preloadQueueRef.current);
        }
      }

      appState.current = nextAppState;
    });

    return () => {
      subscription.remove();
    };
  }, [preloadNextVideos]);

  /**
   * Update preload queue when queue changes
   */
  useEffect(() => {
    preloadQueueRef.current = queue;

    if (queue.length > 0 && appState.current === 'active') {
      console.log('[useVideoPreloader] Queue updated, starting preload');
      preloadNextVideos(queue);
    }
  }, [queue, preloadNextVideos]);

  /**
   * Get the best available source for a video URL
   * Returns local file:// path if cached, otherwise returns remote URL
   */
  const getSource = useCallback((url: string): VideoSource => {
    const localPath = localPaths.get(url);
    
    if (localPath) {
      console.log('[useVideoPreloader] ✅ Using LOCAL cached video for instant playback');
      return { uri: localPath };
    }

    console.log('[useVideoPreloader] ⚠️ Using REMOTE URL (not cached yet)');
    return { uri: url };
  }, [localPaths]);

  return {
    getSource,
    isPreloading,
    preloadProgress,
  };
}
