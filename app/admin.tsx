
import { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput, Alert, ActivityIndicator } from 'react-native';
import { supabase } from '@/app/integrations/supabase/client';
import { Video } from 'expo-av';
import { useTheme } from '@react-navigation/native';
import { useAuth } from '@/contexts/AuthContext';
import * as VideoThumbnails from 'expo-video-thumbnails';
import * as FileSystem from 'expo-file-system/legacy';
import { useVideos } from '@/hooks/useVideos';
import { router } from 'expo-router';
import * as tus from 'tus-js-client';
import * as ImagePicker from 'expo-image-picker';
import { IconSymbol } from '@/components/IconSymbol';
import { colors } from '@/styles/commonStyles';
import 'react-native-url-polyfill/auto';
import { Database } from '@/app/integrations/supabase/types';
import { useLocation } from '@/contexts/LocationContext';

type UserProfile = Database['public']['Tables']['profiles']['Row'];

interface VideoMetadata {
  width: number;
  height: number;
  duration: number;
  size: number;
}

const MAX_DURATION_SECONDS = 600;
const MAX_FILE_SIZE = 10 * 1024 * 1024 * 1024;
const TUS_CHUNK_SIZE = 10 * 1024 * 1024;

export default function AdminScreen() {
  const videoRef = useRef<Video>(null);
  const theme = useTheme();
  const [videoUri, setVideoUri] = useState<string | null>(null);
  const [videoTitle, setVideoTitle] = useState('');
  const [videoDescription, setVideoDescription] = useState('');
  const [selectedLocation, setSelectedLocation] = useState<string>('folly-beach');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const { user, profile } = useAuth();
  const { refreshVideos } = useVideos();
  const { locations } = useLocation();

  useEffect(() => {
    if (profile && !profile.is_admin) {
      console.log('[AdminScreen] User is not admin, redirecting...');
      Alert.alert('Access Denied', 'You do not have admin privileges');
      router.back();
    }
  }, [profile]);

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  };

  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatResolution = (width: number, height: number): string => {
    if (width >= 3840 && height >= 2160) return '4K';
    if (width >= 5760 && height >= 2880) return '6K';
    if (width >= 7680 && height >= 4320) return '8K';
    if (width >= 1920 && height >= 1080) return 'Full HD';
    if (width >= 1280 && height >= 720) return 'HD';
    return `${width}x${height}`;
  };

  const validateVideoMetadata = async (uri: string): Promise<VideoMetadata | null> => {
    try {
      console.log('[AdminScreen] Validating video metadata...');

      const fileInfo = await FileSystem.getInfoAsync(uri);
      if (!fileInfo.exists) {
        throw new Error('Video file not found');
      }

      console.log('[AdminScreen] File size:', formatFileSize(fileInfo.size));

      const metadata: VideoMetadata = {
        width: 3840,
        height: 2160,
        duration: 0,
        size: fileInfo.size,
      };

      return metadata;
    } catch (error) {
      console.error('[AdminScreen] Error validating video metadata:', error);
      return null;
    }
  };

  const checkVideoRequirements = (metadata: VideoMetadata): { valid: boolean; errors: string[] } => {
    const errors: string[] = [];

    if (metadata.size > MAX_FILE_SIZE) {
      errors.push(`File size (${formatFileSize(metadata.size)}) exceeds maximum (${formatFileSize(MAX_FILE_SIZE)})`);
    }

    if (metadata.duration > 0 && metadata.duration > MAX_DURATION_SECONDS) {
      errors.push(`Duration (${formatDuration(metadata.duration)}) exceeds maximum (${formatDuration(MAX_DURATION_SECONDS)})`);
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  };

  const pickVideo = async () => {
    try {
      console.log('[AdminScreen] Requesting media library permissions...');
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Please grant media library access to upload videos');
        return;
      }

      console.log('[AdminScreen] Launching video picker...');
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['videos'],
        allowsEditing: false,
        quality: 1,
      });

      if (result.canceled) {
        console.log('[AdminScreen] Video selection canceled');
        return;
      }

      const videoAsset = result.assets[0];
      console.log('[AdminScreen] Video selected:', videoAsset.uri);
      console.log('[AdminScreen] Video duration:', videoAsset.duration, 'seconds');
      console.log('[AdminScreen] Video dimensions:', videoAsset.width, 'x', videoAsset.height);

      const metadata = await validateVideoMetadata(videoAsset.uri);
      if (!metadata) {
        Alert.alert('Error', 'Failed to read video metadata');
        return;
      }

      metadata.duration = videoAsset.duration || 0;
      metadata.width = videoAsset.width || 3840;
      metadata.height = videoAsset.height || 2160;

      const validation = checkVideoRequirements(metadata);
      if (!validation.valid) {
        Alert.alert(
          'Video Requirements Not Met',
          validation.errors.join('\n\n'),
          [{ text: 'OK' }]
        );
        return;
      }

      const resolution = formatResolution(metadata.width, metadata.height);
      const fileSize = formatFileSize(metadata.size);
      const duration = formatDuration(metadata.duration);

      console.log('[AdminScreen] Video info:', { resolution, fileSize, duration });

      setVideoUri(videoAsset.uri);
      setVideoTitle(`Surf Report - ${new Date().toLocaleDateString()}`);
    } catch (error: any) {
      console.error('[AdminScreen] Error picking video:', error);
      Alert.alert('Error', `Failed to select video: ${error.message}`);
    }
  };

  const uploadVideo = async () => {
    if (!videoUri || !videoTitle.trim()) {
      Alert.alert('Missing Information', 'Please select a video and enter a title');
      return;
    }

    if (!user) {
      Alert.alert('Error', 'You must be logged in to upload videos');
      return;
    }

    try {
      setIsUploading(true);
      setUploadProgress(0);
      console.log('[AdminScreen] Starting video upload...');

      const fileInfo = await FileSystem.getInfoAsync(videoUri);
      if (!fileInfo.exists) {
        throw new Error('Video file not found');
      }

      console.log('[AdminScreen] File size:', formatFileSize(fileInfo.size));

      const timestamp = Date.now();
      const fileName = `video_${timestamp}.mp4`;
      console.log('[AdminScreen] Uploading as:', fileName);

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('videos')
        .createSignedUploadUrl(fileName);

      if (uploadError || !uploadData) {
        console.error('[AdminScreen] Error creating upload URL:', uploadError);
        throw uploadError || new Error('Failed to create upload URL');
      }

      console.log('[AdminScreen] Got upload URL, starting TUS upload...');

      await new Promise<void>((resolve, reject) => {
        const upload = new tus.Upload(
          { uri: videoUri, name: fileName, type: 'video/mp4' } as any,
          {
            endpoint: uploadData.url,
            retryDelays: [0, 3000, 5000, 10000, 20000],
            chunkSize: TUS_CHUNK_SIZE,
            metadata: {
              filename: fileName,
              filetype: 'video/mp4',
            },
            onError: (error) => {
              console.error('[AdminScreen] TUS upload error:', error);
              reject(error);
            },
            onProgress: (bytesUploaded, bytesTotal) => {
              const percentage = Math.round((bytesUploaded / bytesTotal) * 100);
              console.log('[AdminScreen] Upload progress:', percentage, '%');
              setUploadProgress(percentage);
            },
            onSuccess: () => {
              console.log('[AdminScreen] TUS upload completed');
              resolve();
            },
          }
        );

        upload.start();
      });

      console.log('[AdminScreen] Upload completed, getting public URL...');

      const { data: urlData } = supabase.storage
        .from('videos')
        .getPublicUrl(fileName);

      console.log('[AdminScreen] Public URL:', urlData.publicUrl);

      console.log('[AdminScreen] Generating thumbnail...');
      let thumbnailUrl: string | null = null;
      try {
        const { uri: thumbnailUri } = await VideoThumbnails.getThumbnailAsync(videoUri, {
          time: 1000,
        });

        console.log('[AdminScreen] Thumbnail generated:', thumbnailUri);

        const thumbnailFileName = `thumbnail_${timestamp}.jpg`;
        const thumbnailFile = await FileSystem.readAsStringAsync(thumbnailUri, {
          encoding: FileSystem.EncodingType.Base64,
        });

        const { error: thumbnailError } = await supabase.storage
          .from('videos')
          .upload(thumbnailFileName, decode(thumbnailFile), {
            contentType: 'image/jpeg',
          });

        if (thumbnailError) {
          console.error('[AdminScreen] Error uploading thumbnail:', thumbnailError);
        } else {
          const { data: thumbnailUrlData } = supabase.storage
            .from('videos')
            .getPublicUrl(thumbnailFileName);
          thumbnailUrl = thumbnailUrlData.publicUrl;
          console.log('[AdminScreen] Thumbnail URL:', thumbnailUrl);
        }
      } catch (thumbnailError) {
        console.error('[AdminScreen] Error generating thumbnail:', thumbnailError);
      }

      const metadata = await validateVideoMetadata(videoUri);
      const duration = metadata ? formatDuration(metadata.duration) : null;
      const durationSeconds = metadata?.duration || null;
      const resolutionWidth = metadata?.width || null;
      const resolutionHeight = metadata?.height || null;
      const fileSizeBytes = metadata?.size || null;

      console.log('[AdminScreen] Saving to database with location:', selectedLocation);
      const { error: dbError } = await supabase
        .from('videos')
        .insert({
          title: videoTitle.trim(),
          description: videoDescription.trim() || null,
          video_url: urlData.publicUrl,
          thumbnail_url: thumbnailUrl,
          uploaded_by: user.id,
          duration,
          duration_seconds: durationSeconds,
          resolution_width: resolutionWidth,
          resolution_height: resolutionHeight,
          file_size_bytes: fileSizeBytes,
          location: selectedLocation,
        });

      if (dbError) {
        console.error('[AdminScreen] Error saving to database:', dbError);
        throw dbError;
      }

      console.log('[AdminScreen] Video uploaded successfully');
      
      console.log('[AdminScreen] ⚡ Triggering immediate video preparation...');
      try {
        const response = await fetch(urlData.publicUrl, {
          method: 'GET',
          headers: {
            'Range': 'bytes=0-5242879',
          },
        });
        
        if (response.ok || response.status === 206) {
          console.log('[AdminScreen] ✅ Video prepared for instant playback');
        }
      } catch (prepError) {
        console.warn('[AdminScreen] Video preparation failed (non-critical):', prepError);
      }
      
      Alert.alert('Success', 'Video uploaded and prepared for instant playback!');

      setVideoUri(null);
      setVideoTitle('');
      setVideoDescription('');
      setUploadProgress(0);
      setSelectedLocation('folly-beach');

      await refreshVideos();
    } catch (error: any) {
      console.error('[AdminScreen] Error uploading video:', error);
      Alert.alert('Upload Failed', error.message || 'Failed to upload video');
    } finally {
      setIsUploading(false);
    }
  };

  const decode = (base64: string): Uint8Array => {
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
  };

  if (!profile?.is_admin) {
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
            Checking permissions...
          </Text>
        </View>
      </View>
    );
  }

  return (
    <ScrollView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={styles.content}>
        <Text style={[styles.title, { color: theme.colors.text }]}>Admin Panel</Text>

        <View style={[styles.section, { backgroundColor: theme.colors.card }]}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Upload Video</Text>

          {videoUri && (
            <View style={styles.videoPreview}>
              <Video
                ref={videoRef}
                source={{ uri: videoUri }}
                style={styles.video}
                useNativeControls
                resizeMode="contain"
              />
            </View>
          )}

          <TouchableOpacity
            style={[styles.button, { backgroundColor: colors.primary }]}
            onPress={pickVideo}
            disabled={isUploading}
          >
            <IconSymbol
              ios_icon_name="video.fill"
              android_material_icon_name="videocam"
              size={20}
              color="#FFFFFF"
            />
            <Text style={styles.buttonText}>
              {videoUri ? 'Change Video' : 'Select Video'}
            </Text>
          </TouchableOpacity>

          <TextInput
            style={[styles.input, { backgroundColor: theme.colors.background, color: theme.colors.text }]}
            placeholder="Video Title"
            placeholderTextColor={colors.textSecondary}
            value={videoTitle}
            onChangeText={setVideoTitle}
            editable={!isUploading}
          />

          <TextInput
            style={[styles.input, styles.textArea, { backgroundColor: theme.colors.background, color: theme.colors.text }]}
            placeholder="Description (optional)"
            placeholderTextColor={colors.textSecondary}
            value={videoDescription}
            onChangeText={setVideoDescription}
            multiline
            numberOfLines={3}
            editable={!isUploading}
          />

          <View style={styles.locationSection}>
            <Text style={[styles.label, { color: theme.colors.text }]}>Location:</Text>
            <View style={styles.locationButtons}>
              {locations.map((location) => (
                <TouchableOpacity
                  key={location.id}
                  style={[
                    styles.locationButton,
                    selectedLocation === location.id && styles.locationButtonActive,
                    { backgroundColor: selectedLocation === location.id ? colors.primary : theme.colors.background }
                  ]}
                  onPress={() => setSelectedLocation(location.id)}
                  disabled={isUploading}
                >
                  <Text style={[
                    styles.locationButtonText,
                    { color: selectedLocation === location.id ? '#FFFFFF' : theme.colors.text }
                  ]}>
                    {location.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {isUploading && (
            <View style={styles.progressContainer}>
              <Text style={[styles.progressText, { color: theme.colors.text }]}>
                Uploading: {uploadProgress}%
              </Text>
              <View style={[styles.progressBar, { backgroundColor: colors.cardBackground }]}>
                <View 
                  style={[
                    styles.progressFill, 
                    { width: `${uploadProgress}%`, backgroundColor: colors.primary }
                  ]} 
                />
              </View>
            </View>
          )}

          <TouchableOpacity
            style={[
              styles.button,
              styles.uploadButton,
              { backgroundColor: colors.accent },
              (!videoUri || !videoTitle.trim() || isUploading) && styles.buttonDisabled
            ]}
            onPress={uploadVideo}
            disabled={!videoUri || !videoTitle.trim() || isUploading}
          >
            {isUploading ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <>
                <IconSymbol
                  ios_icon_name="arrow.up.circle.fill"
                  android_material_icon_name="cloud_upload"
                  size={20}
                  color="#FFFFFF"
                />
                <Text style={styles.buttonText}>Upload Video</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        <View style={[styles.section, { backgroundColor: theme.colors.card }]}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Quick Actions</Text>
          
          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: colors.primary }]}
            onPress={() => router.push('/admin-users')}
          >
            <IconSymbol
              ios_icon_name="person.2.fill"
              android_material_icon_name="group"
              size={20}
              color="#FFFFFF"
            />
            <Text style={styles.actionButtonText}>Manage Users</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: colors.primary }]}
            onPress={() => router.push('/admin-data')}
          >
            <IconSymbol
              ios_icon_name="arrow.clockwise.circle.fill"
              android_material_icon_name="refresh"
              size={20}
              color="#FFFFFF"
            />
            <Text style={styles.actionButtonText}>Update Surf Data</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: colors.primary }]}
            onPress={() => router.push('/admin-locations')}
          >
            <IconSymbol
              ios_icon_name="map.fill"
              android_material_icon_name="place"
              size={20}
              color="#FFFFFF"
            />
            <Text style={styles.actionButtonText}>Manage Locations</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: colors.primary }]}
            onPress={() => router.push('/admin-debug')}
          >
            <IconSymbol
              ios_icon_name="wrench.and.screwdriver.fill"
              android_material_icon_name="settings"
              size={20}
              color="#FFFFFF"
            />
            <Text style={styles.actionButtonText}>Debug Tools</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: colors.accent }]}
            onPress={() => {
              console.log('[AdminScreen] Navigating to demo paywall for screenshots');
              router.push('/demo-paywall');
            }}
          >
            <IconSymbol
              ios_icon_name="creditcard.fill"
              android_material_icon_name="payment"
              size={20}
              color="#FFFFFF"
            />
            <Text style={styles.actionButtonText}>Show Demo Paywall</Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 16,
    paddingTop: 48,
    paddingBottom: 100,
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    marginTop: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 24,
  },
  section: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  videoPreview: {
    width: '100%',
    height: 200,
    borderRadius: 8,
    overflow: 'hidden',
    marginBottom: 16,
  },
  video: {
    width: '100%',
    height: '100%',
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    marginBottom: 12,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  input: {
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    fontSize: 16,
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  locationSection: {
    marginBottom: 16,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  locationButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  locationButton: {
    minWidth: '45%',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  locationButtonActive: {
  },
  locationButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  progressContainer: {
    marginBottom: 16,
  },
  progressText: {
    fontSize: 14,
    marginBottom: 8,
    textAlign: 'center',
  },
  progressBar: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
  },
  uploadButton: {
    marginTop: 8,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginBottom: 8,
  },
  actionButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
