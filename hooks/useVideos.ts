
import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/app/integrations/supabase/client';

export interface Video {
  id: string;
  title: string;
  description: string | null;
  video_url: string;
  thumbnail_url: string | null;
  duration: string | null;
  uploaded_by: string | null;
  created_at: string;
  updated_at: string;
  // Add signed URL for preloading
  signed_url?: string;
  signed_url_expires_at?: number;
}

// Cache duration: 2 hours (same as Supabase signed URL expiration)
const SIGNED_URL_CACHE_DURATION_MS = 7200000; // 2 hours in milliseconds
const SIGNED_URL_EXPIRATION_SECONDS = 7200; // 2 hours in seconds

// Global cache for video data to persist across component unmounts
let globalVideoCache: Video[] = [];
let globalCacheTimestamp = 0;
let isGloballyLoading = false;

export function useVideos() {
  const [videos, setVideos] = useState<Video[]>(globalVideoCache);
  const [isLoading, setIsLoading] = useState(globalVideoCache.length === 0);
  const [error, setError] = useState<string | null>(null);
  const isLoadingRef = useRef(false);

  const extractFileName = useCallback((videoUrl: string): string | null => {
    try {
      const urlParts = videoUrl.split('/videos/');
      if (urlParts.length === 2) {
        return urlParts[1].split('?')[0];
      } else {
        const url = new URL(videoUrl);
        const pathParts = url.pathname.split('/');
        return pathParts[pathParts.length - 1];
      }
    } catch (e) {
      console.error('[useVideos] Error parsing URL:', e);
      return null;
    }
  }, []);

  const generateSignedUrl = useCallback(async (videoUrl: string): Promise<string | null> => {
    try {
      const fileName = extractFileName(videoUrl);
      if (!fileName) {
        console.error('[useVideos] Could not extract filename from:', videoUrl);
        return null;
      }

      const { data: signedUrlData, error: signedUrlError } = await supabase.storage
        .from('videos')
        .createSignedUrl(fileName, SIGNED_URL_EXPIRATION_SECONDS);

      if (signedUrlError || !signedUrlData?.signedUrl) {
        console.error('[useVideos] Signed URL error:', signedUrlError);
        return null;
      }

      return signedUrlData.signedUrl;
    } catch (err) {
      console.error('[useVideos] Exception generating signed URL:', err);
      return null;
    }
  }, [extractFileName]);

  // Preload video data by making range requests to warm up CDN and cache initial chunks
  const preloadVideoData = useCallback(async (signedUrl: string, videoTitle: string) => {
    try {
      console.log(`[useVideos] 🔥 Preloading video data for: ${videoTitle}`);
      
      // Strategy 1: HEAD request to warm up CDN
      const headResponse = await fetch(signedUrl, {
        method: 'HEAD',
        cache: 'force-cache',
      });
      
      if (!headResponse.ok) {
        console.log(`[useVideos] ⚠️ HEAD request failed for: ${videoTitle}`);
        return;
      }
      
      console.log(`[useVideos] ✓ CDN warmed for: ${videoTitle}`);
      
      // Strategy 2: Fetch first 2MB of video to cache initial playback data
      // This ensures instant playback when user taps the video
      const rangeResponse = await fetch(signedUrl, {
        method: 'GET',
        headers: {
          'Range': 'bytes=0-2097151', // First 2MB
        },
        cache: 'force-cache',
      });
      
      if (rangeResponse.ok || rangeResponse.status === 206) {
        // Read the data to ensure it's cached
        await rangeResponse.blob();
        console.log(`[useVideos] ✅ First 2MB cached for instant playback: ${videoTitle}`);
      } else {
        console.log(`[useVideos] ⚠️ Range request not supported for: ${videoTitle}`);
      }
    } catch (err) {
      console.log(`[useVideos] ⚠️ Preload failed for ${videoTitle}:`, err);
      // Don't throw - preloading is optional optimization
    }
  }, []);

  const loadVideos = useCallback(async () => {
    // Check if we have valid cached data
    const cacheAge = Date.now() - globalCacheTimestamp;
    if (globalVideoCache.length > 0 && cacheAge < SIGNED_URL_CACHE_DURATION_MS) {
      console.log('[useVideos] Using cached videos (age:', Math.floor(cacheAge / 1000), 'seconds)');
      setVideos(globalVideoCache);
      setIsLoading(false);
      return;
    }

    // Prevent duplicate loading
    if (isLoadingRef.current || isGloballyLoading) {
      console.log('[useVideos] Already loading, skipping...');
      return;
    }

    try {
      isLoadingRef.current = true;
      isGloballyLoading = true;
      setIsLoading(true);
      setError(null);

      console.log('[useVideos] 🚀 ULTRA-AGGRESSIVE PRELOAD: Loading ALL videos with CDN warming...');
      const startTime = Date.now();

      const { data, error: fetchError } = await supabase
        .from('videos')
        .select('*')
        .order('created_at', { ascending: false });

      if (fetchError) {
        console.error('[useVideos] Error loading videos:', fetchError);
        throw fetchError;
      }

      console.log(`[useVideos] Loaded ${data?.length || 0} videos from database`);
      
      if (data && data.length > 0) {
        console.log('[useVideos] 🔥 Step 1: Generating signed URLs for ALL videos...');
        
        // Step 1: Generate all signed URLs in parallel
        const videosWithSignedUrls = await Promise.all(
          data.map(async (video, index) => {
            console.log(`[useVideos] Generating URL ${index + 1}/${data.length}: ${video.title}`);
            const signedUrl = await generateSignedUrl(video.video_url);
            return {
              ...video,
              signed_url: signedUrl || undefined,
              signed_url_expires_at: signedUrl ? Date.now() + SIGNED_URL_CACHE_DURATION_MS : undefined
            };
          })
        );

        const urlGenTime = Date.now();
        console.log(`[useVideos] ✓ All signed URLs generated in ${((urlGenTime - startTime) / 1000).toFixed(2)}s`);

        // Update state immediately so UI can show videos
        globalVideoCache = videosWithSignedUrls;
        globalCacheTimestamp = Date.now();
        setVideos(videosWithSignedUrls);
        setIsLoading(false);

        // Step 2: Preload video data in background (non-blocking)
        console.log('[useVideos] 🔥 Step 2: Warming CDN cache for instant playback...');
        
        // Preload the first 3 videos immediately (most likely to be watched)
        const priorityVideos = videosWithSignedUrls.slice(0, 3);
        const backgroundVideos = videosWithSignedUrls.slice(3);
        
        // Priority preload (parallel)
        await Promise.all(
          priorityVideos.map(video => 
            video.signed_url ? preloadVideoData(video.signed_url, video.title) : Promise.resolve()
          )
        );
        
        const priorityTime = Date.now();
        console.log(`[useVideos] ✓ Priority videos (top 3) preloaded in ${((priorityTime - urlGenTime) / 1000).toFixed(2)}s`);
        
        // Background preload (sequential to avoid overwhelming network)
        if (backgroundVideos.length > 0) {
          console.log(`[useVideos] 🔄 Background preloading remaining ${backgroundVideos.length} videos...`);
          
          // Preload in background without blocking
          Promise.all(
            backgroundVideos.map(video => 
              video.signed_url ? preloadVideoData(video.signed_url, video.title) : Promise.resolve()
            )
          ).then(() => {
            const totalTime = Date.now();
            console.log(`[useVideos] ✅ ALL ${data.length} videos fully preloaded in ${((totalTime - startTime) / 1000).toFixed(2)}s - INSTANT PLAYBACK READY!`);
          }).catch(err => {
            console.log('[useVideos] Background preload completed with some errors (non-critical):', err);
          });
        } else {
          const totalTime = Date.now();
          console.log(`[useVideos] ✅ ALL ${data.length} videos fully preloaded in ${((totalTime - startTime) / 1000).toFixed(2)}s - INSTANT PLAYBACK READY!`);
        }
      } else {
        setVideos(data || []);
        globalVideoCache = data || [];
        globalCacheTimestamp = Date.now();
      }
    } catch (err: any) {
      console.error('[useVideos] Exception loading videos:', err);
      setError(err.message || 'Failed to load videos');
    } finally {
      setIsLoading(false);
      isLoadingRef.current = false;
      isGloballyLoading = false;
    }
  }, [generateSignedUrl, preloadVideoData]);

  useEffect(() => {
    loadVideos();

    // Subscribe to real-time updates
    const subscription = supabase
      .channel('videos_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'videos'
        },
        (payload) => {
          console.log('[useVideos] Real-time update:', payload);
          // Invalidate cache on changes
          globalVideoCache = [];
          globalCacheTimestamp = 0;
          loadVideos();
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [loadVideos]);

  return {
    videos,
    isLoading,
    error,
    refreshVideos: loadVideos,
    generateSignedUrl // Export for manual URL generation
  };
}
