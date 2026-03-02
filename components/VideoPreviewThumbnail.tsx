
import { useState, useEffect } from 'react';
import { View, StyleSheet, ActivityIndicator, Image } from 'react-native';
import { VideoView, useVideoPlayer } from 'expo-video';
import { colors } from '@/styles/commonStyles';

interface VideoPreviewThumbnailProps {
  videoUrl: string;
  thumbnailUrl?: string | null;
  style?: any;
}

/**
 * Helper to extract Mux playback ID from video URL
 */
function extractMuxPlaybackId(videoUrl: string): string | null {
  try {
    // Mux HLS URLs are in format: https://stream.mux.com/{playback_id}.m3u8
    if (videoUrl.includes('stream.mux.com/')) {
      const parts = videoUrl.split('stream.mux.com/');
      if (parts.length === 2) {
        const playbackId = parts[1].split('.m3u8')[0];
        console.log('[VideoPreviewThumbnail] Extracted Mux playback ID:', playbackId);
        return playbackId;
      }
    }
  } catch (e) {
    console.error('[VideoPreviewThumbnail] Error extracting playback ID:', e);
  }
  return null;
}

/**
 * Generate high-quality Mux thumbnail URL
 * 🎯 QUALITY FIX: Append quality parameters for max resolution
 */
function getMuxThumbnailUrl(videoUrl: string): string | null {
  const playbackId = extractMuxPlaybackId(videoUrl);
  if (!playbackId) return null;
  
  // 🎯 CRITICAL: Add quality parameters for max resolution
  // width=1920: Request 1080p resolution
  // fit_mode=preserve: Maintain aspect ratio
  // time=1: Use frame at 1 second (better than default 0)
  const thumbnailUrl = `https://image.mux.com/${playbackId}/thumbnail.jpg?width=1920&fit_mode=preserve&time=1`;
  console.log('[VideoPreviewThumbnail] 🎯 Generated high-quality Mux thumbnail URL:', thumbnailUrl);
  return thumbnailUrl;
}

/**
 * Simple video preview component for thumbnails/cards
 * Autoplays muted and looping - separate from full player logic
 */
export function VideoPreviewThumbnail({ videoUrl, thumbnailUrl, style }: VideoPreviewThumbnailProps) {
  const [isReady, setIsReady] = useState(false);
  const [showPoster, setShowPoster] = useState(true);

  // 🎯 QUALITY FIX: Try to get high-quality Mux thumbnail first
  const highQualityThumbnail = getMuxThumbnailUrl(videoUrl);
  const finalThumbnailUrl = highQualityThumbnail || thumbnailUrl;

  console.log('[VideoPreviewThumbnail] Using thumbnail URL:', finalThumbnailUrl);
  console.log('[VideoPreviewThumbnail] Is Mux thumbnail:', !!highQualityThumbnail);

  // 🚨 CRITICAL FIX: Create a simple muted looping player with error handling
  const player = useVideoPlayer(videoUrl, (playerInstance) => {
    try {
      console.log('[VideoPreviewThumbnail] Initializing preview player');
      playerInstance.loop = true;
      playerInstance.muted = true;
      playerInstance.volume = 0;
      
      // 🚨 CRITICAL: Wrap play() in try-catch to prevent unhandled promise rejections
      try {
        playerInstance.play().catch((playError: any) => {
          console.warn('[VideoPreviewThumbnail] ⚠️ Play error (non-critical):', playError);
          // Don't throw - this is expected during rapid state changes
        });
      } catch (playError) {
        console.warn('[VideoPreviewThumbnail] ⚠️ Play exception (non-critical):', playError);
      }
    } catch (error) {
      console.error('[VideoPreviewThumbnail] ⚠️ Player initialization error (non-critical):', error);
    }
  });

  // 🚨 CRITICAL FIX: Listen for when video is ready to play with error handling
  useEffect(() => {
    if (!player) return;

    try {
      const subscription = player.addListener('statusChange', (status) => {
        console.log('[VideoPreviewThumbnail] Status changed:', status.status);
        
        if (status.status === 'readyToPlay' && !isReady) {
          console.log('[VideoPreviewThumbnail] ✅ Video ready to play');
          setIsReady(true);
          // Hide poster after a brief delay to ensure smooth transition
          setTimeout(() => {
            setShowPoster(false);
          }, 300);
        }
        
        // 🚨 CRITICAL: Handle error states gracefully
        if (status.status === 'error') {
          console.warn('[VideoPreviewThumbnail] ⚠️ Video error - keeping poster visible');
          setIsReady(false);
          setShowPoster(true);
        }
      });

      return () => {
        try {
          subscription.remove();
        } catch (error) {
          console.warn('[VideoPreviewThumbnail] ⚠️ Error removing subscription:', error);
        }
      };
    } catch (error) {
      console.error('[VideoPreviewThumbnail] ⚠️ Error setting up status listener:', error);
    }
  }, [player, isReady]);

  // Reset state when URL changes
  useEffect(() => {
    console.log('[VideoPreviewThumbnail] Video URL changed, resetting state');
    setIsReady(false);
    setShowPoster(true);
  }, [videoUrl]);

  return (
    <View style={[styles.container, style]}>
      {/* Poster/thumbnail image - shows while loading */}
      {showPoster && finalThumbnailUrl && (
        <Image
          source={{ uri: finalThumbnailUrl }}
          style={styles.poster}
          resizeMode="cover"
        />
      )}

      {/* Loading spinner - shows while video loads */}
      {!isReady && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      )}

      {/* Video player - hidden until ready */}
      <VideoView
        style={[styles.video, !isReady && styles.hidden]}
        player={player}
        allowsFullscreen={false}
        allowsPictureInPicture={false}
        contentFit="cover"
        nativeControls={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    height: '100%',
    backgroundColor: '#000000',
    position: 'relative',
  },
  poster: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: '100%',
    height: '100%',
    zIndex: 1,
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    zIndex: 2,
  },
  video: {
    width: '100%',
    height: '100%',
  },
  hidden: {
    opacity: 0,
  },
});
