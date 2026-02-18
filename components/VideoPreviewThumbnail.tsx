
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
 * Simple video preview component for thumbnails/cards
 * Autoplays muted and looping - separate from full player logic
 */
export function VideoPreviewThumbnail({ videoUrl, thumbnailUrl, style }: VideoPreviewThumbnailProps) {
  const [isReady, setIsReady] = useState(false);
  const [showPoster, setShowPoster] = useState(true);

  // Create a simple muted looping player
  const player = useVideoPlayer(videoUrl, (playerInstance) => {
    console.log('[VideoPreviewThumbnail] Initializing preview player');
    playerInstance.loop = true;
    playerInstance.muted = true;
    playerInstance.volume = 0;
    playerInstance.play();
  });

  // Listen for when video is ready to play
  useEffect(() => {
    if (!player) return;

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
    });

    return () => {
      subscription.remove();
    };
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
      {showPoster && thumbnailUrl && (
        <Image
          source={{ uri: thumbnailUrl }}
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
