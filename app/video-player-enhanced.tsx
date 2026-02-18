
import { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Platform, Dimensions, AppState, AppStateStatus } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import Video from 'react-native-video';
import { colors } from '@/styles/commonStyles';
import { IconSymbol } from '@/components/IconSymbol';
import { supabase } from '@/app/integrations/supabase/client';
import Slider from '@react-native-community/slider';
import * as ScreenOrientation from 'expo-screen-orientation';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useVideoPreloader } from '@/hooks/useVideoPreloader';
import { useVideoQueue } from '@/hooks/useVideoQueue';
import { Video as VideoType } from '@/types';

const CONTROLS_HIDE_DELAY = 3000;

export default function EnhancedVideoPlayerScreen() {
  const insets = useSafeAreaInsets();
  const { videoId, locationId } = useLocalSearchParams();
  
  const [video, setVideo] = useState<VideoType | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [isPlaying, setIsPlaying] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1.0);
  const [isBuffering, setIsBuffering] = useState(false);
  
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(true);
  
  const videoRef = useRef<Video>(null);
  const nextVideoRef = useRef<Video>(null);
  const isSeekingRef = useRef(false);
  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const appState = useRef(AppState.currentState);

  // Load video queue for this location
  const { videos, currentIndex, goToVideo } = useVideoQueue(
    typeof locationId === 'string' ? locationId : ''
  );

  // Get URLs for preloading (current + next 2-3)
  const videoUrls = videos.map(v => v.video_url);
  const currentVideoIndex = videos.findIndex(v => v.id === videoId);
  const preloadQueue = currentVideoIndex >= 0 
    ? videoUrls.slice(currentVideoIndex, currentVideoIndex + 3)
    : videoUrls.slice(0, 3);

  // Use video preloader hook
  const { getSource, isPreloading } = useVideoPreloader(preloadQueue);

  // Get next video for pre-buffering
  const nextVideo = currentVideoIndex >= 0 && currentVideoIndex < videos.length - 1
    ? videos[currentVideoIndex + 1]
    : null;

  const clearControlsTimeout = useCallback(() => {
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
      controlsTimeoutRef.current = null;
    }
  }, []);

  const startControlsTimeout = useCallback(() => {
    clearControlsTimeout();
    
    if (isPlaying) {
      controlsTimeoutRef.current = setTimeout(() => {
        setControlsVisible(false);
      }, CONTROLS_HIDE_DELAY);
    }
  }, [isPlaying, clearControlsTimeout]);

  const toggleControls = useCallback(() => {
    const newVisibility = !controlsVisible;
    setControlsVisible(newVisibility);
    
    if (newVisibility) {
      startControlsTimeout();
    } else {
      clearControlsTimeout();
    }
  }, [controlsVisible, startControlsTimeout, clearControlsTimeout]);

  const resetControlsTimeout = useCallback(() => {
    setControlsVisible(true);
    startControlsTimeout();
  }, [startControlsTimeout]);

  // Load video metadata
  useEffect(() => {
    console.log('[EnhancedVideoPlayer] Loading video:', videoId);
    
    const loadVideo = async () => {
      try {
        setIsLoading(true);
        setError(null);

        const { data, error: fetchError } = await supabase
          .from('videos')
          .select('*')
          .eq('id', videoId)
          .single();

        if (fetchError) {
          console.error('[EnhancedVideoPlayer] Error loading video:', fetchError);
          throw fetchError;
        }

        console.log('[EnhancedVideoPlayer] Video loaded:', data.title);
        setVideo(data);
        
        if (data.duration_seconds) {
          setDuration(data.duration_seconds);
        }
      } catch (loadError: unknown) {
        console.error('[EnhancedVideoPlayer] Exception loading video:', loadError);
        const errorMessage = loadError instanceof Error ? loadError.message : 'Failed to load video';
        setError(errorMessage);
      } finally {
        setIsLoading(false);
      }
    };

    loadVideo();
  }, [videoId]);

  // Handle app state changes - resume preloading aggressively
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
      console.log('[EnhancedVideoPlayer] App state changed:', appState.current, '->', nextAppState);

      if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
        console.log('[EnhancedVideoPlayer] 🔄 App returned to foreground - resuming playback');
        
        // Resume playback when app comes back
        if (isPlaying && videoRef.current) {
          videoRef.current.seek(currentTime);
        }
      }

      appState.current = nextAppState;
    });

    return () => {
      subscription.remove();
    };
  }, [isPlaying, currentTime]);

  // Controls auto-hide
  useEffect(() => {
    if (isPlaying && controlsVisible) {
      startControlsTimeout();
    } else if (!isPlaying) {
      clearControlsTimeout();
      setControlsVisible(true);
    }

    return () => {
      clearControlsTimeout();
    };
  }, [isPlaying, controlsVisible, startControlsTimeout, clearControlsTimeout]);

  const handleExitPlayer = useCallback(async () => {
    console.log('[EnhancedVideoPlayer] User exiting video player');
    
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    
    if (isFullscreen && Platform.OS !== 'web') {
      try {
        await ScreenOrientation.unlockAsync();
      } catch (e) {
        console.log('[EnhancedVideoPlayer] Error unlocking orientation:', e);
      }
    }
    
    router.back();
  }, [isFullscreen]);

  const togglePlayPause = useCallback(() => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    
    setIsPlaying(!isPlaying);
    resetControlsTimeout();
  }, [isPlaying, resetControlsTimeout]);

  const handleSeekStart = useCallback(() => {
    console.log('[EnhancedVideoPlayer] Seek started');
    isSeekingRef.current = true;
    setControlsVisible(true);
    clearControlsTimeout();
    
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  }, [clearControlsTimeout]);

  const handleSeekChange = useCallback((value: number) => {
    setCurrentTime(value);
  }, []);

  const handleSeekComplete = useCallback((value: number) => {
    console.log('[EnhancedVideoPlayer] Seek to:', value.toFixed(2));
    
    if (videoRef.current) {
      videoRef.current.seek(value);
    }
    
    isSeekingRef.current = false;
    resetControlsTimeout();
    
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
  }, [resetControlsTimeout]);

  const toggleFullscreen = useCallback(async () => {
    const newFullscreenState = !isFullscreen;
    console.log('[EnhancedVideoPlayer] Toggle fullscreen:', newFullscreenState);
    
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    
    if (Platform.OS !== 'web') {
      try {
        if (newFullscreenState) {
          await ScreenOrientation.unlockAsync();
          await new Promise(resolve => setTimeout(resolve, 200));
          await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
          console.log('[EnhancedVideoPlayer] ✅ Locked to portrait');
        } else {
          await ScreenOrientation.unlockAsync();
          console.log('[EnhancedVideoPlayer] ✅ Unlocked orientation');
        }
      } catch (e) {
        console.error('[EnhancedVideoPlayer] Error changing orientation:', e);
      }
    }
    
    setIsFullscreen(newFullscreenState);
    setControlsVisible(true);
    
    if (newFullscreenState && isPlaying) {
      startControlsTimeout();
    }
  }, [isFullscreen, isPlaying, startControlsTimeout]);

  const formatTime = (seconds: number) => {
    if (!seconds || isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (isLoading) {
    return (
      <View style={[styles.container, { backgroundColor: '#000000' }]}>
        <TouchableOpacity
          style={[styles.headerBackButton, { paddingTop: Math.max(insets.top, 16) }]}
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
          <Text style={styles.loadingText}>Loading video...</Text>
        </View>
      </View>
    );
  }

  if (error || !video) {
    return (
      <View style={[styles.container, { backgroundColor: '#000000' }]}>
        <TouchableOpacity
          style={[styles.headerBackButton, { paddingTop: Math.max(insets.top, 16) }]}
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
          <Text style={styles.errorTitle}>Unable to load video</Text>
          <Text style={styles.errorMessage}>{error || 'Video not found'}</Text>
          
          <TouchableOpacity
            style={[styles.button, { backgroundColor: colors.primary, marginTop: 24 }]}
            onPress={handleExitPlayer}
          >
            <Text style={styles.buttonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // Get the best source (local or remote)
  const videoSource = getSource(video.video_url);
  const nextVideoSource = nextVideo ? getSource(nextVideo.video_url) : null;

  const currentTimeText = formatTime(currentTime);
  const durationText = formatTime(duration);
  const playPauseIconIOS = isPlaying ? "pause.fill" : "play.fill";
  const playPauseIconAndroid = isPlaying ? "pause" : "play-arrow";
  const volumeIconIOS = volume === 0 ? "speaker.slash.fill" : "speaker.wave.2.fill";
  const volumeIconAndroid = volume === 0 ? "volume-off" : "volume-up";
  const fullscreenIconIOS = isFullscreen ? "arrow.down.right.and.arrow.up.left" : "arrow.up.left.and.arrow.down.right";
  const fullscreenIconAndroid = isFullscreen ? "fullscreen-exit" : "fullscreen";

  return (
    <TouchableOpacity 
      style={styles.container}
      activeOpacity={1}
      onPress={toggleControls}
    >
      {/* Main video player */}
      <Video
        ref={videoRef}
        source={videoSource}
        style={isFullscreen ? styles.fullscreenVideo : styles.video}
        paused={!isPlaying}
        volume={volume}
        muted={false}
        resizeMode="contain"
        onLoad={(data) => {
          console.log('[EnhancedVideoPlayer] ✅ Video loaded, duration:', data.duration);
          setDuration(data.duration);
          setIsBuffering(false);
        }}
        onProgress={(data) => {
          if (!isSeekingRef.current) {
            setCurrentTime(data.currentTime);
          }
          setIsBuffering(false);
        }}
        onBuffer={({ isBuffering: buffering }) => {
          console.log('[EnhancedVideoPlayer] Buffering:', buffering);
          setIsBuffering(buffering);
        }}
        onError={(error) => {
          console.error('[EnhancedVideoPlayer] Video error:', error);
          setError('Playback error occurred');
        }}
        onEnd={() => {
          console.log('[EnhancedVideoPlayer] Video ended');
          setIsPlaying(false);
        }}
        // Android buffer config for instant playback
        bufferConfig={Platform.OS === 'android' ? {
          minBufferMs: 2500,
          maxBufferMs: 50000,
          bufferForPlaybackMs: 1000,
          bufferForPlaybackAfterRebufferMs: 2000,
        } : undefined}
        // iOS optimization
        automaticallyWaitsToMinimizeStalling={false}
        poster={video.thumbnail_url || undefined}
        posterResizeMode="cover"
      />

      {/* Pre-buffer next video off-screen */}
      {nextVideoSource && (
        <Video
          ref={nextVideoRef}
          source={nextVideoSource}
          style={styles.hiddenVideo}
          paused={true}
          volume={0}
          muted={true}
          resizeMode="contain"
          onLoad={() => {
            console.log('[EnhancedVideoPlayer] ✅ Next video pre-buffered');
          }}
          bufferConfig={Platform.OS === 'android' ? {
            minBufferMs: 2500,
            maxBufferMs: 50000,
            bufferForPlaybackMs: 1000,
            bufferForPlaybackAfterRebufferMs: 2000,
          } : undefined}
          automaticallyWaitsToMinimizeStalling={false}
        />
      )}
      
      {isBuffering && (
        <View style={styles.bufferingOverlay}>
          <ActivityIndicator size="large" color="#FFFFFF" />
          <Text style={styles.bufferingText}>Buffering...</Text>
        </View>
      )}

      {isPreloading && (
        <View style={styles.preloadingBadge}>
          <ActivityIndicator size="small" color="#FFFFFF" />
          <Text style={styles.preloadingText}>Preloading...</Text>
        </View>
      )}
      
      {controlsVisible && (
        <View style={styles.controls}>
          <View style={[styles.topBar, { paddingTop: Math.max(insets.top, 16) }]}>
            <TouchableOpacity
              style={styles.iconButton}
              onPress={handleExitPlayer}
            >
              <IconSymbol
                ios_icon_name="chevron.left"
                android_material_icon_name="arrow-back"
                size={24}
                color="#FFFFFF"
              />
            </TouchableOpacity>
            <Text style={styles.videoTitle} numberOfLines={1}>{video.title}</Text>
            <TouchableOpacity
              style={styles.iconButton}
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

          <View style={styles.centerControls}>
            <TouchableOpacity
              style={styles.playPauseButton}
              onPress={togglePlayPause}
            >
              <IconSymbol
                ios_icon_name={playPauseIconIOS}
                android_material_icon_name={playPauseIconAndroid}
                size={48}
                color="#FFFFFF"
              />
            </TouchableOpacity>
          </View>

          <View style={styles.bottomBar}>
            <View style={styles.seekContainer}>
              <Text style={styles.timeText}>{currentTimeText}</Text>
              <Slider
                style={styles.seekBar}
                minimumValue={0}
                maximumValue={duration > 0 ? duration : 100}
                value={currentTime}
                onSlidingStart={handleSeekStart}
                onValueChange={handleSeekChange}
                onSlidingComplete={handleSeekComplete}
                minimumTrackTintColor={colors.primary}
                maximumTrackTintColor="rgba(255, 255, 255, 0.3)"
                thumbTintColor={colors.primary}
              />
              <Text style={styles.timeText}>{durationText}</Text>
            </View>

            <View style={styles.bottomControls}>
              <View style={styles.volumeControl}>
                <IconSymbol
                  ios_icon_name={volumeIconIOS}
                  android_material_icon_name={volumeIconAndroid}
                  size={24}
                  color="#FFFFFF"
                />
                <Slider
                  style={styles.volumeSlider}
                  minimumValue={0}
                  maximumValue={1}
                  value={volume}
                  onValueChange={setVolume}
                  minimumTrackTintColor={colors.primary}
                  maximumTrackTintColor="rgba(255, 255, 255, 0.3)"
                  thumbTintColor={colors.primary}
                />
              </View>
            </View>
          </View>
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  video: {
    width: '100%',
    height: '100%',
  },
  fullscreenVideo: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: '100%',
    height: '100%',
  },
  hiddenVideo: {
    position: 'absolute',
    width: 1,
    height: 1,
    opacity: 0,
  },
  headerBackButton: {
    position: 'absolute',
    top: 0,
    left: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
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
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  bufferingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  bufferingText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '500',
    marginTop: 12,
  },
  preloadingBadge: {
    position: 'absolute',
    top: 80,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    borderRadius: 16,
  },
  preloadingText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  controls: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'space-between',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    gap: 16,
  },
  videoTitle: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  centerControls: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  playPauseButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  bottomBar: {
    padding: 16,
    paddingBottom: 32,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
  },
  seekContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  seekBar: {
    flex: 1,
    height: 40,
  },
  timeText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '500',
    minWidth: 45,
    textAlign: 'center',
  },
  bottomControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  volumeControl: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
    maxWidth: 250,
  },
  volumeSlider: {
    flex: 1,
    height: 40,
  },
  iconButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
