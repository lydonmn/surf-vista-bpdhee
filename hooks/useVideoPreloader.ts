
import { useState, useEffect, useCallback, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { VideoDownloadManager } from '@/services/VideoDownloadManager';

interface VideoSource {
  uri: string;
}

interface UseVideoPreloaderResult {
  getSource: (url: string) => VideoSource;
}

/**
 * Strip query parameters from URL to get base URL
 * This ensures consistent cache keys for Supabase storage URLs with rotating tokens
 */
function getBaseUrl(url: string): string {
  return url.split('?')[0];
}

/**
 * Hook to manage video preloading queue
 * Preloads 2-3 videos ahead and returns the best available source (local or remote)
 * 
 * ⚠️ SILENT OPERATION: This hook performs all preloading in the background
 * with NO UI feedback. Users should not see any preloading indicators.
 * 
 * 🚨 CRITICAL FIX: Preloading starts IMMEDIATELY on mount, not waiting for user interaction
 */
export function useVideoPreloader(queue: string[]): UseVideoPreloaderResult {
  const [localPaths, setLocalPaths] = useState<Map<string, string>>(new Map());
  const appState = useRef(AppState.currentState);
  const preloadQueueRef = useRef<string[]>([]);
  const isPreloadingRef = useRef(false);

  /**
   * Preload the next 2-3 videos in the queue
   * This runs SILENTLY in the background with no UI feedback
   * 🚨 CRITICAL: This is called IMMEDIATELY on mount, not waiting for user interaction
   */
  const preloadNextVideos = useCallback(async (currentQueue: string[]) => {
    if (isPreloadingRef.current) {
      // Already preloading, skip
      return;
    }

    if (currentQueue.length === 0) {
      return;
    }

    isPreloadingRef.current = true;

    // Silent background logging only (no UI updates)
    if (__DEV__) {
      console.log('[useVideoPreloader] 📥 Starting IMMEDIATE silent background preload for', Math.min(3, currentQueue.length), 'videos');
      console.log('[useVideoPreloader] ✅ Preloading triggered on MOUNT (not waiting for user interaction)');
    }

    try {
      // Initialize download manager
      await VideoDownloadManager.initialize();

      // Preload next 2-3 videos
      const videosToPreload = currentQueue.slice(0, 3);
      const newLocalPaths = new Map(localPaths);

      for (const url of videosToPreload) {
        try {
          const baseUrl = getBaseUrl(url);
          
          // Check if already cached
          const cachedPath = await VideoDownloadManager.getLocalPathIfCached(url);
          
          if (cachedPath) {
            if (__DEV__) {
              console.log('[useVideoPreloader] ✅ Video already cached:', baseUrl);
            }
            newLocalPaths.set(url, cachedPath);
          } else if (!VideoDownloadManager.isDownloading(url)) {
            if (__DEV__) {
              console.log('[useVideoPreloader] 📥 Starting IMMEDIATE silent background download:', baseUrl);
            }
            
            // Start background download (no UI feedback)
            VideoDownloadManager.preloadVideo(url).then((localPath) => {
              if (localPath) {
                setLocalPaths(prev => new Map(prev).set(url, localPath));
                if (__DEV__) {
                  console.log('[useVideoPreloader] ✅ Download complete (silent):', baseUrl);
                }
              }
            }).catch((error) => {
              if (__DEV__) {
                console.error('[useVideoPreloader] Download error (silent):', error);
              }
            });
          }
        } catch (error) {
          if (__DEV__) {
            console.error('[useVideoPreloader] Error preloading video (silent):', error);
          }
        }
      }

      setLocalPaths(newLocalPaths);
    } catch (error) {
      if (__DEV__) {
        console.error('[useVideoPreloader] Preload error (silent):', error);
      }
    } finally {
      isPreloadingRef.current = false;
    }
  }, [localPaths]);

  /**
   * Handle app state changes - resume preloading when app comes to foreground
   */
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
      if (__DEV__) {
        console.log('[useVideoPreloader] App state changed:', appState.current, '->', nextAppState);
      }

      if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
        if (__DEV__) {
          console.log('[useVideoPreloader] 🔄 App returned to foreground - resuming IMMEDIATE silent preloading');
        }
        
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
   * 🚨 CRITICAL FIX: Update preload queue when queue changes
   * Preloading starts IMMEDIATELY on mount, not waiting for user interaction
   */
  useEffect(() => {
    preloadQueueRef.current = queue;

    if (queue.length > 0 && appState.current === 'active') {
      if (__DEV__) {
        console.log('[useVideoPreloader] Queue updated, starting IMMEDIATE silent preload');
        console.log('[useVideoPreloader] ✅ Preloading called on MOUNT (not waiting for tap/interaction)');
      }
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
      if (__DEV__) {
        console.log('[useVideoPreloader] ✅ Using LOCAL cached video for instant playback');
      }
      return { uri: localPath };
    }

    if (__DEV__) {
      console.log('[useVideoPreloader] ⚠️ Using REMOTE URL (not cached yet)');
    }
    return { uri: url };
  }, [localPaths]);

  return {
    getSource,
  };
}
