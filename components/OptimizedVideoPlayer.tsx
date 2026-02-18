
import { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Platform } from 'react-native';
import Video, { OnLoadData, OnProgressData, OnBufferData, OnPlaybackStateChangedData, OnAudioBecomingNoisyData } from 'react-native-video';
import { IconSymbol } from '@/components/IconSymbol';
import { colors } from '@/styles/commonStyles';
import Slider from '@react-native-community/slider';
import * as Haptics from 'expo-haptics';

interface OptimizedVideoPlayerProps {
  source: { uri: string };
  poster?: string;
  onEnd?: () => void;
  onError?: (error: any) => void;
  style?: any;
  isFullscreen?: boolean;
  showControls?: boolean;
  onToggleFullscreen?: () => void;
}

export function OptimizedVideoPlayer({
  source,
  poster,
  onEnd,
  onError,
  style,
  isFullscreen = false,
  showControls = true,
  onToggleFullscreen,
}: OptimizedVideoPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1.0);
  const [isBuffering, setIsBuffering] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(true);
  
  const videoRef = useRef<Video>(null);
  const isSeekingRef = useRef(false);
  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // 🚨 CRITICAL FIX: Track audio state to detect when it drops
  const isAudioActiveRef = useRef(true);
  const audioRecoveryTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastBufferEndTimeRef = useRef<number>(0);

  // 🚨 CRITICAL FIX: Automatic audio recovery function
  const triggerAudioRecovery = useCallback(() => {
    if (Platform.OS !== 'ios') return;
    
    console.log('[OptimizedVideoPlayer] 🔧 AUDIO RECOVERY: Triggering pause/resume cycle to restore audio track');
    
    // Tiny pause/resume cycle to force AVPlayer to reselect audio track
    setIsPlaying(false);
    
    setTimeout(() => {
      console.log('[OptimizedVideoPlayer] 🔧 AUDIO RECOVERY: Resuming playback');
      setIsPlaying(true);
      isAudioActiveRef.current = true;
    }, 50); // 50ms pause is imperceptible to users
  }, []);

  const clearControlsTimeout = useCallback(() => {
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
      controlsTimeoutRef.current = null;
    }
  }, []);

  const startControlsTimeout = useCallback(() => {
    clearControlsTimeout();
    
    if (isPlaying && showControls) {
      controlsTimeoutRef.current = setTimeout(() => {
        setControlsVisible(false);
      }, 3000);
    }
  }, [isPlaying, showControls, clearControlsTimeout]);

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

  useEffect(() => {
    if (isPlaying && controlsVisible && showControls) {
      startControlsTimeout();
    } else if (!isPlaying) {
      clearControlsTimeout();
      setControlsVisible(true);
    }

    return () => {
      clearControlsTimeout();
    };
  }, [isPlaying, controlsVisible, showControls, startControlsTimeout, clearControlsTimeout]);

  // 🚨 CRITICAL FIX: Cleanup audio recovery timeout on unmount
  useEffect(() => {
    return () => {
      if (audioRecoveryTimeoutRef.current) {
        clearTimeout(audioRecoveryTimeoutRef.current);
        audioRecoveryTimeoutRef.current = null;
      }
    };
  }, []);

  const togglePlayPause = useCallback(() => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    
    setIsPlaying(!isPlaying);
    resetControlsTimeout();
  }, [isPlaying, resetControlsTimeout]);

  const handleSeekStart = useCallback(() => {
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
    if (videoRef.current) {
      videoRef.current.seek(value);
    }
    
    isSeekingRef.current = false;
    resetControlsTimeout();
    
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
  }, [resetControlsTimeout]);

  const handleLoad = useCallback((data: OnLoadData) => {
    console.log('[OptimizedVideoPlayer] ✅ Video loaded, duration:', data.duration);
    setDuration(data.duration);
    setIsBuffering(false);
    isAudioActiveRef.current = true;
  }, []);

  const handleProgress = useCallback((data: OnProgressData) => {
    if (!isSeekingRef.current) {
      setCurrentTime(data.currentTime);
    }
    setIsBuffering(false);
    
    // Track audio activity
    if (Platform.OS === 'ios' && isPlaying && volume > 0) {
      isAudioActiveRef.current = true;
    }
  }, [isPlaying, volume]);

  // 🚨 CRITICAL FIX: Handle buffer events with automatic audio recovery
  const handleBuffer = useCallback((data: OnBufferData) => {
    if (data.isBuffering) {
      console.log('[OptimizedVideoPlayer] ⏸️ Buffering STARTED at', currentTime.toFixed(2), 'seconds');
      setIsBuffering(true);
    } else {
      console.log('[OptimizedVideoPlayer] ▶️ Buffering ENDED at', currentTime.toFixed(2), 'seconds');
      setIsBuffering(false);
      
      // 🚨 CRITICAL FIX: After buffer refill completes, check audio after 500ms
      if (Platform.OS === 'ios') {
        lastBufferEndTimeRef.current = Date.now();
        
        // Clear any existing recovery timeout
        if (audioRecoveryTimeoutRef.current) {
          clearTimeout(audioRecoveryTimeoutRef.current);
        }
        
        // Wait 500ms then check if audio is still active
        audioRecoveryTimeoutRef.current = setTimeout(() => {
          if (!isAudioActiveRef.current && isPlaying) {
            console.log('[OptimizedVideoPlayer] 🚨 AUDIO DROP DETECTED after buffer refill - triggering automatic recovery');
            triggerAudioRecovery();
          } else {
            console.log('[OptimizedVideoPlayer] ✅ Audio still active after buffer refill');
          }
        }, 500);
      }
    }
  }, [currentTime, isPlaying, triggerAudioRecovery]);

  // 🚨 CRITICAL FIX: Handle playback state changes to detect audio drops
  const handlePlaybackStateChanged = useCallback((data: OnPlaybackStateChangedData) => {
    console.log('[OptimizedVideoPlayer] 🎬 Playback state changed:', data.isPlaying);
    
    if (Platform.OS === 'ios') {
      // Track if audio should be active
      const shouldHaveAudio = data.isPlaying && volume > 0;
      
      if (shouldHaveAudio && !isAudioActiveRef.current) {
        console.log('[OptimizedVideoPlayer] 🚨 AUDIO DROP DETECTED via playback state change - triggering recovery');
        triggerAudioRecovery();
      }
      
      isAudioActiveRef.current = shouldHaveAudio;
    }
  }, [volume, triggerAudioRecovery]);

  // 🚨 CRITICAL FIX: Handle audio becoming noisy (headphones unplugged, etc.)
  const handleAudioBecomingNoisy = useCallback((data: OnAudioBecomingNoisyData) => {
    console.log('[OptimizedVideoPlayer] 🔊 Audio becoming noisy event detected');
    
    if (Platform.OS === 'ios') {
      // This event can indicate audio track issues
      console.log('[OptimizedVideoPlayer] 🚨 AUDIO INTERRUPTION - triggering recovery');
      triggerAudioRecovery();
    }
  }, [triggerAudioRecovery]);

  const handleError = useCallback((error: any) => {
    console.error('[OptimizedVideoPlayer] Video error:', error);
    setIsBuffering(false);
    if (onError) {
      onError(error);
    }
  }, [onError]);

  const handleEnd = useCallback(() => {
    console.log('[OptimizedVideoPlayer] Video ended');
    setIsPlaying(false);
    if (onEnd) {
      onEnd();
    }
  }, [onEnd]);

  const formatTime = (seconds: number) => {
    if (!seconds || isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

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
      style={[styles.container, style]}
      activeOpacity={1}
      onPress={toggleControls}
    >
      <Video
        ref={videoRef}
        source={source}
        style={styles.video}
        paused={!isPlaying}
        volume={volume}
        muted={false}
        resizeMode="contain"
        onLoad={handleLoad}
        onProgress={handleProgress}
        onBuffer={handleBuffer}
        onError={handleError}
        onEnd={handleEnd}
        onPlaybackStateChanged={handlePlaybackStateChanged}
        onAudioBecomingNoisy={handleAudioBecomingNoisy}
        repeat={false}
        playInBackground={false}
        playWhenInactive={false}
        ignoreSilentSwitch="ignore"
        audioOnly={false}
        selectedAudioTrack={{ type: 'system' }}
        preferredForwardBufferDuration={Platform.OS === 'ios' ? 10 : undefined}
        bufferConfig={Platform.OS === 'android' ? {
          minBufferMs: 5000,
          maxBufferMs: 60000,
          bufferForPlaybackMs: 1000,
          bufferForPlaybackAfterRebufferMs: 2000,
        } : undefined}
        automaticallyWaitsToMinimizeStalling={false}
        poster={poster}
        posterResizeMode="cover"
      />
      
      {isBuffering && (
        <View style={styles.bufferingOverlay}>
          <ActivityIndicator size="large" color="#FFFFFF" />
          <Text style={styles.bufferingText}>Buffering...</Text>
        </View>
      )}
      
      {showControls && controlsVisible && (
        <View style={styles.controls}>
          <View style={styles.topBar}>
            {onToggleFullscreen && (
              <TouchableOpacity
                style={styles.iconButton}
                onPress={onToggleFullscreen}
              >
                <IconSymbol
                  ios_icon_name={fullscreenIconIOS}
                  android_material_icon_name={fullscreenIconAndroid}
                  size={24}
                  color="#FFFFFF"
                />
              </TouchableOpacity>
            )}
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
    justifyContent: 'flex-end',
    padding: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
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
