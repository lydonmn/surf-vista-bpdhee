
import React, { useState, useEffect, useCallback } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, Alert } from "react-native";
import { useTheme } from "@react-navigation/native";
import { useLocalSearchParams, router } from "expo-router";
import { VideoView, useVideoPlayer } from "expo-video";
import { colors } from "@/styles/commonStyles";
import { IconSymbol } from "@/components/IconSymbol";
import { supabase } from "@/app/integrations/supabase/client";
import { Video } from "@/hooks/useVideos";

export default function VideoPlayerScreen() {
  const theme = useTheme();
  const { videoId } = useLocalSearchParams();
  const [video, setVideo] = useState<Video | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadVideo = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      console.log('[VideoPlayer] Loading video:', videoId);

      const { data, error } = await supabase
        .from('videos')
        .select('*')
        .eq('id', videoId)
        .single();

      if (error) {
        console.error('[VideoPlayer] Error loading video:', error);
        throw error;
      }

      console.log('[VideoPlayer] Video loaded:', data.title);
      console.log('[VideoPlayer] Video URL from DB:', data.video_url);
      setVideo(data);

      // Extract the file path from the public URL
      // The URL format is: https://[project].supabase.co/storage/v1/object/public/videos/[filename]
      const urlParts = data.video_url.split('/videos/');
      if (urlParts.length === 2) {
        const fileName = urlParts[1];
        console.log('[VideoPlayer] Extracted filename:', fileName);
        
        // Get a fresh signed URL for the video (valid for 1 hour)
        const { data: signedUrlData, error: signedUrlError } = await supabase.storage
          .from('videos')
          .createSignedUrl(fileName, 3600); // 1 hour expiry

        if (signedUrlError) {
          console.error('[VideoPlayer] Error creating signed URL:', signedUrlError);
          // Fall back to public URL if signed URL fails
          console.log('[VideoPlayer] Falling back to public URL');
          setVideoUrl(data.video_url);
        } else {
          console.log('[VideoPlayer] Using signed URL:', signedUrlData.signedUrl);
          setVideoUrl(signedUrlData.signedUrl);
        }
      } else {
        // Use the URL as-is if we can't parse it
        console.log('[VideoPlayer] Using URL as-is');
        setVideoUrl(data.video_url);
      }
    } catch (error: any) {
      console.error('[VideoPlayer] Exception loading video:', error);
      setError(error.message || 'Failed to load video');
    } finally {
      setIsLoading(false);
    }
  }, [videoId]);

  useEffect(() => {
    loadVideo();
  }, [loadVideo]);

  const player = useVideoPlayer(videoUrl || '', player => {
    if (videoUrl) {
      console.log('[VideoPlayer] Initializing player with URL:', videoUrl);
      player.loop = false;
      player.play();
      setIsPlaying(true);
    }
  });

  // Update player source when videoUrl changes
  useEffect(() => {
    if (videoUrl && player) {
      console.log('[VideoPlayer] Updating player source to:', videoUrl);
      player.replace(videoUrl);
    }
  }, [videoUrl, player]);

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
        <View style={styles.centerContent}>
          <IconSymbol
            ios_icon_name="exclamationmark.triangle.fill"
            android_material_icon_name="warning"
            size={64}
            color={colors.textSecondary}
          />
          <Text style={[styles.errorText, { color: theme.colors.text }]}>
            {error || 'Video not found'}
          </Text>
          <TouchableOpacity
            style={[styles.backButton, { backgroundColor: colors.primary }]}
            onPress={() => router.back()}
          >
            <Text style={styles.backButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
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

  return (
    <ScrollView 
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      contentContainerStyle={styles.scrollContent}
    >
      <View style={styles.videoContainer}>
        <VideoView
          style={styles.video}
          player={player}
          allowsFullscreen
          allowsPictureInPicture
          contentFit="contain"
          nativeControls={false}
        />
      </View>

      <View style={styles.controls}>
        <TouchableOpacity
          style={[styles.controlButton, { backgroundColor: colors.primary }]}
          onPress={() => {
            if (isPlaying) {
              player.pause();
              setIsPlaying(false);
            } else {
              player.play();
              setIsPlaying(true);
            }
          }}
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
            player.currentTime = 0;
            player.play();
            setIsPlaying(true);
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
  );
}

const styles = StyleSheet.create({
  container: {
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
  videoContainer: {
    width: '100%',
    aspectRatio: 16 / 9,
    backgroundColor: '#000000',
  },
  video: {
    width: '100%',
    height: '100%',
  },
  controls: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
    paddingVertical: 16,
    paddingHorizontal: 16,
  },
  controlButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    fontSize: 18,
    textAlign: 'center',
    marginTop: 16,
    marginBottom: 24,
  },
  infoCard: {
    marginHorizontal: 16,
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
  backButton: {
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 16,
  },
  backButtonText: {
    color: '#FFFFFF',
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
