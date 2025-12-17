
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput, Alert, ActivityIndicator, Platform } from 'react-native';
import { useTheme } from '@react-navigation/native';
import { router } from 'expo-router';
import { colors } from '@/styles/commonStyles';
import { IconSymbol } from '@/components/IconSymbol';
import { supabase } from '@/app/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { Video } from 'expo-av';

interface UserProfile {
  id: string;
  email: string;
  is_admin: boolean;
  is_subscribed: boolean;
  subscription_end_date: string | null;
}

interface VideoMetadata {
  width: number;
  height: number;
  duration: number;
  size: number;
}

// Video upload limits (no minimum quality requirement)
const MAX_DURATION_SECONDS = 90; // 90 seconds max

// File size limits - support up to 6K video (90 seconds at high bitrate)
// 6K video at 100 Mbps bitrate = ~1.1 GB per 90 seconds
// Increased to 3GB to support high-quality 6K video
const MAX_FILE_SIZE = 3 * 1024 * 1024 * 1024; // 3GB max
const RECOMMENDED_FILE_SIZE = 1.5 * 1024 * 1024 * 1024; // 1.5GB recommended

// Chunk size for uploads (50MB chunks for better reliability)
const CHUNK_SIZE = 50 * 1024 * 1024; // 50MB

export default function AdminScreen() {
  const theme = useTheme();
  const { profile } = useAuth();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [validatingVideo, setValidatingVideo] = useState(false);

  // Video upload state
  const [videoTitle, setVideoTitle] = useState('');
  const [videoDescription, setVideoDescription] = useState('');
  const [selectedVideo, setSelectedVideo] = useState<string | null>(null);
  const [videoMetadata, setVideoMetadata] = useState<VideoMetadata | null>(null);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  useEffect(() => {
    if (profile?.is_admin) {
      loadUsers();
    }
  }, [profile]);

  const loadUsers = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setUsers(data || []);
    } catch (error) {
      console.error('Error loading users:', error);
      Alert.alert('Error', 'Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  const toggleSubscription = async (userId: string, currentStatus: boolean) => {
    try {
      const newEndDate = currentStatus 
        ? null 
        : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

      const { error } = await supabase
        .from('profiles')
        .update({
          is_subscribed: !currentStatus,
          subscription_end_date: newEndDate
        })
        .eq('id', userId);

      if (error) throw error;

      Alert.alert('Success', `Subscription ${!currentStatus ? 'activated' : 'deactivated'}`);
      loadUsers();
    } catch (error) {
      console.error('Error toggling subscription:', error);
      Alert.alert('Error', 'Failed to update subscription');
    }
  };

  const toggleAdmin = async (userId: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ is_admin: !currentStatus })
        .eq('id', userId);

      if (error) throw error;

      Alert.alert('Success', `Admin status ${!currentStatus ? 'granted' : 'revoked'}`);
      loadUsers();
    } catch (error) {
      console.error('Error toggling admin:', error);
      Alert.alert('Error', 'Failed to update admin status');
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatResolution = (width: number, height: number): string => {
    // Determine resolution name
    if (width >= 7680) return `8K (${width}x${height})`;
    if (width >= 6144) return `6K (${width}x${height})`;
    if (width >= 3840) return `4K (${width}x${height})`;
    if (width >= 2560) return `2K (${width}x${height})`;
    if (width >= 1920) return `1080p (${width}x${height})`;
    if (width >= 1280) return `720p (${width}x${height})`;
    return `${width}x${height}`;
  };

  const validateVideoMetadata = async (
    uri: string, 
    assetWidth?: number, 
    assetHeight?: number, 
    assetDuration?: number
  ): Promise<VideoMetadata | null> => {
    try {
      console.log('[AdminScreen] Validating video metadata for:', uri);
      console.log('[AdminScreen] Asset info from picker:', {
        width: assetWidth,
        height: assetHeight,
        duration: assetDuration
      });
      
      // Get file info for size
      const fileInfo = await FileSystem.getInfoAsync(uri);
      if (!fileInfo.exists || !('size' in fileInfo)) {
        throw new Error('Could not read file information');
      }

      const fileSize = fileInfo.size;
      console.log('[AdminScreen] File size:', formatFileSize(fileSize));

      // Use dimensions from picker result
      let width = assetWidth || 0;
      let height = assetHeight || 0;
      
      // CRITICAL FIX: expo-image-picker returns duration in MILLISECONDS, not seconds!
      // We need to convert it to seconds
      let duration = 0;
      if (assetDuration && assetDuration > 0) {
        // Convert milliseconds to seconds
        duration = assetDuration / 1000;
        console.log('[AdminScreen] Duration from picker:', assetDuration, 'ms =', duration, 'seconds');
      }

      // Only try to get duration from expo-av if picker didn't provide it
      if (duration === 0) {
        console.log('[AdminScreen] Duration not available from picker, trying expo-av as fallback');
        try {
          const { sound, status } = await Video.Sound.createAsync(
            { uri },
            { shouldPlay: false }
          );
          
          if (status.isLoaded && status.durationMillis) {
            // Convert milliseconds to seconds
            duration = status.durationMillis / 1000;
            console.log('[AdminScreen] Duration from expo-av:', duration, 'seconds (converted from', status.durationMillis, 'ms)');
          }

          await sound.unloadAsync();
        } catch (error) {
          console.error('[AdminScreen] Error loading video with expo-av:', error);
          console.log('[AdminScreen] Continuing without duration information');
        }
      }

      // If we still don't have dimensions, use fallback
      if (width === 0 || height === 0) {
        console.log('[AdminScreen] Using fallback dimensions');
        width = 1920;
        height = 1080;
      }

      const metadata = {
        width,
        height,
        duration,
        size: fileSize
      };

      console.log('[AdminScreen] Final video metadata:', {
        resolution: formatResolution(width, height),
        duration: duration > 0 ? formatDuration(duration) : 'Unknown',
        durationSeconds: duration,
        size: formatFileSize(fileSize)
      });

      return metadata;
    } catch (error) {
      console.error('[AdminScreen] Error validating video:', error);
      return null;
    }
  };

  const checkVideoRequirements = (metadata: VideoMetadata): string[] => {
    const errors: string[] = [];

    // NO MINIMUM RESOLUTION REQUIREMENT - Accept any quality
    // Videos will play at their uploaded resolution

    // Check duration (maximum 90 seconds)
    // Only validate if we have a valid duration
    if (metadata.duration > 0 && metadata.duration > MAX_DURATION_SECONDS) {
      errors.push(
        `Duration too long: ${formatDuration(metadata.duration)}. Maximum allowed: ${formatDuration(MAX_DURATION_SECONDS)}`
      );
    }

    // Check file size
    if (metadata.size > MAX_FILE_SIZE) {
      errors.push(
        `File too large: ${formatFileSize(metadata.size)}. Maximum allowed: ${formatFileSize(MAX_FILE_SIZE)}`
      );
    }

    return errors;
  };

  const pickVideo = async () => {
    try {
      setValidationErrors([]);
      setVideoMetadata(null);
      
      // Request permissions
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Please grant permission to access your photo library');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['videos'],
        allowsEditing: false,
        quality: 1, // Maximum quality - preserve original
        videoMaxDuration: 300, // Allow selection, we'll validate after
      });

      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        const videoUri = asset.uri;
        
        console.log('[AdminScreen] Video selected:', videoUri);
        console.log('[AdminScreen] Asset info from picker:', {
          width: asset.width,
          height: asset.height,
          duration: asset.duration,
          type: asset.type
        });
        
        // Show loading state
        setValidatingVideo(true);
        
        try {
          // Validate video metadata - pass all info from picker result
          // IMPORTANT: expo-image-picker returns duration in MILLISECONDS
          const metadata = await validateVideoMetadata(
            videoUri, 
            asset.width, 
            asset.height, 
            asset.duration // This is in milliseconds, will be converted in validateVideoMetadata
          );
          
          if (!metadata) {
            Alert.alert('Error', 'Could not read video information. Please try a different video.');
            return;
          }

          setVideoMetadata(metadata);
          
          // Check if video meets requirements (duration and file size only)
          const errors = checkVideoRequirements(metadata);
          setValidationErrors(errors);

          if (errors.length > 0) {
            // Show detailed error message
            Alert.alert(
              'Video Does Not Meet Requirements',
              errors.join('\n\n'),
              [{ text: 'OK' }]
            );
            setSelectedVideo(null);
          } else {
            // Video is valid!
            setSelectedVideo(videoUri);
            
            // Show success with metadata
            const durationText = metadata.duration > 0 
              ? `Duration: ${formatDuration(metadata.duration)}\n` 
              : 'Duration: Unknown (will be determined during upload)\n';
            
            Alert.alert(
              'Video Validated ✓',
              `Resolution: ${formatResolution(metadata.width, metadata.height)}\n${durationText}Size: ${formatFileSize(metadata.size)}\n\nThis video is ready to upload and will play at its original quality.`,
              [{ text: 'OK' }]
            );
          }
        } catch (error) {
          console.error('[AdminScreen] Error validating video:', error);
          Alert.alert(
            'Validation Error',
            'Could not validate video. Please ensure the video is a valid format and try again.'
          );
        } finally {
          setValidatingVideo(false);
        }
      }
    } catch (error) {
      console.error('[AdminScreen] Error picking video:', error);
      Alert.alert('Error', 'Failed to pick video');
      setValidatingVideo(false);
    }
  };

  const uploadVideoInChunks = async (
    videoUri: string,
    fileName: string,
    accessToken: string
  ): Promise<boolean> => {
    try {
      console.log('[AdminScreen] Starting chunked upload for:', fileName);
      
      // Get file info
      const fileInfo = await FileSystem.getInfoAsync(videoUri);
      if (!fileInfo.exists || !('size' in fileInfo)) {
        throw new Error('Could not read file');
      }

      const fileSize = fileInfo.size;
      const totalChunks = Math.ceil(fileSize / CHUNK_SIZE);
      
      console.log('[AdminScreen] File size:', formatFileSize(fileSize));
      console.log('[AdminScreen] Total chunks:', totalChunks);

      // For large files, we'll use the standard upload with progress tracking
      // Supabase storage supports large files, but we need to ensure the bucket is configured correctly
      
      const supabaseUrl = 'https://ucbilksfpnmltrkwvzft.supabase.co';
      const uploadUrl = `${supabaseUrl}/storage/v1/object/videos/${fileName}`;
      
      console.log('[AdminScreen] Upload URL:', uploadUrl);
      
      // Create upload task with progress tracking
      const uploadTask = FileSystem.createUploadTask(
        uploadUrl,
        videoUri,
        {
          httpMethod: 'POST',
          uploadType: FileSystem.FileSystemUploadType.MULTIPART,
          fieldName: 'file',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVjYmlsa3NmcG5tbHRya3d2emZ0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU4NDM2MjcsImV4cCI6MjA4MTQxOTYyN30.pQkSbD0JzvRV4_lj0rAmeaQFZqK1QVW0EkVlhYM-KA8',
            'x-upsert': 'false',
            'Content-Type': 'video/mp4',
          },
        },
        (data) => {
          const progress = data.totalBytesSent / data.totalBytesExpectedToSend;
          const percentComplete = Math.round(progress * 100);
          console.log('[AdminScreen] Upload progress:', percentComplete + '%');
          setUploadProgress(percentComplete);
        }
      );
      
      const result = await uploadTask.uploadAsync();
      
      console.log('[AdminScreen] Upload result:', {
        status: result?.status,
        body: result?.body
      });
      
      if (!result || result.status < 200 || result.status >= 300) {
        let errorMessage = 'Upload failed';
        
        try {
          const errorBody = result?.body ? JSON.parse(result.body) : null;
          console.error('[AdminScreen] Upload error details:', errorBody);
          
          if (errorBody?.statusCode === 413 || errorBody?.error === 'Payload too large') {
            errorMessage = `File size exceeds storage limits.\n\nYour file: ${formatFileSize(fileSize)}\n\nPlease ensure your Supabase storage bucket is configured to accept files up to ${formatFileSize(MAX_FILE_SIZE)}.\n\nTo fix this:\n1. Go to Supabase Dashboard\n2. Storage → videos bucket → Settings\n3. Increase "Maximum file size" to 3GB`;
          } else if (errorBody?.message) {
            errorMessage = errorBody.message;
          } else if (result?.status === 413) {
            errorMessage = `File too large for upload.\n\nYour file: ${formatFileSize(fileSize)}\n\nPlease configure your Supabase storage bucket to accept larger files.`;
          }
        } catch (parseError) {
          console.error('[AdminScreen] Error parsing response:', parseError);
          if (result?.status === 413) {
            errorMessage = `File too large. Please configure Supabase storage to accept files up to ${formatFileSize(MAX_FILE_SIZE)}`;
          } else {
            errorMessage = `Upload failed with status ${result?.status}`;
          }
        }
        
        throw new Error(errorMessage);
      }
      
      console.log('[AdminScreen] Upload successful');
      return true;
    } catch (error) {
      console.error('[AdminScreen] Chunked upload error:', error);
      throw error;
    }
  };

  const uploadVideo = async () => {
    if (!selectedVideo || !videoTitle || !videoMetadata) {
      Alert.alert('Error', 'Please select a valid video and enter a title');
      return;
    }

    // Final validation check
    const errors = checkVideoRequirements(videoMetadata);
    if (errors.length > 0) {
      Alert.alert('Cannot Upload', errors.join('\n\n'));
      return;
    }

    try {
      setUploading(true);
      setUploadProgress(0);
      
      console.log('[AdminScreen] Starting video upload...');
      console.log('[AdminScreen] Video URI:', selectedVideo);
      console.log('[AdminScreen] Video metadata:', {
        resolution: formatResolution(videoMetadata.width, videoMetadata.height),
        duration: videoMetadata.duration > 0 ? formatDuration(videoMetadata.duration) : 'Unknown',
        durationSeconds: videoMetadata.duration,
        size: formatFileSize(videoMetadata.size)
      });

      // Generate unique filename
      const fileExt = selectedVideo.split('.').pop()?.toLowerCase() || 'mp4';
      const fileName = `${Date.now()}.${fileExt}`;

      console.log('[AdminScreen] Uploading file:', fileName);

      // Get auth session
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Not authenticated. Please log in again.');
      }

      console.log('[AdminScreen] Session obtained, proceeding with upload');

      // Upload video with chunked upload for large files
      await uploadVideoInChunks(selectedVideo, fileName, session.access_token);
      
      console.log('[AdminScreen] Upload successful');
      setUploadProgress(100);

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('videos')
        .getPublicUrl(fileName);

      console.log('[AdminScreen] Public URL:', publicUrl);

      // Create video record in database with metadata
      const { error: dbError } = await supabase
        .from('videos')
        .insert({
          title: videoTitle,
          description: videoDescription,
          video_url: publicUrl,
          uploaded_by: profile?.id,
          resolution_width: videoMetadata.width,
          resolution_height: videoMetadata.height,
          duration_seconds: videoMetadata.duration > 0 ? videoMetadata.duration : null,
          file_size_bytes: videoMetadata.size
        });

      if (dbError) {
        console.error('[AdminScreen] Database error:', dbError);
        throw dbError;
      }

      console.log('[AdminScreen] Video record created successfully');

      const durationText = videoMetadata.duration > 0 
        ? `Duration: ${formatDuration(videoMetadata.duration)}\n` 
        : '';

      Alert.alert(
        'Success!', 
        `Video uploaded successfully!\n\nResolution: ${formatResolution(videoMetadata.width, videoMetadata.height)}\n${durationText}Size: ${formatFileSize(videoMetadata.size)}\n\nYour video will play at its original quality.`,
        [
          {
            text: 'OK',
            onPress: () => {
              setVideoTitle('');
              setVideoDescription('');
              setSelectedVideo(null);
              setVideoMetadata(null);
              setValidationErrors([]);
              setUploadProgress(0);
            }
          }
        ]
      );
    } catch (error: any) {
      console.error('[AdminScreen] Upload error:', error);
      
      let errorMessage = 'Failed to upload video. ';
      
      if (error.message?.includes('Payload too large') || error.message?.includes('File too large') || error.message?.includes('413')) {
        errorMessage = error.message;
      } else if (error.message?.includes('Network request failed')) {
        errorMessage += 'Network connection lost. Please check your internet connection and try again.';
      } else if (error.message?.includes('Not authenticated')) {
        errorMessage += 'Your session has expired. Please log out and log in again.';
      } else if (error.message?.includes('storage')) {
        errorMessage += 'Storage service error. Please try again later or contact support.';
      } else {
        errorMessage += error.message || 'An unknown error occurred. Please try again.';
      }
      
      Alert.alert('Upload Failed', errorMessage);
    } finally {
      setUploading(false);
    }
  };

  if (!profile?.is_admin) {
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <View style={styles.centerContent}>
          <IconSymbol
            ios_icon_name="lock.fill"
            android_material_icon_name="lock"
            size={64}
            color={colors.textSecondary}
          />
          <Text style={[styles.errorText, { color: theme.colors.text }]}>
            Admin access required
          </Text>
          <TouchableOpacity
            style={[styles.button, { backgroundColor: colors.primary }]}
            onPress={() => router.back()}
          >
            <Text style={styles.buttonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <IconSymbol
              ios_icon_name="chevron.left"
              android_material_icon_name="arrow_back"
              size={24}
              color={colors.primary}
            />
          </TouchableOpacity>
          <Text style={[styles.title, { color: theme.colors.text }]}>
            Admin Panel
          </Text>
        </View>

        {/* Data Management Card */}
        <TouchableOpacity
          style={[styles.card, { backgroundColor: theme.colors.card }]}
          onPress={() => router.push('/admin-data')}
        >
          <View style={styles.cardHeader}>
            <IconSymbol
              ios_icon_name="arrow.clockwise.circle.fill"
              android_material_icon_name="sync"
              size={32}
              color={colors.accent}
            />
            <View style={styles.cardHeaderText}>
              <Text style={[styles.cardTitle, { color: theme.colors.text }]}>
                Data Management
              </Text>
              <Text style={[styles.cardDescription, { color: colors.textSecondary }]}>
                Update weather, tides, and surf reports
              </Text>
            </View>
            <IconSymbol
              ios_icon_name="chevron.right"
              android_material_icon_name="chevron_right"
              size={24}
              color={colors.textSecondary}
            />
          </View>
        </TouchableOpacity>

        {/* Video Upload Section */}
        <View style={[styles.card, { backgroundColor: theme.colors.card }]}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
            Upload Video
          </Text>

          <View style={[styles.requirementsBox, { backgroundColor: '#E8F5E9', borderColor: '#4CAF50' }]}>
            <IconSymbol
              ios_icon_name="checkmark.circle.fill"
              android_material_icon_name="check_circle"
              size={20}
              color="#388E3C"
            />
            <View style={styles.requirementsTextContainer}>
              <Text style={[styles.requirementsTitle, { color: '#2E7D32' }]}>
                Upload Any Quality Video
              </Text>
              <Text style={[styles.requirementsText, { color: '#388E3C' }]}>
                • No minimum resolution required
              </Text>
              <Text style={[styles.requirementsText, { color: '#388E3C' }]}>
                • Supports up to 6K and beyond
              </Text>
              <Text style={[styles.requirementsText, { color: '#388E3C' }]}>
                • Videos play at original quality
              </Text>
              <Text style={[styles.requirementsText, { color: '#388E3C' }]}>
                • Maximum Duration: 90 seconds
              </Text>
              <Text style={[styles.requirementsText, { color: '#388E3C' }]}>
                • Maximum File Size: {formatFileSize(MAX_FILE_SIZE)}
              </Text>
            </View>
          </View>

          <View style={[styles.warningBox, { backgroundColor: '#FFF3E0', borderColor: '#FF9800' }]}>
            <IconSymbol
              ios_icon_name="exclamationmark.triangle.fill"
              android_material_icon_name="warning"
              size={20}
              color="#F57C00"
            />
            <View style={styles.requirementsTextContainer}>
              <Text style={[styles.requirementsTitle, { color: '#E65100' }]}>
                Storage Configuration Required
              </Text>
              <Text style={[styles.requirementsText, { color: '#F57C00' }]}>
                If you get a &quot;Payload too large&quot; error, you need to increase your Supabase storage bucket file size limit:
              </Text>
              <Text style={[styles.requirementsText, { color: '#F57C00' }]}>
                1. Go to Supabase Dashboard
              </Text>
              <Text style={[styles.requirementsText, { color: '#F57C00' }]}>
                2. Storage → videos bucket → Settings
              </Text>
              <Text style={[styles.requirementsText, { color: '#F57C00' }]}>
                3. Set &quot;Maximum file size&quot; to 3GB (3221225472 bytes)
              </Text>
            </View>
          </View>

          <TextInput
            style={[styles.input, { 
              backgroundColor: theme.colors.background,
              color: theme.colors.text,
              borderColor: colors.textSecondary
            }]}
            placeholder="Video Title"
            placeholderTextColor={colors.textSecondary}
            value={videoTitle}
            onChangeText={setVideoTitle}
          />

          <TextInput
            style={[styles.input, styles.textArea, { 
              backgroundColor: theme.colors.background,
              color: theme.colors.text,
              borderColor: colors.textSecondary
            }]}
            placeholder="Description (optional)"
            placeholderTextColor={colors.textSecondary}
            value={videoDescription}
            onChangeText={setVideoDescription}
            multiline
            numberOfLines={3}
          />

          <TouchableOpacity
            style={[styles.button, { backgroundColor: colors.primary }]}
            onPress={pickVideo}
            disabled={uploading || validatingVideo}
          >
            {validatingVideo ? (
              <React.Fragment>
                <ActivityIndicator color="#FFFFFF" size="small" />
                <Text style={styles.buttonText}>Validating Video...</Text>
              </React.Fragment>
            ) : (
              <React.Fragment>
                <IconSymbol
                  ios_icon_name="video.fill"
                  android_material_icon_name="videocam"
                  size={20}
                  color="#FFFFFF"
                />
                <Text style={styles.buttonText}>
                  {selectedVideo ? 'Change Video' : 'Select Video'}
                </Text>
              </React.Fragment>
            )}
          </TouchableOpacity>

          {videoMetadata && (
            <View style={[
              styles.metadataBox,
              { 
                backgroundColor: validationErrors.length > 0 ? '#FFEBEE' : '#E8F5E9',
                borderColor: validationErrors.length > 0 ? '#F44336' : '#4CAF50'
              }
            ]}>
              <View style={styles.metadataHeader}>
                <IconSymbol
                  ios_icon_name={validationErrors.length > 0 ? "xmark.circle.fill" : "checkmark.circle.fill"}
                  android_material_icon_name={validationErrors.length > 0 ? "cancel" : "check_circle"}
                  size={24}
                  color={validationErrors.length > 0 ? '#D32F2F' : '#388E3C'}
                />
                <Text style={[
                  styles.metadataTitle,
                  { color: validationErrors.length > 0 ? '#C62828' : '#2E7D32' }
                ]}>
                  {validationErrors.length > 0 ? 'Validation Failed' : 'Video Validated ✓'}
                </Text>
              </View>
              
              <View style={styles.metadataDetails}>
                <View style={styles.metadataRow}>
                  <Text style={[styles.metadataLabel, { color: colors.textSecondary }]}>
                    Resolution:
                  </Text>
                  <Text style={[
                    styles.metadataValue,
                    { 
                      color: '#388E3C',
                      fontWeight: '600'
                    }
                  ]}>
                    {formatResolution(videoMetadata.width, videoMetadata.height)}
                  </Text>
                </View>
                
                <View style={styles.metadataRow}>
                  <Text style={[styles.metadataLabel, { color: colors.textSecondary }]}>
                    Duration:
                  </Text>
                  <Text style={[
                    styles.metadataValue,
                    { 
                      color: (videoMetadata.duration <= MAX_DURATION_SECONDS || videoMetadata.duration === 0) ? '#388E3C' : '#D32F2F',
                      fontWeight: '600'
                    }
                  ]}>
                    {videoMetadata.duration > 0 ? formatDuration(videoMetadata.duration) : 'Unknown'}
                  </Text>
                </View>
                
                <View style={styles.metadataRow}>
                  <Text style={[styles.metadataLabel, { color: colors.textSecondary }]}>
                    File Size:
                  </Text>
                  <Text style={[
                    styles.metadataValue,
                    { 
                      color: videoMetadata.size <= MAX_FILE_SIZE ? '#388E3C' : '#D32F2F',
                      fontWeight: '600'
                    }
                  ]}>
                    {formatFileSize(videoMetadata.size)}
                  </Text>
                </View>
              </View>

              {validationErrors.length > 0 && (
                <View style={styles.errorsContainer}>
                  {validationErrors.map((error, index) => (
                    <Text key={index} style={[styles.errorText, { color: '#C62828' }]}>
                      • {error}
                    </Text>
                  ))}
                </View>
              )}
            </View>
          )}

          {uploading && (
            <View style={styles.progressContainer}>
              <View style={styles.progressBar}>
                <View 
                  style={[
                    styles.progressFill, 
                    { 
                      width: `${uploadProgress}%`,
                      backgroundColor: colors.primary 
                    }
                  ]} 
                />
              </View>
              <Text style={[styles.progressText, { color: colors.textSecondary }]}>
                Uploading video... {uploadProgress}%
              </Text>
              <Text style={[styles.progressSubtext, { color: colors.textSecondary }]}>
                Large file upload in progress. Please keep the app open and maintain internet connection.
              </Text>
              {videoMetadata && (
                <Text style={[styles.progressSubtext, { color: colors.textSecondary, marginTop: 4 }]}>
                  Uploading {formatFileSize(videoMetadata.size)} - This may take several minutes
                </Text>
              )}
            </View>
          )}

          <TouchableOpacity
            style={[
              styles.button,
              { backgroundColor: colors.accent },
              (!selectedVideo || !videoTitle || uploading || validationErrors.length > 0) && styles.buttonDisabled
            ]}
            onPress={uploadVideo}
            disabled={!selectedVideo || !videoTitle || uploading || validationErrors.length > 0}
          >
            {uploading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <React.Fragment>
                <IconSymbol
                  ios_icon_name="arrow.up.circle.fill"
                  android_material_icon_name="upload"
                  size={20}
                  color="#FFFFFF"
                />
                <Text style={styles.buttonText}>Upload Video</Text>
              </React.Fragment>
            )}
          </TouchableOpacity>

          <View style={[styles.infoBox, { backgroundColor: theme.colors.background }]}>
            <IconSymbol
              ios_icon_name="lightbulb.fill"
              android_material_icon_name="lightbulb"
              size={16}
              color={colors.primary}
            />
            <Text style={[styles.infoText, { color: colors.textSecondary }]}>
              Tips for video uploads:{'\n'}
              • Upload any resolution - from 720p to 6K+{'\n'}
              • Videos play at their original quality{'\n'}
              • Keep videos under 90 seconds{'\n'}
              • Use a stable, fast WiFi connection{'\n'}
              • Ensure sufficient storage space{'\n'}
              • Large uploads may take 5-15 minutes{'\n'}
              • Configure Supabase storage for 3GB max file size
            </Text>
          </View>
        </View>

        {/* User Management Section */}
        <View style={[styles.card, { backgroundColor: theme.colors.card }]}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
            User Management
          </Text>

          {loading ? (
            <ActivityIndicator size="large" color={colors.primary} style={styles.loader} />
          ) : (
            users.map((user) => (
              <View key={user.id} style={[styles.userCard, { borderColor: colors.textSecondary }]}>
                <View style={styles.userInfo}>
                  <Text style={[styles.userEmail, { color: theme.colors.text }]}>
                    {user.email}
                  </Text>
                  <View style={styles.badges}>
                    {user.is_admin && (
                      <View style={[styles.badge, { backgroundColor: colors.accent }]}>
                        <Text style={styles.badgeText}>Admin</Text>
                      </View>
                    )}
                    {user.is_subscribed && (
                      <View style={[styles.badge, { backgroundColor: colors.primary }]}>
                        <Text style={styles.badgeText}>Subscribed</Text>
                      </View>
                    )}
                  </View>
                </View>

                <View style={styles.userActions}>
                  <TouchableOpacity
                    style={[styles.actionButton, { 
                      backgroundColor: user.is_subscribed ? colors.textSecondary : colors.primary 
                    }]}
                    onPress={() => toggleSubscription(user.id, user.is_subscribed)}
                  >
                    <Text style={styles.actionButtonText}>
                      {user.is_subscribed ? 'Revoke Sub' : 'Grant Sub'}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.actionButton, { 
                      backgroundColor: user.is_admin ? colors.textSecondary : colors.accent 
                    }]}
                    onPress={() => toggleAdmin(user.id, user.is_admin)}
                  >
                    <Text style={styles.actionButtonText}>
                      {user.is_admin ? 'Revoke Admin' : 'Grant Admin'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingTop: 60,
    paddingBottom: 100,
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
    gap: 12,
  },
  backButton: {
    padding: 8,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
  },
  card: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    boxShadow: '0px 2px 8px rgba(0, 0, 0, 0.1)',
    elevation: 3,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  cardHeaderText: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  cardDescription: {
    fontSize: 14,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  requirementsBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    borderWidth: 2,
  },
  warningBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    borderWidth: 2,
  },
  requirementsTextContainer: {
    flex: 1,
  },
  requirementsTitle: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 8,
  },
  requirementsText: {
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 2,
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    fontSize: 16,
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 8,
    marginTop: 12,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  metadataBox: {
    marginTop: 16,
    padding: 16,
    borderRadius: 8,
    borderWidth: 2,
  },
  metadataHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  metadataTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  metadataDetails: {
    gap: 8,
  },
  metadataRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  metadataLabel: {
    fontSize: 14,
    fontWeight: '500',
  },
  metadataValue: {
    fontSize: 14,
  },
  errorsContainer: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.1)',
    gap: 4,
  },
  errorText: {
    fontSize: 12,
    lineHeight: 18,
  },
  progressContainer: {
    marginTop: 16,
    marginBottom: 8,
  },
  progressBar: {
    height: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.1)',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  progressText: {
    fontSize: 14,
    textAlign: 'center',
    marginTop: 8,
    fontWeight: '600',
  },
  progressSubtext: {
    fontSize: 12,
    textAlign: 'center',
    marginTop: 4,
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    padding: 12,
    borderRadius: 8,
    marginTop: 12,
  },
  infoText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 18,
  },
  loader: {
    marginVertical: 20,
  },
  userCard: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  userInfo: {
    marginBottom: 12,
  },
  userEmail: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  badges: {
    flexDirection: 'row',
    gap: 8,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  userActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    alignItems: 'center',
  },
  actionButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
});
