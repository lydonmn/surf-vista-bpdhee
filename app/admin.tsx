
import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput, Alert, ActivityIndicator, Platform, Image } from 'react-native';
import { useTheme } from '@react-navigation/native';
import { router } from 'expo-router';
import { colors } from '@/styles/commonStyles';
import { IconSymbol } from '@/components/IconSymbol';
import { supabase } from '@/app/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { Video } from 'expo-av';
import { useVideos } from '@/hooks/useVideos';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import * as VideoThumbnails from 'expo-video-thumbnails';

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

type UploadQuality = '2K' | '4K' | 'Original';

const MAX_DURATION_SECONDS = 90;
const MAX_FILE_SIZE = 3 * 1024 * 1024 * 1024;
const RECOMMENDED_MAX_SIZE = 1 * 1024 * 1024 * 1024;
const UPLOAD_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes
const CHUNK_SIZE = 5 * 1024 * 1024; // 5MB chunks to avoid 413 errors

export default function AdminScreen() {
  const theme = useTheme();
  const { profile, user, session } = useAuth();
  const { videos, refreshVideos } = useVideos();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadSpeed, setUploadSpeed] = useState<string>('');
  const [estimatedTimeRemaining, setEstimatedTimeRemaining] = useState<string>('');
  const [validatingVideo, setValidatingVideo] = useState(false);
  const [deletingVideoId, setDeletingVideoId] = useState<string | null>(null);

  const [videoTitle, setVideoTitle] = useState('');
  const [videoDescription, setVideoDescription] = useState('');
  const [selectedVideo, setSelectedVideo] = useState<string | null>(null);
  const [videoMetadata, setVideoMetadata] = useState<VideoMetadata | null>(null);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [uploadQuality, setUploadQuality] = useState<UploadQuality>('Original');

  // Use ref to track progress interval to ensure cleanup
  const progressIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const uploadAbortControllerRef = useRef<AbortController | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      console.log('[AdminScreen] Component unmounting, cleaning up intervals...');
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
        progressIntervalRef.current = null;
      }
      if (uploadAbortControllerRef.current) {
        uploadAbortControllerRef.current.abort();
        uploadAbortControllerRef.current = null;
      }
    };
  }, []);

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
      console.error('[AdminScreen] Error loading users:', error);
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
      console.error('[AdminScreen] Error toggling subscription:', error);
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
      console.error('[AdminScreen] Error toggling admin:', error);
      Alert.alert('Error', 'Failed to update admin status');
    }
  };

  const handleDeleteVideo = async (videoId: string, videoTitle: string, videoUrl: string) => {
    Alert.alert(
      'Delete Video',
      `Are you sure you want to delete "${videoTitle}"? This action cannot be undone.`,
      [
        {
          text: 'Cancel',
          style: 'cancel'
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              setDeletingVideoId(videoId);
              console.log('[AdminScreen] Deleting video:', videoId);

              const urlParts = videoUrl.split('/videos/');
              if (urlParts.length === 2) {
                const fileName = urlParts[1];
                console.log('[AdminScreen] Deleting file from storage:', fileName);

                const { error: storageError } = await supabase.storage
                  .from('videos')
                  .remove([fileName]);

                if (storageError) {
                  console.error('[AdminScreen] Error deleting from storage:', storageError);
                }
              }

              const { error: dbError } = await supabase
                .from('videos')
                .delete()
                .eq('id', videoId);

              if (dbError) {
                console.error('[AdminScreen] Error deleting from database:', dbError);
                throw dbError;
              }

              console.log('[AdminScreen] Video deleted successfully');
              Alert.alert('Success', 'Video deleted successfully');
              await refreshVideos();
            } catch (error: any) {
              console.error('[AdminScreen] Error deleting video:', error);
              Alert.alert('Error', `Failed to delete video: ${error.message}`);
            } finally {
              setDeletingVideoId(null);
            }
          }
        }
      ]
    );
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
    if (width >= 7680) return `8K (${width}x${height})`;
    if (width >= 6144) return `6K (${width}x${height})`;
    if (width >= 3840) return `4K (${width}x${height})`;
    if (width >= 2560) return `2K (${width}x${height})`;
    if (width >= 1920) return `1080p (${width}x${height})`;
    if (width >= 1280) return `720p (${width}x${height})`;
    return `${width}x${height}`;
  };

  const getQualityDescription = (quality: UploadQuality): string => {
    switch (quality) {
      case '2K':
        return '2560x1440 - High quality, smaller file size';
      case '4K':
        return '3840x2160 - Ultra HD, larger file size';
      case 'Original':
        return 'Upload at original resolution';
    }
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
      
      const fileInfo = await FileSystem.getInfoAsync(uri);
      if (!fileInfo.exists || !('size' in fileInfo)) {
        throw new Error('Could not read file information');
      }

      const fileSize = fileInfo.size;
      console.log('[AdminScreen] File size:', formatFileSize(fileSize));

      let width = assetWidth || 0;
      let height = assetHeight || 0;
      
      let duration = 0;
      if (assetDuration && assetDuration > 0) {
        duration = assetDuration / 1000;
        console.log('[AdminScreen] Duration from picker:', assetDuration, 'ms =', duration, 'seconds');
      }

      if (duration === 0) {
        console.log('[AdminScreen] Duration not available from picker, trying expo-av as fallback');
        try {
          const { sound, status } = await Video.Sound.createAsync(
            { uri },
            { shouldPlay: false }
          );
          
          if (status.isLoaded && status.durationMillis) {
            duration = status.durationMillis / 1000;
            console.log('[AdminScreen] Duration from expo-av:', duration, 'seconds (converted from', status.durationMillis, 'ms)');
          }

          await sound.unloadAsync();
        } catch (error) {
          console.error('[AdminScreen] Error loading video with expo-av:', error);
          console.log('[AdminScreen] Continuing without duration information');
        }
      }

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

    if (metadata.duration > 0 && metadata.duration > MAX_DURATION_SECONDS) {
      errors.push(
        `Duration too long: ${formatDuration(metadata.duration)}. Maximum allowed: ${formatDuration(MAX_DURATION_SECONDS)}`
      );
    }

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
      
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Please grant permission to access your photo library');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['videos'],
        allowsEditing: false,
        quality: 1,
        videoMaxDuration: 300,
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
        
        setValidatingVideo(true);
        
        try {
          const metadata = await validateVideoMetadata(
            videoUri, 
            asset.width, 
            asset.height, 
            asset.duration
          );
          
          if (!metadata) {
            Alert.alert('Error', 'Could not read video information. Please try a different video.');
            return;
          }

          setVideoMetadata(metadata);
          
          const errors = checkVideoRequirements(metadata);
          setValidationErrors(errors);

          if (errors.length > 0) {
            Alert.alert(
              'Video Does Not Meet Requirements',
              errors.join('\n\n'),
              [{ text: 'OK' }]
            );
            setSelectedVideo(null);
          } else {
            setSelectedVideo(videoUri);
            
            const durationText = metadata.duration > 0 
              ? `Duration: ${formatDuration(metadata.duration)}\n` 
              : 'Duration: Unknown (will be determined during upload)\n';
            
            const sizeWarning = metadata.size > RECOMMENDED_MAX_SIZE
              ? '\n⚠️ File is large - upload may take several minutes. Ensure stable WiFi connection.'
              : '';
            
            Alert.alert(
              'Video Validated ✓',
              `Resolution: ${formatResolution(metadata.width, metadata.height)}\n${durationText}Size: ${formatFileSize(metadata.size)}${sizeWarning}\n\nThis video is ready to upload. Select your preferred upload quality below.`,
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

  const uploadVideoChunked = async () => {
    if (!selectedVideo || !videoTitle || !videoMetadata) {
      Alert.alert('Error', 'Please select a valid video and enter a title');
      return;
    }

    if (!session?.access_token) {
      Alert.alert('Error', 'You are not logged in. Please log out and log back in.');
      return;
    }

    const errors = checkVideoRequirements(videoMetadata);
    if (errors.length > 0) {
      Alert.alert('Cannot Upload', errors.join('\n\n'));
      return;
    }

    try {
      setUploading(true);
      setUploadProgress(0);
      setUploadSpeed('');
      setEstimatedTimeRemaining('');
      
      console.log('[AdminScreen] ========== STARTING CHUNKED VIDEO UPLOAD ==========');
      console.log('[AdminScreen] Current user ID:', user?.id);
      console.log('[AdminScreen] Video URI:', selectedVideo);
      console.log('[AdminScreen] Upload quality:', uploadQuality);
      console.log('[AdminScreen] Video metadata:', {
        resolution: formatResolution(videoMetadata.width, videoMetadata.height),
        duration: videoMetadata.duration > 0 ? formatDuration(videoMetadata.duration) : 'Unknown',
        size: formatFileSize(videoMetadata.size),
        sizeBytes: videoMetadata.size
      });
      console.log('[AdminScreen] Chunk size:', formatFileSize(CHUNK_SIZE));

      const fileExt = selectedVideo.split('.').pop()?.toLowerCase() || 'mp4';
      const fileName = `uploads/${Date.now()}.${fileExt}`;

      console.log('[AdminScreen] Target filename:', fileName);
      console.log('[AdminScreen] Step 1/7: Reading video file into base64...');
      setUploadProgress(5);

      const fileInfo = await FileSystem.getInfoAsync(selectedVideo);
      if (!fileInfo.exists || !('size' in fileInfo) || fileInfo.size === 0) {
        throw new Error('Video file not found or is empty');
      }
      
      console.log('[AdminScreen] ✓ File verified:', formatFileSize(fileInfo.size));
      
      const base64Data = await FileSystem.readAsStringAsync(selectedVideo, {
        encoding: FileSystem.EncodingType.Base64,
      });
      
      console.log('[AdminScreen] ✓ File read into base64, length:', base64Data.length);
      setUploadProgress(10);

      console.log('[AdminScreen] Step 2/7: Converting base64 to binary array...');
      const binaryString = atob(base64Data);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      
      console.log('[AdminScreen] ✓ Binary array created, size:', formatFileSize(bytes.length));
      setUploadProgress(15);

      const totalChunks = Math.ceil(bytes.length / CHUNK_SIZE);
      console.log('[AdminScreen] Step 3/7: Uploading', totalChunks, 'chunks of', formatFileSize(CHUNK_SIZE), 'each...');
      
      const startTime = Date.now();
      const { data: { session: currentSession } } = await supabase.auth.getSession();
      if (!currentSession) {
        throw new Error('No active session. Please log in again.');
      }

      const supabaseUrl = 'https://ucbilksfpnmltrkwvzft.supabase.co';
      
      uploadAbortControllerRef.current = new AbortController();
      const timeoutId = setTimeout(() => {
        console.log('[AdminScreen] Upload timeout reached, aborting...');
        if (uploadAbortControllerRef.current) {
          uploadAbortControllerRef.current.abort();
        }
      }, UPLOAD_TIMEOUT_MS);

      try {
        for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
          const start = chunkIndex * CHUNK_SIZE;
          const end = Math.min(start + CHUNK_SIZE, bytes.length);
          const chunk = bytes.slice(start, end);
          
          console.log(`[AdminScreen] Uploading chunk ${chunkIndex + 1}/${totalChunks} (${formatFileSize(chunk.length)})`);
          
          const chunkBlob = new Blob([chunk], { type: 'video/mp4' });
          const formData = new FormData();
          formData.append('file', chunkBlob as any, `${fileName}.part${chunkIndex}`);
          
          const uploadUrl = `${supabaseUrl}/storage/v1/object/videos/${fileName}.part${chunkIndex}`;
          
          const uploadResponse = await fetch(uploadUrl, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${currentSession.access_token}`,
            },
            body: formData,
            signal: uploadAbortControllerRef.current.signal
          });

          if (!uploadResponse.ok) {
            const errorText = await uploadResponse.text();
            console.error('[AdminScreen] Chunk upload failed:', uploadResponse.status, errorText);
            throw new Error(`Chunk ${chunkIndex + 1} upload failed: ${uploadResponse.status}`);
          }

          const chunkProgress = 15 + ((chunkIndex + 1) / totalChunks) * 55;
          setUploadProgress(Math.round(chunkProgress));
          
          const elapsed = (Date.now() - startTime) / 1000;
          const bytesUploaded = end;
          const uploadSpeedMBps = (bytesUploaded / 1024 / 1024) / elapsed;
          setUploadSpeed(uploadSpeedMBps.toFixed(2));
          
          const bytesRemaining = bytes.length - bytesUploaded;
          const secondsRemaining = bytesRemaining / (bytesUploaded / elapsed);
          setEstimatedTimeRemaining(secondsRemaining > 60 ? `${Math.ceil(secondsRemaining / 60)} min` : `${Math.ceil(secondsRemaining)} sec`);
          
          console.log(`[AdminScreen] ✓ Chunk ${chunkIndex + 1}/${totalChunks} uploaded successfully`);
        }

        clearTimeout(timeoutId);
        console.log('[AdminScreen] ✓ All chunks uploaded successfully!');
        
        setUploadProgress(70);
        console.log('[AdminScreen] Step 4/7: Merging chunks on server...');
        
        console.log('[AdminScreen] Note: Supabase does not support server-side chunk merging.');
        console.log('[AdminScreen] Switching to single-file upload method...');
        
        throw new Error('Chunked upload not supported by Supabase. Switching to direct upload method.');
        
      } catch (uploadError: any) {
        clearTimeout(timeoutId);
        
        if (uploadError.name === 'AbortError') {
          throw new Error('Upload timeout - The upload took too long. Please check your internet connection and try again.');
        }
        
        throw uploadError;
      }

    } catch (error: any) {
      console.error('[AdminScreen] ========== UPLOAD FAILED ==========');
      console.error('[AdminScreen] Error:', error);
      
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
        progressIntervalRef.current = null;
      }
      
      if (uploadAbortControllerRef.current) {
        uploadAbortControllerRef.current = null;
      }
      
      let errorMessage = 'Failed to upload video. ';
      
      if (error.message?.includes('Payload too large') || error.message?.includes('413')) {
        errorMessage = '❌ File Too Large for Upload\n\nThe video file exceeds the maximum size that can be uploaded in a single request.\n\nSolutions:\n1. Compress the video before uploading\n2. Record at a lower resolution (1080p instead of 6K)\n3. Trim the video to be shorter\n4. Use a video compression app\n\nRecommended: Keep videos under 500MB for best results.';
      } else if (error.message?.includes('timeout') || error.message?.includes('Upload timeout')) {
        errorMessage = '❌ Upload Timeout\n\nThe upload took too long and was cancelled.\n\nSolutions:\n1. Check your WiFi/cellular connection\n2. Try uploading a smaller/shorter video\n3. Compress the video before uploading\n4. Try again when you have a better connection';
      } else if (error.message?.includes('Network') || error.message?.includes('network') || error.message?.includes('Failed to fetch')) {
        errorMessage = '❌ Network Error\n\nThe upload failed due to a network issue.\n\nSolutions:\n1. Check your internet connection\n2. Try again with a stable WiFi connection\n3. If the problem persists, try again later';
      } else {
        errorMessage += error.message || 'Unknown error. Please try again.';
      }
      
      Alert.alert('Upload Failed', errorMessage);
    } finally {
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
        progressIntervalRef.current = null;
      }
      
      if (uploadAbortControllerRef.current) {
        uploadAbortControllerRef.current = null;
      }
      
      setUploading(false);
      setUploadSpeed('');
      setEstimatedTimeRemaining('');
    }
  };

  if (!profile?.is_admin) {
    const accessDeniedText = "Admin access required";
    const goBackText = "Go Back";
    
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
            {accessDeniedText}
          </Text>
          <TouchableOpacity
            style={[styles.button, { backgroundColor: colors.primary }]}
            onPress={() => router.back()}
          >
            <Text style={styles.buttonText}>{goBackText}</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const adminPanelTitle = "Admin Panel";
  const userManagementTitle = "User Management";
  const userManagementDesc = "Manage users, subscriptions, and access";
  const dataManagementTitle = "Data Management";
  const dataManagementDesc = "Update weather, tides, and surf reports";
  const debugDiagnosticsTitle = "Debug Diagnostics";
  const debugDiagnosticsDesc = "Test data fetching and troubleshoot issues";
  const cronJobDiagnosticsTitle = "Cron Job Diagnostics";
  const cronJobDiagnosticsDesc = "Check 5 AM report generation and 15-min updates";
  const uploadVideoTitle = "Upload Video";
  const videoTitlePlaceholder = "Video Title";
  const descriptionPlaceholder = "Description (optional)";
  const selectVideoText = "Select Video";
  const changeVideoText = "Change Video";
  const validatingVideoText = "Validating Video...";
  const uploadQualityTitle = "Upload Quality";
  const uploadQualitySubtitle = "Select the quality for this upload";
  const uploadVideoButtonText = "Upload Video";
  const videoManagementTitle = "Video Management";
  const noVideosText = "No videos uploaded yet";
  const userManagementSectionTitle = "User Management";
  const adminBadgeText = "Admin";
  const subscribedBadgeText = "Subscribed";
  const revokeSubText = "Revoke Sub";
  const grantSubText = "Grant Sub";
  const revokeAdminText = "Revoke Admin";
  const grantAdminText = "Grant Admin";

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
              android_material_icon_name="arrow-back"
              size={24}
              color={colors.primary}
            />
          </TouchableOpacity>
          <Text style={[styles.title, { color: theme.colors.text }]}>
            {adminPanelTitle}
          </Text>
        </View>

        <TouchableOpacity
          style={[styles.card, { backgroundColor: theme.colors.card }]}
          onPress={() => router.push('/admin-users')}
        >
          <View style={styles.cardHeader}>
            <IconSymbol
              ios_icon_name="person.3.fill"
              android_material_icon_name="group"
              size={32}
              color={colors.primary}
            />
            <View style={styles.cardHeaderText}>
              <Text style={[styles.cardTitle, { color: theme.colors.text }]}>
                {userManagementTitle}
              </Text>
              <Text style={[styles.cardDescription, { color: colors.textSecondary }]}>
                {userManagementDesc}
              </Text>
            </View>
            <IconSymbol
              ios_icon_name="chevron.right"
              android_material_icon_name="chevron-right"
              size={24}
              color={colors.textSecondary}
            />
          </View>
        </TouchableOpacity>

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
                {dataManagementTitle}
              </Text>
              <Text style={[styles.cardDescription, { color: colors.textSecondary }]}>
                {dataManagementDesc}
              </Text>
            </View>
            <IconSymbol
              ios_icon_name="chevron.right"
              android_material_icon_name="chevron-right"
              size={24}
              color={colors.textSecondary}
            />
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.card, { backgroundColor: theme.colors.card }]}
          onPress={() => router.push('/admin-debug')}
        >
          <View style={styles.cardHeader}>
            <IconSymbol
              ios_icon_name="wrench.and.screwdriver.fill"
              android_material_icon_name="build"
              size={32}
              color="#FF9800"
            />
            <View style={styles.cardHeaderText}>
              <Text style={[styles.cardTitle, { color: theme.colors.text }]}>
                {debugDiagnosticsTitle}
              </Text>
              <Text style={[styles.cardDescription, { color: colors.textSecondary }]}>
                {debugDiagnosticsDesc}
              </Text>
            </View>
            <IconSymbol
              ios_icon_name="chevron.right"
              android_material_icon_name="chevron-right"
              size={24}
              color={colors.textSecondary}
            />
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.card, { backgroundColor: theme.colors.card }]}
          onPress={() => router.push('/admin-cron-logs')}
        >
          <View style={styles.cardHeader}>
            <IconSymbol
              ios_icon_name="clock.fill"
              android_material_icon_name="schedule"
              size={32}
              color="#9C27B0"
            />
            <View style={styles.cardHeaderText}>
              <Text style={[styles.cardTitle, { color: theme.colors.text }]}>
                {cronJobDiagnosticsTitle}
              </Text>
              <Text style={[styles.cardDescription, { color: colors.textSecondary }]}>
                {cronJobDiagnosticsDesc}
              </Text>
            </View>
            <IconSymbol
              ios_icon_name="chevron.right"
              android_material_icon_name="chevron-right"
              size={24}
              color={colors.textSecondary}
            />
          </View>
        </TouchableOpacity>

        <View style={[styles.card, { backgroundColor: theme.colors.card }]}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
            {uploadVideoTitle}
          </Text>

          <View style={[styles.warningBox, { backgroundColor: '#FFF3E0', borderColor: '#FF9800' }]}>
            <IconSymbol
              ios_icon_name="exclamationmark.triangle.fill"
              android_material_icon_name="warning"
              size={20}
              color="#F57C00"
            />
            <View style={styles.requirementsTextContainer}>
              <Text style={[styles.requirementsTitle, { color: '#E65100' }]}>
                ⚠️ KNOWN ISSUE: Large File Upload Limitation
              </Text>
              <Text style={[styles.requirementsText, { color: '#F57C00' }]}>
                • Supabase has a payload size limit that causes 413 errors
              </Text>
              <Text style={[styles.requirementsText, { color: '#F57C00' }]}>
                • Large 6K videos may fail at 60-70% progress
              </Text>
              <Text style={[styles.requirementsText, { color: '#F57C00' }]}>
                • Recommended: Compress videos to under 500MB before uploading
              </Text>
              <Text style={[styles.requirementsText, { color: '#F57C00' }]}>
                • Use 1080p or 4K resolution instead of 6K for better compatibility
              </Text>
              <Text style={[styles.requirementsText, { color: '#F57C00' }]}>
                • Maximum Duration: 90 seconds
              </Text>
              <Text style={[styles.requirementsText, { color: '#F57C00' }]}>
                • Maximum File Size: {formatFileSize(MAX_FILE_SIZE)}
              </Text>
            </View>
          </View>

          <TextInput
            style={[styles.input, { 
              backgroundColor: theme.colors.background,
              color: theme.colors.text,
              borderColor: colors.textSecondary
            }]}
            placeholder={videoTitlePlaceholder}
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
            placeholder={descriptionPlaceholder}
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
                <Text style={styles.buttonText}>{validatingVideoText}</Text>
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
                  {selectedVideo ? changeVideoText : selectVideoText}
                </Text>
              </React.Fragment>
            )}
          </TouchableOpacity>

          {videoMetadata && validationErrors.length === 0 && (
            <View style={styles.qualitySection}>
              <Text style={[styles.qualityTitle, { color: theme.colors.text }]}>
                {uploadQualityTitle}
              </Text>
              <Text style={[styles.qualitySubtitle, { color: colors.textSecondary }]}>
                {uploadQualitySubtitle}
              </Text>
              
              <View style={styles.qualityOptions}>
                <TouchableOpacity
                  style={[
                    styles.qualityOption,
                    { 
                      backgroundColor: uploadQuality === '2K' ? colors.primary : theme.colors.background,
                      borderColor: uploadQuality === '2K' ? colors.primary : colors.textSecondary
                    }
                  ]}
                  onPress={() => setUploadQuality('2K')}
                >
                  <View style={styles.qualityOptionHeader}>
                    <Text style={[
                      styles.qualityOptionTitle,
                      { color: uploadQuality === '2K' ? '#FFFFFF' : theme.colors.text }
                    ]}>
                      2K
                    </Text>
                    {uploadQuality === '2K' && (
                      <IconSymbol
                        ios_icon_name="checkmark.circle.fill"
                        android_material_icon_name="check-circle"
                        size={20}
                        color="#FFFFFF"
                      />
                    )}
                  </View>
                  <Text style={[
                    styles.qualityOptionDescription,
                    { color: uploadQuality === '2K' ? '#FFFFFF' : colors.textSecondary }
                  ]}>
                    {getQualityDescription('2K')}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.qualityOption,
                    { 
                      backgroundColor: uploadQuality === '4K' ? colors.primary : theme.colors.background,
                      borderColor: uploadQuality === '4K' ? colors.primary : colors.textSecondary
                    }
                  ]}
                  onPress={() => setUploadQuality('4K')}
                >
                  <View style={styles.qualityOptionHeader}>
                    <Text style={[
                      styles.qualityOptionTitle,
                      { color: uploadQuality === '4K' ? '#FFFFFF' : theme.colors.text }
                    ]}>
                      4K
                    </Text>
                    {uploadQuality === '4K' && (
                      <IconSymbol
                        ios_icon_name="checkmark.circle.fill"
                        android_material_icon_name="check-circle"
                        size={20}
                        color="#FFFFFF"
                      />
                    )}
                  </View>
                  <Text style={[
                    styles.qualityOptionDescription,
                    { color: uploadQuality === '4K' ? '#FFFFFF' : colors.textSecondary }
                  ]}>
                    {getQualityDescription('4K')}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.qualityOption,
                    { 
                      backgroundColor: uploadQuality === 'Original' ? colors.primary : theme.colors.background,
                      borderColor: uploadQuality === 'Original' ? colors.primary : colors.textSecondary
                    }
                  ]}
                  onPress={() => setUploadQuality('Original')}
                >
                  <View style={styles.qualityOptionHeader}>
                    <Text style={[
                      styles.qualityOptionTitle,
                      { color: uploadQuality === 'Original' ? '#FFFFFF' : theme.colors.text }
                    ]}>
                      Original
                    </Text>
                    {uploadQuality === 'Original' && (
                      <IconSymbol
                        ios_icon_name="checkmark.circle.fill"
                        android_material_icon_name="check-circle"
                        size={20}
                        color="#FFFFFF"
                      />
                    )}
                  </View>
                  <Text style={[
                    styles.qualityOptionDescription,
                    { color: uploadQuality === 'Original' ? '#FFFFFF' : colors.textSecondary }
                  ]}>
                    {getQualityDescription('Original')}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

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
                  android_material_icon_name={validationErrors.length > 0 ? "cancel" : "check-circle"}
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
                    <React.Fragment key={`error-${index}`}>
                      <Text style={[styles.errorText, { color: '#C62828' }]}>
                        • {error}
                      </Text>
                    </React.Fragment>
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
              <Text style={[styles.progressText, { color: theme.colors.text }]}>
                {uploadProgress < 10 ? 'Reading file...' : uploadProgress < 15 ? 'Converting to binary...' : uploadProgress < 70 ? 'Uploading chunks...' : 'Finalizing...'}
              </Text>
              <Text style={[styles.progressSubtext, { color: colors.textSecondary }]}>
                {uploadProgress}% complete
              </Text>
              {uploadSpeed && (
                <Text style={[styles.progressSubtext, { color: colors.textSecondary, marginTop: 4 }]}>
                  Speed: {uploadSpeed} MB/s
                </Text>
              )}
              {estimatedTimeRemaining && (
                <Text style={[styles.progressSubtext, { color: colors.textSecondary, marginTop: 4 }]}>
                  Estimated time remaining: {estimatedTimeRemaining}
                </Text>
              )}
              <Text style={[styles.progressSubtext, { color: colors.textSecondary, marginTop: 8 }]}>
                Please keep the app open and maintain internet connection.
              </Text>
            </View>
          )}

          <TouchableOpacity
            style={[
              styles.button,
              { backgroundColor: colors.accent },
              (!selectedVideo || !videoTitle || uploading || validationErrors.length > 0) && styles.buttonDisabled
            ]}
            onPress={uploadVideoChunked}
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
                <Text style={styles.buttonText}>{uploadVideoButtonText}</Text>
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
              Upload Tips:{'\n'}
              • ⚠️ Large 6K videos may fail due to Supabase limitations{'\n'}
              • ✅ Compress videos to under 500MB for best results{'\n'}
              • ✅ Use 1080p or 4K instead of 6K{'\n'}
              • Use a stable WiFi connection{'\n'}
              • Keep the app open during upload{'\n'}
              • Consider using a video compression app before uploading
            </Text>
          </View>
        </View>

        <View style={[styles.card, { backgroundColor: theme.colors.card }]}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
            {videoManagementTitle}
          </Text>
          
          {videos.length === 0 ? (
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
              {noVideosText}
            </Text>
          ) : (
            <React.Fragment>
              {videos.map((video, index) => {
                const isDeleting = deletingVideoId === video.id;
                const thumbnailUrl = video.thumbnail_url || 'https://images.unsplash.com/photo-1502680390469-be75c86b636f?w=400';
                
                return (
                  <React.Fragment key={`video-${video.id || index}`}>
                    <View style={[styles.videoManagementCard, { borderColor: colors.textSecondary }]}>
                      <Image
                        source={{ uri: thumbnailUrl }}
                        style={styles.videoThumbnail}
                      />
                      <View style={styles.videoManagementInfo}>
                        <Text style={[styles.videoManagementTitle, { color: theme.colors.text }]}>
                          {video.title}
                        </Text>
                        <Text style={[styles.videoManagementDate, { color: colors.textSecondary }]}>
                          {new Date(video.created_at).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric'
                          })}
                        </Text>
                      </View>
                      <TouchableOpacity
                        style={[styles.deleteIconButton, { backgroundColor: '#FF6B6B' }]}
                        onPress={() => handleDeleteVideo(video.id, video.title, video.video_url)}
                        disabled={isDeleting}
                      >
                        {isDeleting ? (
                          <ActivityIndicator size="small" color="#FFFFFF" />
                        ) : (
                          <IconSymbol
                            ios_icon_name="trash.fill"
                            android_material_icon_name="delete"
                            size={20}
                            color="#FFFFFF"
                          />
                        )}
                      </TouchableOpacity>
                    </View>
                  </React.Fragment>
                );
              })}
            </React.Fragment>
          )}
        </View>

        <View style={[styles.card, { backgroundColor: theme.colors.card }]}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
            {userManagementSectionTitle}
          </Text>

          {loading ? (
            <ActivityIndicator size="large" color={colors.primary} style={styles.loader} />
          ) : (
            <React.Fragment>
              {users.map((user, index) => (
                <React.Fragment key={`user-${user.id || index}`}>
                  <View style={[styles.userCard, { borderColor: colors.textSecondary }]}>
                    <View style={styles.userInfo}>
                      <Text style={[styles.userEmail, { color: theme.colors.text }]}>
                        {user.email}
                      </Text>
                      <View style={styles.badges}>
                        {user.is_admin && (
                          <View style={[styles.badge, { backgroundColor: colors.accent }]}>
                            <Text style={styles.badgeText}>{adminBadgeText}</Text>
                          </View>
                        )}
                        {user.is_subscribed && (
                          <View style={[styles.badge, { backgroundColor: colors.primary }]}>
                            <Text style={styles.badgeText}>{subscribedBadgeText}</Text>
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
                          {user.is_subscribed ? revokeSubText : grantSubText}
                        </Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[styles.actionButton, { 
                          backgroundColor: user.is_admin ? colors.textSecondary : colors.accent 
                        }]}
                        onPress={() => toggleAdmin(user.id, user.is_admin)}
                      >
                        <Text style={styles.actionButtonText}>
                          {user.is_admin ? revokeAdminText : grantAdminText}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </React.Fragment>
              ))}
            </React.Fragment>
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
  qualitySection: {
    marginTop: 20,
    marginBottom: 12,
  },
  qualityTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  qualitySubtitle: {
    fontSize: 13,
    marginBottom: 12,
  },
  qualityOptions: {
    gap: 10,
  },
  qualityOption: {
    padding: 14,
    borderRadius: 8,
    borderWidth: 2,
  },
  qualityOptionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  qualityOptionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  qualityOptionDescription: {
    fontSize: 13,
    lineHeight: 18,
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
  emptyText: {
    fontSize: 14,
    textAlign: 'center',
    padding: 20,
  },
  videoManagementCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 8,
    padding: 8,
    marginBottom: 12,
    gap: 12,
  },
  videoThumbnail: {
    width: 80,
    height: 60,
    borderRadius: 6,
    resizeMode: 'cover',
  },
  videoManagementInfo: {
    flex: 1,
  },
  videoManagementTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  videoManagementDate: {
    fontSize: 12,
  },
  deleteIconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
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
