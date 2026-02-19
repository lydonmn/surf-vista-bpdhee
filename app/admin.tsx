
import { useLocation } from '@/contexts/LocationContext';
import { useTheme } from '@react-navigation/native';
import { colors } from '@/styles/commonStyles';
import { router } from 'expo-router';
import { useVideos } from '@/hooks/useVideos';
import { useAuth } from '@/contexts/AuthContext';
import { IconSymbol } from '@/components/IconSymbol';
import * as VideoThumbnails from 'expo-video-thumbnails';
import { supabase } from '@/app/integrations/supabase/client';
import * as ImagePicker from 'expo-image-picker';
import { VideoView, useVideoPlayer } from 'expo-video';
import { useState, useEffect, useRef } from 'react';
import 'react-native-url-polyfill/auto';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput, Alert, ActivityIndicator } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';

interface VideoMetadata {
  width: number;
  height: number;
  duration: number;
  size: number;
}

const MAX_DURATION_SECONDS = 300; // 5 minutes
const MAX_FILE_SIZE = 500 * 1024 * 1024; // 500MB

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    padding: 20,
  },
  header: {
    fontSize: 28,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: colors.textSecondary,
    marginBottom: 24,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 12,
  },
  button: {
    backgroundColor: colors.primary,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 12,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryButton: {
    backgroundColor: colors.card,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 12,
  },
  secondaryButtonText: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '600',
  },
  disabledButton: {
    backgroundColor: colors.border,
    opacity: 0.5,
  },
  input: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 16,
    color: colors.text,
    fontSize: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  videoPreview: {
    width: '100%',
    height: 200,
    borderRadius: 12,
    backgroundColor: colors.card,
    marginBottom: 12,
  },
  metadataContainer: {
    backgroundColor: colors.card,
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  metadataText: {
    color: colors.text,
    fontSize: 14,
    marginBottom: 4,
  },
  uploadingContainer: {
    backgroundColor: colors.card,
    padding: 20,
    borderRadius: 12,
    alignItems: 'center',
  },
  uploadingText: {
    color: colors.text,
    fontSize: 16,
    marginTop: 12,
  },
  locationSelector: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  locationText: {
    color: colors.text,
    fontSize: 16,
  },
  locationPlaceholder: {
    color: colors.textSecondary,
    fontSize: 16,
  },
  adminActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  adminButton: {
    flex: 1,
    backgroundColor: colors.card,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  adminButtonText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '600',
  },
});

export default function AdminScreen() {
  const { colors } = useTheme();
  const { user, profile } = useAuth();
  const { locations, currentLocation, selectedLocation } = useLocation();
  const { videos, loading: videosLoading, fetchVideos } = useVideos();
  
  const [selectedVideo, setSelectedVideo] = useState<string | null>(null);
  const [videoMetadata, setVideoMetadata] = useState<VideoMetadata | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [stokeRating, setStokeRating] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  
  const videoPlayer = useVideoPlayer(selectedVideo || '', (player) => {
    player.loop = true;
    player.play();
  });

  useEffect(() => {
    if (!isUploading) {
      fetchVideos();
    }
  }, [isUploading]);

  useEffect(() => {
    if (!profile) return;
    
    // Set default location if regional admin
    if (profile.is_regional_admin && profile.managed_locations && profile.managed_locations.length > 0) {
      const defaultLocationId = profile.managed_locations[0];
      const defaultLocation = locations.find(loc => loc.id === defaultLocationId);
      if (defaultLocation && !selectedLocation) {
        // Location will be set by LocationContext
      }
    }
  }, [profile, locations, selectedLocation]);

  const formatFileSize = (bytes: number): string => {
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(2)} MB`;
  };

  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatResolution = (width: number, height: number): string => {
    return `${width}x${height}`;
  };

  const validateVideoMetadata = async (uri: string): Promise<VideoMetadata | null> => {
    try {
      console.log('[Admin] 📊 Starting video metadata validation...');
      console.log('[Admin] 📁 Video URI:', uri);
      
      const fileInfo = await FileSystem.getInfoAsync(uri);
      console.log('[Admin] 📊 File info retrieved:', JSON.stringify(fileInfo, null, 2));
      
      if (!fileInfo.exists) {
        console.error('[Admin] ❌ File does not exist at URI:', uri);
        Alert.alert('Error', 'Video file not found');
        return null;
      }

      const size = fileInfo.size || 0;
      console.log('[Admin] 📏 File size:', size, 'bytes (', formatFileSize(size), ')');

      // Get video dimensions and duration using expo-video-thumbnails
      console.log('[Admin] 🎬 Generating thumbnail to extract metadata...');
      const { uri: thumbnailUri, width, height } = await VideoThumbnails.getThumbnailAsync(uri, {
        time: 0,
      });
      console.log('[Admin] ✅ Thumbnail generated successfully');
      console.log('[Admin] 📐 Video dimensions:', width, 'x', height);

      // For duration, we'll use the video player or estimate
      // Since we can't easily get duration without playing, we'll use a placeholder
      const duration = 60; // Placeholder - will be updated by Mux
      console.log('[Admin] ⏱️ Duration (placeholder):', duration, 'seconds');

      const metadata: VideoMetadata = {
        width,
        height,
        duration,
        size,
      };

      console.log('[Admin] ✅ Metadata validation complete:', JSON.stringify(metadata, null, 2));
      return metadata;
    } catch (error) {
      console.error('[Admin] ❌ Error validating video metadata:', error);
      Alert.alert('Error', 'Failed to read video metadata');
      return null;
    }
  };

  const checkVideoRequirements = (metadata: VideoMetadata): boolean => {
    console.log('[Admin] 🔍 Checking video requirements...');
    
    if (metadata.size > MAX_FILE_SIZE) {
      const sizeMB = formatFileSize(metadata.size);
      const maxMB = formatFileSize(MAX_FILE_SIZE);
      console.error('[Admin] ❌ File too large:', sizeMB, '(max:', maxMB, ')');
      Alert.alert('File Too Large', `Video must be under ${maxMB}. Current size: ${sizeMB}`);
      return false;
    }
    console.log('[Admin] ✅ File size OK');

    if (metadata.duration > MAX_DURATION_SECONDS) {
      const durationStr = formatDuration(metadata.duration);
      const maxStr = formatDuration(MAX_DURATION_SECONDS);
      console.error('[Admin] ❌ Video too long:', durationStr, '(max:', maxStr, ')');
      Alert.alert('Video Too Long', `Video must be under ${maxStr}. Current duration: ${durationStr}`);
      return false;
    }
    console.log('[Admin] ✅ Duration OK');

    console.log('[Admin] ✅ All requirements met');
    return true;
  };

  const pickVideo = async () => {
    try {
      console.log('[Admin] 🎥 Starting video picker...');
      
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      console.log('[Admin] 🔐 Media library permission:', permissionResult.status);
      
      if (!permissionResult.granted) {
        console.error('[Admin] ❌ Media library permission denied');
        Alert.alert('Permission Required', 'Please allow access to your media library');
        return;
      }
      console.log('[Admin] ✅ Media library permission granted');

      console.log('[Admin] 📂 Launching image picker...');
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Videos,
        allowsEditing: false,
        quality: 1,
      });

      console.log('[Admin] 📋 Picker result:', JSON.stringify(result, null, 2));

      if (result.canceled) {
        console.log('[Admin] ℹ️ User canceled video selection');
        return;
      }

      console.log('[Admin] ✅ Video selected:', result.assets[0].uri);
      const metadata = await validateVideoMetadata(result.assets[0].uri);
      
      if (!metadata) {
        console.error('[Admin] ❌ Failed to validate metadata');
        return;
      }

      if (!checkVideoRequirements(metadata)) {
        console.error('[Admin] ❌ Video does not meet requirements');
        return;
      }

      console.log('[Admin] ✅ Setting selected video and metadata');
      setSelectedVideo(result.assets[0].uri);
      setVideoMetadata(metadata);
      console.log('[Admin] ✅ Video selection complete');
    } catch (error) {
      console.error('[Admin] ❌ Error picking video:', error);
      Alert.alert('Error', 'Failed to select video');
    }
  };

  const uploadVideo = async () => {
    if (!selectedVideo || !videoMetadata) {
      console.error('[Admin] ❌ No video selected or metadata missing');
      Alert.alert('Error', 'Please select a video first');
      return;
    }

    if (!title.trim()) {
      console.error('[Admin] ❌ Title is required');
      Alert.alert('Error', 'Please enter a title');
      return;
    }

    if (!selectedLocation) {
      console.error('[Admin] ❌ No location selected');
      Alert.alert('Error', 'Please select a location');
      return;
    }

    try {
      console.log('[Admin] 🚀 ========================================');
      console.log('[Admin] 🚀 STARTING VIDEO UPLOAD PROCESS');
      console.log('[Admin] 🚀 ========================================');
      console.log('[Admin] 📝 Title:', title);
      console.log('[Admin] 📝 Description:', description);
      console.log('[Admin] 📝 Stoke Rating:', stokeRating);
      console.log('[Admin] 📍 Location:', selectedLocation);
      console.log('[Admin] 📊 Metadata:', JSON.stringify(videoMetadata, null, 2));
      
      setIsUploading(true);

      // Step 1: Handle ph:// URI conversion
      let fileUri = selectedVideo;
      let fileName = fileUri.split('/').pop();
      const fileExtension = fileName?.split('.').pop();
      console.log('[Admin] 📁 Original URI:', fileUri);
      console.log('[Admin] 📁 File name:', fileName);
      console.log('[Admin] 📁 File extension:', fileExtension);

      if (fileUri.startsWith('ph://')) {
        console.log('[Admin] ➡️ ========================================');
        console.log('[Admin] ➡️ STARTING ph:// TO file:// CONVERSION');
        console.log('[Admin] ➡️ ========================================');
        console.log('[Admin] ➡️ Source URI:', fileUri);
        
        const newUri = FileSystem.cacheDirectory + fileName;
        console.log('[Admin] ➡️ Target URI:', newUri);
        console.log('[Admin] ➡️ Calling FileSystem.copyAsync...');
        
        const copyStartTime = Date.now();
        await FileSystem.copyAsync({
          from: fileUri,
          to: newUri,
        });
        const copyEndTime = Date.now();
        
        fileUri = newUri;
        console.log('[Admin] ✅ Copy completed in', (copyEndTime - copyStartTime), 'ms');
        console.log('[Admin] ✅ New URI:', fileUri);
        console.log('[Admin] ✅ ========================================');
      } else {
        console.log('[Admin] ℹ️ URI is not ph://, skipping conversion');
      }

      // Step 2: Get file size of copied file
      console.log('[Admin] 📏 ========================================');
      console.log('[Admin] 📏 CHECKING FILE SIZE');
      console.log('[Admin] 📏 ========================================');
      console.log('[Admin] 📏 Getting file info for:', fileUri);
      
      const fileInfo = await FileSystem.getInfoAsync(fileUri);
      console.log('[Admin] 📏 File info:', JSON.stringify(fileInfo, null, 2));
      
      if (fileInfo.exists && fileInfo.size) {
        console.log('[Admin] 📏 ✅ File size:', fileInfo.size, 'bytes');
        console.log('[Admin] 📏 ✅ File size (MB):', formatFileSize(fileInfo.size));
      } else {
        console.warn('[Admin] ⚠️ Could not get file size');
      }
      console.log('[Admin] 📏 ========================================');

      // Step 3: Get signed upload URL
      console.log('[Admin] 🔗 ========================================');
      console.log('[Admin] 🔗 FETCHING SIGNED UPLOAD URL');
      console.log('[Admin] 🔗 ========================================');
      console.log('[Admin] 🔗 Calling Supabase function: mux-create-upload');
      
      const { data: uploadData, error: uploadError } = await supabase.functions.invoke('mux-create-upload', {
        body: { filename: fileName },
      });

      if (uploadError) {
        console.error('[Admin] ❌ Error getting upload URL:', uploadError);
        throw uploadError;
      }

      console.log('[Admin] ✅ Upload URL received');
      console.log('[Admin] 🔗 Upload URL:', uploadData.url);
      console.log('[Admin] 🔗 Asset ID:', uploadData.assetId);
      console.log('[Admin] 🔗 ========================================');

      const uploadUrl = uploadData.url;
      const muxAssetId = uploadData.assetId;

      // Determine MIME type
      const mimeType = fileExtension === 'mov' ? 'video/quicktime' : 'video/mp4';
      console.log('[Admin] 📦 MIME type:', mimeType);

      // Step 4: Upload file to Mux
      console.log('[Admin] 🚀 ========================================');
      console.log('[Admin] 🚀 STARTING FILE UPLOAD TO MUX');
      console.log('[Admin] 🚀 ========================================');
      console.log('[Admin] 🚀 Upload URL:', uploadUrl);
      console.log('[Admin] 🚀 File URI:', fileUri);
      console.log('[Admin] 🚀 MIME type:', mimeType);
      console.log('[Admin] 🚀 Calling FileSystem.uploadAsync...');
      
      const uploadStartTime = Date.now();
      
      const uploadResult = await FileSystem.uploadAsync(uploadUrl, fileUri, {
        httpMethod: 'PUT',
        uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
        headers: {
          'Content-Type': mimeType,
        },
        onProgress: (progress) => {
          const percentage = (progress.totalBytesSent / progress.totalBytesExpectedToSend) * 100;
          console.log('[Admin] 🔄 Upload progress:', percentage.toFixed(2), '%');
          console.log('[Admin] 🔄 Bytes sent:', progress.totalBytesSent, '/', progress.totalBytesExpectedToSend);
        },
      });

      const uploadEndTime = Date.now();
      console.log('[Admin] ✅ FileSystem.uploadAsync completed in', (uploadEndTime - uploadStartTime), 'ms');
      console.log('[Admin] ✅ Upload result:', JSON.stringify(uploadResult, null, 2));
      console.log('[Admin] ✅ Upload status:', uploadResult.status);
      console.log('[Admin] 🚀 ========================================');

      if (uploadResult.status !== 200) {
        console.error('[Admin] ❌ Upload failed with status:', uploadResult.status);
        throw new Error(`Upload failed with status ${uploadResult.status}`);
      }

      console.log('[Admin] ✅ File successfully uploaded to Mux');

      // Step 5: Save video record to database
      console.log('[Admin] 💾 ========================================');
      console.log('[Admin] 💾 SAVING VIDEO RECORD TO DATABASE');
      console.log('[Admin] 💾 ========================================');
      console.log('[Admin] 💾 Creating video record...');
      
      const { data: videoRecord, error: dbError } = await supabase
        .from('videos')
        .insert({
          title: title.trim(),
          description: description.trim() || null,
          stoke_rating: stokeRating ? parseInt(stokeRating) : null,
          location_id: selectedLocation,
          user_id: user?.id,
          status: 'processing',
          mux_asset_id: muxAssetId,
          resolution_width: videoMetadata.width,
          resolution_height: videoMetadata.height,
          file_size_bytes: videoMetadata.size,
        })
        .select()
        .single();

      if (dbError) {
        console.error('[Admin] ❌ Database error:', dbError);
        throw dbError;
      }

      console.log('[Admin] ✅ Video record saved:', JSON.stringify(videoRecord, null, 2));
      console.log('[Admin] 💾 ========================================');

      console.log('[Admin] 🎉 ========================================');
      console.log('[Admin] 🎉 UPLOAD PROCESS COMPLETE');
      console.log('[Admin] 🎉 ========================================');
      console.log('[Admin] 🎉 Video ID:', videoRecord.id);
      console.log('[Admin] 🎉 Status: processing');
      console.log('[Admin] 🎉 Mux will transcode the video in the background');
      console.log('[Admin] 🎉 ========================================');

      Alert.alert(
        'Success',
        'Video uploaded successfully! It will be available once processing is complete.',
        [{ text: 'OK', onPress: () => router.back() }]
      );

      // Reset form
      setSelectedVideo(null);
      setVideoMetadata(null);
      setTitle('');
      setDescription('');
      setStokeRating('');
      setIsUploading(false);
    } catch (error) {
      console.error('[Admin] ❌ ========================================');
      console.error('[Admin] ❌ UPLOAD FAILED');
      console.error('[Admin] ❌ ========================================');
      console.error('[Admin] ❌ Error:', error);
      console.error('[Admin] ❌ Error message:', error instanceof Error ? error.message : 'Unknown error');
      console.error('[Admin] ❌ Error stack:', error instanceof Error ? error.stack : 'No stack trace');
      console.error('[Admin] ❌ ========================================');
      
      setIsUploading(false);
      Alert.alert('Upload Failed', error instanceof Error ? error.message : 'An error occurred');
    }
  };

  if (!profile?.is_admin && !profile?.is_regional_admin) {
    return (
      <View style={styles.container}>
        <View style={styles.scrollContent}>
          <Text style={styles.header}>Access Denied</Text>
          <Text style={styles.subtitle}>You do not have permission to access this page.</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollContent}>
        <Text style={styles.header}>Admin Panel</Text>
        <Text style={styles.subtitle}>Upload and manage surf report videos</Text>

        {/* Admin Actions */}
        {profile?.is_admin && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Admin Actions</Text>
            <View style={styles.adminActions}>
              <TouchableOpacity
                style={styles.adminButton}
                onPress={() => router.push('/admin-data')}
              >
                <IconSymbol ios_icon_name="chart.bar.fill" android_material_icon_name="bar-chart" size={24} color={colors.text} />
                <Text style={styles.adminButtonText}>Data Management</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.adminButton}
                onPress={() => router.push('/admin-locations')}
              >
                <IconSymbol ios_icon_name="location.fill" android_material_icon_name="location-on" size={24} color={colors.text} />
                <Text style={styles.adminButtonText}>Locations</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.adminActions}>
              <TouchableOpacity
                style={styles.adminButton}
                onPress={() => router.push('/admin-users')}
              >
                <IconSymbol ios_icon_name="person.2.fill" android_material_icon_name="group" size={24} color={colors.text} />
                <Text style={styles.adminButtonText}>Regional Admins</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.adminButton}
                onPress={() => router.push('/manage-all-users')}
              >
                <IconSymbol ios_icon_name="person.3.fill" android_material_icon_name="people" size={24} color={colors.text} />
                <Text style={styles.adminButtonText}>All Users</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Location Selection */}
        {profile?.is_regional_admin && !profile?.is_admin && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Location</Text>
            <View style={styles.locationSelector}>
              <Text style={styles.locationText}>
                {locations.find(loc => loc.id === selectedLocation)?.display_name || 'Select Location'}
              </Text>
            </View>
          </View>
        )}

        {/* Video Upload Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Upload Video</Text>
          
          {!selectedVideo ? (
            <TouchableOpacity
              style={styles.button}
              onPress={pickVideo}
              disabled={isUploading}
            >
              <Text style={styles.buttonText}>Select Video</Text>
            </TouchableOpacity>
          ) : (
            <>
              <VideoView
                style={styles.videoPreview}
                player={videoPlayer}
                allowsFullscreen
                allowsPictureInPicture
              />
              
              {videoMetadata && (
                <View style={styles.metadataContainer}>
                  <Text style={styles.metadataText}>
                    Resolution: {formatResolution(videoMetadata.width, videoMetadata.height)}
                  </Text>
                  <Text style={styles.metadataText}>
                    Size: {formatFileSize(videoMetadata.size)}
                  </Text>
                  <Text style={styles.metadataText}>
                    Duration: {formatDuration(videoMetadata.duration)}
                  </Text>
                </View>
              )}

              <TextInput
                style={styles.input}
                placeholder="Video Title"
                placeholderTextColor={colors.textSecondary}
                value={title}
                onChangeText={setTitle}
                editable={!isUploading}
              />

              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="Description (optional)"
                placeholderTextColor={colors.textSecondary}
                value={description}
                onChangeText={setDescription}
                multiline
                editable={!isUploading}
              />

              <TextInput
                style={styles.input}
                placeholder="Stoke Rating (1-10, optional)"
                placeholderTextColor={colors.textSecondary}
                value={stokeRating}
                onChangeText={setStokeRating}
                keyboardType="number-pad"
                editable={!isUploading}
              />

              {isUploading ? (
                <View style={styles.uploadingContainer}>
                  <ActivityIndicator size="large" color={colors.primary} />
                  <Text style={styles.uploadingText}>Uploading video...</Text>
                </View>
              ) : (
                <>
                  <TouchableOpacity
                    style={styles.button}
                    onPress={uploadVideo}
                  >
                    <Text style={styles.buttonText}>Upload Video</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.secondaryButton}
                    onPress={() => {
                      setSelectedVideo(null);
                      setVideoMetadata(null);
                      setTitle('');
                      setDescription('');
                      setStokeRating('');
                    }}
                  >
                    <Text style={styles.secondaryButtonText}>Cancel</Text>
                  </TouchableOpacity>
                </>
              )}
            </>
          )}
        </View>

        {/* Recent Videos */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Recent Videos</Text>
          {videosLoading ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : (
            videos.slice(0, 5).map((video) => (
              <View key={video.id} style={styles.metadataContainer}>
                <Text style={styles.metadataText}>{video.title}</Text>
                <Text style={styles.metadataText}>Status: {video.status}</Text>
              </View>
            ))
          )}
        </View>
      </ScrollView>
    </View>
  );
}
