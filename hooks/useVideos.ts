
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
  const currentLocationRef = useRef(currentLocation);

  // ✅ CRITICAL: Optimized caching and preloading for instant playback
  const SIGNED_URL_CACHE_DURATION = 3600000; // 1 hour
  const PRELOAD_SIZE = 20 * 1024 * 1024; // 20MB preload for instant start
  const KEEP_ALIVE_INTERVAL = 45000; // 45 seconds (more frequent)
  const REFRESH_INTERVAL = 8 * 60 * 1000; // 8 minutes (more frequent)

  useEffect(() => {
    currentLocationRef.current = currentLocation;
  }, [currentLocation]);

  const generateSignedUrl = useCallback(async (videoUrl: string, videoId: string): Promise<string | null> => {
    try {
      const cached = preloadedUrlsRef.current.get(videoId);
      if (cached) {
        const age = Date.now() - cached.timestamp;
        if (age < SIGNED_URL_CACHE_DURATION) {
          return cached.url;
        } else {
          preloadedUrlsRef.current.delete(videoId);
        }
      }

      const urlParts = videoUrl.split('/videos/');
      if (urlParts.length !== 2) {
        console.error('[useVideos] Invalid video URL format:', videoUrl);
        return null;
      }

      const filePath = urlParts[1].split('?')[0];

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
      
      preloadedUrlsRef.current.set(videoId, {
        url: data.signedUrl,
        timestamp: Date.now()
      });

      return data.signedUrl;
    } catch (error) {
      console.error('[useVideos] Exception generating signed URL:', error);
      return null;
    }
  }, [SIGNED_URL_CACHE_DURATION]);

  // ✅ CRITICAL FIX: More aggressive keep-alive
  const keepConnectionsAlive = useCallback(async () => {
    const now = Date.now();
    const timeSinceLastActivity = now - lastActivityRef.current;
    
    console.log('[useVideos] ⏰ Keep-alive check');
    
    // Refresh if idle for more than 1 minute (more aggressive)
    if (timeSinceLastActivity > 60000) {
      console.log('[useVideos] ⚡ Refreshing connections for instant playback');
      
      const firstVideo = Array.from(preloadedUrlsRef.current.entries())[0];
      
      if (firstVideo) {
        const [videoId, { url }] = firstVideo;
        try {
          await fetch(url, {
            method: 'HEAD',
            cache: 'no-cache',
          });
          console.log('[useVideos] ✅ Connection kept alive');
        } catch (error) {
          console.warn('[useVideos] ⚠️ Keep-alive failed:', error);
        }
      }
      
      lastActivityRef.current = now;
    }
  }, []);

  // ✅ CRITICAL FIX: More aggressive preloading for instant playback
  const preloadVideo = useCallback(async (signedUrl: string, videoId: string): Promise<void> => {
    if (preloadingQueueRef.current.has(videoId)) {
      return;
    }

    try {
      preloadingQueueRef.current.add(videoId);
      
      lastActivityRef.current = Date.now();
      
      console.log('[useVideos] ⚡ Preloading video for instant playback:', videoId);
      
      // Strategy 1: Fetch first 20MB to warm up CDN
      const response = await fetch(signedUrl, {
        method: 'GET',
        headers: {
          'Range': `bytes=0-${PRELOAD_SIZE - 1}`,
          'Cache-Control': 'no-cache',
        },
      });

      if (response.ok || response.status === 206) {
        console.log('[useVideos] ✅ Video preloaded:', videoId);
        
        // Strategy 2: Cache locally for instant access
        try {
          const cacheDir = `${FileSystem.cacheDirectory}video_cache/`;
          const cacheFile = `${cacheDir}${videoId}_preload.mp4`;
          
          const dirInfo = await FileSystem.getInfoAsync(cacheDir);
          if (!dirInfo.exists) {
            await FileSystem.makeDirectoryAsync(cacheDir, { intermediates: true });
          }
          
          await FileSystem.downloadAsync(signedUrl, cacheFile, {
            headers: {
              'Range': `bytes=0-${PRELOAD_SIZE - 1}`,
              'Cache-Control': 'no-cache',
            },
          });
          
          console.log('[useVideos] ✅ Video cached locally for instant access');
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

  const fetchVideosRef = useRef<() => Promise<void>>();
  
  fetchVideosRef.current = async () => {
    if (!isMountedRef.current || isFetchingRef.current) {
      console.log('[useVideos] Fetch already in progress, skipping...');
      return;
    }

    try {
      isFetchingRef.current = true;
      setIsLoading(true);
      setError(null);
      const location = currentLocationRef.current;
      console.log('[useVideos] ⚡ Fetching videos for location:', location);

      const { data, error: fetchError } = await supabase
        .from('videos')
        .select('*')
        .eq('location', location)
        .order('created_at', { ascending: false });

      if (fetchError) {
        console.error('[useVideos] Error fetching videos:', fetchError);
        throw fetchError;
      }

      if (!data || data.length === 0) {
        console.log('[useVideos] No videos found for location:', location);
        if (isMountedRef.current) {
          setVideos([]);
          setIsLoading(false);
        }
        return;
      }

      console.log('[useVideos] ✅ Fetched', data.length, 'videos');

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

      // ✅ CRITICAL FIX: Preload ALL videos aggressively in parallel
      const preloadPromises = videosWithSignedUrls
        .filter(video => video.signed_url)
        .map(video => 
          preloadVideo(video.signed_url!, video.id)
            .catch(err => console.warn('[useVideos] Preload failed:', video.id, err))
        );

      Promise.all(preloadPromises)
        .then(() => console.log('[useVideos] ✅ All videos preloaded for instant playback'))
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
  };

  const fetchVideos = useCallback(() => {
    fetchVideosRef.current?.();
  }, []);

  // ✅ CRITICAL FIX: More frequent background refresh
  const backgroundRefresh = useCallback(async () => {
    if (isFetchingRef.current) {
      return;
    }

    console.log('[useVideos] ⏰ Background refresh - keeping videos preloaded');
    
    try {
      const location = currentLocationRef.current;
      
      const { data, error: fetchError } = await supabase
        .from('videos')
        .select('*')
        .eq('location', location)
        .order('created_at', { ascending: false });

      if (fetchError || !data) {
        return;
      }

      const refreshPromises = data.map(async (video) => {
        const signedUrl = await generateSignedUrl(video.video_url, video.id);
        if (signedUrl) {
          preloadVideo(signedUrl, video.id).catch(() => {
            console.log('[useVideos] Preload failed:', video.id);
          });
        }
      });

      await Promise.all(refreshPromises);
      console.log('[useVideos] ✅ Background refresh complete');
    } catch (error) {
      console.error('[useVideos] Background refresh error:', error);
    }
  }, [generateSignedUrl, preloadVideo]);

  useEffect(() => {
    console.log('[useVideos] Location changed to:', currentLocation);
    fetchVideos();
  }, [currentLocation, fetchVideos]);

  useEffect(() => {
    console.log('[useVideos] Initializing video preloading system...');
    isMountedRef.current = true;
    lastActivityRef.current = Date.now();
    
    fetchVideos();

    // ✅ CRITICAL FIX: More frequent keep-alive (every 45 seconds)
    keepAliveIntervalRef.current = setInterval(() => {
      keepConnectionsAlive();
    }, KEEP_ALIVE_INTERVAL);

    // ✅ CRITICAL FIX: More frequent background refresh (every 8 minutes)
    const refreshInterval = setInterval(() => {
      backgroundRefresh();
    }, REFRESH_INTERVAL);

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
          
          if (payload.old && 'id' in payload.old) {
            preloadedUrlsRef.current.delete(payload.old.id as string);
          }
          if (payload.new && 'id' in payload.new) {
            preloadedUrlsRef.current.delete(payload.new.id as string);
          }
          
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
