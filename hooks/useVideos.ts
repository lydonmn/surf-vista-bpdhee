
import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/app/integrations/supabase/client';
import { Database } from '@/app/integrations/supabase/types';
import { useLocation } from '@/contexts/LocationContext';
import * as FileSystem from 'expo-file-system/legacy';

type Video = Database['public']['Tables']['videos']['Row'] & {
  signed_url?: string;
  status?: string;
  mux_upload_id?: string;
};

// 🎬 Mux HLS URL prefix for detection
const MUX_HLS_PREFIX = 'https://stream.mux.com/';

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
  const processingPollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const SIGNED_URL_CACHE_DURATION = 3600000; // 1 hour
  const PRELOAD_SIZE = 20 * 1024 * 1024; // 20MB preload for instant start
  const KEEP_ALIVE_INTERVAL = 45000; // 45 seconds (more frequent)
  const REFRESH_INTERVAL = 8 * 60 * 1000; // 8 minutes (more frequent)
  const PROCESSING_POLL_INTERVAL = 10000; // 10 seconds for processing videos

  useEffect(() => {
    currentLocationRef.current = currentLocation;
  }, [currentLocation]);

  const generateSignedUrl = useCallback(async (videoUrl: string, videoIdParam: string): Promise<string | null> => {
    try {
      // 🎬 CRITICAL: Check if this is a Mux HLS URL - if so, return it as-is (no signing needed)
      if (videoUrl.startsWith(MUX_HLS_PREFIX)) {
        console.log('[useVideos] 🎬 Mux HLS URL detected, returning as-is (publicly accessible):', videoUrl);
        return videoUrl;
      }

      const cached = preloadedUrlsRef.current.get(videoIdParam);
      if (cached) {
        const age = Date.now() - cached.timestamp;
        if (age < SIGNED_URL_CACHE_DURATION) {
          return cached.url;
        } else {
          preloadedUrlsRef.current.delete(videoIdParam);
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
    const now = Date.now();
    const timeSinceLastActivity = now - lastActivityRef.current;
    
    console.log('[useVideos] ⏰ Keep-alive check');
    
    if (timeSinceLastActivity > 60000) {
      console.log('[useVideos] ⚡ Refreshing connections for instant playback');
      
      const firstVideo = Array.from(preloadedUrlsRef.current.entries())[0];
      
      if (firstVideo) {
        const [, { url }] = firstVideo;
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

  const preloadVideo = useCallback(async (signedUrl: string, videoIdParam: string): Promise<void> => {
    if (preloadingQueueRef.current.has(videoIdParam)) {
      return;
    }

    try {
      preloadingQueueRef.current.add(videoIdParam);
      
      lastActivityRef.current = Date.now();
      
      console.log('[useVideos] ⚡ Preloading video for instant playback:', videoIdParam);
      
      const response = await fetch(signedUrl, {
        method: 'GET',
        headers: {
          'Range': `bytes=0-${PRELOAD_SIZE - 1}`,
          'Cache-Control': 'no-cache',
        },
      });

      if (response.ok || response.status === 206) {
        console.log('[useVideos] ✅ Video preloaded:', videoIdParam);
        
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

  // 🚨 NEW: Background polling for processing videos
  const pollProcessingVideos = useCallback(async (processingVideos: Video[]) => {
    if (processingVideos.length === 0) {
      return;
    }

    console.log('[useVideos] 🔄 Polling Mux asset status for', processingVideos.length, 'processing videos...');

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      console.warn('[useVideos] No session available for polling');
      return;
    }

    for (const video of processingVideos) {
      if (!video.mux_upload_id) {
        console.warn('[useVideos] Video missing mux_upload_id:', video.id);
        continue;
      }

      try {
        console.log('[useVideos] 🔍 Checking Mux asset status for video:', video.id);
        
        const assetStatusResponse = await fetch(
          `${supabase.supabaseUrl}/functions/v1/mux-asset-status?uploadId=${video.mux_upload_id}`,
          {
            headers: {
              'Authorization': `Bearer ${session.access_token}`,
            },
          }
        );

        if (!assetStatusResponse.ok) {
          console.error('[useVideos] ❌ Failed to get Mux asset status for video:', video.id);
          continue;
        }

        const assetData = await assetStatusResponse.json();
        console.log('[useVideos] 📊 Mux asset status for video', video.id, ':', assetData);

        if (assetData.status === 'ready' && assetData.playback_id) {
          // 🚨 CRITICAL: Update video record with final HLS URL and set status to active
          const hlsUrl = `https://stream.mux.com/${assetData.playback_id}.m3u8`;
          console.log('[useVideos] ✅ Mux asset ready! Updating video:', video.id);
          console.log('[useVideos] 🎥 HLS URL:', hlsUrl);
          console.log('[useVideos] 🎬 Asset ID:', assetData.asset_id);

          const { error: updateError } = await supabase
            .from('videos')
            .update({
              video_url: hlsUrl,
              status: 'active',
              mux_asset_id: assetData.asset_id,
            })
            .eq('id', video.id);

          if (updateError) {
            console.error('[useVideos] ❌ Error updating video record:', updateError);
          } else {
            console.log('[useVideos] ✅ Video updated to active status');
            // Trigger a refresh to update the UI
            fetchVideos();
          }
        } else if (assetData.status === 'errored') {
          console.error('[useVideos] ❌ Mux asset processing failed for video:', video.id);
          
          // Update status to errored
          const { error: updateError } = await supabase
            .from('videos')
            .update({
              status: 'errored',
            })
            .eq('id', video.id);

          if (updateError) {
            console.error('[useVideos] ❌ Error updating video to errored status:', updateError);
          }
        } else {
          console.log('[useVideos] ⏳ Mux asset still processing for video:', video.id, '- status:', assetData.status);
        }
      } catch (error) {
        console.error('[useVideos] Error polling Mux asset status for video:', video.id, error);
      }
    }
  }, []);

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

      const videosWithSignedUrls = await Promise.all(
        data.map(async (video) => {
          // Skip signing for processing videos (they don't have a video_url yet)
          if (video.status === 'processing') {
            return video;
          }

          const signedUrl = await generateSignedUrl(video.video_url, video.id);
          
          if (signedUrl) {
            return { ...video, signed_url: signedUrl };
          }

          return video;
        })
      );

      const preloadPromises = videosWithSignedUrls
        .filter(video => video.signed_url && video.status !== 'processing')
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
        if (video.status === 'processing') {
          return;
        }
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

  // 🚨 NEW: Set up background polling for processing videos
  useEffect(() => {
    const processingVideos = videos.filter(v => v.status === 'processing');
    
    if (processingVideos.length > 0) {
      console.log('[useVideos] 🔄 Found', processingVideos.length, 'processing videos - starting background polling...');
      
      // Clear any existing interval
      if (processingPollIntervalRef.current) {
        clearInterval(processingPollIntervalRef.current);
      }

      // Start polling every 10 seconds
      processingPollIntervalRef.current = setInterval(() => {
        console.log('[useVideos] ⏰ Polling processing videos...');
        pollProcessingVideos(processingVideos);
      }, PROCESSING_POLL_INTERVAL);

      // Also poll immediately
      pollProcessingVideos(processingVideos);

      return () => {
        if (processingPollIntervalRef.current) {
          console.log('[useVideos] 🛑 Stopping processing video polling');
          clearInterval(processingPollIntervalRef.current);
          processingPollIntervalRef.current = null;
        }
      };
    } else {
      // No processing videos, clear interval if it exists
      if (processingPollIntervalRef.current) {
        console.log('[useVideos] ✅ No processing videos - stopping polling');
        clearInterval(processingPollIntervalRef.current);
        processingPollIntervalRef.current = null;
      }
    }
  }, [videos, pollProcessingVideos, PROCESSING_POLL_INTERVAL]);

  useEffect(() => {
    console.log('[useVideos] Initializing video preloading system...');
    isMountedRef.current = true;
    lastActivityRef.current = Date.now();
    
    fetchVideos();

    keepAliveIntervalRef.current = setInterval(() => {
      keepConnectionsAlive();
    }, KEEP_ALIVE_INTERVAL);

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
      
      if (processingPollIntervalRef.current) {
        clearInterval(processingPollIntervalRef.current);
        processingPollIntervalRef.current = null;
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
