
import React, { useState, useEffect, useCallback } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, Alert } from "react-native";
import { useTheme } from "@react-navigation/native";
import { useLocalSearchParams, router } from "expo-router";
import { VideoView, useVideoPlayer } from "expo-video";
import { colors } from "@/styles/commonStyles";
import { IconSymbol } from "@/components/IconSymbol";
import { supabase } from "@/app/integrations/supabase/client";

interface VideoData {
  id: string;
  title: string;
  description: string | null;
  video_url: string;
  created_at: string;
  duration: string | null;
}

export default function SimpleVideoPlayerScreen() {
  const theme = useTheme();
  const { videoId } = useLocalSearchParams();
  const [video, setVideo] = useState<VideoData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [videoUrl, setVideoUrl] = useState<string>('');
  const [error, setError] = useState<string>('');

  const loadVideo = useCallback(async () => {
    try {
      setIsLoading(true);
      setError('');
      
      console.log('[SimpleVideoPlayer] Loading video:', videoId);

      // Load video metadata
      const { data, error: fetchError } = await supabase
        .from('videos')
        .select('*')
        .eq('id', videoId)
        .single();

      if (fetchError) {
        console.error('[SimpleVideoPlayer] Fetch error:', fetchError);
        throw new Error('Video not found');
      }

      console.log('[SimpleVideoPlayer] Video data:', data);
      setVideo(data);

      // Extract filename
      const urlParts = data.video_url.split('/videos/');
      if (urlParts.length < 2) {
        throw new Error('Invalid video URL format');
      }
      
      const fileName = urlParts[1].split('?')[0];
      console.log('[SimpleVideoPlayer] Filename:', fileName);

      // Try to get public URL first (simplest approach)
      const { data: publicUrlData } = supabase.storage
        .from('videos')
        .getPublicUrl(fileName);

      if (publicUrlData?.publicUrl) {
        console.log('[SimpleVideoPlayer] Using public URL');
        setVideoUrl(publicUrlData.publicUrl);
      } else {
        // Fallback to signed URL
        const { data: signedData, error: signedError } = await supabase.storage
          .from('videos')
          .createSignedUrl(fileName, 3600);

        if (signedError || !signedData?.signedUrl) {
          console.error('[SimpleVideoPlayer] URL generation failed:', signedError);
          throw new Error('Cannot generate video URL. Please check storage bucket configuration.');
        }

        console.log('[SimpleVideoPlayer] Using signed URL');
        setVideoUrl(signedData.signedUrl);
      }
    } catch (err: any) {
      console.error('[SimpleVideoPlayer] Error:', err);
      setError(err.message || 'Failed to load video');
    } finally {
      setIsLoading(false);
    }
  }, [videoId]);

  useEffect(() => {
    loadVideo();
  }, [loadVideo]);

  const player = useVideoPlayer(videoUrl, (player) => {
    player.loop = false;
    player.play();
  });

  if (isLoading) {
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[styles.text, { color: colors.textSecondary }]}>Loading...</Text>
      </View>
    );
  }

  if (error || !video || !videoUrl) {
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <IconSymbol
          ios_icon_name="exclamationmark.triangle"
          android_material_icon_name="warning"
          size={48}
          color={colors.textSecondary}
        />
        <Text style={[styles.errorText, { color: theme.colors.text }]}>
          {error || 'Cannot load video'}
        </Text>
        <Text style={[styles.text, { color: colors.textSecondary, marginTop: 8 }]}>
          Please check:
        </Text>
        <Text style={[styles.text, { color: colors.textSecondary }]}>
          • Storage bucket is public or has RLS policies
        </Text>
        <Text style={[styles.text, { color: colors.textSecondary }]}>
          • CORS is configured on the bucket
        </Text>
        <Text style={[styles.text, { color: colors.textSecondary }]}>
          • Video file exists in storage
        </Text>
        <TouchableOpacity
          style={[styles.button, { backgroundColor: colors.primary, marginTop: 16 }]}
          onPress={loadVideo}
        >
          <Text style={styles.buttonText}>Retry</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.button, { backgroundColor: colors.secondary, marginTop: 8 }]}
          onPress={() => router.back()}
        >
          <Text style={[styles.buttonText, { color: colors.text }]}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView style={[styles.scrollContainer, { backgroundColor: theme.colors.background }]}>
      <View style={styles.videoContainer}>
        <VideoView
          style={styles.video}
          player={player}
          allowsFullscreen
          allowsPictureInPicture
          contentFit="contain"
          nativeControls
        />
      </View>

      <View style={[styles.infoCard, { backgroundColor: theme.colors.card }]}>
        <Text style={[styles.title, { color: theme.colors.text }]}>
          {video.title}
        </Text>
        <Text style={[styles.date, { color: colors.textSecondary }]}>
          {new Date(video.created_at).toLocaleDateString()}
        </Text>
        {video.description && (
          <Text style={[styles.description, { color: colors.textSecondary }]}>
            {video.description}
          </Text>
        )}
      </View>

      <TouchableOpacity
        style={[styles.button, { backgroundColor: colors.secondary, margin: 16 }]}
        onPress={() => router.back()}
      >
        <IconSymbol
          ios_icon_name="chevron.left"
          android_material_icon_name="arrow_back"
          size={20}
          color={colors.text}
        />
        <Text style={[styles.buttonText, { color: colors.text }]}>Back to Videos</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  scrollContainer: {
    flex: 1,
  },
  videoContainer: {
    width: '100%',
    aspectRatio: 16 / 9,
    backgroundColor: '#000',
  },
  video: {
    width: '100%',
    height: '100%',
  },
  infoCard: {
    margin: 16,
    padding: 16,
    borderRadius: 12,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  date: {
    fontSize: 14,
    marginBottom: 8,
  },
  description: {
    fontSize: 14,
    lineHeight: 20,
  },
  text: {
    fontSize: 14,
    textAlign: 'center',
    marginTop: 4,
  },
  errorText: {
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
    marginTop: 16,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  buttonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
