
import { useState, useEffect, useCallback, useRef } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Platform } from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { VideoView, useVideoPlayer } from "expo-video";
import { colors } from "@/styles/commonStyles";
import { IconSymbol } from "@/components/IconSymbol";
import { supabase } from "@/app/integrations/supabase/client";
import * as ScreenOrientation from 'expo-screen-orientation';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface Video {
  id: string;
  title: string;
  description: string | null;
  video_url: string;
  thumbnail_url: string | null;
  duration_seconds: number | null;
  resolution_width: number | null;
  resolution_height: number | null;
  file_size_bytes: number | null;
  created_at: string;
}

export default function VideoPlayerScreen() {
  const insets = useSafeAreaInsets();
  const { videoId } = useLocalSearchParams();
  
  const [video, setVideo] = useState<Video | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const hasLoadedRef = useRef(false);

  // Create player with URL - simple and clean
  const player = useVideoPlayer(videoUrl || '', (player) => {
    if (videoUrl) {
      console.log('[VideoPlayer] Player ready - starting playback');
      player.loop = false;
      player.muted = false;
      player.play();
    }
  });

  const handleExitPlayer = useCallback(async () => {
    console.log('[VideoPlayer] Exiting player');
    
    if (player) {
      player.pause();
    }
    
    if (Platform.OS !== 'web') {
      try {
        await ScreenOrientation.unlockAsync();
      } catch (e) {
        console.log('[VideoPlayer] Orientation unlock error:', e);
      }
    }
    
    router.back();
  }, [player]);

  // Load video with signed URL
  useEffect(() => {
    if (hasLoadedRef.current) return;
    
    console.log('[VideoPlayer] Loading video:', videoId);
    
    const loadVideo = async () => {
      try {
        setIsLoading(true);
        setError(null);
        
        // Get session
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          throw new Error('Not authenticated');
        }

        // Get video metadata
        const { data: videoData, error: fetchError } = await supabase
          .from('videos')
          .select('*')
          .eq('id', videoId)
          .single();

        if (fetchError || !videoData) {
          throw new Error('Video not found');
        }

        console.log('[VideoPlayer] Video loaded:', videoData.title);
        console.log('[VideoPlayer] Resolution:', videoData.resolution_width, 'x', videoData.resolution_height);
        
        setVideo(videoData);

        // Extract filename from video_url
        let fileName = '';
        try {
          const urlParts = videoData.video_url.split('/videos/');
          if (urlParts.length === 2) {
            fileName = urlParts[1].split('?')[0];
          } else {
            const url = new URL(videoData.video_url);
            const pathParts = url.pathname.split('/');
            fileName = pathParts[pathParts.length - 1];
          }
        } catch (e) {
          console.error('[VideoPlayer] URL parse error:', e);
          throw new Error('Invalid video URL');
        }

        if (!fileName) {
          throw new Error('Could not extract filename');
        }

        console.log('[VideoPlayer] Generating signed URL for:', fileName);
        const { data: signedUrlData, error: signedUrlError } = await supabase.storage
          .from('videos')
          .createSignedUrl(fileName, 7200);

        if (signedUrlError || !signedUrlData?.signedUrl) {
          console.error('[VideoPlayer] Signed URL error:', signedUrlError);
          throw new Error('Failed to generate video URL');
        }

        console.log('[VideoPlayer] Signed URL ready');
        setVideoUrl(signedUrlData.signedUrl);
        hasLoadedRef.current = true;
      } catch (loadError: unknown) {
        console.error('[VideoPlayer] Load error:', loadError);
        const errorMessage = loadError instanceof Error ? loadError.message : 'Failed to load video';
        setError(errorMessage);
      } finally {
        setIsLoading(false);
      }
    };

    loadVideo();
  }, [videoId]);

  const headerTopPadding = Platform.OS === 'ios' ? insets.top : (Platform.OS === 'android' ? 48 : 12);

  if (isLoading) {
    const loadingText = "Loading video...";
    
    return (
      <View style={[styles.container, { backgroundColor: '#000000' }]}>
        <TouchableOpacity
          style={[styles.headerBackButton, { paddingTop: headerTopPadding }]}
          onPress={handleExitPlayer}
        >
          <IconSymbol
            ios_icon_name="chevron.left"
            android_material_icon_name="arrow-back"
            size={24}
            color="#FFFFFF"
          />
          <Text style={styles.headerBackText}>Back</Text>
        </TouchableOpacity>
        
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>{loadingText}</Text>
        </View>
      </View>
    );
  }

  if (error || !video || !videoUrl) {
    const errorMessage = error || 'Video not found';
    const errorTitle = "Unable to load video";
    const backText = "Go Back";
    
    return (
      <View style={[styles.container, { backgroundColor: '#000000' }]}>
        <TouchableOpacity
          style={[styles.headerBackButton, { paddingTop: headerTopPadding }]}
          onPress={handleExitPlayer}
        >
          <IconSymbol
            ios_icon_name="chevron.left"
            android_material_icon_name="arrow-back"
            size={24}
            color="#FFFFFF"
          />
          <Text style={styles.headerBackText}>Back</Text>
        </TouchableOpacity>
        
        <View style={styles.centerContent}>
          <IconSymbol
            ios_icon_name="exclamationmark.triangle.fill"
            android_material_icon_name="warning"
            size={64}
            color="#FF6B6B"
          />
          <Text style={styles.errorTitle}>{errorTitle}</Text>
          <Text style={styles.errorMessage}>{errorMessage}</Text>
          
          <TouchableOpacity
            style={[styles.button, { backgroundColor: colors.primary, marginTop: 24 }]}
            onPress={handleExitPlayer}
          >
            <Text style={styles.buttonText}>{backText}</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const videoTitle = video.title;
  const backButtonText = "Back";

  return (
    <View style={[styles.container, { backgroundColor: '#000000' }]}>
      <TouchableOpacity
        style={[styles.headerBackButton, { paddingTop: headerTopPadding }]}
        onPress={handleExitPlayer}
      >
        <IconSymbol
          ios_icon_name="chevron.left"
          android_material_icon_name="arrow-back"
          size={24}
          color="#FFFFFF"
        />
        <Text style={styles.headerBackText}>{backButtonText}</Text>
      </TouchableOpacity>

      <View style={styles.videoContainer}>
        <VideoView
          style={styles.video}
          player={player}
          allowsFullscreen={true}
          allowsPictureInPicture
          contentFit="contain"
          nativeControls={true}
        />
      </View>

      <View style={styles.infoContainer}>
        <Text style={styles.title}>{videoTitle}</Text>
        
        {video.description && (
          <Text style={styles.description}>{video.description}</Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerBackButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    zIndex: 10,
  },
  headerBackText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  loadingText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '500',
    marginTop: 16,
  },
  errorTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: 'bold',
    marginTop: 16,
    textAlign: 'center',
  },
  errorMessage: {
    color: '#FF6B6B',
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  videoContainer: {
    flex: 1,
    backgroundColor: '#000000',
  },
  video: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  infoContainer: {
    padding: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.95)',
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 12,
  },
  description: {
    fontSize: 14,
    lineHeight: 20,
    color: 'rgba(255, 255, 255, 0.8)',
  },
});
