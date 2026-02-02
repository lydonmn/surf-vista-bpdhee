
import { useState, useEffect, useRef } from 'react';
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

export function useVideos() {
  const [videos, setVideos] = useState<Video[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const isLoadingRef = useRef(false);

  const extractFileName = (videoUrl: string): string | null => {
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
  };

  const generateSignedUrl = async (videoUrl: string): Promise<string | null> => {
    try {
      const fileName = extractFileName(videoUrl);
      if (!fileName) {
        console.error('[useVideos] Could not extract filename from:', videoUrl);
        return null;
      }

      console.log('[useVideos] Generating signed URL for:', fileName);
      const { data: signedUrlData, error: signedUrlError } = await supabase.storage
        .from('videos')
        .createSignedUrl(fileName, SIGNED_URL_EXPIRATION_SECONDS);

      if (signedUrlError || !signedUrlData?.signedUrl) {
        console.error('[useVideos] Signed URL error:', signedUrlError);
        return null;
      }

      console.log('[useVideos] ✓ Signed URL created for:', fileName);
      return signedUrlData.signedUrl;
    } catch (err) {
      console.error('[useVideos] Exception generating signed URL:', err);
      return null;
    }
  };

  const loadVideos = async () => {
    // Prevent duplicate loading
    if (isLoadingRef.current) {
      console.log('[useVideos] Already loading, skipping...');
      return;
    }

    try {
      isLoadingRef.current = true;
      setIsLoading(true);
      setError(null);

      console.log('[useVideos] 🚀 AGGRESSIVE PRELOAD: Loading ALL videos from database...');

      const { data, error: fetchError } = await supabase
        .from('videos')
        .select('*')
        .order('created_at', { ascending: false });

      if (fetchError) {
        console.error('[useVideos] Error loading videos:', fetchError);
        throw fetchError;
      }

      console.log(`[useVideos] Loaded ${data?.length || 0} videos`);
      
      // 🚀 AGGRESSIVE PRELOADING: Generate signed URLs for ALL videos immediately
      if (data && data.length > 0) {
        console.log('[useVideos] 🔥 Preloading signed URLs for ALL videos (instant playback)...');
        
        const startTime = Date.now();
        
        // Generate signed URLs in parallel for maximum speed
        const videosWithSignedUrls = await Promise.all(
          data.map(async (video, index) => {
            console.log(`[useVideos] Preloading video ${index + 1}/${data.length}:`, video.title);

            // Generate signed URL for instant playback
            const signedUrl = await generateSignedUrl(video.video_url);
            return {
              ...video,
              signed_url: signedUrl || undefined,
              signed_url_expires_at: signedUrl ? Date.now() + SIGNED_URL_CACHE_DURATION_MS : undefined
            };
          })
        );

        const endTime = Date.now();
        const duration = ((endTime - startTime) / 1000).toFixed(2);
        
        console.log(`[useVideos] ✅ ALL ${data.length} videos preloaded in ${duration}s - INSTANT PLAYBACK READY!`);
        setVideos(videosWithSignedUrls);
      } else {
        setVideos(data || []);
      }
    } catch (err: any) {
      console.error('[useVideos] Exception loading videos:', err);
      setError(err.message || 'Failed to load videos');
    } finally {
      setIsLoading(false);
      isLoadingRef.current = false;
    }
  };

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
          loadVideos();
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  return {
    videos,
    isLoading,
    error,
    refreshVideos: loadVideos,
    generateSignedUrl // Export for manual URL generation
  };
}
