
import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/app/integrations/supabase/client';
import { Database } from '@/app/integrations/supabase/types';
import { useLocation } from '@/contexts/LocationContext';

type Video = Database['public']['Tables']['videos']['Row'];

export function useVideos() {
  const { currentLocation } = useLocation();
  const [videos, setVideos] = useState<Video[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const isMountedRef = useRef(true);
  const isFetchingRef = useRef(false);
  const currentLocationRef = useRef(currentLocation);

  useEffect(() => {
    currentLocationRef.current = currentLocation;
  }, [currentLocation]);

  const fetchVideosRef = useRef<() => Promise<void>>();
  
  fetchVideosRef.current = async () => {
    if (!isMountedRef.current || isFetchingRef.current) {
      return;
    }

    try {
      isFetchingRef.current = true;
      setIsLoading(true);
      setError(null);
      const location = currentLocationRef.current;
      console.log('[useVideos] ⚡ Fetching videos for:', location);

      const { data, error: fetchError } = await supabase
        .from('videos')
        .select('*')
        .eq('location', location)
        .order('created_at', { ascending: false });

      if (fetchError) {
        console.error('[useVideos] Fetch error:', fetchError);
        throw fetchError;
      }

      if (!data || data.length === 0) {
        console.log('[useVideos] No videos found');
        if (isMountedRef.current) {
          setVideos([]);
          setIsLoading(false);
        }
        return;
      }

      console.log('[useVideos] ✅ Fetched', data.length, 'videos');

      if (isMountedRef.current) {
        setVideos(data);
        setIsLoading(false);
      }
    } catch (err) {
      console.error('[useVideos] Error:', err);
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

  useEffect(() => {
    console.log('[useVideos] Location changed to:', currentLocation);
    fetchVideos();
  }, [currentLocation, fetchVideos]);

  useEffect(() => {
    console.log('[useVideos] ⚡ Initializing video system');
    isMountedRef.current = true;
    
    fetchVideos();

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
          console.log('[useVideos] ⚡ Video updated:', payload);
          
          if (!isFetchingRef.current) {
            fetchVideos();
          }
        }
      )
      .subscribe();

    return () => {
      console.log('[useVideos] Cleanup');
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
