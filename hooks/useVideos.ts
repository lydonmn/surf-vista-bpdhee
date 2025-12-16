
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
}

export function useVideos() {
  const [videos, setVideos] = useState<Video[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
      setVideos(data || []);
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
    refreshVideos: loadVideos
  };
}
