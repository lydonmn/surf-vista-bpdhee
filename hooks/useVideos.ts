
import { useState, useEffect } from 'react';
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

export function useVideos() {
  const [videos, setVideos] = useState<Video[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
        .createSignedUrl(fileName, 7200); // 2 hours

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
    try {
      setIsLoading(true);
      setError(null);

      console.log('[useVideos] Loading videos from database...');

      const { data, error: fetchError } = await supabase
        .from('videos')
        .select('*')
        .order('created_at', { ascending: false });

      if (fetchError) {
        console.error('[useVideos] Error loading videos:', fetchError);
        throw fetchError;
      }

      console.log('[useVideos] Loaded videos:', data?.length || 0);
      
      // Preload signed URLs for the first 3 videos (most likely to be watched)
      if (data && data.length > 0) {
        const videosWithSignedUrls = await Promise.all(
          data.slice(0, 3).map(async (video, index) => {
            console.log(`[useVideos] Video ${index + 1}:`, {
              id: video.id,
              title: video.title,
              hasThumbnail: !!video.thumbnail_url,
              thumbnailUrl: video.thumbnail_url,
              hasVideoUrl: !!video.video_url,
              videoUrl: video.video_url,
              createdAt: video.created_at
            });

            // Generate signed URL for preloading
            const signedUrl = await generateSignedUrl(video.video_url);
            return {
              ...video,
              signed_url: signedUrl || undefined,
              signed_url_expires_at: signedUrl ? Date.now() + 7200000 : undefined // 2 hours from now
            };
          })
        );

        // Merge preloaded videos with the rest
        const allVideos = [
          ...videosWithSignedUrls,
          ...data.slice(3)
        ];

        console.log('[useVideos] Preloaded signed URLs for first 3 videos');
        setVideos(allVideos);
      } else {
        setVideos(data || []);
      }
    } catch (err: any) {
      console.error('[useVideos] Exception loading videos:', err);
      setError(err.message || 'Failed to load videos');
    } finally {
      setIsLoading(false);
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
