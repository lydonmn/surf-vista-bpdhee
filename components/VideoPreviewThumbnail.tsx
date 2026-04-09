
import { useEffect, useState } from 'react';
import { View, StyleSheet, ActivityIndicator, Image } from 'react-native';
import { VideoView, useVideoPlayer } from 'expo-video';
import { colors } from '@/styles/commonStyles';

interface VideoPreviewThumbnailProps {
  videoUrl: string;
  thumbnailUrl?: string | null;
  style?: any;
}

function extractMuxPlaybackId(videoUrl: string): string | null {
  try {
    if (videoUrl.includes('stream.mux.com/')) {
      const parts = videoUrl.split('stream.mux.com/');
      if (parts.length === 2) return parts[1].split('.m3u8')[0];
    }
  } catch {}
  return null;
}

function getMuxThumbnailUrl(videoUrl: string): string | null {
  const playbackId = extractMuxPlaybackId(videoUrl);
  if (!playbackId) return null;
  return `https://image.mux.com/${playbackId}/thumbnail.jpg?width=1920&fit_mode=preserve&time=1`;
}

export function VideoPreviewThumbnail({ videoUrl, thumbnailUrl, style }: VideoPreviewThumbnailProps) {
  const [videoReady, setVideoReady] = useState(false);
  const [videoError, setVideoError] = useState(false);

  const player = useVideoPlayer(videoUrl || '', (p) => {
    p.loop = true;
    p.muted = true;
    p.volume = 0;
  });

  useEffect(() => {
    if (!videoUrl) return;
    console.log('[VideoPreviewThumbnail] Starting inline muted autoplay for:', videoUrl);
    try {
      player.play();
      setVideoReady(true);
    } catch (e) {
      console.error('[VideoPreviewThumbnail] Failed to start playback:', e);
      setVideoError(true);
    }
  }, [videoUrl]);

  useEffect(() => {
    return () => {
      try {
        console.log('[VideoPreviewThumbnail] Unmounting — pausing player');
        player.pause();
      } catch {}
    };
  }, []);

  const finalThumbnailUrl = getMuxThumbnailUrl(videoUrl) || thumbnailUrl;

  if (videoError || !videoUrl) {
    return (
      <View style={[styles.container, style]}>
        {finalThumbnailUrl ? (
          <Image source={{ uri: finalThumbnailUrl }} style={styles.thumbnail} resizeMode="cover" />
        ) : (
          <View style={[styles.container, styles.centered]}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        )}
      </View>
    );
  }

  return (
    <View style={[styles.container, style]}>
      {!videoReady && finalThumbnailUrl && (
        <Image
          source={{ uri: finalThumbnailUrl }}
          style={[styles.thumbnail, styles.thumbnailOverlay]}
          resizeMode="cover"
        />
      )}
      <VideoView
        player={player}
        style={styles.thumbnail}
        contentFit="cover"
        nativeControls={false}
        allowsFullscreen={false}
        allowsPictureInPicture={false}
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
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  thumbnail: {
    width: '100%',
    height: '100%',
  },
  thumbnailOverlay: {
    position: 'absolute',
    zIndex: 1,
  },
});
