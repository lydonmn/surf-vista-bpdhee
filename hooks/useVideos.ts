
import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/app/integrations/supabase/client';
import { Database } from '@/app/integrations/supabase/types';
import { useLocation } from '@/contexts/LocationContext';
import * as FileSystem from 'expo-file-system/legacy';

type Video = Database['public']['Tables']['videos']['Row'] & {
  signed_url?: string;
};

export function useVideos() {
  const { currentLocation } = useLocation();
  const [videos, setVideos] = useState<Video[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const isMountedRef = useRef(true);
  const preloadedUrlsRef = useRef<Map<string, { url: string; timestamp: number }>>(new Map());
  const preloadingQueueRef = useRef<Set<string>>(new Set());
  const keepAliveIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastActivityRef = useRef<number>(Date.now());
  const isFetchingRef = useRef(false);

  // ✅ CRITICAL: Cache signed URLs with 1-hour expiry
  const SIGNED_URL_CACHE_DURATION = 3600000; // 1 hour in milliseconds
  const PRELOAD_SIZE = 15 * 1024 * 1024; // 15MB preload for instant playback
  const KEEP_ALIVE_INTERVAL = 60000; // ✅ CRITICAL FIX: Increased to 60 seconds (was 30s)
  const REFRESH_INTERVAL = 10 * 60 * 1000; // ✅ CRITICAL FIX: Increased to 10 minutes (was 2 minutes)

  // Generate signed URL for a video with caching
  const generateSignedUrl = useCallback(async (videoUrl: string, videoId: string): Promise<string | null> => {
    try {
      // Check cache first
      const cached = preloadedUrlsRef.current.get(videoId);
      if (cached) {
        const age = Date.now() - cached.timestamp;
        if (age < SIGNED_URL_CACHE_DURATION) {
          return cached.url;
        } else {
          preloadedUrlsRef.current.delete(videoId);
        }
      }

      // Extract the file path from the full URL
      const urlParts = videoUrl.split('/videos/');
      if (urlParts.length !== 2) {
        console.error('[useVideos] Invalid video URL format:', videoUrl);
        return null;
      }

      const filePath = urlParts[1].split('?')[0];

      // Generate signed URL with 2 hour expiry (longer than cache to prevent edge cases)
      const { data, error } = await supabase.storage
        .from('videos')
        .createSignedUrl(filePath, 7200);

      if (error) {
        console.error('[useVideos] Error generating signed URL:', error);
        return null;
      }

      if (!data?.signedUrl) {
        console.error('[useVideos] No signed URL returned');
        return null;
      }
      
      // Cache the signed URL
      preloadedUrlsRef.current.set(videoId, {
        url: data.signedUrl,
        timestamp: Date.now()
      });

      return data.signedUrl;
    } catch (error) {
      console.error('[useVideos] Exception generating signed URL:', error);
      return null;
    }
  }, []);

  // ✅ CRITICAL FIX: Simplified keep-alive mechanism
  const keepConnectionsAlive = useCallback(async () => {
    const now = Date.now();
    const timeSinceLastActivity = now - lastActivityRef.current;
    
    // Only refresh if app has been idle for more than 2 minutes
    if (timeSinceLastActivity > 120000) {
      console.log('[useVideos] ⚡ App idle detected - refreshing connections');
      
      // Ping only the first video to keep connection warm
      const firstVideo = Array.from(preloadedUrlsRef.current.entries())[0];
      
      if (firstVideo) {
        const [videoId, { url }] = firstVideo;
        try {
          await fetch(url, {
            method: 'HEAD',
            cache: 'no-cache',
          });
        } catch (error) {
          console.warn('[useVideos] Keep-alive failed:', error);
        }
      }
      
      lastActivityRef.current = now;
    }
  }, []);

  // ✅ CRITICAL: Aggressive preloading with local caching for instant playback
  const preloadVideo = useCallback(async (signedUrl: string, videoId: string): Promise<void> => {
    // Prevent duplicate preloading
    if (preloadingQueueRef.current.has(videoId)) {
      return;
    }

    try {
      preloadingQueueRef.current.add(videoId);
      
      // Update last activity timestamp
      lastActivityRef.current = Date.now();
      
      // Strategy 1: Fetch first 15MB to warm up CDN and cache in memory
      const response = await fetch(signedUrl, {
        method: 'GET',
        headers: {
          'Range': `bytes=0-${PRELOAD_SIZE - 1}`,
          'Cache-Control': 'no-cache',
        },
      });

      if (response.ok || response.status === 206) {
        // Strategy 2: Cache the preloaded data locally for instant access
        try {
          const cacheDir = `${FileSystem.cacheDirectory}video_cache/`;
          const cacheFile = `${cacheDir}${videoId}_preload.mp4`;
          
          // Ensure cache directory exists
          const dirInfo = await FileSystem.getInfoAsync(cacheDir);
          if (!dirInfo.exists) {
            await FileSystem.makeDirectoryAsync(cacheDir, { intermediates: true });
          }
          
          // Download and cache the preload chunk
          await FileSystem.downloadAsync(signedUrl, cacheFile, {
            headers: {
              'Range': `bytes=0-${PRELOAD_SIZE - 1}`,
              'Cache-Control': 'no-cache',
            },
          });
        } catch (cacheError) {
          console.warn('[useVideos] Local caching failed (non-critical):', cacheError);
        }
      }
    } catch (error) {
      console.error('[useVideos] Error preloading video:', videoId, error);
    } finally {
      preloadingQueueRef.current.delete(videoId);
    }
  }, [PRELOAD_SIZE]);

  // ✅ CRITICAL FIX: Fetch videos with debouncing to prevent reload loops
  const fetchVideos = useCallback(async () => {
    if (!isMountedRef.current || isFetchingRef.current) {
      console.log('[useVideos] Fetch already in progress, skipping...');
      return;
    }

    try {
      isFetchingRef.current = true;
      setIsLoading(true);
      setError(null);
      console.log('[useVideos] ⚡ Fetching videos for location:', currentLocation);

      // Fetch videos from database with location filter
      const { data, error: fetchError } = await supabase
        .from('videos')
        .select('*')
        .eq('location', currentLocation)
        .order('created_at', { ascending: false });

      if (fetchError) {
        console.error('[useVideos] Error fetching videos:', fetchError);
        throw fetchError;
      }

      if (!data || data.length === 0) {
        console.log('[useVideos] No videos found for location:', currentLocation);
        if (isMountedRef.current) {
          setVideos([]);
          setIsLoading(false);
        }
        return;
      }

      console.log('[useVideos] ✅ Fetched', data.length, 'videos for location:', currentLocation);

      // ✅ INSTANT PLAYBACK: Generate ALL signed URLs in parallel
      const videosWithSignedUrls = await Promise.all(
        data.map(async (video) => {
          const signedUrl = await generateSignedUrl(video.video_url, video.id);
          
          if (signedUrl) {
            return { ...video, signed_url: signedUrl };
          }

          return video;
        })
      );

      // ✅ CRITICAL: Preload ALL videos in parallel for instant playback
      const preloadPromises = videosWithSignedUrls
        .filter(video => video.signed_url)
        .map(video => 
          preloadVideo(video.signed_url!, video.id)
            .catch(err => console.warn('[useVideos] Preload failed for video:', video.id, err))
        );

      // Don't await - let preloading happen in background
      Promise.all(preloadPromises)
        .then(() => console.log('[useVideos] ✅ All videos preloaded'))
        .catch(err => console.warn('[useVideos] Some preloads failed:', err));

      if (isMountedRef.current) {
        setVideos(videosWithSignedUrls);
        setIsLoading(false);
      }
    } catch (err) {
      console.error('[useVideos] Error in fetchVideos:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to load videos';
      
      if (isMountedRef.current) {
        setError(errorMessage);
        setIsLoading(false);
      }
    } finally {
      isFetchingRef.current = false;
    }
  }, [generateSignedUrl, preloadVideo, currentLocation]);

  // ✅ CRITICAL FIX: Simplified background refresh
  const backgroundRefresh = useCallback(async () => {
    if (isFetchingRef.current) {
      return;
    }

    console.log('[useVideos] 🔄 Background refresh triggered');
    
    try {
      // Fetch latest videos without showing loading state
      const { data, error: fetchError } = await supabase
        .from('videos')
        .select('*')
        .eq('location', currentLocation)
        .order('created_at', { ascending: false });

      if (fetchError || !data) {
        return;
      }

      // Regenerate signed URLs and preload in background
      const refreshPromises = data.map(async (video) => {
        const signedUrl = await generateSignedUrl(video.video_url, video.id);
        if (signedUrl) {
          preloadVideo(signedUrl, video.id).catch(() => {});
        }
      });

      await Promise.all(refreshPromises);
    } catch (error) {
      console.error('[useVideos] Background refresh error:', error);
    }
  }, [generateSignedUrl, preloadVideo, currentLocation]);

  // Refetch videos when location changes
  useEffect(() => {
    console.log('[useVideos] Location changed to:', currentLocation);
    fetchVideos();
  }, [currentLocation, fetchVideos]);

  useEffect(() => {
    console.log('[useVideos] Initializing...');
    isMountedRef.current = true;
    lastActivityRef.current = Date.now();
    
    fetchVideos();

    // ✅ CRITICAL FIX: Keep-alive mechanism with longer interval
    keepAliveIntervalRef.current = setInterval(() => {
      keepConnectionsAlive();
    }, KEEP_ALIVE_INTERVAL);

    // ✅ CRITICAL FIX: Periodic background refresh with longer interval
    const refreshInterval = setInterval(() => {
      backgroundRefresh();
    }, REFRESH_INTERVAL);

    // ✅ CRITICAL: Set up real-time subscription for instant updates
    const subscription = supabase
      .channel(`videos_changes_${currentLocation}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'videos',
          filter: `location=eq.${currentLocation}`,
        },
        (payload) => {
          console.log('[useVideos] ⚡ Video updated in real-time:', payload);
          lastActivityRef.current = Date.now();
          
          // Clear cache for the affected video
          if (payload.old && 'id' in payload.old) {
            preloadedUrlsRef.current.delete(payload.old.id as string);
          }
          if (payload.new && 'id' in payload.new) {
            preloadedUrlsRef.current.delete(payload.new.id as string);
          }
          
          // Only fetch if not already fetching
          if (!isFetchingRef.current) {
            fetchVideos();
          }
        }
      )
      .subscribe();

    return () => {
      console.log('[useVideos] Cleaning up...');
      isMountedRef.current = false;
      
      if (keepAliveIntervalRef.current) {
        clearInterval(keepAliveIntervalRef.current);
        keepAliveIntervalRef.current = null;
      }
      
      clearInterval(refreshInterval);
      subscription.unsubscribe();
    };
  }, [fetchVideos, backgroundRefresh, currentLocation, keepConnectionsAlive, KEEP_ALIVE_INTERVAL, REFRESH_INTERVAL]);

  return {
    videos,
    isLoading,
    error,
    refreshVideos: fetchVideos,
  };
}
