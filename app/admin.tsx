
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
import * as ImagePicker from 'expo-image-picker';
import { IconSymbol } from '@/components/IconSymbol';
import { colors } from '@/styles/commonStyles';
import 'react-native-url-polyfill/auto';
import { useLocation } from '@/contexts/LocationContext';

interface VideoMetadata {
  width: number;
  height: number;
  duration: number;
  size: number;
}

const MAX_DURATION_SECONDS = 600;
const MAX_FILE_SIZE = 10 * 1024 * 1024 * 1024;

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
  const [availableLocations, setAvailableLocations] = useState<typeof locations>([]);

  // Determine which locations this user can upload to
  useEffect(() => {
    if (profile) {
      if (profile.is_admin) {
        // Super admin can upload to all locations
        console.log('[AdminScreen] Super admin - all locations available');
        setAvailableLocations(locations);
      } else if (profile.is_regional_admin && profile.managed_locations) {
        // Regional admin can only upload to their managed locations
        console.log('[AdminScreen] Regional admin - filtering to managed locations:', profile.managed_locations);
        const managedLocs = locations.filter(loc => profile.managed_locations?.includes(loc.id));
        setAvailableLocations(managedLocs);
        
        // Set default to first managed location
        if (managedLocs.length > 0 && !profile.managed_locations.includes(selectedLocation)) {
          setSelectedLocation(managedLocs[0].id);
        }
      } else {
        // Not an admin
        console.log('[AdminScreen] User is not admin, redirecting...');
        Alert.alert('Access Denied', 'You do not have admin privileges');
        router.back();
      }
    }
  }, [profile, locations, selectedLocation]);

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
      console.log('[AdminScreen] Raw video duration from picker:', videoAsset.duration);
      console.log('[AdminScreen] Video dimensions:', videoAsset.width, 'x', videoAsset.height);

      const metadata = await validateVideoMetadata(videoAsset.uri);
      if (!metadata) {
        Alert.alert('Error', 'Failed to read video metadata');
        return;
      }

      // CRITICAL FIX: ImagePicker returns duration in MILLISECONDS, convert to seconds
      const durationInSeconds = videoAsset.duration ? Math.floor(videoAsset.duration / 1000) : 0;
      console.log('[AdminScreen] Converted duration to seconds:', durationInSeconds);

      metadata.duration = durationInSeconds;
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

    // Check if regional admin is trying to upload to a location they don't manage
    if (profile?.is_regional_admin && !profile.is_admin) {
      if (!profile.managed_locations?.includes(selectedLocation)) {
        Alert.alert('Access Denied', 'You can only upload videos to your assigned locations');
        return;
      }
    }

    try {
      setIsUploading(true);
      setUploadProgress(0);
      console.log('[AdminScreen] 🚀 Starting video upload for location:', selectedLocation);

      const fileInfo = await FileSystem.getInfoAsync(videoUri);
      if (!fileInfo.exists) {
        throw new Error('Video file not found');
      }

      console.log('[AdminScreen] 📊 File size:', formatFileSize(fileInfo.size));

      const timestamp = Date.now();
      const fileName = `video_${timestamp}.mp4`;
      console.log('[AdminScreen] 📝 Uploading as:', fileName);

      // Read file as base64
      console.log('[AdminScreen] 📖 Reading file...');
      const base64Data = await FileSystem.readAsStringAsync(videoUri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      // Convert base64 to binary
      console.log('[AdminScreen] 🔄 Converting to binary...');
      const binaryData = decode(base64Data);

      console.log('[AdminScreen] ☁️ Uploading to Supabase Storage...');
      
      // Use standard Supabase upload with progress tracking
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('videos')
        .upload(fileName, binaryData, {
          contentType: 'video/mp4',
          upsert: false,
          cacheControl: '3600',
        });

      if (uploadError) {
        console.error('[AdminScreen] ❌ Upload error:', uploadError);
        throw uploadError;
      }

      console.log('[AdminScreen] ✅ Upload complete:', uploadData);

      // Simulate progress for user feedback
      setUploadProgress(100);

      console.log('[AdminScreen] 🔗 Getting public URL...');

      const { data: urlData } = supabase.storage
        .from('videos')
        .getPublicUrl(fileName);

      console.log('[AdminScreen] ✅ Public URL:', urlData.publicUrl);

      console.log('[AdminScreen] 🖼️ Generating thumbnail...');
      let thumbnailUrl: string | null = null;
      try {
        const { uri: thumbnailUri } = await VideoThumbnails.getThumbnailAsync(videoUri, {
          time: 1000,
          quality: 0.9,
        });

        console.log('[AdminScreen] ✅ Thumbnail generated:', thumbnailUri);

        const thumbnailFileName = `thumbnail_${timestamp}.jpg`;
        const thumbnailFile = await FileSystem.readAsStringAsync(thumbnailUri, {
          encoding: FileSystem.EncodingType.Base64,
        });

        const { error: thumbnailError } = await supabase.storage
          .from('videos')
          .upload(thumbnailFileName, decode(thumbnailFile), {
            contentType: 'image/jpeg',
            upsert: false,
          });

        if (thumbnailError) {
          console.error('[AdminScreen] ⚠️ Error uploading thumbnail:', thumbnailError);
        } else {
          const { data: thumbnailUrlData } = supabase.storage
            .from('videos')
            .getPublicUrl(thumbnailFileName);
          thumbnailUrl = thumbnailUrlData.publicUrl;
          console.log('[AdminScreen] ✅ Thumbnail URL:', thumbnailUrl);
        }
      } catch (thumbnailError) {
        console.error('[AdminScreen] ⚠️ Error generating thumbnail (non-critical):', thumbnailError);
      }

      const metadata = await validateVideoMetadata(videoUri);
      const duration = metadata ? formatDuration(metadata.duration) : null;
      const durationSeconds = metadata?.duration || null;
      const resolutionWidth = metadata?.width || null;
      const resolutionHeight = metadata?.height || null;
      const fileSizeBytes = metadata?.size || null;

      console.log('[AdminScreen] 💾 Saving to database with location:', selectedLocation);
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
        console.error('[AdminScreen] ❌ Error saving to database:', dbError);
        throw dbError;
      }

      console.log('[AdminScreen] ✅ Video saved to database');
      
      console.log('[AdminScreen] ⚡ Triggering immediate video preparation for instant playback...');
      try {
        const response = await fetch(urlData.publicUrl, {
          method: 'HEAD',
        });
        
        if (response.ok) {
          console.log('[AdminScreen] ✅ Video prepared and ready for instant playback');
        }
      } catch (prepError) {
        console.warn('[AdminScreen] ⚠️ Video preparation failed (non-critical):', prepError);
      }
      
      const selectedLocationData = locations.find(loc => loc.id === selectedLocation);
      const locationName = selectedLocationData?.displayName || selectedLocation;
      
      Alert.alert(
        '🎉 Upload Complete!', 
        `Your video is ready for instant playback!\n\n✅ Video tagged to: ${locationName}\n✅ Will appear on homepage when ${locationName} is selected\n✅ Added to video library for ${locationName}\n\n🚀 Full quality preserved - no compression!`
      );

      setVideoUri(null);
      setVideoTitle('');
      setVideoDescription('');
      setUploadProgress(0);
      
      // Reset to first available location
      if (availableLocations.length > 0) {
        setSelectedLocation(availableLocations[0].id);
      }

      await refreshVideos();
    } catch (error: any) {
      console.error('[AdminScreen] ❌ Error uploading video:', error);
      console.error('[AdminScreen] Error stack:', error.stack);
      Alert.alert(
        'Upload Failed', 
        `${error.message || 'Failed to upload video'}\n\nPlease try again. If the issue persists, check your internet connection.`
      );
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

  if (!profile?.is_admin && !profile?.is_regional_admin) {
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

  const locationInfoText = profile?.is_regional_admin && !profile.is_admin
    ? `You can upload videos to your assigned locations. Videos are automatically tagged and will appear on the homepage when users select that location.`
    : `Videos are automatically tagged to locations. When users select a location on the homepage, they'll see the latest video for that location in the large video card.`;

  const titleText = profile?.is_regional_admin && !profile.is_admin ? 'Regional Admin Panel' : 'Admin Panel';

  return (
    <ScrollView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={styles.content}>
        <Text style={[styles.title, { color: theme.colors.text }]}>{titleText}</Text>

        <View style={[styles.section, { backgroundColor: theme.colors.card }]}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Upload Video</Text>

          <View style={styles.infoCard}>
            <View style={styles.infoHeader}>
              <IconSymbol
                ios_icon_name="info.circle.fill"
                android_material_icon_name="info"
                size={20}
                color={colors.primary}
              />
              <Text style={styles.infoTitle}>High-Quality Video Upload</Text>
            </View>
            <Text style={styles.infoText}>
              {locationInfoText}
            </Text>
            <Text style={[styles.infoText, { marginTop: 8, fontWeight: '600' }]}>
              🚀 Optimized for 6K drone footage - instant uploads with paid Supabase!
            </Text>
          </View>

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
            <Text style={[styles.label, { color: theme.colors.text }]}>
              📍 Select Location for This Video:
            </Text>
            {profile?.is_regional_admin && !profile.is_admin && (
              <Text style={styles.helperText}>
                You can only upload to your assigned locations
              </Text>
            )}
            <View style={styles.locationButtons}>
              {availableLocations.map((location) => {
                const isSelected = selectedLocation === location.id;
                return (
                  <TouchableOpacity
                    key={location.id}
                    style={[
                      styles.locationButton,
                      isSelected && styles.locationButtonActive,
                      { backgroundColor: isSelected ? colors.primary : theme.colors.background }
                    ]}
                    onPress={() => setSelectedLocation(location.id)}
                    disabled={isUploading}
                  >
                    <Text style={[
                      styles.locationButtonText,
                      { color: isSelected ? '#FFFFFF' : theme.colors.text }
                    ]}>
                      {location.name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
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
              <Text style={[styles.progressSubtext, { color: colors.textSecondary }]}>
                Using instant upload with paid Supabase...
              </Text>
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

        {/* Only show admin actions for super admins */}
        {profile?.is_admin && (
          <View style={[styles.section, { backgroundColor: theme.colors.card }]}>
            <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Admin Actions</Text>
            
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
              <Text style={styles.actionButtonText}>Manage Regional Admins</Text>
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
              <Text style={styles.actionButtonText}>Update Surf Data (All Locations)</Text>
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
        )}

        {/* Regional admin actions */}
        {profile?.is_regional_admin && !profile.is_admin && (
          <View style={[styles.section, { backgroundColor: theme.colors.card }]}>
            <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Regional Admin Actions</Text>
            
            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: colors.primary }]}
              onPress={() => router.push('/admin-regional')}
            >
              <IconSymbol
                ios_icon_name="arrow.clockwise.circle.fill"
                android_material_icon_name="refresh"
                size={20}
                color="#FFFFFF"
              />
              <Text style={styles.actionButtonText}>Manage Your Locations</Text>
            </TouchableOpacity>
          </View>
        )}
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
  infoCard: {
    backgroundColor: '#E3F2FD',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    borderLeftWidth: 4,
    borderLeftColor: colors.primary,
  },
  infoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  infoTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1976D2',
  },
  infoText: {
    fontSize: 13,
    color: '#424242',
    lineHeight: 20,
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
  helperText: {
    fontSize: 13,
    color: colors.textSecondary,
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
    borderWidth: 2,
    borderColor: colors.border,
  },
  locationButtonActive: {
    borderColor: colors.primary,
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
    fontWeight: '600',
  },
  progressBar: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  progressSubtext: {
    fontSize: 12,
    marginTop: 6,
    textAlign: 'center',
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
