
import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/app/integrations/supabase/client';
import { Database } from '@/app/integrations/supabase/types';
import { useLocation } from '@/contexts/LocationContext';

type Video = Database['public']['Tables']['videos']['Row'] & {
  signed_url?: string;
};

export function useVideos() {
  const { currentLocation } = useLocation();
  const [videos, setVideos] = useState<Video[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const isMountedRef = useRef(true);
  const preloadedUrlsRef = useRef<Map<string, string>>(new Map());

  // Generate signed URL for a video
  const generateSignedUrl = useCallback(async (videoUrl: string): Promise<string | null> => {
    try {
      // Extract the file path from the full URL
      const urlParts = videoUrl.split('/videos/');
      if (urlParts.length !== 2) {
        console.error('[useVideos] Invalid video URL format:', videoUrl);
        return null;
      }

      const filePath = urlParts[1];
      console.log('[useVideos] Generating signed URL for:', filePath);

      // Generate signed URL with 1 hour expiry
      const { data, error } = await supabase.storage
        .from('videos')
        .createSignedUrl(filePath, 3600);

      if (error) {
        console.error('[useVideos] Error generating signed URL:', error);
        return null;
      }

      if (!data?.signedUrl) {
        console.error('[useVideos] No signed URL returned');
        return null;
      }

      console.log('[useVideos] Signed URL generated successfully');
      return data.signedUrl;
    } catch (error) {
      console.error('[useVideos] Exception generating signed URL:', error);
      return null;
    }
  }, []);

  // Preload video by fetching first 2MB to warm up CDN
  const preloadVideo = useCallback(async (signedUrl: string): Promise<void> => {
    try {
      console.log('[useVideos] Preloading video (CDN warming)...');
      
      // Fetch first 2MB to warm up CDN
      const response = await fetch(signedUrl, {
        method: 'GET',
        headers: {
          'Range': 'bytes=0-2097151', // First 2MB
        },
      });

      if (response.ok || response.status === 206) {
        console.log('[useVideos] Video preloaded successfully (CDN warmed)');
      } else {
        console.warn('[useVideos] Video preload returned status:', response.status);
      }
    } catch (error) {
      console.error('[useVideos] Error preloading video:', error);
      // Don't throw - preloading is optional optimization
    }
  }, []);

  // Fetch videos with aggressive preloading
  const fetchVideos = useCallback(async () => {
    if (!isMountedRef.current) return;

    try {
      setIsLoading(true);
      setError(null);
      console.log('[useVideos] Fetching videos for location:', currentLocation);

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

      console.log('[useVideos] Fetched', data.length, 'videos for location:', currentLocation);

      // AGGRESSIVE PRELOADING: Generate ALL signed URLs in parallel
      console.log('[useVideos] Starting aggressive preloading of all videos...');
      const videosWithSignedUrls = await Promise.all(
        data.map(async (video) => {
          // Check if we already have a cached signed URL
          const cachedUrl = preloadedUrlsRef.current.get(video.id);
          if (cachedUrl) {
            console.log('[useVideos] Using cached signed URL for video:', video.id);
            return { ...video, signed_url: cachedUrl };
          }

          // Generate new signed URL
          const signedUrl = await generateSignedUrl(video.video_url);
          
          if (signedUrl) {
            // Cache the signed URL
            preloadedUrlsRef.current.set(video.id, signedUrl);
            
            // Warm up CDN in background (don't await)
            preloadVideo(signedUrl).catch(err => 
              console.warn('[useVideos] CDN warming failed for video:', video.id, err)
            );
            
            return { ...video, signed_url: signedUrl };
          }

          return video;
        })
      );

      console.log('[useVideos] All videos preloaded with signed URLs');

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
    }
  }, [generateSignedUrl, preloadVideo, currentLocation]);

  // Refetch videos when location changes
  useEffect(() => {
    console.log('[useVideos] Location changed to:', currentLocation);
    // Clear cached URLs when location changes
    preloadedUrlsRef.current.clear();
    fetchVideos();
  }, [currentLocation, fetchVideos]);

  useEffect(() => {
    console.log('[useVideos] Initializing...');
    isMountedRef.current = true;
    
    fetchVideos();

    // Set up real-time subscription for videos with location filter
    const subscription = supabase
      .channel('videos_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'videos',
          filter: `location=eq.${currentLocation}`,
        },
        (payload) => {
          console.log('[useVideos] Video updated:', payload);
          // Clear cache for the affected video
          if (payload.old && 'id' in payload.old) {
            preloadedUrlsRef.current.delete(payload.old.id as string);
          }
          if (payload.new && 'id' in payload.new) {
            preloadedUrlsRef.current.delete(payload.new.id as string);
          }
          fetchVideos();
        }
      )
      .subscribe();

    return () => {
      console.log('[useVideos] Cleaning up...');
      isMountedRef.current = false;
      subscription.unsubscribe();
    };
  }, [fetchVideos, currentLocation]);

  return {
    videos,
    isLoading,
    error,
    refreshVideos: fetchVideos,
  };
}
