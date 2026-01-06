
import React, { useState, useEffect, useCallback } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, Alert, Platform } from "react-native";
import { useTheme } from "@react-navigation/native";
import { useLocalSearchParams, router } from "expo-router";
import { VideoView, useVideoPlayer, VideoAirPlayButton } from "expo-video";
import { colors } from "@/styles/commonStyles";
import { IconSymbol } from "@/components/IconSymbol";
import { supabase } from "@/app/integrations/supabase/client";
import { Video } from "@/hooks/useVideos";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function VideoPlayerScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { videoId } = useLocalSearchParams();
  const [video, setVideo] = useState<Video | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [debugInfo, setDebugInfo] = useState<string>('');

  const loadVideo = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      setDebugInfo('');
      console.log('[VideoPlayer] Loading video:', videoId);

      // Check authentication
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Not authenticated. Please log in again.');
      }
      console.log('[VideoPlayer] User authenticated:', session.user.email);

      const { data, error: fetchError } = await supabase
        .from('videos')
        .select('*')
        .eq('id', videoId)
        .single();

      if (fetchError) {
        console.error('[VideoPlayer] Error loading video:', fetchError);
        throw fetchError;
      }

      console.log('[VideoPlayer] Video loaded:', data.title);
      console.log('[VideoPlayer] Video URL from DB:', data.video_url);
      setVideo(data);

      // Extract filename from the stored URL
      let fileName = '';
      try {
        const urlParts = data.video_url.split('/videos/');
        if (urlParts.length === 2) {
          fileName = urlParts[1].split('?')[0]; // Remove any query params
          console.log('[VideoPlayer] Extracted filename:', fileName);
        } else {
          // Try alternative parsing
          const url = new URL(data.video_url);
          const pathParts = url.pathname.split('/');
          fileName = pathParts[pathParts.length - 1];
          console.log('[VideoPlayer] Extracted filename (alternative):', fileName);
        }
      } catch (e) {
        console.error('[VideoPlayer] Error parsing URL:', e);
        throw new Error('Invalid video URL format');
      }

      if (!fileName) {
        throw new Error('Could not extract filename from video URL');
      }

      // Try public URL first (simplest and most reliable)
      console.log('[VideoPlayer] Trying public URL for:', fileName);
      const { data: publicUrlData } = supabase.storage
        .from('videos')
        .getPublicUrl(fileName);

      if (publicUrlData?.publicUrl) {
        console.log('[VideoPlayer] Public URL obtained:', publicUrlData.publicUrl);
        setVideoUrl(publicUrlData.publicUrl);
        setDebugInfo('Using public URL');
        return; // Success!
      }

      // If public URL doesn't work, try signed URL
      console.log('[VideoPlayer] Public URL failed, trying signed URL');
      const { data: signedUrlData, error: signedUrlError } = await supabase.storage
        .from('videos')
        .createSignedUrl(fileName, 3600);

      if (signedUrlError) {
        console.error('[VideoPlayer] Signed URL error:', signedUrlError);
        throw new Error(
          `Cannot access video. Please ensure:\n` +
          `1. Storage bucket "videos" is public OR\n` +
          `2. RLS policies are configured correctly\n\n` +
          `Error: ${signedUrlError.message}`
        );
      }

      if (signedUrlData?.signedUrl) {
        console.log('[VideoPlayer] Signed URL created successfully');
        setVideoUrl(signedUrlData.signedUrl);
        setDebugInfo('Using signed URL (expires in 1 hour)');
      } else {
        throw new Error('Failed to generate video URL');
      }
    } catch (error: any) {
      console.error('[VideoPlayer] Exception loading video:', error);
      setError(error.message || 'Failed to load video');
      setDebugInfo(`Error: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  }, [videoId]);

  useEffect(() => {
    loadVideo();
  }, [loadVideo]);

  // Create video player with external playback enabled for AirPlay
  const player = useVideoPlayer(videoUrl || '', (player) => {
    if (videoUrl) {
      console.log('[VideoPlayer] Initializing player with URL:', videoUrl);
      player.loop = false;
      player.muted = false;
      player.allowsExternalPlayback = true; // Enable AirPlay
      
      // Add status change listener
      player.addListener('statusChange', (status) => {
        console.log('[VideoPlayer] Status changed:', status);
        
        if (status.error) {
          console.error('[VideoPlayer] Player error:', status.error);
          setError(`Playback error: ${status.error}`);
        }
        
        if (status.status === 'readyToPlay') {
          console.log('[VideoPlayer] Video ready to play');
        }
        
        if (status.status === 'loading') {
          console.log('[VideoPlayer] Video loading...');
        }
      });

      // Add playback status listener
      player.addListener('playingChange', (isPlaying) => {
        console.log('[VideoPlayer] Playing state changed:', isPlaying);
        setIsPlaying(isPlaying);
      });
    }
  });

  // Update player source when videoUrl changes
  useEffect(() => {
    if (videoUrl && player) {
      console.log('[VideoPlayer] Updating player source to:', videoUrl);
      try {
        player.replace(videoUrl);
        console.log('[VideoPlayer] Player source updated successfully');
        
        // Auto-play after a short delay
        setTimeout(() => {
          console.log('[VideoPlayer] Attempting auto-play');
          player.play();
        }, 500);
      } catch (e) {
        console.error('[VideoPlayer] Error updating player source:', e);
        setError('Failed to load video source');
      }
    }
  }, [videoUrl, player]);

  const toggleFullscreen = useCallback(() => {
    setIsFullscreen(!isFullscreen);
    console.log('[VideoPlayer] Fullscreen toggled:', !isFullscreen);
  }, [isFullscreen]);

  if (isLoading) {
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
            Loading video...
          </Text>
        </View>
      </View>
    );
  }

  if (error || !video) {
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <ScrollView contentContainerStyle={styles.centerContent}>
          <IconSymbol
            ios_icon_name="exclamationmark.triangle.fill"
            android_material_icon_name="warning"
            size={64}
            color={colors.textSecondary}
          />
          <Text style={[styles.errorText, { color: theme.colors.text }]}>
            {error || 'Video not found'}
          </Text>
          <Text style={[styles.errorSubtext, { color: colors.textSecondary }]}>
            This could be due to:
          </Text>
          <Text style={[styles.errorSubtext, { color: colors.textSecondary }]}>
            - Storage bucket RLS policies not configured
          </Text>
          <Text style={[styles.errorSubtext, { color: colors.textSecondary }]}>
            - Video file not accessible or deleted
          </Text>
          <Text style={[styles.errorSubtext, { color: colors.textSecondary }]}>
            - Network connectivity issues
          </Text>
          <Text style={[styles.errorSubtext, { color: colors.textSecondary }]}>
            - CORS configuration on storage bucket
          </Text>
          
          {debugInfo && (
            <View style={[styles.debugCard, { backgroundColor: theme.colors.card, marginTop: 16 }]}>
              <Text style={[styles.debugTitle, { color: theme.colors.text }]}>
                Debug Info
              </Text>
              <Text style={[styles.debugText, { color: colors.textSecondary }]}>
                {debugInfo}
              </Text>
            </View>
          )}
          
          <TouchableOpacity
            style={[styles.retryButton, { backgroundColor: colors.primary }]}
            onPress={loadVideo}
          >
            <IconSymbol
              ios_icon_name="arrow.clockwise"
              android_material_icon_name="refresh"
              size={20}
              color="#FFFFFF"
            />
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.backButton, { backgroundColor: colors.secondary }]}
            onPress={() => router.back()}
          >
            <Text style={[styles.backButtonText, { color: colors.text }]}>Go Back</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    );
  }

  if (!videoUrl) {
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
            Preparing video...
          </Text>
        </View>
      </View>
    );
  }

  // Fullscreen mode - video takes entire screen with custom controls
  if (isFullscreen) {
    return (
      <View style={[styles.fullscreenContainer, { backgroundColor: '#000000' }]}>
        <VideoView
          style={styles.fullscreenVideo}
          player={player}
          allowsFullscreen={false}
          allowsPictureInPicture
          contentFit="contain"
          nativeControls={false}
        />
        
        {/* Custom controls overlay - bottom right */}
        <View style={[styles.fullscreenControlsOverlay, { paddingBottom: insets.bottom + 20 }]}>
          <View style={styles.controlsRow}>
            {/* AirPlay button - iOS only */}
            {Platform.OS === 'ios' && (
              <View style={styles.airplayButtonContainer}>
                <VideoAirPlayButton
                  style={styles.airplayButton}
                  tint="#FFFFFF"
                  activeTint={colors.primary}
                />
              </View>
            )}
            
            {/* Exit fullscreen button */}
            <TouchableOpacity
              style={[styles.controlIconButton, { backgroundColor: 'rgba(0, 0, 0, 0.7)' }]}
              onPress={toggleFullscreen}
              activeOpacity={0.8}
            >
              <IconSymbol
                ios_icon_name="arrow.down.right.and.arrow.up.left"
                android_material_icon_name="fullscreen_exit"
                size={24}
                color="#FFFFFF"
              />
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  }

  // Normal mode - video with info below
  return (
    <ScrollView 
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      contentContainerStyle={styles.scrollContent}
    >
      <View style={styles.videoContainer}>
        <VideoView
          style={styles.video}
          player={player}
          allowsFullscreen={false}
          allowsPictureInPicture
          contentFit="contain"
          nativeControls={false}
        />
        
        {/* Custom controls overlay - bottom right */}
        <View style={styles.videoControlsOverlay}>
          <View style={styles.controlsRow}>
            {/* AirPlay button - iOS only */}
            {Platform.OS === 'ios' && (
              <View style={styles.airplayButtonContainer}>
                <VideoAirPlayButton
                  style={styles.airplayButton}
                  tint="#FFFFFF"
                  activeTint={colors.primary}
                />
              </View>
            )}
            
            {/* Fullscreen button */}
            <TouchableOpacity
              style={[styles.controlIconButton, { backgroundColor: 'rgba(0, 0, 0, 0.7)' }]}
              onPress={toggleFullscreen}
              activeOpacity={0.8}
            >
              <IconSymbol
                ios_icon_name="arrow.up.left.and.arrow.down.right"
                android_material_icon_name="fullscreen"
                size={24}
                color="#FFFFFF"
              />
            </TouchableOpacity>
          </View>
        </View>
      </View>

      <View style={styles.controls}>
        <TouchableOpacity
          style={[styles.controlButton, { backgroundColor: colors.primary }]}
          onPress={() => {
            if (isPlaying) {
              player.pause();
              console.log('[VideoPlayer] Paused');
            } else {
              player.play();
              console.log('[VideoPlayer] Playing');
            }
          }}
        >
          <IconSymbol
            ios_icon_name={isPlaying ? "pause.fill" : "play.fill"}
            android_material_icon_name={isPlaying ? "pause" : "play_arrow"}
            size={24}
            color="#FFFFFF"
          />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.controlButton, { backgroundColor: colors.secondary }]}
          onPress={() => {
            player.currentTime = 0;
            player.play();
            console.log('[VideoPlayer] Restarted');
          }}
        >
          <IconSymbol
            ios_icon_name="arrow.counterclockwise"
            android_material_icon_name="replay"
            size={24}
            color={colors.text}
          />
        </TouchableOpacity>
      </View>

      <View style={[styles.infoCard, { backgroundColor: theme.colors.card }]}>
        <Text style={[styles.videoTitle, { color: theme.colors.text }]}>
          {video.title}
        </Text>
        <Text style={[styles.videoDate, { color: colors.textSecondary }]}>
          {new Date(video.created_at).toLocaleDateString('en-US', {
            weekday: 'long',
            month: 'long',
            day: 'numeric',
            year: 'numeric'
          })}
        </Text>
        {video.duration && (
          <Text style={[styles.videoDuration, { color: colors.textSecondary }]}>
            Duration: {video.duration}
          </Text>
        )}
      </View>

      {video.description && (
        <View style={[styles.descriptionCard, { backgroundColor: theme.colors.card }]}>
          <Text style={[styles.descriptionTitle, { color: theme.colors.text }]}>
            About This Video
          </Text>
          <Text style={[styles.descriptionText, { color: colors.textSecondary }]}>
            {video.description}
          </Text>
        </View>
      )}

      <View style={[styles.infoBox, { backgroundColor: theme.colors.card }]}>
        <IconSymbol
          ios_icon_name="info.circle.fill"
          android_material_icon_name="info"
          size={20}
          color={colors.primary}
        />
        <Text style={[styles.infoText, { color: colors.textSecondary }]}>
          High-resolution drone footage captured at Folly Beach, South Carolina. 
          This exclusive content is available only to SurfVista subscribers.
        </Text>
      </View>

      {debugInfo && (
        <View style={[styles.debugCard, { backgroundColor: theme.colors.card }]}>
          <Text style={[styles.debugTitle, { color: theme.colors.text }]}>
            Debug Info
          </Text>
          <Text style={[styles.debugText, { color: colors.textSecondary }]}>
            Video ID: {videoId}
          </Text>
          <Text style={[styles.debugText, { color: colors.textSecondary }]} numberOfLines={3}>
            URL: {videoUrl}
          </Text>
          <Text style={[styles.debugText, { color: colors.textSecondary }]}>
            Status: {debugInfo}
          </Text>
        </View>
      )}

      <TouchableOpacity
        style={[styles.backButtonLarge, { backgroundColor: colors.secondary }]}
        onPress={() => router.back()}
      >
        <IconSymbol
          ios_icon_name="chevron.left"
          android_material_icon_name="arrow_back"
          size={20}
          color={colors.text}
        />
        <Text style={[styles.backButtonLargeText, { color: colors.text }]}>
          Back to Videos
        </Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  loadingText: {
    fontSize: 16,
    marginTop: 16,
  },
  videoContainer: {
    width: '100%',
    aspectRatio: 16 / 9,
    backgroundColor: '#000000',
    position: 'relative',
  },
  video: {
    width: '100%',
    height: '100%',
  },
  videoControlsOverlay: {
    position: 'absolute',
    bottom: 16,
    right: 16,
    zIndex: 10,
  },
  fullscreenContainer: {
    flex: 1,
    position: 'relative',
  },
  fullscreenVideo: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  fullscreenControlsOverlay: {
    position: 'absolute',
    bottom: 0,
    right: 16,
    zIndex: 10,
  },
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  airplayButtonContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  airplayButton: {
    width: 44,
    height: 44,
  },
  controlIconButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    boxShadow: '0px 2px 8px rgba(0, 0, 0, 0.3)',
    elevation: 5,
  },
  controls: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
    paddingVertical: 16,
    paddingHorizontal: 16,
  },
  controlButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
    marginTop: 16,
    marginBottom: 16,
  },
  errorSubtext: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 4,
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 24,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  infoCard: {
    marginHorizontal: 16,
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    boxShadow: '0px 2px 8px rgba(0, 0, 0, 0.1)',
    elevation: 3,
  },
  videoTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  videoDate: {
    fontSize: 14,
    marginBottom: 4,
  },
  videoDuration: {
    fontSize: 14,
  },
  descriptionCard: {
    marginHorizontal: 16,
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    boxShadow: '0px 2px 8px rgba(0, 0, 0, 0.1)',
    elevation: 3,
  },
  descriptionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  descriptionText: {
    fontSize: 14,
    lineHeight: 20,
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginHorizontal: 16,
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
  },
  debugCard: {
    marginHorizontal: 16,
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    boxShadow: '0px 2px 8px rgba(0, 0, 0, 0.1)',
    elevation: 3,
  },
  debugTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  debugText: {
    fontSize: 12,
    marginBottom: 4,
    fontFamily: 'monospace',
  },
  backButton: {
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 16,
  },
  backButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  backButtonLarge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 8,
  },
  backButtonLargeText: {
    fontSize: 16,
    fontWeight: '600',
  },
});
