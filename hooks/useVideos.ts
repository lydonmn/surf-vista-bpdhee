
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
  const isFetchingRef = useRef(false);
  const currentLocationRef = useRef(currentLocation);

  const SIGNED_URL_CACHE_DURATION = 3600000; // 1 hour
  const PRELOAD_SIZE = 75 * 1024 * 1024; // ✅ CRITICAL FIX: 75MB preload for INSTANT smooth start (increased from 50MB)
  const KEEP_ALIVE_INTERVAL = 240000; // ✅ OPTIMIZED: 4 minutes (less aggressive)
  const REFRESH_INTERVAL = 25 * 60 * 1000; // ✅ OPTIMIZED: 25 minutes (less frequent)

  useEffect(() => {
    currentLocationRef.current = currentLocation;
  }, [currentLocation]);

  const generateSignedUrl = useCallback(async (videoUrl: string, videoIdParam: string): Promise<string | null> => {
    try {
      const cached = preloadedUrlsRef.current.get(videoIdParam);
      if (cached) {
        const age = Date.now() - cached.timestamp;
        if (age < SIGNED_URL_CACHE_DURATION) {
          console.log('[useVideos] ✅ Using cached signed URL for:', videoIdParam);
          return cached.url;
        } else {
          console.log('[useVideos] ⚠️ Cached URL expired, regenerating for:', videoIdParam);
          preloadedUrlsRef.current.delete(videoIdParam);
        }
      }

      const urlParts = videoUrl.split('/videos/');
      if (urlParts.length !== 2) {
        console.error('[useVideos] Invalid video URL format:', videoUrl);
        return null;
      }

      const filePath = urlParts[1].split('?')[0];

      console.log('[useVideos] ⚡ Generating signed URL for:', videoIdParam);
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
      
      console.log('[useVideos] ✅ Signed URL generated and cached');
      preloadedUrlsRef.current.set(videoIdParam, {
        url: data.signedUrl,
        timestamp: Date.now()
      });

      return data.signedUrl;
    } catch (error) {
      console.error('[useVideos] Exception generating signed URL:', error);
      return null;
    }
  }, [SIGNED_URL_CACHE_DURATION]);

  const keepConnectionsAlive = useCallback(async () => {
    console.log('[useVideos] ⏰ Keep-alive check - maintaining video connections');
    
    const firstVideo = Array.from(preloadedUrlsRef.current.entries())[0];
    
    if (firstVideo) {
      const [videoId, { url }] = firstVideo;
      try {
        console.log('[useVideos] ⚡ Pinging video connection for instant playback readiness');
        await fetch(url, {
          method: 'HEAD',
          cache: 'no-cache',
        });
        console.log('[useVideos] ✅ Connection kept alive for:', videoId);
      } catch (error) {
        console.warn('[useVideos] ⚠️ Keep-alive ping failed (non-critical):', error);
      }
    }
  }, []);

  const preloadVideo = useCallback(async (signedUrl: string, videoIdParam: string): Promise<void> => {
    if (preloadingQueueRef.current.has(videoIdParam)) {
      console.log('[useVideos] Video already preloading:', videoIdParam);
      return;
    }

    try {
      preloadingQueueRef.current.add(videoIdParam);
      
      console.log('[useVideos] ⚡ Preloading first', PRELOAD_SIZE / (1024 * 1024), 'MB for INSTANT smooth playback:', videoIdParam);
      
      // ✅ CRITICAL FIX: Preload larger initial chunk (75MB) for instant smooth start
      const response = await fetch(signedUrl, {
        method: 'GET',
        headers: {
          'Range': `bytes=0-${PRELOAD_SIZE - 1}`,
          'Cache-Control': 'no-cache',
        },
      });

      if (response.ok || response.status === 206) {
        console.log('[useVideos] ✅ Video preloaded for INSTANT smooth playback:', videoIdParam);
        
        // ✅ OPTIONAL: Cache to local storage for even faster access
        try {
          const cacheDir = `${FileSystem.cacheDirectory}video_cache/`;
          const cacheFile = `${cacheDir}${videoIdParam}_preload.mp4`;
          
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
      console.error('[useVideos] Error preloading video:', videoIdParam, error);
    } finally {
      preloadingQueueRef.current.delete(videoIdParam);
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

      // ✅ CRITICAL FIX: Generate signed URLs and preload in parallel for speed
      const videosWithSignedUrls = await Promise.all(
        data.map(async (video) => {
          const signedUrl = await generateSignedUrl(video.video_url, video.id);
          
          if (signedUrl) {
            // ✅ Start preloading immediately (non-blocking)
            preloadVideo(signedUrl, video.id).catch(err => 
              console.warn('[useVideos] Preload failed (non-critical):', video.id, err)
            );
            
            return { ...video, signed_url: signedUrl };
          }

          return video;
        })
      );

      console.log('[useVideos] ✅ All videos prepared for INSTANT smooth playback');

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

  const backgroundRefresh = useCallback(async () => {
    if (isFetchingRef.current) {
      return;
    }

    console.log('[useVideos] ⏰ Background refresh - refreshing signed URLs and preloading');
    
    try {
      const location = currentLocationRef.current;
      
      const { data, error: fetchError } = await supabase
        .from('videos')
        .select('*')
        .eq('location', location)
        .order('created_at', { ascending: false });

      if (fetchError || !data) {
        console.warn('[useVideos] Background refresh failed:', fetchError);
        return;
      }

      // ✅ CRITICAL FIX: Refresh signed URLs and preload in background
      const refreshPromises = data.map(async (video) => {
        const signedUrl = await generateSignedUrl(video.video_url, video.id);
        if (signedUrl) {
          preloadVideo(signedUrl, video.id).catch(() => {
            console.log('[useVideos] Background preload failed (non-critical):', video.id);
          });
        }
      });

      await Promise.all(refreshPromises);
      console.log('[useVideos] ✅ Background refresh complete - videos ready for INSTANT smooth playback');
    } catch (error) {
      console.error('[useVideos] Background refresh error:', error);
    }
  }, [generateSignedUrl, preloadVideo]);

  useEffect(() => {
    console.log('[useVideos] Location changed to:', currentLocation);
    fetchVideos();
  }, [currentLocation, fetchVideos]);

  useEffect(() => {
    console.log('[useVideos] ⚡ Initializing video preloading system for INSTANT SMOOTH PLAYBACK...');
    isMountedRef.current = true;
    
    fetchVideos();

    // ✅ CRITICAL FIX: Less aggressive keep-alive (every 4 minutes instead of 3)
    keepAliveIntervalRef.current = setInterval(() => {
      keepConnectionsAlive();
    }, KEEP_ALIVE_INTERVAL);

    // ✅ CRITICAL FIX: Less frequent background refresh (every 25 minutes instead of 20)
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
