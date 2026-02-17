
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
  const [isFullscreen, setIsFullscreen] = useState(false);
  
  const hasLoadedRef = useRef(false);
  const isPortraitVideo = useRef(false);

  // ✅ SIMPLE: Create player with URL
  const player = useVideoPlayer(videoUrl || '', (player) => {
    if (videoUrl) {
      console.log('[VideoPlayer] ⚡ Player ready - auto-playing');
      player.loop = false;
      player.muted = false;
      player.play();
    }
  });

  const handleExitPlayer = useCallback(async () => {
    console.log('[VideoPlayer] Exiting');
    
    if (player) {
      player.pause();
    }
    
    if (Platform.OS !== 'web') {
      try {
        await ScreenOrientation.unlockAsync();
        await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
      } catch (e) {
        console.log('[VideoPlayer] Orientation reset error:', e);
      }
    }
    
    router.back();
  }, [player]);

  // ✅ SIMPLE: Load video with signed URL
  useEffect(() => {
    if (hasLoadedRef.current) return;
    
    console.log('[VideoPlayer] ⚡ Loading video:', videoId);
    
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

        console.log('[VideoPlayer] ✅ Video loaded:', videoData.title);
        console.log('[VideoPlayer] 📐 Resolution:', videoData.resolution_width, 'x', videoData.resolution_height);
        
        // Determine orientation
        if (videoData.resolution_width && videoData.resolution_height) {
          isPortraitVideo.current = videoData.resolution_height > videoData.resolution_width;
          console.log('[VideoPlayer] 📐 Video is:', isPortraitVideo.current ? 'PORTRAIT' : 'LANDSCAPE');
        }
        
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

        console.log('[VideoPlayer] ⚡ Generating signed URL...');
        const { data: signedUrlData, error: signedUrlError } = await supabase.storage
          .from('videos')
          .createSignedUrl(fileName, 7200);

        if (signedUrlError || !signedUrlData?.signedUrl) {
          console.error('[VideoPlayer] Signed URL error:', signedUrlError);
          throw new Error('Failed to generate video URL');
        }

        console.log('[VideoPlayer] ✅ Signed URL ready');
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

  const toggleFullscreen = useCallback(async () => {
    const newFullscreenState = !isFullscreen;
    console.log('[VideoPlayer] Fullscreen:', newFullscreenState);
    setIsFullscreen(newFullscreenState);
    
    if (Platform.OS !== 'web') {
      try {
        if (newFullscreenState) {
          // ✅ CRITICAL FIX: Lock to correct orientation based on video
          if (isPortraitVideo.current) {
            console.log('[VideoPlayer] ✅ Locking to PORTRAIT for fullscreen');
            await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
          } else {
            console.log('[VideoPlayer] ✅ Locking to LANDSCAPE for fullscreen');
            await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE);
          }
        } else {
          console.log('[VideoPlayer] Resetting to portrait');
          await ScreenOrientation.unlockAsync();
          await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
        }
      } catch (e) {
        console.log('[VideoPlayer] Orientation error:', e);
      }
    }
  }, [isFullscreen]);

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
  const fullscreenIconIOS = isFullscreen ? "arrow.down.right.and.arrow.up.left" : "arrow.up.left.and.arrow.down.right";
  const fullscreenIconAndroid = isFullscreen ? "fullscreen-exit" : "fullscreen";

  // ✅ SIMPLE FULLSCREEN MODE
  if (isFullscreen) {
    return (
      <View style={styles.fullscreenContainer}>
        <VideoView
          style={styles.fullscreenVideo}
          player={player}
          allowsFullscreen={false}
          allowsPictureInPicture
          contentFit="contain"
          nativeControls={true}
        />
        
        <View style={styles.fullscreenOverlay}>
          <View style={[styles.fullscreenTopBar, { paddingTop: Math.max(insets.top, 16) }]}>
            <TouchableOpacity
              style={styles.fullscreenButton}
              onPress={handleExitPlayer}
            >
              <IconSymbol
                ios_icon_name="chevron.left"
                android_material_icon_name="arrow-back"
                size={24}
                color="#FFFFFF"
              />
            </TouchableOpacity>
            <Text style={styles.fullscreenTitle}>{videoTitle}</Text>
            <TouchableOpacity
              style={styles.fullscreenButton}
              onPress={toggleFullscreen}
            >
              <IconSymbol
                ios_icon_name={fullscreenIconIOS}
                android_material_icon_name={fullscreenIconAndroid}
                size={24}
                color="#FFFFFF"
              />
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  }

  // ✅ SIMPLE NORMAL MODE WITH NATIVE CONTROLS
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
          allowsFullscreen={false}
          allowsPictureInPicture
          contentFit="contain"
          nativeControls={true}
        />
        
        <TouchableOpacity
          style={styles.fullscreenToggle}
          onPress={toggleFullscreen}
        >
          <IconSymbol
            ios_icon_name={fullscreenIconIOS}
            android_material_icon_name={fullscreenIconAndroid}
            size={28}
            color="#FFFFFF"
          />
        </TouchableOpacity>
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
    position: 'relative',
    backgroundColor: '#000000',
  },
  video: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  fullscreenToggle: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  fullscreenContainer: {
    flex: 1,
    backgroundColor: '#000000',
  },
  fullscreenVideo: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  fullscreenOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
  },
  fullscreenTopBar: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    gap: 16,
  },
  fullscreenButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullscreenTitle: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
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
