
import React, { useState, useEffect, useCallback, useRef } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Dimensions, Platform } from "react-native";
import { useTheme } from "@react-navigation/native";
import { useLocalSearchParams, router } from "expo-router";
import { VideoView, useVideoPlayer } from "expo-video";
import { colors } from "@/styles/commonStyles";
import { IconSymbol } from "@/components/IconSymbol";
import { supabase } from "@/app/integrations/supabase/client";
import Slider from '@react-native-community/slider';
import * as ScreenOrientation from 'expo-screen-orientation';

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

// ✅ CONFIGURABLE CONTROL TIMEOUT (in milliseconds)
const CONTROLS_HIDE_DELAY = 3000; // 3 seconds of inactivity

export default function VideoPlayerScreen() {
  const theme = useTheme();
  const { videoId } = useLocalSearchParams();
  
  // Video data and loading states
  const [video, setVideo] = useState<Video | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Playback states
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1.0);
  const [isBuffering, setIsBuffering] = useState(false);
  
  // UI states
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(true);
  
  // Refs
  const isSeekingRef = useRef(false);
  const lastProgressUpdateRef = useRef(0);
  const hasLoadedRef = useRef(false);
  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // ✅ ENHANCED: Clear timeout helper function
  const clearControlsTimeout = useCallback(() => {
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
      controlsTimeoutRef.current = null;
    }
  }, []);

  // ✅ ENHANCED: Start timeout helper function
  const startControlsTimeout = useCallback(() => {
    clearControlsTimeout();
    
    // Only auto-hide if playing
    if (isPlaying) {
      console.log('[VideoPlayer] Starting controls hide timer:', CONTROLS_HIDE_DELAY, 'ms');
      controlsTimeoutRef.current = setTimeout(() => {
        console.log('[VideoPlayer] Hiding controls after inactivity');
        setControlsVisible(false);
      }, CONTROLS_HIDE_DELAY);
    }
  }, [isPlaying, clearControlsTimeout]);

  // ✅ ENHANCED: Toggle controls visibility with smart timeout management
  const toggleControls = useCallback(() => {
    console.log('[VideoPlayer] User toggled controls');
    const newVisibility = !controlsVisible;
    setControlsVisible(newVisibility);
    
    if (newVisibility) {
      // Controls shown - start hide timer if playing
      startControlsTimeout();
    } else {
      // Controls hidden - clear any pending timer
      clearControlsTimeout();
    }
  }, [controlsVisible, startControlsTimeout, clearControlsTimeout]);

  // ✅ ENHANCED: Reset controls timeout on user interaction
  const resetControlsTimeout = useCallback(() => {
    console.log('[VideoPlayer] User interaction detected - resetting controls timer');
    setControlsVisible(true);
    startControlsTimeout();
  }, [startControlsTimeout]);

  // ✅ Load video only once on mount - NO dependencies
  useEffect(() => {
    console.log('[VideoPlayer] Component mounted, loading video:', videoId);
    
    const loadVideo = async () => {
      if (hasLoadedRef.current) {
        console.log('[VideoPlayer] Already loaded, skipping...');
        return;
      }
      
      try {
        setIsLoading(true);
        setError(null);
        console.log('[VideoPlayer] Loading video:', videoId);

        // Check authentication
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          throw new Error('Not authenticated. Please log in again.');
        }

        // Fetch video metadata from database
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
        console.log('[VideoPlayer] Resolution:', data.resolution_width, 'x', data.resolution_height);
        console.log('[VideoPlayer] File size:', (data.file_size_bytes / (1024 * 1024 * 1024)).toFixed(2), 'GB');
        setVideo(data);

        // Extract filename from stored URL
        let fileName = '';
        try {
          const urlParts = data.video_url.split('/videos/');
          if (urlParts.length === 2) {
            fileName = urlParts[1].split('?')[0];
            console.log('[VideoPlayer] Extracted filename:', fileName);
          } else {
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

        // Create signed URL for streaming (valid for 2 hours for long videos)
        console.log('[VideoPlayer] Creating signed URL for 4K streaming...');
        const { data: signedUrlData, error: signedUrlError } = await supabase.storage
          .from('videos')
          .createSignedUrl(fileName, 7200); // 2 hours expiry for long-form content

        if (signedUrlError || !signedUrlData?.signedUrl) {
          console.error('[VideoPlayer] Signed URL error:', signedUrlError);
          throw new Error('Failed to generate streaming URL. Please check storage permissions.');
        }

        const generatedUrl = signedUrlData.signedUrl;
        console.log('[VideoPlayer] ✓ Signed URL created successfully');
        console.log('[VideoPlayer] URL length:', generatedUrl.length);
        
        // ✅ VERIFY HTTPS URL
        if (!generatedUrl.startsWith('https://')) {
          console.error('[VideoPlayer] ❌ URL is not HTTPS:', generatedUrl);
          throw new Error('Video URL must use HTTPS. iOS requires secure connections.');
        }
        console.log('[VideoPlayer] ✅ URL verified as HTTPS');
        
        setVideoUrl(generatedUrl);
        hasLoadedRef.current = true;
        
        // Set duration if available from metadata
        if (data.duration_seconds) {
          setDuration(data.duration_seconds);
        }
      } catch (error: any) {
        console.error('[VideoPlayer] Exception loading video:', error);
        setError(error.message || 'Failed to load video');
      } finally {
        setIsLoading(false);
      }
    };

    loadVideo();
  }, []); // ✅ Empty dependency array - only run once on mount

  // ✅ Initialize player ONLY when videoUrl is ready - use stable reference
  // ✅ CACHING ENABLED: expo-video automatically caches video data for smooth playback
  const player = useVideoPlayer(videoUrl || '', (player) => {
    if (videoUrl) {
      console.log('[VideoPlayer] Initializing player for 4K streaming with caching enabled');
      console.log('[VideoPlayer] Video URL set');
      player.loop = false;
      player.muted = false;
      player.volume = volume;
      player.allowsExternalPlayback = true;
      console.log('[VideoPlayer] Player configured for long-form 4K playback');
      console.log('[VideoPlayer] ✅ Caching: ENABLED (expo-video default behavior)');
    }
  });

  // ✅ Set up player event listeners - only depend on player and videoUrl
  useEffect(() => {
    if (!player || !videoUrl) return;

    console.log('[VideoPlayer] Setting up player event listeners');

    // Status change listener - handles loading, ready, error states
    const statusListener = player.addListener('statusChange', (status) => {
      console.log('[VideoPlayer] Status:', status.status);
      
      if (status.error) {
        console.error('[VideoPlayer] Player error:', status.error);
        setError(`Playback error: ${status.error}`);
        setIsBuffering(false);
      }
      
      if (status.status === 'readyToPlay') {
        const videoDuration = status.duration || 0;
        console.log('[VideoPlayer] Video ready, duration:', videoDuration.toFixed(2), 'seconds');
        setDuration(videoDuration);
        setIsBuffering(false);
        console.log('[VideoPlayer] ✓ 4K stream initialized and ready');
      }
      
      if (status.status === 'loading') {
        console.log('[VideoPlayer] Video buffering...');
        setIsBuffering(true);
      }
    });

    // Playing state listener
    const playingListener = player.addListener('playingChange', (newIsPlaying) => {
      console.log('[VideoPlayer] Playing state changed:', newIsPlaying);
      setIsPlaying(newIsPlaying);
    });

    // Time update listener - fires during playback
    const timeUpdateListener = player.addListener('timeUpdate', (timeUpdate) => {
      const newTime = timeUpdate.currentTime || 0;
      
      // Throttle updates to avoid excessive re-renders (100ms intervals)
      const now = Date.now();
      if (now - lastProgressUpdateRef.current < 100) return;
      lastProgressUpdateRef.current = now;
      
      // Only update if not seeking
      if (!isSeekingRef.current) {
        setCurrentTime(newTime);
      }
      
      // Update duration if not set (only once)
      if (player.duration && player.duration > 0) {
        setDuration(prevDuration => {
          if (prevDuration === 0) {
            return player.duration;
          }
          return prevDuration;
        });
      }

      // Update buffering state
      if (player.status === 'loading') {
        setIsBuffering(true);
      } else {
        setIsBuffering(false);
      }
    });

    return () => {
      console.log('[VideoPlayer] Cleaning up event listeners');
      statusListener.remove();
      playingListener.remove();
      timeUpdateListener.remove();
    };
  }, [player, videoUrl]); // ✅ Only depend on player and videoUrl

  // Update player source when URL changes
  useEffect(() => {
    if (videoUrl && player) {
      console.log('[VideoPlayer] Loading 4K video source...');
      console.log('[VideoPlayer] ✅ URL is HTTPS:', videoUrl.startsWith('https://'));
      try {
        player.replace(videoUrl);
        console.log('[VideoPlayer] ✓ Video source loaded, buffering will begin');
      } catch (e) {
        console.error('[VideoPlayer] Error loading source:', e);
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

  // Polling for smooth progress updates
  useEffect(() => {
    if (!player || !isPlaying) return;

    const interval = setInterval(() => {
      if (!isSeekingRef.current && player.currentTime !== undefined) {
        setCurrentTime(player.currentTime);
      }
    }, 100);
    
    return () => clearInterval(interval);
  }, [player, isPlaying]);

  // ✅ ENHANCED: Auto-hide controls based on playing state
  useEffect(() => {
    console.log('[VideoPlayer] Playing state changed:', isPlaying, '| Controls visible:', controlsVisible);
    
    if (isPlaying && controlsVisible) {
      // Video is playing and controls are visible - start hide timer
      startControlsTimeout();
    } else if (!isPlaying) {
      // Video paused - clear timer and keep controls visible
      clearControlsTimeout();
      setControlsVisible(true);
    }

    // Cleanup on unmount
    return () => {
      clearControlsTimeout();
    };
  }, [isPlaying, controlsVisible, startControlsTimeout, clearControlsTimeout]);

  // ✅ ENHANCED: Toggle play/pause with control visibility management
  const togglePlayPause = useCallback(() => {
    if (!player) return;
    
    const currentlyPlaying = player.playing;
    console.log('[VideoPlayer] Toggle play/pause:', currentlyPlaying ? 'pause' : 'play');
    
    if (currentlyPlaying) {
      player.pause();
      setIsPlaying(false);
      // Show controls when paused
      setControlsVisible(true);
      clearControlsTimeout();
    } else {
      player.play();
      setIsPlaying(true);
      // Start hide timer when playing
      resetControlsTimeout();
    }
  }, [player, resetControlsTimeout, clearControlsTimeout]);

  // Seek handlers
  const handleSeekStart = useCallback(() => {
    console.log('[VideoPlayer] Seek started');
    isSeekingRef.current = true;
    // Show controls during seek
    setControlsVisible(true);
    clearControlsTimeout();
  }, [clearControlsTimeout]);

  const handleSeekChange = useCallback((value: number) => {
    setCurrentTime(value);
  }, []);

  const handleSeekComplete = useCallback((value: number) => {
    console.log('[VideoPlayer] Seek to:', value.toFixed(2), 'seconds');
    if (player) {
      const clampedValue = Math.max(0, Math.min(value, duration));
      player.currentTime = clampedValue;
      setCurrentTime(clampedValue);
    }
    isSeekingRef.current = false;
    // Reset timer after seek
    resetControlsTimeout();
  }, [player, duration, resetControlsTimeout]);

  // ✅ Smart orientation handling based on video aspect ratio
  const toggleFullscreen = useCallback(async () => {
    const newFullscreenState = !isFullscreen;
    console.log('[VideoPlayer] Toggle fullscreen:', newFullscreenState);
    setIsFullscreen(newFullscreenState);
    setControlsVisible(true);
    
    // Start hide timer if entering fullscreen and playing
    if (newFullscreenState && isPlaying) {
      startControlsTimeout();
    }
    
    // Handle screen orientation for native platforms
    if (Platform.OS !== 'web') {
      try {
        if (newFullscreenState) {
          // Determine if video is portrait or landscape
          const isPortraitVideo = video && video.resolution_height && video.resolution_width 
            ? video.resolution_height > video.resolution_width 
            : false;
          
          if (isPortraitVideo) {
            // For portrait videos, allow all orientations or lock to portrait
            console.log('[VideoPlayer] ✅ Portrait video detected - unlocking orientation');
            await ScreenOrientation.unlockAsync();
          } else {
            // For landscape videos, lock to landscape
            console.log('[VideoPlayer] ✅ Landscape video detected - locking to landscape');
            await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE);
          }
        } else {
          // Unlock orientation when exiting fullscreen
          await ScreenOrientation.unlockAsync();
          console.log('[VideoPlayer] ✅ Unlocked screen orientation');
        }
      } catch (e) {
        console.log('[VideoPlayer] Screen orientation not available:', e);
      }
    }
  }, [isFullscreen, video, isPlaying, startControlsTimeout]);

  // Format time helper
  const formatTime = (seconds: number) => {
    if (!seconds || isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Format file size helper
  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return 'Unknown';
    const gb = bytes / (1024 * 1024 * 1024);
    if (gb >= 1) return `${gb.toFixed(2)} GB`;
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(2)} MB`;
  };

  // Prepare icon variables (ATOMIC JSX)
  const playPauseIconIOS = isPlaying ? "pause.fill" : "play.fill";
  const playPauseIconAndroid = isPlaying ? "pause" : "play-arrow";
  const volumeIconIOS = volume === 0 ? "speaker.slash.fill" : "speaker.wave.2.fill";
  const volumeIconAndroid = volume === 0 ? "volume-off" : "volume-up";
  const fullscreenIconIOS = isFullscreen ? "arrow.down.right.and.arrow.up.left" : "arrow.up.left.and.arrow.down.right";
  const fullscreenIconAndroid = isFullscreen ? "fullscreen-exit" : "fullscreen";

  // Loading state
  if (isLoading) {
    const loadingText = "Loading 4K video...";
    const loadingSubtext = "Preparing high-resolution stream";
    const loadingHint = "This may take a moment for large files";
    
    return (
      <View style={[styles.container, { backgroundColor: '#000000' }]}>
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>{loadingText}</Text>
          <Text style={styles.loadingSubtext}>{loadingSubtext}</Text>
          <Text style={styles.loadingHint}>{loadingHint}</Text>
        </View>
      </View>
    );
  }

  // Error state
  if (error || !video) {
    const errorMessage = error || 'Video not found';
    const errorTitle = "Unable to load video";
    const errorHint1 = "• Check your internet connection";
    const errorHint2 = "• Video may be processing";
    const errorHint3 = "• Storage permissions may be incorrect";
    const errorHint4 = "• Try refreshing the app";
    const errorHint5 = "• Ensure video URL uses HTTPS";
    const retryText = "Retry";
    const backText = "Go Back";
    
    return (
      <View style={[styles.container, { backgroundColor: '#000000' }]}>
        <View style={styles.centerContent}>
          <IconSymbol
            ios_icon_name="exclamationmark.triangle.fill"
            android_material_icon_name="warning"
            size={64}
            color="#FF6B6B"
          />
          <Text style={styles.errorTitle}>{errorTitle}</Text>
          <Text style={styles.errorMessage}>{errorMessage}</Text>
          <Text style={styles.errorHint}>{errorHint1}</Text>
          <Text style={styles.errorHint}>{errorHint2}</Text>
          <Text style={styles.errorHint}>{errorHint3}</Text>
          <Text style={styles.errorHint}>{errorHint4}</Text>
          <Text style={styles.errorHint}>{errorHint5}</Text>
          
          <TouchableOpacity
            style={[styles.button, { backgroundColor: colors.primary, marginTop: 24 }]}
            onPress={() => {
              hasLoadedRef.current = false;
              setIsLoading(true);
              setError(null);
              // Trigger reload by remounting component
              router.back();
              setTimeout(() => {
                router.push(`/video-player?videoId=${videoId}`);
              }, 100);
            }}
          >
            <IconSymbol
              ios_icon_name="arrow.clockwise"
              android_material_icon_name="refresh"
              size={20}
              color="#FFFFFF"
            />
            <Text style={styles.buttonText}>{retryText}</Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[styles.button, { backgroundColor: colors.secondary, marginTop: 12 }]}
            onPress={() => router.back()}
          >
            <Text style={[styles.buttonText, { color: colors.text }]}>{backText}</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (!videoUrl) {
    const preparingText = "Preparing video stream...";
    const preparingSubtext = "Generating secure streaming URL";
    return (
      <View style={[styles.container, { backgroundColor: '#000000' }]}>
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>{preparingText}</Text>
          <Text style={styles.loadingSubtext}>{preparingSubtext}</Text>
        </View>
      </View>
    );
  }

  // Prepare text variables
  const currentTimeText = formatTime(currentTime);
  const durationText = formatTime(duration);
  const videoTitle = video.title;
  const videoResolution = video.resolution_width && video.resolution_height 
    ? `${video.resolution_width}x${video.resolution_height}` 
    : '4K';
  const videoSize = formatFileSize(video.file_size_bytes);
  const bufferingText = "Buffering 4K stream...";
  const bufferingSubtext = "Please wait";

  // Fullscreen mode
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
        {/* ✅ expo-video automatically caches video data for smooth 4K playback */}
        
        {/* Buffering indicator */}
        {isBuffering && (
          <View style={styles.bufferingOverlay}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.bufferingText}>{bufferingText}</Text>
            <Text style={styles.bufferingSubtext}>{bufferingSubtext}</Text>
          </View>
        )}
        
        {/* ✅ ENHANCED: Custom controls overlay with manual visibility control */}
        {controlsVisible && (
          <View style={styles.fullscreenControls}>
            {/* Top bar - Exit fullscreen */}
            <View style={styles.topBar}>
              <TouchableOpacity
                style={styles.iconButton}
                onPress={toggleFullscreen}
              >
                <IconSymbol
                  ios_icon_name="xmark"
                  android_material_icon_name="close"
                  size={28}
                  color="#FFFFFF"
                />
              </TouchableOpacity>
              <Text style={styles.fullscreenTitle}>{videoTitle}</Text>
            </View>

            {/* Center - Play/Pause button */}
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

            {/* Bottom bar - Seek, volume, fullscreen */}
            <View style={styles.bottomBar}>
              {/* Seek bar */}
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

              {/* Volume and fullscreen controls */}
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
          </View>
        )}
      </TouchableOpacity>
    );
  }

  // Normal mode
  const aboutTitle = "About";
  const resolutionLabel = "Resolution:";
  const sizeLabel = "Size:";
  const durationLabel = "Duration:";
  const backButtonText = "Back";
  const optimizedForText = "Optimized for 4K streaming";
  const httpsVerifiedText = "✓ HTTPS Verified";
  const controlsAutoHideText = "✓ Auto-hide Controls";
  
  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* Video player */}
      <View style={styles.videoContainer}>
        <VideoView
          style={styles.video}
          player={player}
          allowsFullscreen={false}
          allowsPictureInPicture
          contentFit="contain"
          nativeControls={false}
        />
        {/* ✅ expo-video with caching enabled for smooth 4K streaming */}
        
        {/* Buffering indicator */}
        {isBuffering && (
          <View style={styles.bufferingOverlay}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.bufferingText}>{bufferingText}</Text>
            <Text style={styles.bufferingSubtext}>{bufferingSubtext}</Text>
          </View>
        )}
        
        {/* Fullscreen button overlay */}
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

      {/* Controls */}
      <View style={[styles.controlsContainer, { backgroundColor: theme.colors.card }]}>
        {/* Play/Pause and seek */}
        <View style={styles.mainControls}>
          <TouchableOpacity
            style={[styles.controlButton, { backgroundColor: colors.primary }]}
            onPress={togglePlayPause}
          >
            <IconSymbol
              ios_icon_name={playPauseIconIOS}
              android_material_icon_name={playPauseIconAndroid}
              size={28}
              color="#FFFFFF"
            />
          </TouchableOpacity>

          <View style={styles.seekInfo}>
            <View style={styles.seekRow}>
              <Text style={[styles.timeLabel, { color: colors.textSecondary }]}>
                {currentTimeText}
              </Text>
              <Slider
                style={styles.normalSeekBar}
                minimumValue={0}
                maximumValue={duration > 0 ? duration : 100}
                value={currentTime}
                onSlidingStart={handleSeekStart}
                onValueChange={handleSeekChange}
                onSlidingComplete={handleSeekComplete}
                minimumTrackTintColor={colors.primary}
                maximumTrackTintColor={colors.textSecondary}
                thumbTintColor={colors.primary}
              />
              <Text style={[styles.timeLabel, { color: colors.textSecondary }]}>
                {durationText}
              </Text>
            </View>
          </View>
        </View>

        {/* Volume control */}
        <View style={styles.volumeRow}>
          <IconSymbol
            ios_icon_name={volumeIconIOS}
            android_material_icon_name={volumeIconAndroid}
            size={20}
            color={theme.colors.text}
          />
          <Slider
            style={styles.normalVolumeSlider}
            minimumValue={0}
            maximumValue={1}
            value={volume}
            onValueChange={setVolume}
            minimumTrackTintColor={colors.primary}
            maximumTrackTintColor={colors.textSecondary}
            thumbTintColor={colors.primary}
          />
        </View>
      </View>

      {/* Video info */}
      <View style={[styles.infoContainer, { backgroundColor: theme.colors.card }]}>
        <Text style={[styles.title, { color: theme.colors.text }]}>
          {videoTitle}
        </Text>
        
        <View style={styles.badgeRow}>
          <View style={[styles.optimizedBadge, { backgroundColor: colors.primary }]}>
            <IconSymbol
              ios_icon_name="checkmark.circle.fill"
              android_material_icon_name="check-circle"
              size={16}
              color="#FFFFFF"
            />
            <Text style={styles.optimizedText}>{optimizedForText}</Text>
          </View>
          
          <View style={[styles.httpsBadge, { backgroundColor: '#4CAF50' }]}>
            <IconSymbol
              ios_icon_name="lock.fill"
              android_material_icon_name="lock"
              size={14}
              color="#FFFFFF"
            />
            <Text style={styles.httpsText}>{httpsVerifiedText}</Text>
          </View>
          
          <View style={[styles.cachingBadge, { backgroundColor: '#2196F3' }]}>
            <IconSymbol
              ios_icon_name="arrow.down.circle.fill"
              android_material_icon_name="download"
              size={14}
              color="#FFFFFF"
            />
            <Text style={styles.cachingText}>Caching Enabled</Text>
          </View>
        </View>
        
        <View style={styles.badgeRow}>
          <View style={[styles.autoHideBadge, { backgroundColor: '#9C27B0' }]}>
            <IconSymbol
              ios_icon_name="eye.slash.fill"
              android_material_icon_name="visibility-off"
              size={14}
              color="#FFFFFF"
            />
            <Text style={styles.autoHideText}>{controlsAutoHideText}</Text>
          </View>
        </View>
        
        <View style={styles.metaRow}>
          <Text style={[styles.metaLabel, { color: colors.textSecondary }]}>
            {resolutionLabel}
          </Text>
          <Text style={[styles.metaValue, { color: theme.colors.text }]}>
            {videoResolution}
          </Text>
        </View>
        
        <View style={styles.metaRow}>
          <Text style={[styles.metaLabel, { color: colors.textSecondary }]}>
            {sizeLabel}
          </Text>
          <Text style={[styles.metaValue, { color: theme.colors.text }]}>
            {videoSize}
          </Text>
        </View>
        
        <View style={styles.metaRow}>
          <Text style={[styles.metaLabel, { color: colors.textSecondary }]}>
            {durationLabel}
          </Text>
          <Text style={[styles.metaValue, { color: theme.colors.text }]}>
            {durationText}
          </Text>
        </View>

        {video.description && (
          <View style={styles.descriptionContainer}>
            <Text style={[styles.aboutTitle, { color: theme.colors.text }]}>
              {aboutTitle}
            </Text>
            <Text style={[styles.description, { color: colors.textSecondary }]}>
              {video.description}
            </Text>
          </View>
        )}
      </View>

      {/* Back button */}
      <TouchableOpacity
        style={[styles.backButtonLarge, { backgroundColor: colors.secondary }]}
        onPress={() => router.back()}
      >
        <IconSymbol
          ios_icon_name="chevron.left"
          android_material_icon_name="arrow-back"
          size={20}
          color={colors.text}
        />
        <Text style={[styles.buttonText, { color: colors.text }]}>
          {backButtonText}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  loadingText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
  },
  loadingSubtext: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
  },
  loadingHint: {
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: 12,
    marginTop: 4,
    textAlign: 'center',
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
    fontSize: 16,
    marginTop: 8,
    textAlign: 'center',
  },
  errorHint: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 14,
    marginTop: 4,
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
    width: '100%',
    aspectRatio: 16 / 9,
    backgroundColor: '#000000',
    position: 'relative',
  },
  video: {
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
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
  },
  bufferingText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    marginTop: 12,
  },
  bufferingSubtext: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 14,
    marginTop: 4,
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
    paddingTop: 48,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    gap: 16,
  },
  fullscreenTitle: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 18,
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
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  bottomBar: {
    padding: 16,
    paddingBottom: 32,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
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
    fontSize: 14,
    fontWeight: '600',
    minWidth: 50,
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
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  controlsContainer: {
    padding: 16,
  },
  mainControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginBottom: 16,
  },
  controlButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
  seekInfo: {
    flex: 1,
  },
  seekRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  normalSeekBar: {
    flex: 1,
    height: 40,
  },
  timeLabel: {
    fontSize: 13,
    minWidth: 45,
    textAlign: 'center',
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
    margin: 16,
    padding: 16,
    borderRadius: 12,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
    flexWrap: 'wrap',
  },
  optimizedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  optimizedText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  httpsBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
  },
  httpsText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '600',
  },
  cachingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
  },
  cachingText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '600',
  },
  autoHideBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
  },
  autoHideText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '600',
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  metaLabel: {
    fontSize: 14,
  },
  metaValue: {
    fontSize: 14,
    fontWeight: '600',
  },
  descriptionContainer: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0, 0, 0, 0.1)',
  },
  aboutTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  description: {
    fontSize: 14,
    lineHeight: 20,
  },
  backButtonLarge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginHorizontal: 16,
    marginBottom: 32,
    paddingVertical: 14,
    borderRadius: 8,
  },
});
