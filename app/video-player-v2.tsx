
import { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Platform, ScrollView, AppState, AppStateStatus } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { VideoView, useVideoPlayer } from 'expo-video';
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
const MUX_HLS_PREFIX = 'https://stream.mux.com/';

export default function VideoPlayerV2Screen() {
  const insets = useSafeAreaInsets();
  const { videoId, locationId } = useLocalSearchParams();
  
  const [video, setVideo] = useState<VideoType | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1.0);
  const [isBuffering, setIsBuffering] = useState(false);
  
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(true);
  
  const isSeekingRef = useRef(false);
  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const appState = useRef(AppState.currentState);
  const hasLoadedRef = useRef(false);
  const lastProgressUpdateRef = useRef(0);
  const bufferingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Load video queue for this location
  const locationIdStr = typeof locationId === 'string' ? locationId : '';
  const { videos } = useVideoQueue(locationIdStr);

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

  // 🚨 REMOVED: Audio session configuration (expo-video handles this automatically)
  // expo-video in Expo SDK 52+ manages audio sessions internally
  // No manual configuration needed

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
      if (hasLoadedRef.current) {
        console.log('[VideoPlayerV2] Already loaded, skipping...');
        return;
      }

      try {
        setIsLoading(true);
        setError(null);

        const [sessionResult, videoResult] = await Promise.all([
          supabase.auth.getSession(),
          supabase.from('videos').select('*').eq('id', videoId).single()
        ]);

        const { data: { session } } = sessionResult;
        if (!session) {
          throw new Error('Not authenticated. Please log in again.');
        }

        const { data, error: fetchError } = videoResult;
        if (fetchError) {
          console.error('[VideoPlayerV2] Error loading video:', fetchError);
          throw fetchError;
        }

        console.log('[VideoPlayerV2] Video loaded:', data.title);
        console.log('[VideoPlayerV2] 🎬 Video URL:', data.video_url);
        setVideo(data);

        // 🎬 CRITICAL FIX: Check if this is a Mux HLS URL - if so, use it directly without signing
        if (data.video_url.startsWith(MUX_HLS_PREFIX)) {
          console.log('[VideoPlayerV2] 🎬 Mux HLS URL detected, using directly (no signing needed):', data.video_url);
          setVideoUrl(data.video_url);
          hasLoadedRef.current = true;
          setIsLoading(false);
          return;
        }

        // For Supabase storage URLs, generate signed URL
        console.log('[VideoPlayerV2] Generating signed URL for Supabase storage video');
        
        let fileName = '';
        try {
          const urlParts = data.video_url.split('/videos/');
          if (urlParts.length === 2) {
            fileName = urlParts[1].split('?')[0];
          } else {
            const url = new URL(data.video_url);
            const pathParts = url.pathname.split('/');
            fileName = pathParts[pathParts.length - 1];
          }
        } catch (e) {
          console.error('[VideoPlayerV2] Error parsing URL:', e);
          throw new Error('Invalid video URL format');
        }

        if (!fileName) {
          throw new Error('Could not extract filename from video URL');
        }

        const { data: signedUrlData, error: signedUrlError } = await supabase.storage
          .from('videos')
          .createSignedUrl(fileName, 7200);

        if (signedUrlError || !signedUrlData?.signedUrl) {
          console.error('[VideoPlayerV2] Signed URL error:', signedUrlError);
          throw new Error('Failed to generate streaming URL');
        }

        const generatedUrl = signedUrlData.signedUrl;
        console.log('[VideoPlayerV2] ✓ Signed URL created');
        
        setVideoUrl(generatedUrl);
        hasLoadedRef.current = true;
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

  // Initialize video player with expo-video
  // 🎯 QUALITY FIX: Configure player to prefer highest quality rendition on load
  const player = useVideoPlayer(videoUrl || '', (player) => {
    if (videoUrl) {
      console.log('[VideoPlayerV2] ⚡ Initializing player with expo-video');
      console.log('[VideoPlayerV2] 🎯 Configuring for HIGHEST QUALITY on load');
      player.loop = false;
      player.muted = false;
      player.volume = volume;
      player.allowsExternalPlayback = true;
      
      // 🎯 CRITICAL: Set preferredPeakBitRate to force maximum quality
      // Setting to a very high value (100 Mbps) ensures the player always selects the highest quality rendition
      if (Platform.OS === 'ios') {
        // iOS-specific: Set preferredPeakBitRate to 100 Mbps (100,000,000 bits per second)
        (player as any).preferredPeakBitRate = 100000000;
        console.log('[VideoPlayerV2] ✅ iOS: Set preferredPeakBitRate to 100 Mbps for maximum quality');
        
        // Also set preferredForwardBufferDuration to request more data upfront
        (player as any).preferredForwardBufferDuration = 10;
        console.log('[VideoPlayerV2] ✅ iOS: Set preferredForwardBufferDuration to 10 seconds');
      }
      
      console.log('[VideoPlayerV2] ✅ Player configured for highest quality playback');
    }
  });

  // Set up player event listeners
  useEffect(() => {
    if (!player || !videoUrl) return;

    console.log('[VideoPlayerV2] Setting up player event listeners');

    const statusListener = player.addListener('statusChange', (status) => {
      console.log('[VideoPlayerV2] Status:', status.status);
      
      if (status.error) {
        console.error('[VideoPlayerV2] ❌ Player error:', status.error);
        setError(`Playback error: ${status.error}`);
        setIsBuffering(false);
      }
      
      if (status.status === 'readyToPlay') {
        const videoDuration = status.duration || 0;
        console.log('[VideoPlayerV2] ✅ Video ready to play, duration:', videoDuration.toFixed(2));
        
        if (videoDuration > 0) {
          setDuration(videoDuration);
        }
        
        setIsBuffering(false);
        
        if (bufferingTimeoutRef.current) {
          clearTimeout(bufferingTimeoutRef.current);
          bufferingTimeoutRef.current = null;
        }
        
        // Start playback automatically
        if (!isPlaying) {
          setTimeout(() => {
            if (player) {
              player.play();
            }
          }, 50);
        }
      }
      
      if (status.status === 'loading') {
        console.log('[VideoPlayerV2] Video buffering...');
        setIsBuffering(true);
        
        if (bufferingTimeoutRef.current) {
          clearTimeout(bufferingTimeoutRef.current);
        }
        bufferingTimeoutRef.current = setTimeout(() => {
          console.log('[VideoPlayerV2] ⚠️ Buffering timeout - forcing clear');
          setIsBuffering(false);
        }, 2000);
      }
      
      if (status.status === 'idle' || status.status === 'error') {
        setIsBuffering(false);
        if (bufferingTimeoutRef.current) {
          clearTimeout(bufferingTimeoutRef.current);
          bufferingTimeoutRef.current = null;
        }
      }
    });

    const playingListener = player.addListener('playingChange', (newIsPlaying) => {
      console.log('[VideoPlayerV2] Playing state changed:', newIsPlaying);
      setIsPlaying(newIsPlaying);
      
      if (newIsPlaying) {
        console.log('[VideoPlayerV2] ✅ Video playing - clearing buffering');
        setIsBuffering(false);
        if (bufferingTimeoutRef.current) {
          clearTimeout(bufferingTimeoutRef.current);
          bufferingTimeoutRef.current = null;
        }
      }
    });

    const timeUpdateListener = player.addListener('timeUpdate', (timeUpdate) => {
      const newTime = timeUpdate.currentTime || 0;
      
      const now = Date.now();
      if (now - lastProgressUpdateRef.current < 100) return;
      lastProgressUpdateRef.current = now;
      
      if (!isSeekingRef.current) {
        setCurrentTime(newTime);
      }
      
      // Update duration from player if we don't have it yet
      if (player.duration && player.duration > 0) {
        setDuration(prevDuration => {
          if (prevDuration === 0 || Math.abs(prevDuration - player.duration) > 1) {
            console.log('[VideoPlayerV2] 🎯 Updating duration from player:', player.duration);
            return player.duration;
          }
          return prevDuration;
        });
      }

      setIsBuffering(false);
      if (bufferingTimeoutRef.current) {
        clearTimeout(bufferingTimeoutRef.current);
        bufferingTimeoutRef.current = null;
      }
    });

    return () => {
      console.log('[VideoPlayerV2] Cleaning up event listeners');
      statusListener.remove();
      playingListener.remove();
      timeUpdateListener.remove();
      
      if (bufferingTimeoutRef.current) {
        clearTimeout(bufferingTimeoutRef.current);
        bufferingTimeoutRef.current = null;
      }
    };
  }, [player, videoUrl, isPlaying]);

  // Load video source
  useEffect(() => {
    if (videoUrl && player) {
      console.log('[VideoPlayerV2] ⚡ Loading video source...');
      try {
        player.replace(videoUrl);
        console.log('[VideoPlayerV2] ✅ Video source loaded');
      } catch (e) {
        console.error('[VideoPlayerV2] Error loading source:', e);
        setError('Failed to load video source');
      }
    }
  }, [videoUrl, player]);

  // Update player volume
  useEffect(() => {
    if (player) {
      player.volume = volume;
    }
  }, [volume, player]);

  // Update current time while playing
  useEffect(() => {
    if (!player || !isPlaying) return;

    const interval = setInterval(() => {
      if (!isSeekingRef.current && player.currentTime !== undefined) {
        setCurrentTime(player.currentTime);
      }
      
      // Continuously check for duration from player
      if (player.duration && player.duration > 0 && duration === 0) {
        console.log('[VideoPlayerV2] 🎯 Got duration from player during playback:', player.duration);
        setDuration(player.duration);
      }
    }, 100);
    
    return () => clearInterval(interval);
  }, [player, isPlaying, duration]);

  // Handle app state changes
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
      console.log('[VideoPlayerV2] App state changed:', appState.current, '->', nextAppState);

      if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
        console.log('[VideoPlayerV2] 🔄 App returned to foreground');
        
        // Resume playback when app comes back
        if (isPlaying && player) {
          player.play();
        }
      }

      appState.current = nextAppState;
    });

    return () => {
      subscription.remove();
    };
  }, [isPlaying, player]);

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
    console.log('[VideoPlayerV2] User exiting video player');
    
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    
    if (player) {
      try {
        player.pause();
        console.log('[VideoPlayerV2] Stopped playback');
      } catch (e) {
        console.log('[VideoPlayerV2] Error stopping playback:', e);
      }
    }
    
    if (isFullscreen && Platform.OS !== 'web') {
      try {
        await ScreenOrientation.unlockAsync();
      } catch (e) {
        console.log('[VideoPlayerV2] Error unlocking orientation:', e);
      }
    }
    
    router.back();
  }, [player, isFullscreen]);

  const togglePlayPause = useCallback(() => {
    if (!player) return;
    
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    
    const currentlyPlaying = player.playing;
    console.log('[VideoPlayerV2] Toggle play/pause:', currentlyPlaying ? 'pause' : 'play');
    
    if (currentlyPlaying) {
      player.pause();
      setIsPlaying(false);
      setControlsVisible(true);
      clearControlsTimeout();
    } else {
      player.play();
      setIsPlaying(true);
      resetControlsTimeout();
    }
  }, [player, resetControlsTimeout, clearControlsTimeout]);

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
    
    if (player) {
      const clampedValue = Math.max(0, Math.min(value, duration));
      player.currentTime = clampedValue;
      setCurrentTime(clampedValue);
    }
    
    isSeekingRef.current = false;
    resetControlsTimeout();
    
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
  }, [player, duration, resetControlsTimeout]);

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

  const headerTopPadding = Platform.OS === 'ios' ? insets.top : (Platform.OS === 'android' ? 48 : 12);

  if (isLoading) {
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
          <Text style={styles.loadingText}>Loading video...</Text>
        </View>
      </View>
    );
  }

  if (error || !video) {
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

  if (!videoUrl) {
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
          <Text style={styles.loadingText}>Preparing video...</Text>
        </View>
      </View>
    );
  }

  // Get the best source (local or remote) - currently unused but available for future optimization
  // const videoSource = getSource(video.video_url);
  // const nextVideoSource = nextVideo ? getSource(nextVideo.video_url) : null;

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
        <VideoView
          style={styles.fullscreenVideo}
          player={player}
          allowsFullscreen={false}
          allowsPictureInPicture
          contentFit="contain"
          nativeControls={false}
        />
        
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

      <ScrollView style={styles.scrollContainer} contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 100 }]}>
        <View style={styles.videoContainer}>
          <VideoView
            style={styles.video}
            player={player}
            allowsFullscreen={false}
            allowsPictureInPicture
            contentFit="contain"
            nativeControls={false}
          />
          
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
    paddingBottom: 120,
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
    flex: 1,
    width: '100%',
    height: '100%',
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
    marginBottom: 8,
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
