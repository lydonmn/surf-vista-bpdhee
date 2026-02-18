
import { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Platform, ScrollView, AppState, AppStateStatus } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import Video, { OnLoadData, OnProgressData, OnBufferData, OnPlaybackStateChangedData, OnAudioBecomingNoisyData, OnPlaybackRateChangeData } from 'react-native-video';
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

export default function VideoPlayerV2Screen() {
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
  
  // Audio recovery state
  const [forceAudioRefresh, setForceAudioRefresh] = useState(0);
  
  const videoRef = useRef<Video>(null);
  const nextVideoRef = useRef<Video>(null);
  const isSeekingRef = useRef(false);
  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const appState = useRef(AppState.currentState);
  
  // Track audio recovery timing
  const audioRecoveryTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastBufferEndTimeRef = useRef<number>(Date.now());
  const playbackStartedAtRef = useRef<number | null>(null);
  const eightSecondTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Load video queue for this location
  const locationIdStr = typeof locationId === 'string' ? locationId : '';
  const { videos, currentIndex } = useVideoQueue(locationIdStr);

  // Get URLs for preloading (current + next 2-3)
  const videoUrls = videos.map(v => v.video_url);
  const currentVideoIndex = videos.findIndex(v => v.id === videoId);
  const preloadQueue = currentVideoIndex >= 0 
    ? videoUrls.slice(currentVideoIndex, currentVideoIndex + 3)
    : videoUrls.slice(0, 3);

  console.log('[VideoPlayerV2] 📥 Preload queue initialized:', preloadQueue.length, 'videos');
  console.log('[VideoPlayerV2] Current video index:', currentVideoIndex);
  console.log('[VideoPlayerV2] Preloading should start NOW (not waiting for user interaction)');

  // Use video preloader hook (silent background operation)
  const { getSource } = useVideoPreloader(preloadQueue);

  // Get next video for pre-buffering
  const nextVideo = currentVideoIndex >= 0 && currentVideoIndex < videos.length - 1
    ? videos[currentVideoIndex + 1]
    : null;

  // Audio recovery function - rapid pause/resume
  const triggerAudioRecovery = useCallback(() => {
    if (Platform.OS !== 'ios') return;
    
    console.log('[VideoPlayerV2] 🔧 AUDIO RECOVERY: Triggering rapid pause/resume cycle to restore audio track');
    
    // Rapid pause/resume cycle to force AVPlayer to reselect audio track
    setIsPlaying(false);
    
    setTimeout(() => {
      console.log('[VideoPlayerV2] 🔧 AUDIO RECOVERY: Resuming playback after 50ms');
      setIsPlaying(true);
    }, 50); // 50ms pause is imperceptible to users
  }, []);

  // Effect to handle forceAudioRefresh state changes
  useEffect(() => {
    if (forceAudioRefresh > 0) {
      console.log('[VideoPlayerV2] 🔄 forceAudioRefresh triggered (count:', forceAudioRefresh, ')');
      triggerAudioRecovery();
    }
  }, [forceAudioRefresh, triggerAudioRecovery]);

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
    console.log('[VideoPlayerV2] Loading video:', videoId);
    
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
          console.error('[VideoPlayerV2] Error loading video:', fetchError);
          throw fetchError;
        }

        console.log('[VideoPlayerV2] Video loaded:', data.title);
        setVideo(data);
        
        if (data.duration_seconds) {
          setDuration(data.duration_seconds);
        }
      } catch (loadError: unknown) {
        console.error('[VideoPlayerV2] Exception loading video:', loadError);
        const errorMessage = loadError instanceof Error ? loadError.message : 'Failed to load video';
        setError(errorMessage);
      } finally {
        setIsLoading(false);
      }
    };

    loadVideo();
  }, [videoId]);

  // Handle app state changes
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
      console.log('[VideoPlayerV2] App state changed:', appState.current, '->', nextAppState);

      if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
        console.log('[VideoPlayerV2] 🔄 App returned to foreground');
        
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

  // Cleanup audio recovery timeouts on unmount
  useEffect(() => {
    return () => {
      if (audioRecoveryTimeoutRef.current) {
        clearTimeout(audioRecoveryTimeoutRef.current);
        audioRecoveryTimeoutRef.current = null;
      }
      if (eightSecondTimeoutRef.current) {
        clearTimeout(eightSecondTimeoutRef.current);
        eightSecondTimeoutRef.current = null;
      }
    };
  }, []);

  // Set up 8-second safety net once when playback starts
  useEffect(() => {
    if (Platform.OS !== 'ios') return;
    
    // Only set up once when playback truly starts
    if (isPlaying && !playbackStartedAtRef.current) {
      playbackStartedAtRef.current = Date.now();
      
      console.log('[VideoPlayerV2] ⏰ Setting up 8-second safety net audio refresh (one-time)');
      
      // Clear any existing timeout
      if (eightSecondTimeoutRef.current) {
        clearTimeout(eightSecondTimeoutRef.current);
      }
      
      // Schedule audio refresh at 8 seconds from now
      eightSecondTimeoutRef.current = setTimeout(() => {
        console.log('[VideoPlayerV2] 🛡️ 8-SECOND SAFETY NET: Triggering preventive audio refresh');
        setForceAudioRefresh(prev => prev + 1);
      }, 8000);
    }
    
    // Reset when video stops
    if (!isPlaying && playbackStartedAtRef.current) {
      playbackStartedAtRef.current = null;
      if (eightSecondTimeoutRef.current) {
        clearTimeout(eightSecondTimeoutRef.current);
        eightSecondTimeoutRef.current = null;
      }
    }
  }, [isPlaying]);

  const handleExitPlayer = useCallback(async () => {
    console.log('[VideoPlayerV2] User exiting video player');
    
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    
    if (isFullscreen && Platform.OS !== 'web') {
      try {
        await ScreenOrientation.unlockAsync();
      } catch (e) {
        console.log('[VideoPlayerV2] Error unlocking orientation:', e);
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
    console.log('[VideoPlayerV2] Seek started');
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
    console.log('[VideoPlayerV2] Seek to:', value.toFixed(2));
    
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
    console.log('[VideoPlayerV2] Toggle fullscreen:', newFullscreenState);
    
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    
    if (Platform.OS !== 'web') {
      try {
        if (newFullscreenState) {
          await ScreenOrientation.unlockAsync();
          await new Promise(resolve => setTimeout(resolve, 200));
          await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
          console.log('[VideoPlayerV2] ✅ Locked to portrait');
        } else {
          await ScreenOrientation.unlockAsync();
          console.log('[VideoPlayerV2] ✅ Unlocked orientation');
        }
      } catch (e) {
        console.error('[VideoPlayerV2] Error changing orientation:', e);
      }
    }
    
    setIsFullscreen(newFullscreenState);
    setControlsVisible(true);
    
    if (newFullscreenState && isPlaying) {
      startControlsTimeout();
    }
  }, [isFullscreen, isPlaying, startControlsTimeout]);

  // Handle buffer events with automatic audio recovery
  const handleBuffer = useCallback((data: OnBufferData) => {
    if (data.isBuffering) {
      console.log('[VideoPlayerV2] ⏸️ Buffering STARTED at', currentTime.toFixed(2), 'seconds');
      setIsBuffering(true);
    } else {
      console.log('[VideoPlayerV2] ▶️ Buffering ENDED at', currentTime.toFixed(2), 'seconds');
      setIsBuffering(false);
      
      // After buffer refill completes, schedule audio recovery after 500ms
      if (Platform.OS === 'ios') {
        lastBufferEndTimeRef.current = Date.now();
        
        // Clear any existing recovery timeout
        if (audioRecoveryTimeoutRef.current) {
          clearTimeout(audioRecoveryTimeoutRef.current);
        }
        
        // Wait 500ms then trigger audio recovery
        audioRecoveryTimeoutRef.current = setTimeout(() => {
          console.log('[VideoPlayerV2] 🔧 500ms post-buffer check: Triggering audio recovery');
          setForceAudioRefresh(prev => prev + 1);
        }, 500);
      }
    }
  }, [currentTime]);

  // Simple progress handler - no critical window checks
  const handleProgress = useCallback((data: OnProgressData) => {
    if (!isSeekingRef.current) {
      setCurrentTime(data.currentTime);
    }
    setIsBuffering(false);
  }, []);

  const formatTime = (seconds: number) => {
    if (!seconds || isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return 'Unknown';
    const gb = bytes / (1024 * 1024 * 1024);
    if (gb >= 1) return `${gb.toFixed(2)} GB`;
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(2)} MB`;
  };

  // iOS-specific buffer config with increased minBufferMs
  const bufferConfig = Platform.select({
    ios: {
      minBufferMs: 5000,
      maxBufferMs: 60000,
      bufferForPlaybackMs: 1000,
      bufferForPlaybackAfterRebufferMs: 2000,
    },
    android: {
      minBufferMs: 5000,
      maxBufferMs: 60000,
      bufferForPlaybackMs: 1000,
      bufferForPlaybackAfterRebufferMs: 2000,
    },
  });

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
  const videoResolution = video.resolution_width && video.resolution_height 
    ? `${video.resolution_width}x${video.resolution_height}` 
    : '4K';
  const videoSize = formatFileSize(video.file_size_bytes);

  if (isFullscreen) {
    return (
      <TouchableOpacity 
        style={styles.fullscreenContainer}
        activeOpacity={1}
        onPress={toggleControls}
      >
        {/* Main video player with ALL audio fixes */}
        <Video
          ref={videoRef}
          source={videoSource}
          style={styles.fullscreenVideo}
          paused={!isPlaying}
          volume={volume}
          muted={false}
          resizeMode="contain"
          onLoad={(data: OnLoadData) => {
            console.log('[VideoPlayerV2] ✅ Video loaded, duration:', data.duration);
            setDuration(data.duration);
            setIsBuffering(false);
            isAudioActiveRef.current = true;
            eightSecondRefreshTriggered.current = false; // Reset for new video
          }}
          onProgress={handleProgress}
          onBuffer={handleBuffer}
          onError={(error) => {
            console.error('[VideoPlayerV2] Video error:', error);
            setError('Playback error occurred');
          }}
          onEnd={() => {
            console.log('[VideoPlayerV2] Video ended');
            setIsPlaying(false);
          }}
          onPlaybackStateChanged={handlePlaybackStateChanged}
          onAudioBecomingNoisy={handleAudioBecomingNoisy}
          onPlaybackRateChange={handlePlaybackRateChange}
          repeat={false}
          playInBackground={false}
          playWhenInactive={false}
          ignoreSilentSwitch="ignore"
          audioOnly={false}
          selectedAudioTrack={{ type: 'system' }}
          preferredForwardBufferDuration={Platform.OS === 'ios' ? 10 : undefined}
          bufferConfig={bufferConfig}
          automaticallyWaitsToMinimizeStalling={false}
          poster={video.thumbnail_url || undefined}
          posterResizeMode="cover"
        />

        {/* Pre-buffer next video off-screen (silent) */}
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
              if (__DEV__) {
                console.log('[VideoPlayerV2] ✅ Next video pre-buffered (silent)');
              }
            }}
            ignoreSilentSwitch="ignore"
            audioOnly={false}
            selectedAudioTrack={{ type: 'system' }}
            preferredForwardBufferDuration={Platform.OS === 'ios' ? 10 : undefined}
            bufferConfig={bufferConfig}
            automaticallyWaitsToMinimizeStalling={false}
          />
        )}
        
        {isBuffering && (
          <View style={styles.bufferingOverlay}>
            <ActivityIndicator size="large" color="#FFFFFF" />
            <Text style={styles.bufferingText}>Buffering...</Text>
          </View>
        )}
        
        {controlsVisible && (
          <View style={styles.fullscreenControls}>
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
              <Text style={styles.fullscreenTitle} numberOfLines={1}>{video.title}</Text>
              <TouchableOpacity
                style={styles.iconButton}
                onPress={toggleFullscreen}
              >
                <IconSymbol
                  ios_icon_name="xmark"
                  android_material_icon_name="close"
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

      <ScrollView style={styles.scrollContainer} contentContainerStyle={styles.scrollContent}>
        <View style={styles.videoContainer}>
          {/* Main video player with ALL audio fixes */}
          <Video
            ref={videoRef}
            source={videoSource}
            style={styles.video}
            paused={!isPlaying}
            volume={volume}
            muted={false}
            resizeMode="contain"
            onLoad={(data: OnLoadData) => {
              console.log('[VideoPlayerV2] ✅ Video loaded, duration:', data.duration);
              setDuration(data.duration);
              setIsBuffering(false);
              isAudioActiveRef.current = true;
              eightSecondRefreshTriggered.current = false; // Reset for new video
            }}
            onProgress={handleProgress}
            onBuffer={handleBuffer}
            onError={(error) => {
              console.error('[VideoPlayerV2] Video error:', error);
              setError('Playback error occurred');
            }}
            onEnd={() => {
              console.log('[VideoPlayerV2] Video ended');
              setIsPlaying(false);
            }}
            onPlaybackStateChanged={handlePlaybackStateChanged}
            onAudioBecomingNoisy={handleAudioBecomingNoisy}
            onPlaybackRateChange={handlePlaybackRateChange}
            repeat={false}
            playInBackground={false}
            playWhenInactive={false}
            ignoreSilentSwitch="ignore"
            audioOnly={false}
            selectedAudioTrack={{ type: 'system' }}
            preferredForwardBufferDuration={Platform.OS === 'ios' ? 10 : undefined}
            bufferConfig={bufferConfig}
            automaticallyWaitsToMinimizeStalling={false}
            poster={video.thumbnail_url || undefined}
            posterResizeMode="cover"
          />

          {/* Pre-buffer next video off-screen (silent) */}
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
                if (__DEV__) {
                  console.log('[VideoPlayerV2] ✅ Next video pre-buffered (silent)');
                }
              }}
              ignoreSilentSwitch="ignore"
              audioOnly={false}
              selectedAudioTrack={{ type: 'system' }}
              preferredForwardBufferDuration={Platform.OS === 'ios' ? 10 : undefined}
              bufferConfig={bufferConfig}
              automaticallyWaitsToMinimizeStalling={false}
            />
          )}
          
          {isBuffering && (
            <View style={styles.bufferingOverlay}>
              <ActivityIndicator size="large" color="#FFFFFF" />
              <Text style={styles.bufferingText}>Buffering...</Text>
            </View>
          )}
          
          <View style={styles.videoOverlay}>
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
        </View>

        <View style={styles.controlsContainer}>
          <View style={styles.mainControls}>
            <TouchableOpacity
              style={[styles.controlButton, { backgroundColor: colors.primary }]}
              onPress={togglePlayPause}
            >
              <IconSymbol
                ios_icon_name={playPauseIconIOS}
                android_material_icon_name={playPauseIconAndroid}
                size={32}
                color="#FFFFFF"
              />
            </TouchableOpacity>

            <View style={styles.seekInfo}>
              <Slider
                style={styles.normalSeekBar}
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
              <View style={styles.timeRow}>
                <Text style={styles.timeLabel}>{currentTimeText}</Text>
                <Text style={styles.timeLabel}>{durationText}</Text>
              </View>
            </View>
          </View>

          <View style={styles.volumeRow}>
            <IconSymbol
              ios_icon_name={volumeIconIOS}
              android_material_icon_name={volumeIconAndroid}
              size={20}
              color="#FFFFFF"
            />
            <Slider
              style={styles.normalVolumeSlider}
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

        <View style={styles.infoContainer}>
          <Text style={styles.title}>{video.title}</Text>
          
          {video.description && (
            <Text style={styles.description}>{video.description}</Text>
          )}
          
          <View style={styles.badgeRow}>
            <View style={styles.badge}>
              <IconSymbol
                ios_icon_name="checkmark.circle.fill"
                android_material_icon_name="check-circle"
                size={14}
                color={colors.primary}
              />
              <Text style={styles.badgeText}>Instant Playback</Text>
            </View>
            
            <View style={styles.badge}>
              <IconSymbol
                ios_icon_name="lock.fill"
                android_material_icon_name="lock"
                size={14}
                color="#4CAF50"
              />
              <Text style={styles.badgeText}>Secure</Text>
            </View>
          </View>
          
          <View style={styles.metadataContainer}>
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>Resolution</Text>
              <Text style={styles.metaValue}>{videoResolution}</Text>
            </View>
            
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>File Size</Text>
              <Text style={styles.metaValue}>{videoSize}</Text>
            </View>
            
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>Duration</Text>
              <Text style={styles.metaValue}>{durationText}</Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  fullscreenContainer: {
    flex: 1,
    backgroundColor: '#000000',
  },
  scrollContainer: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 40,
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
    width: '100%',
    aspectRatio: 9 / 16,
    backgroundColor: '#000000',
    position: 'relative',
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
  videoOverlay: {
    position: 'absolute',
    bottom: 16,
    right: 16,
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
  fullscreenControls: {
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
  fullscreenTitle: {
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
  controlsContainer: {
    padding: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.95)',
  },
  mainControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginBottom: 16,
  },
  controlButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  seekInfo: {
    flex: 1,
  },
  normalSeekBar: {
    flex: 1,
    height: 40,
  },
  timeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  timeLabel: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.7)',
    fontWeight: '500',
  },
  volumeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  normalVolumeSlider: {
    flex: 1,
    height: 40,
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
    marginBottom: 16,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  badgeText: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: 12,
    fontWeight: '600',
  },
  metadataContainer: {
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
  },
  metaLabel: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.6)',
  },
  metaValue: {
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.9)',
  },
});
