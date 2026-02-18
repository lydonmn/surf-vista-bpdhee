
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/app/integrations/supabase/client';
import { Video } from '@/types';

interface UseVideoQueueResult {
  videos: Video[];
  currentIndex: number;
  isLoading: boolean;
  error: string | null;
  nextVideo: () => void;
  previousVideo: () => void;
  goToVideo: (index: number) => void;
  refresh: () => Promise<void>;
}

/**
 * Hook to manage a queue of videos for a location
 */
export function useVideoQueue(locationId: string): UseVideoQueueResult {
  const [videos, setVideos] = useState<Video[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadVideos = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      console.log('[useVideoQueue] Loading videos for location:', locationId);

      const { data, error: fetchError } = await supabase
        .from('videos')
        .select('*')
        .eq('location', locationId)
        .order('created_at', { ascending: false });

      if (fetchError) {
        console.error('[useVideoQueue] Error loading videos:', fetchError);
        throw fetchError;
      }

      console.log('[useVideoQueue] Loaded', data?.length || 0, 'videos');
      setVideos(data || []);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load videos';
      console.error('[useVideoQueue] Error:', errorMessage);
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, [locationId]);

  useEffect(() => {
    loadVideos();
  }, [loadVideos]);

  const nextVideo = useCallback(() => {
    setCurrentIndex((prev) => {
      const next = prev + 1;
      if (next >= videos.length) {
        console.log('[useVideoQueue] Reached end of queue, staying at last video');
        return prev;
      }
      console.log('[useVideoQueue] Moving to next video:', next);
      return next;
    });
  }, [videos.length]);

  const previousVideo = useCallback(() => {
    setCurrentIndex((prev) => {
      const next = prev - 1;
      if (next < 0) {
        console.log('[useVideoQueue] At start of queue, staying at first video');
        return 0;
      }
      console.log('[useVideoQueue] Moving to previous video:', next);
      return next;
    });
  }, []);

  const goToVideo = useCallback((index: number) => {
    if (index >= 0 && index < videos.length) {
      console.log('[useVideoQueue] Jumping to video:', index);
      setCurrentIndex(index);
    }
  }, [videos.length]);

  const refresh = useCallback(async () => {
    await loadVideos();
  }, [loadVideos]);

  return {
    videos,
    currentIndex,
    isLoading,
    error,
    nextVideo,
    previousVideo,
    goToVideo,
    refresh,
  };
}
