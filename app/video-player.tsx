
import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Platform, ScrollView } from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { colors } from "@/styles/commonStyles";
import { IconSymbol } from "@/components/IconSymbol";
import { supabase } from "@/integrations/supabase/client";
import Slider from '@react-native-community/slider';
import * as ScreenOrientation from 'expo-screen-orientation';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { VideoView, useVideoPlayer } from "expo-video";
import { useAuth } from "@/contexts/AuthContext";
import { openPaywall } from "@/utils/paywallHelper";
import { trackVideoWatch } from "@/utils/usageTracking";

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
const MUX_HLS_PREFIX = 'https://stream.mux.com/';

export default function VideoPlayerScreen() {
  const insets = useSafeAreaInsets();
  const { videoId, preloadedUrl } = useLocalSearchParams();
  const { user, checkSubscription } = useAuth();
  const isSubscribed = checkSubscription();

  // Paywall guard — redirect non-subscribers immediately
  useEffect(() => {
    if (!isSubscribed) {
      console.log('[VideoPlayer] Non-subscriber attempted to access video player — opening paywall');
      openPaywall(user?.id, user?.email || undefined).then(() => {
        router.back();
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  
  const [video, setVideo] = useState<Video | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1.0);
  const [isBuffering, setIsBuffering] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const maxRetries = 3;
  
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(true);
  
  const isSeekingRef = useRef(false);
  const lastProgressUpdateRef = useRef(0);
  const hasLoadedRef = useRef(false);
  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const bufferingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastPlaybackActivityRef = useRef<number>(Date.now());
  const connectionRefreshTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isMountedRef = useRef(true);
  // Usage tracking: record when playback starts so we can compute watch duration
  const playbackStartTimeRef = useRef<number | null>(null);
  // Prevent double-counting if both onEnd and unmount fire
  const videoWatchTrackedRef = useRef(false);
  // Keep a ref to the video title so it's accessible in cleanup/listener closures
  const videoTitleRef = useRef<string | undefined>(undefined);

  const videoOrientation = useMemo(() => {
    if (!video?.resolution_width || !video?.resolution_height) {
      return 'portrait';
    }
    
    const isPortrait = video.resolution_height > video.resolution_width;
    return isPortrait ? 'portrait' : 'landscape';
  }, [video]);

  // 🚨 CRITICAL FIX: Safe cleanup on unmount
  useEffect(() => {
    isMountedRef.current = true;
    
    return () => {
      console.log('[VideoPlayer] Component unmounting - cleaning up');
      isMountedRef.current = false;
      
      // Track video watch on unmount if playback started and not already tracked
      if (playbackStartTimeRef.current !== null && !videoWatchTrackedRef.current) {
        const watchedSeconds = Math.round((Date.now() - playbackStartTimeRef.current) / 1000);
        if (watchedSeconds >= 5) {
          console.log('[VideoPlayer] Tracking video_watch on unmount — duration_seconds:', watchedSeconds, 'title:', videoTitleRef.current);
          videoWatchTrackedRef.current = true;
          trackVideoWatch(user?.id, String(videoId ?? ''), videoTitleRef.current, watchedSeconds).catch(() => {});
        } else {
          console.log('[VideoPlayer] Skipping video_watch on unmount — watched only', watchedSeconds, 'seconds (< 5s threshold)');
        }
        playbackStartTimeRef.current = null;
      }
      
      // Clear all timeouts
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current);
        controlsTimeoutRef.current = null;
      }
      if (bufferingTimeoutRef.current) {
        clearTimeout(bufferingTimeoutRef.current);
        bufferingTimeoutRef.current = null;
      }
      if (connectionRefreshTimeoutRef.current) {
        clearInterval(connectionRefreshTimeoutRef.current);
        connectionRefreshTimeoutRef.current = null;
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const clearControlsTimeout = useCallback(() => {
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
      controlsTimeoutRef.current = null;
    }
  }, []);

  const startControlsTimeout = useCallback(() => {
    clearControlsTimeout();
    
    if (isPlaying && isMountedRef.current) {
      controlsTimeoutRef.current = setTimeout(() => {
        if (isMountedRef.current) {
          setControlsVisible(false);
        }
      }, CONTROLS_HIDE_DELAY);
    }
  }, [isPlaying, clearControlsTimeout]);

  const toggleControls = useCallback(() => {
    if (!isMountedRef.current) return;
    
    const newVisibility = !controlsVisible;
    setControlsVisible(newVisibility);
    
    if (newVisibility) {
      startControlsTimeout();
    } else {
      clearControlsTimeout();
    }
  }, [controlsVisible, startControlsTimeout, clearControlsTimeout]);

  const resetControlsTimeout = useCallback(() => {
    if (!isMountedRef.current) return;
    
    setControlsVisible(true);
    startControlsTimeout();
  }, [startControlsTimeout]);

  const memoizedVideoUrl = useMemo(() => videoUrl || '', [videoUrl]);

  const refreshConnectionIfNeeded = useCallback(() => {
    if (!isMountedRef.current) return;
    
    const now = Date.now();
    const timeSinceLastActivity = now - lastPlaybackActivityRef.current;
    
    if (timeSinceLastActivity > 45000 && videoUrl) {
      fetch(videoUrl, {
        method: 'HEAD',
        cache: 'no-cache',
      })
        .then(() => {
          if (isMountedRef.current) {
            lastPlaybackActivityRef.current = now;
          }
        })
        .catch(() => {
          // Silently fail
        });
    }
  }, [videoUrl]);

  // 🚨 CRITICAL FIX: ALWAYS call useVideoPlayer unconditionally
  const player = useVideoPlayer(memoizedVideoUrl, (player) => {
    if (memoizedVideoUrl && isMountedRef.current) {
      try {
        player.loop = false;
        player.muted = false;
        player.volume = volume;
        player.allowsExternalPlayback = true;
        lastPlaybackActivityRef.current = Date.now();
      } catch (playerError) {
        console.error('[VideoPlayer] Error configuring player:', playerError);
      }
    }
  });

  // 🚨 CRITICAL FIX: Safe play/pause with proper error handling
  const safePlay = useCallback(async () => {
    if (!player || !isMountedRef.current) return;
    
    try {
      player.play();
    } catch (playError) {
      console.error('[VideoPlayer] Play error (caught):', playError);
    }
  }, [player]);

  const safePause = useCallback(async () => {
    if (!player || !isMountedRef.current) return;
    
    try {
      player.pause();
    } catch (pauseError) {
      console.error('[VideoPlayer] Pause error (caught):', pauseError);
    }
  }, [player]);

  const handleExitPlayer = useCallback(async () => {
    console.log('[VideoPlayer] User exiting video player');
    
    if (Platform.OS !== 'web') {
      try {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      } catch (hapticsError) {
        console.log('[VideoPlayer] Haptics error:', hapticsError);
      }
    }
    
    if (player) {
      try {
        await safePause();
      } catch (pauseError) {
        console.log('[VideoPlayer] Pause error on exit:', pauseError);
      }
    }
    
    if (isFullscreen && Platform.OS !== 'web') {
      try {
        await ScreenOrientation.unlockAsync();
      } catch (orientationError) {
        console.log('[VideoPlayer] Orientation error:', orientationError);
      }
    }
    
    router.back();
  }, [player, isFullscreen, safePause]);

  useEffect(() => {
    if (!isMountedRef.current) return;
    
    connectionRefreshTimeoutRef.current = setInterval(() => {
      refreshConnectionIfNeeded();
    }, 30000);
    
    return () => {
      if (connectionRefreshTimeoutRef.current) {
        clearInterval(connectionRefreshTimeoutRef.current);
        connectionRefreshTimeoutRef.current = null;
      }
    };
  }, [refreshConnectionIfNeeded]);

  useEffect(() => {
    if (!isMountedRef.current) return;
    
    const loadVideo = async () => {
      if (hasLoadedRef.current) {
        return;
      }
      
      try {
        setIsLoading(true);
        setError(null);

        const [sessionResult, videoResult] = await Promise.all([
          supabase.auth.getSession(),
          supabase.from('videos').select('*').eq('id', videoId).single()
        ]);

        if (!isMountedRef.current) return;

        const { data: { session } } = sessionResult;
        if (!session) {
          throw new Error('Not authenticated. Please log in again.');
        }

        const { data, error: fetchError } = videoResult;
        if (fetchError) {
          throw fetchError;
        }

        setVideo(data);
        videoTitleRef.current = data.title;

        if (data.video_url.startsWith(MUX_HLS_PREFIX)) {
          setVideoUrl(data.video_url);
          hasLoadedRef.current = true;
          setIsLoading(false);
          setIsBuffering(false);
          return;
        }

        if (preloadedUrl && typeof preloadedUrl === 'string') {
          setVideoUrl(preloadedUrl);
          hasLoadedRef.current = true;
          setIsLoading(false);
          setIsBuffering(false);
          return;
        }

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
        } catch (urlError) {
          console.error('[VideoPlayer] URL parsing error:', urlError);
          throw new Error('Invalid video URL format');
        }

        if (!fileName) {
          throw new Error('Could not extract filename from video URL');
        }

        const { data: signedUrlData, error: signedUrlError } = await supabase.storage
          .from('videos')
          .createSignedUrl(fileName, 7200);

        if (!isMountedRef.current) return;

        if (signedUrlError || !signedUrlData?.signedUrl) {
          throw new Error('Failed to generate streaming URL');
        }

        const generatedUrl = signedUrlData.signedUrl;
        
        if (!generatedUrl.startsWith('https://')) {
          throw new Error('Video URL must use HTTPS');
        }
        
        setVideoUrl(generatedUrl);
        hasLoadedRef.current = true;
      } catch (loadError: unknown) {
        if (!isMountedRef.current) return;
        
        const errorMessage = loadError instanceof Error ? loadError.message : 'Failed to load video';
        console.error('[VideoPlayer] Load error:', errorMessage);
        setError(errorMessage);
      } finally {
        if (isMountedRef.current) {
          setIsLoading(false);
        }
      }
    };

    loadVideo();
  }, [videoId, preloadedUrl]);

  useEffect(() => {
    if (!player || !videoUrl || !isMountedRef.current) return;

    const statusListener = player.addListener('statusChange', (status: any) => {
      if (!isMountedRef.current) return;
      
      if (status.error) {
        console.error('[VideoPlayer] Status error:', status.error);
        const errorString = String(status.error).toLowerCase();
        const isRecoverableError = errorString.includes('network') || 
                                   errorString.includes('timeout') || 
                                   errorString.includes('connection') ||
                                   errorString.includes('buffer');
        
        if (isRecoverableError && retryCount < maxRetries) {
          console.log('[VideoPlayer] Retrying playback...');
          setRetryCount(prev => prev + 1);
          
          const backoffDelay = Math.min(1000 * Math.pow(2, retryCount), 5000);
          setTimeout(() => {
            if (player && videoUrl && isMountedRef.current) {
              player.replace(videoUrl);
              setTimeout(() => {
                if (player && isMountedRef.current) {
                  safePlay().catch(() => {
                    console.log('[VideoPlayer] Retry play failed');
                  });
                }
              }, 100);
            }
          }, backoffDelay);
        } else if (retryCount >= maxRetries) {
          setError(`Playback error: ${status.error}. Please check your internet connection and try again.`);
        } else {
          setError(`Playback error: ${status.error}`);
        }
        setIsBuffering(false);
      }
      
      if (status.status === 'readyToPlay') {
        const videoDuration = status.duration || 0;
        
        if (videoDuration > 0 && isMountedRef.current) {
          setDuration(videoDuration);
        }
        
        setIsBuffering(false);
        
        if (bufferingTimeoutRef.current) {
          clearTimeout(bufferingTimeoutRef.current);
          bufferingTimeoutRef.current = null;
        }
        
        if (retryCount > 0 && isMountedRef.current) {
          setRetryCount(0);
        }
        
        if (!isPlaying && isMountedRef.current) {
          setTimeout(() => {
            if (player && isMountedRef.current) {
              safePlay().catch(() => {
                console.log('[VideoPlayer] Auto-play failed');
              });
            }
          }, 50);
        }
      }
      
      if (status.status === 'loading') {
        setIsBuffering(true);
        
        const bufferTimeout = 2000;
        
        if (bufferingTimeoutRef.current) {
          clearTimeout(bufferingTimeoutRef.current);
        }
        bufferingTimeoutRef.current = setTimeout(() => {
          if (isMountedRef.current) {
            setIsBuffering(false);
          }
        }, bufferTimeout);
      }
      
      if (status.status === 'idle' || status.status === 'error') {
        setIsBuffering(false);
        if (bufferingTimeoutRef.current) {
          clearTimeout(bufferingTimeoutRef.current);
          bufferingTimeoutRef.current = null;
        }
      }
    });

    const playingListener = player.addListener('playingChange', (newIsPlaying: boolean) => {
      if (!isMountedRef.current) return;
      
      setIsPlaying(newIsPlaying);
      
      if (newIsPlaying) {
        // Record start time on first play (don't overwrite if already set)
        if (playbackStartTimeRef.current === null) {
          playbackStartTimeRef.current = Date.now();
          console.log('[VideoPlayer] Playback started — recording start time for usage tracking');
        }
        setIsBuffering(false);
        if (bufferingTimeoutRef.current) {
          clearTimeout(bufferingTimeoutRef.current);
          bufferingTimeoutRef.current = null;
        }
      }
    });

    const timeUpdateListener = player.addListener('timeUpdate', (timeUpdate: any) => {
      if (!isMountedRef.current) return;
      
      const newTime = timeUpdate.currentTime || 0;
      
      const now = Date.now();
      if (now - lastProgressUpdateRef.current < 100) return;
      lastProgressUpdateRef.current = now;
      
      lastPlaybackActivityRef.current = now;
      
      if (!isSeekingRef.current) {
        setCurrentTime(newTime);
      }
      
      if (player.duration && player.duration > 0) {
        setDuration(prevDuration => {
          if (prevDuration === 0 || Math.abs(prevDuration - player.duration) > 1) {
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

    // Track when video plays to end
    const playToEndListener = player.addListener('playToEnd', () => {
      if (!isMountedRef.current) return;
      if (!videoWatchTrackedRef.current && playbackStartTimeRef.current !== null) {
        const watchedSeconds = Math.round((Date.now() - playbackStartTimeRef.current) / 1000);
        console.log('[VideoPlayer] Video played to end — tracking video_watch, duration_seconds:', watchedSeconds, 'title:', videoTitleRef.current);
        videoWatchTrackedRef.current = true;
        playbackStartTimeRef.current = null;
        trackVideoWatch(user?.id, String(videoId ?? ''), videoTitleRef.current, watchedSeconds).catch(() => {});
      }
    });

    return () => {
      statusListener.remove();
      playingListener.remove();
      timeUpdateListener.remove();
      playToEndListener.remove();
      
      if (bufferingTimeoutRef.current) {
        clearTimeout(bufferingTimeoutRef.current);
        bufferingTimeoutRef.current = null;
      }
    };
  }, [player, videoUrl, isPlaying, retryCount, preloadedUrl, safePlay, user?.id, videoId]);

  useEffect(() => {
    if (videoUrl && player && isMountedRef.current) {
      try {
        player.replace(videoUrl);
      } catch (replaceError) {
        console.error('[VideoPlayer] Error loading source:', replaceError);
        if (isMountedRef.current) {
          setError('Failed to load video source');
        }
      }
    }
  }, [videoUrl, player]);

  useEffect(() => {
    if (player && isMountedRef.current) {
      player.volume = volume;
    }
  }, [volume, player]);

  useEffect(() => {
    if (!player || !isPlaying || !isMountedRef.current) return;

    const interval = setInterval(() => {
      if (!isMountedRef.current) return;
      
      if (!isSeekingRef.current && player.currentTime !== undefined) {
        setCurrentTime(player.currentTime);
      }
      
      if (player.duration && player.duration > 0 && duration === 0) {
        setDuration(player.duration);
      }
    }, 100);
    
    return () => clearInterval(interval);
  }, [player, isPlaying, duration]);

  useEffect(() => {
    if (!isMountedRef.current) return;
    
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
    if (!player || !isMountedRef.current) return;
    
    if (Platform.OS !== 'web') {
      try {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {
          console.log('[VideoPlayer] Haptics failed');
        });
      } catch (hapticsError) {
        console.log('[VideoPlayer] Haptics error:', hapticsError);
      }
    }
    
    lastPlaybackActivityRef.current = Date.now();
    
    const currentlyPlaying = player.playing;
    
    if (currentlyPlaying) {
      safePause().then(() => {
        if (isMountedRef.current) {
          setIsPlaying(false);
          setControlsVisible(true);
          clearControlsTimeout();
        }
      }).catch(() => {
        console.log('[VideoPlayer] Pause failed');
      });
    } else {
      refreshConnectionIfNeeded();
      
      safePlay().then(() => {
        if (isMountedRef.current) {
          setIsPlaying(true);
          resetControlsTimeout();
        }
      }).catch(() => {
        console.log('[VideoPlayer] Play failed');
      });
    }
  }, [player, resetControlsTimeout, clearControlsTimeout, refreshConnectionIfNeeded, safePlay, safePause]);

  const handleSeekStart = useCallback(() => {
    if (!isMountedRef.current) return;
    
    isSeekingRef.current = true;
    setControlsVisible(true);
    clearControlsTimeout();
    
    if (Platform.OS !== 'web') {
      try {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {
          console.log('[VideoPlayer] Haptics failed');
        });
      } catch (hapticsError) {
        console.log('[VideoPlayer] Haptics error:', hapticsError);
      }
    }
  }, [clearControlsTimeout]);

  const handleSeekChange = useCallback((value: number) => {
    if (!isMountedRef.current) return;
    setCurrentTime(value);
  }, []);

  const handleSeekComplete = useCallback((value: number) => {
    if (!player || !isMountedRef.current) return;
    
    const clampedValue = Math.max(0, Math.min(value, duration));
    player.currentTime = clampedValue;
    setCurrentTime(clampedValue);
    isSeekingRef.current = false;
    resetControlsTimeout();
    
    if (Platform.OS !== 'web') {
      try {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {
          console.log('[VideoPlayer] Haptics failed');
        });
      } catch (hapticsError) {
        console.log('[VideoPlayer] Haptics error:', hapticsError);
      }
    }
  }, [player, duration, resetControlsTimeout]);

  const toggleFullscreen = useCallback(async () => {
    if (!isMountedRef.current) return;
    
    const newFullscreenState = !isFullscreen;
    
    if (Platform.OS !== 'web') {
      try {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      } catch (hapticsError) {
        console.log('[VideoPlayer] Haptics error:', hapticsError);
      }
    }
    
    if (Platform.OS !== 'web') {
      try {
        if (newFullscreenState) {
          await ScreenOrientation.unlockAsync();
          await new Promise(resolve => setTimeout(resolve, 200));
          await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
          await new Promise(resolve => setTimeout(resolve, 250));
          
          if (isMountedRef.current) {
            setIsFullscreen(true);
            setControlsVisible(true);
          }
        } else {
          if (isMountedRef.current) {
            setIsFullscreen(false);
          }
          await ScreenOrientation.unlockAsync();
        }
      } catch (orientationError) {
        console.log('[VideoPlayer] Orientation error:', orientationError);
        if (isMountedRef.current) {
          setIsFullscreen(newFullscreenState);
          setControlsVisible(true);
        }
      }
    } else {
      setIsFullscreen(newFullscreenState);
      setControlsVisible(true);
    }
    
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

  const playPauseIconIOS = isPlaying ? "pause.fill" : "play.fill";
  const playPauseIconAndroid = isPlaying ? "pause" : "play-arrow";
  const volumeIconIOS = volume === 0 ? "speaker.slash.fill" : "speaker.wave.2.fill";
  const volumeIconAndroid = volume === 0 ? "volume-off" : "volume-up";
  const fullscreenIconIOS = isFullscreen ? "arrow.down.right.and.arrow.up.left" : "arrow.up.left.and.arrow.down.right";
  const fullscreenIconAndroid = isFullscreen ? "fullscreen-exit" : "fullscreen";

  const headerTopPadding = Platform.OS === 'ios' ? insets.top : (Platform.OS === 'android' ? 48 : 12);

  if (isLoading) {
    const loadingText = preloadedUrl ? "Starting instant playback..." : "Loading video...";
    
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
            onPress={handleExitPlayer}
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
              <Text style={styles.fullscreenTitle}>{videoTitle}</Text>
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
  const optimizedText = preloadedUrl ? "Instant Playback" : "4K Streaming";
  const httpsText = "Secure";
  const resolutionLabel = "Resolution";
  const sizeLabel = "File Size";
  const durationLabel = "Duration";
  const orientationLabel = "Orientation";
  const orientationText = videoOrientation === 'portrait' ? 'Portrait (9:16)' : 'Landscape (16:9)';
  
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
              <Text style={styles.metaLabel}>{orientationLabel}</Text>
              <Text style={styles.metaValue}>{orientationText}</Text>
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
