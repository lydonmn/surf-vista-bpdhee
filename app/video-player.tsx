
import React, { useState, useEffect, useCallback, useRef } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Dimensions, Platform, ScrollView } from "react-native";
import { useTheme } from "@react-navigation/native";
import { useLocalSearchParams, router } from "expo-router";
import { VideoView, useVideoPlayer } from "expo-video";
import { colors } from "@/styles/commonStyles";
import { IconSymbol } from "@/components/IconSymbol";
import { supabase } from "@/app/integrations/supabase/client";
import Slider from '@react-native-community/slider';
import * as ScreenOrientation from 'expo-screen-orientation';
import * as Haptics from 'expo-haptics';

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

const CONTROLS_HIDE_DELAY = 3000;

export default function VideoPlayerScreen() {
  const theme = useTheme();
  const { videoId } = useLocalSearchParams();
  
  const [video, setVideo] = useState<Video | null>(null);
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
  const lastProgressUpdateRef = useRef(0);
  const hasLoadedRef = useRef(false);
  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const clearControlsTimeout = useCallback(() => {
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
      controlsTimeoutRef.current = null;
    }
  }, []);

  const startControlsTimeout = useCallback(() => {
    clearControlsTimeout();
    
    if (isPlaying) {
      console.log('[VideoPlayer] Starting controls hide timer');
      controlsTimeoutRef.current = setTimeout(() => {
        console.log('[VideoPlayer] Hiding controls after inactivity');
        setControlsVisible(false);
      }, CONTROLS_HIDE_DELAY);
    }
  }, [isPlaying, clearControlsTimeout]);

  const toggleControls = useCallback(() => {
    console.log('[VideoPlayer] User toggled controls');
    const newVisibility = !controlsVisible;
    setControlsVisible(newVisibility);
    
    if (newVisibility) {
      startControlsTimeout();
    } else {
      clearControlsTimeout();
    }
  }, [controlsVisible, startControlsTimeout, clearControlsTimeout]);

  const resetControlsTimeout = useCallback(() => {
    console.log('[VideoPlayer] User interaction - resetting timer');
    setControlsVisible(true);
    startControlsTimeout();
  }, [startControlsTimeout]);

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

        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          throw new Error('Not authenticated. Please log in again.');
        }

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
        setVideo(data);

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
          console.error('[VideoPlayer] Error parsing URL:', e);
          throw new Error('Invalid video URL format');
        }

        if (!fileName) {
          throw new Error('Could not extract filename from video URL');
        }

        console.log('[VideoPlayer] Creating signed URL...');
        const { data: signedUrlData, error: signedUrlError } = await supabase.storage
          .from('videos')
          .createSignedUrl(fileName, 7200);

        if (signedUrlError || !signedUrlData?.signedUrl) {
          console.error('[VideoPlayer] Signed URL error:', signedUrlError);
          throw new Error('Failed to generate streaming URL');
        }

        const generatedUrl = signedUrlData.signedUrl;
        console.log('[VideoPlayer] ✓ Signed URL created');
        
        if (!generatedUrl.startsWith('https://')) {
          console.error('[VideoPlayer] ❌ URL is not HTTPS');
          throw new Error('Video URL must use HTTPS');
        }
        
        setVideoUrl(generatedUrl);
        hasLoadedRef.current = true;
        
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
  }, []);

  const player = useVideoPlayer(videoUrl || '', (player) => {
    if (videoUrl) {
      console.log('[VideoPlayer] Initializing player with caching enabled');
      player.loop = false;
      player.muted = false;
      player.volume = volume;
      player.allowsExternalPlayback = true;
    }
  });

  useEffect(() => {
    if (!player || !videoUrl) return;

    console.log('[VideoPlayer] Setting up player event listeners');

    const statusListener = player.addListener('statusChange', (status) => {
      console.log('[VideoPlayer] Status:', status.status);
      
      if (status.error) {
        console.error('[VideoPlayer] Player error:', status.error);
        setError(`Playback error: ${status.error}`);
        setIsBuffering(false);
      }
      
      if (status.status === 'readyToPlay') {
        const videoDuration = status.duration || 0;
        console.log('[VideoPlayer] Video ready, duration:', videoDuration.toFixed(2));
        setDuration(videoDuration);
        setIsBuffering(false);
      }
      
      if (status.status === 'loading') {
        console.log('[VideoPlayer] Video buffering...');
        setIsBuffering(true);
      }
    });

    const playingListener = player.addListener('playingChange', (newIsPlaying) => {
      console.log('[VideoPlayer] Playing state changed:', newIsPlaying);
      setIsPlaying(newIsPlaying);
    });

    const timeUpdateListener = player.addListener('timeUpdate', (timeUpdate) => {
      const newTime = timeUpdate.currentTime || 0;
      
      const now = Date.now();
      if (now - lastProgressUpdateRef.current < 100) return;
      lastProgressUpdateRef.current = now;
      
      if (!isSeekingRef.current) {
        setCurrentTime(newTime);
      }
      
      if (player.duration && player.duration > 0) {
        setDuration(prevDuration => {
          if (prevDuration === 0) {
            return player.duration;
          }
          return prevDuration;
        });
      }

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
  }, [player, videoUrl]);

  useEffect(() => {
    if (videoUrl && player) {
      console.log('[VideoPlayer] Loading video source...');
      try {
        player.replace(videoUrl);
      } catch (e) {
        console.error('[VideoPlayer] Error loading source:', e);
        setError('Failed to load video source');
      }
    }
  }, [videoUrl, player]);

  useEffect(() => {
    if (player) {
      player.volume = volume;
    }
  }, [volume, player]);

  useEffect(() => {
    if (!player || !isPlaying) return;

    const interval = setInterval(() => {
      if (!isSeekingRef.current && player.currentTime !== undefined) {
        setCurrentTime(player.currentTime);
      }
    }, 100);
    
    return () => clearInterval(interval);
  }, [player, isPlaying]);

  useEffect(() => {
    console.log('[VideoPlayer] Playing state changed:', isPlaying);
    
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

  const togglePlayPause = useCallback(() => {
    if (!player) return;
    
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    
    const currentlyPlaying = player.playing;
    console.log('[VideoPlayer] Toggle play/pause:', currentlyPlaying ? 'pause' : 'play');
    
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
    console.log('[VideoPlayer] Seek started');
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
    console.log('[VideoPlayer] Seek to:', value.toFixed(2));
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
    console.log('[VideoPlayer] Toggle fullscreen:', newFullscreenState);
    setIsFullscreen(newFullscreenState);
    setControlsVisible(true);
    
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    
    if (newFullscreenState && isPlaying) {
      startControlsTimeout();
    }
    
    if (Platform.OS !== 'web') {
      try {
        if (newFullscreenState) {
          const isPortraitVideo = video && video.resolution_height && video.resolution_width 
            ? video.resolution_height > video.resolution_width 
            : false;
          
          if (isPortraitVideo) {
            console.log('[VideoPlayer] Portrait video - unlocking orientation');
            await ScreenOrientation.unlockAsync();
          } else {
            console.log('[VideoPlayer] Landscape video - locking to landscape');
            await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE);
          }
        } else {
          await ScreenOrientation.unlockAsync();
        }
      } catch (e) {
        console.log('[VideoPlayer] Screen orientation not available:', e);
      }
    }
  }, [isFullscreen, video, isPlaying, startControlsTimeout]);

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

  const playPauseIconIOS = isPlaying ? "pause.fill" : "play.fill";
  const playPauseIconAndroid = isPlaying ? "pause" : "play-arrow";
  const volumeIconIOS = volume === 0 ? "speaker.slash.fill" : "speaker.wave.2.fill";
  const volumeIconAndroid = volume === 0 ? "volume-off" : "volume-up";
  const fullscreenIconIOS = isFullscreen ? "arrow.down.right.and.arrow.up.left" : "arrow.up.left.and.arrow.down.right";
  const fullscreenIconAndroid = isFullscreen ? "fullscreen-exit" : "fullscreen";

  if (isLoading) {
    const loadingText = "Loading video...";
    
    return (
      <View style={[styles.container, { backgroundColor: '#000000' }]}>
        <TouchableOpacity
          style={styles.headerBackButton}
          onPress={() => router.back()}
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

  if (error || !video) {
    const errorMessage = error || 'Video not found';
    const errorTitle = "Unable to load video";
    const retryText = "Retry";
    const backText = "Go Back";
    
    return (
      <View style={[styles.container, { backgroundColor: '#000000' }]}>
        <TouchableOpacity
          style={styles.headerBackButton}
          onPress={() => router.back()}
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
            onPress={() => {
              hasLoadedRef.current = false;
              setIsLoading(true);
              setError(null);
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
    const preparingText = "Preparing video...";
    return (
      <View style={[styles.container, { backgroundColor: '#000000' }]}>
        <TouchableOpacity
          style={styles.headerBackButton}
          onPress={() => router.back()}
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
          <Text style={styles.loadingText}>{preparingText}</Text>
        </View>
      </View>
    );
  }

  const currentTimeText = formatTime(currentTime);
  const durationText = formatTime(duration);
  const videoTitle = video.title;
  const videoDescription = video.description;
  const videoResolution = video.resolution_width && video.resolution_height 
    ? `${video.resolution_width}x${video.resolution_height}` 
    : '4K';
  const videoSize = formatFileSize(video.file_size_bytes);
  const bufferingText = "Buffering...";

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
            <Text style={styles.bufferingText}>{bufferingText}</Text>
          </View>
        )}
        
        {controlsVisible && (
          <View style={styles.fullscreenControls}>
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

  const backButtonText = "Back";
  const optimizedText = "4K Streaming";
  const httpsText = "Secure";
  const resolutionLabel = "Resolution";
  const sizeLabel = "File Size";
  const durationLabel = "Duration";
  
  return (
    <View style={[styles.container, { backgroundColor: '#000000' }]}>
      <TouchableOpacity
        style={styles.headerBackButton}
        onPress={() => router.back()}
      >
        <IconSymbol
          ios_icon_name="chevron.left"
          android_material_icon_name="arrow-back"
          size={24}
          color="#FFFFFF"
        />
        <Text style={styles.headerBackText}>{backButtonText}</Text>
      </TouchableOpacity>

      <ScrollView style={styles.scrollContainer} contentContainerStyle={styles.scrollContent}>
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
              <Text style={styles.bufferingText}>{bufferingText}</Text>
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
          <Text style={styles.title}>{videoTitle}</Text>
          
          {videoDescription && (
            <Text style={styles.description}>{videoDescription}</Text>
          )}
          
          <View style={styles.badgeRow}>
            <View style={styles.badge}>
              <IconSymbol
                ios_icon_name="checkmark.circle.fill"
                android_material_icon_name="check-circle"
                size={14}
                color={colors.primary}
              />
              <Text style={styles.badgeText}>{optimizedText}</Text>
            </View>
            
            <View style={styles.badge}>
              <IconSymbol
                ios_icon_name="lock.fill"
                android_material_icon_name="lock"
                size={14}
                color="#4CAF50"
              />
              <Text style={styles.badgeText}>{httpsText}</Text>
            </View>
          </View>
          
          <View style={styles.metadataContainer}>
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>{resolutionLabel}</Text>
              <Text style={styles.metaValue}>{videoResolution}</Text>
            </View>
            
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>{sizeLabel}</Text>
              <Text style={styles.metaValue}>{videoSize}</Text>
            </View>
            
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>{durationLabel}</Text>
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
    paddingTop: Platform.OS === 'android' ? 48 : 12,
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
    width: '100%',
    aspectRatio: 9 / 16,
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
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  bufferingText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '500',
    marginTop: 12,
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
