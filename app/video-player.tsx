
import React, { useState, useEffect, useCallback, useRef } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, Alert, Platform } from "react-native";
import { useTheme } from "@react-navigation/native";
import { useLocalSearchParams, router } from "expo-router";
import { VideoView, useVideoPlayer, VideoAirPlayButton } from "expo-video";
import { colors } from "@/styles/commonStyles";
import { IconSymbol } from "@/components/IconSymbol";
import { supabase } from "@/app/integrations/supabase/client";
import { Video } from "@/hooks/useVideos";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Slider from '@react-native-community/slider';

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
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1.0);
  const [showControls, setShowControls] = useState(true);
  const [controlsTimeout, setControlsTimeout] = useState<NodeJS.Timeout | null>(null);
  
  // Use ref to track if we're currently seeking to avoid state update conflicts
  const isSeekingRef = useRef(false);
  // Use ref to store the latest current time for smoother updates
  const currentTimeRef = useRef(0);

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
      player.loop = true; // Enable looping so users can play as much as they'd like
      player.muted = false;
      player.volume = volume;
      player.allowsExternalPlayback = true; // Enable AirPlay
      
      // Add status change listener
      player.addListener('statusChange', (status) => {
        console.log('[VideoPlayer] Status changed:', status);
        
        if (status.error) {
          console.error('[VideoPlayer] Player error:', status.error);
          setError(`Playback error: ${status.error}`);
        }
        
        if (status.status === 'readyToPlay') {
          const videoDuration = status.duration || 0;
          console.log('[VideoPlayer] Video ready to play, duration:', videoDuration);
          setDuration(videoDuration);
          
          // Also get duration directly from player as backup
          if (player.duration && player.duration > 0) {
            console.log('[VideoPlayer] Player duration:', player.duration);
            setDuration(player.duration);
          }
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

      // Add time update listener - this fires frequently during playback
      player.addListener('timeUpdate', (timeUpdate) => {
        const newTime = timeUpdate.currentTime || 0;
        
        // Always update the ref for the latest time
        currentTimeRef.current = newTime;
        
        // Only update state if we're not currently seeking
        // This prevents the slider from jumping while the user is dragging it
        if (!isSeekingRef.current) {
          setCurrentTime(newTime);
        }
        
        // Update duration if we have it and it's not set yet
        if (duration === 0 && player.duration && player.duration > 0) {
          console.log('[VideoPlayer] Setting duration from player:', player.duration);
          setDuration(player.duration);
        }
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
        
        // Wait a bit for the video to load, then get duration
        setTimeout(() => {
          if (player.duration && player.duration > 0) {
            console.log('[VideoPlayer] Duration from player after load:', player.duration);
            setDuration(player.duration);
          }
        }, 500);
        
        // DO NOT auto-play - user must press play button
        console.log('[VideoPlayer] Video ready - waiting for user to press play');
      } catch (e) {
        console.error('[VideoPlayer] Error updating player source:', e);
        setError('Failed to load video source');
      }
    }
  }, [videoUrl, player]);

  // Update player volume when volume state changes
  useEffect(() => {
    if (player) {
      player.volume = volume;
    }
  }, [volume, player]);

  // Periodically check for duration if not set
  useEffect(() => {
    if (player && duration === 0) {
      const interval = setInterval(() => {
        if (player.duration && player.duration > 0) {
          console.log('[VideoPlayer] Duration check - setting from player:', player.duration);
          setDuration(player.duration);
        }
      }, 1000);
      
      return () => clearInterval(interval);
    }
  }, [player, duration]);

  const toggleFullscreen = useCallback(() => {
    setIsFullscreen(!isFullscreen);
    setShowControls(true);
    console.log('[VideoPlayer] Fullscreen toggled:', !isFullscreen);
  }, [isFullscreen]);

  const togglePlayPause = useCallback(() => {
    if (isPlaying) {
      player.pause();
      console.log('[VideoPlayer] Paused at:', player.currentTime);
    } else {
      player.play();
      console.log('[VideoPlayer] Playing from:', player.currentTime);
    }
  }, [isPlaying, player]);

  const handleSeekStart = useCallback(() => {
    console.log('[VideoPlayer] User started seeking from:', currentTime);
    isSeekingRef.current = true;
    // Pause during seeking for smoother experience
    if (isPlaying) {
      player.pause();
    }
  }, [currentTime, isPlaying, player]);

  const handleSeekChange = useCallback((value: number) => {
    // Update the displayed time immediately as user drags
    setCurrentTime(value);
  }, []);

  const handleSeekComplete = useCallback((value: number) => {
    console.log('[VideoPlayer] User released seek slider at:', value, 'seconds');
    console.log('[VideoPlayer] Video duration:', duration);
    
    if (player) {
      // Ensure the seek value is within bounds
      const clampedValue = Math.max(0, Math.min(value, duration));
      console.log('[VideoPlayer] Clamped seek value:', clampedValue);
      
      // Seek to the position
      player.currentTime = clampedValue;
      console.log('[VideoPlayer] Set player.currentTime to:', clampedValue);
      
      // Update both state and ref
      setCurrentTime(clampedValue);
      currentTimeRef.current = clampedValue;
      
      // Clear the seeking flag immediately so timeUpdate can resume updating
      isSeekingRef.current = false;
      
      // Resume playback if it was playing before
      if (isPlaying) {
        console.log('[VideoPlayer] Resuming playback after seek');
        player.play();
      }
    }
  }, [player, duration, isPlaying]);

  const formatTime = (seconds: number) => {
    if (!seconds || isNaN(seconds)) {
      return '0:00';
    }
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Auto-hide controls in fullscreen after 3 seconds of inactivity
  const resetControlsTimeout = useCallback(() => {
    if (controlsTimeout) {
      clearTimeout(controlsTimeout);
    }
    setShowControls(true);
    if (isFullscreen && isPlaying) {
      const timeout = setTimeout(() => {
        setShowControls(false);
      }, 3000);
      setControlsTimeout(timeout);
    }
  }, [controlsTimeout, isFullscreen, isPlaying]);

  useEffect(() => {
    if (isFullscreen) {
      resetControlsTimeout();
    }
    return () => {
      if (controlsTimeout) {
        clearTimeout(controlsTimeout);
      }
    };
  }, [isFullscreen, isPlaying]);

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
      <TouchableOpacity 
        style={[styles.fullscreenContainer, { backgroundColor: '#000000' }]}
        activeOpacity={1}
        onPress={resetControlsTimeout}
      >
        <VideoView
          style={styles.fullscreenVideo}
          player={player}
          allowsFullscreen={false}
          allowsPictureInPicture
          contentFit="contain"
          nativeControls={false}
        />
        
        {/* Custom controls overlay - visible when showControls is true */}
        {showControls && (
          <View style={[styles.fullscreenControlsContainer, { paddingBottom: insets.bottom + 20, paddingTop: insets.top + 20 }]}>
            {/* Top controls - Exit fullscreen */}
            <View style={styles.topControls}>
              <TouchableOpacity
                style={[styles.controlIconButton, { backgroundColor: 'rgba(0, 0, 0, 0.7)' }]}
                onPress={toggleFullscreen}
                activeOpacity={0.8}
              >
                <IconSymbol
                  ios_icon_name="xmark"
                  android_material_icon_name="close"
                  size={24}
                  color="#FFFFFF"
                />
              </TouchableOpacity>
            </View>

            {/* Bottom controls - Play/Pause, Scrubbing, volume, AirPlay */}
            <View style={styles.bottomControls}>
              {/* Play/Pause button and scrubbing bar */}
              <View style={styles.playbackControlsRow}>
                {/* Play/Pause button */}
                <TouchableOpacity
                  style={[styles.playPauseButtonSmall, { backgroundColor: 'rgba(0, 0, 0, 0.7)' }]}
                  onPress={togglePlayPause}
                  activeOpacity={0.8}
                >
                  <IconSymbol
                    ios_icon_name={isPlaying ? "pause.fill" : "play.fill"}
                    android_material_icon_name={isPlaying ? "pause" : "play_arrow"}
                    size={24}
                    color="#FFFFFF"
                  />
                </TouchableOpacity>

                {/* Time and scrubbing bar */}
                <View style={styles.scrubberContainer}>
                  <Text style={styles.timeText}>{formatTime(currentTime)}</Text>
                  <Slider
                    style={styles.scrubber}
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
                  <Text style={styles.timeText}>{formatTime(duration)}</Text>
                </View>
              </View>

              {/* Volume and other controls */}
              <View style={styles.bottomControlsRow}>
                {/* Volume control */}
                <View style={styles.volumeContainer}>
                  <IconSymbol
                    ios_icon_name={volume === 0 ? "speaker.slash.fill" : "speaker.wave.2.fill"}
                    android_material_icon_name={volume === 0 ? "volume_off" : "volume_up"}
                    size={20}
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

                {/* AirPlay and fullscreen buttons */}
                <View style={styles.rightControls}>
                  {Platform.OS === 'ios' && (
                    <View style={styles.airplayButtonContainer}>
                      <VideoAirPlayButton
                        style={styles.airplayButton}
                        tint="#FFFFFF"
                        activeTint={colors.primary}
                      />
                    </View>
                  )}
                  
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
          </View>
        )}
      </TouchableOpacity>
    );
  }

  // Normal mode - video with info below
  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <ScrollView 
        style={styles.scrollContainer}
        contentContainerStyle={styles.scrollContent}
      >
        <View style={styles.videoWrapper}>
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
              onPress={togglePlayPause}
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
                console.log('[VideoPlayer] User tapped restart button');
                player.currentTime = 0; // Seek to beginning
                player.play();
                console.log('[VideoPlayer] Video restarted from beginning');
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

          {/* Scrubbing bar in normal mode */}
          <View style={styles.normalScrubberContainer}>
            <Text style={[styles.normalTimeText, { color: colors.textSecondary }]}>
              {formatTime(currentTime)}
            </Text>
            <Slider
              style={styles.normalScrubber}
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
            <Text style={[styles.normalTimeText, { color: colors.textSecondary }]}>
              {formatTime(duration)}
            </Text>
          </View>
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
          {duration > 0 && (
            <Text style={[styles.videoDuration, { color: colors.textSecondary }]}>
              Actual Duration: {formatTime(duration)}
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
            <Text style={[styles.debugText, { color: colors.textSecondary }]}>
              Duration: {duration}s ({formatTime(duration)})
            </Text>
            <Text style={[styles.debugText, { color: colors.textSecondary }]}>
              Current Time: {currentTime}s ({formatTime(currentTime)})
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
  videoWrapper: {
    width: '100%',
    backgroundColor: '#000000',
  },
  videoContainer: {
    width: '100%',
    aspectRatio: 9 / 16, // Portrait aspect ratio for vertical videos
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
  fullscreenControlsContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'space-between',
    zIndex: 10,
  },
  topControls: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    paddingHorizontal: 16,
  },
  bottomControls: {
    paddingHorizontal: 16,
  },
  playbackControlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  playPauseButtonSmall: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrubberContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  scrubber: {
    flex: 1,
    height: 40,
  },
  timeText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    minWidth: 45,
    textAlign: 'center',
  },
  bottomControlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  volumeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
    maxWidth: 200,
  },
  volumeSlider: {
    flex: 1,
    height: 40,
  },
  rightControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
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
    backgroundColor: '#000000',
  },
  controlButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
  normalScrubberContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#000000',
  },
  normalScrubber: {
    flex: 1,
    height: 40,
  },
  normalTimeText: {
    fontSize: 12,
    minWidth: 40,
    textAlign: 'center',
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
    marginTop: 16,
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
