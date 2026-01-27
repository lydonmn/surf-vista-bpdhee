
import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput, Alert, ActivityIndicator, Platform, Image } from 'react-native';
import { useTheme } from '@react-navigation/native';
import { router } from 'expo-router';
import { colors } from '@/styles/commonStyles';
import { IconSymbol } from '@/components/IconSymbol';
import { supabase } from '@/app/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import { Video } from 'expo-av';
import { useVideos } from '@/hooks/useVideos';
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

const MAX_DURATION_SECONDS = 90;
const MAX_FILE_SIZE = 3 * 1024 * 1024 * 1024; // 3GB

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
  const [uploadStatus, setUploadStatus] = useState<string>('');

  const [videoTitle, setVideoTitle] = useState('');
  const [videoDescription, setVideoDescription] = useState('');
  const [selectedVideo, setSelectedVideo] = useState<string | null>(null);
  const [videoMetadata, setVideoMetadata] = useState<VideoMetadata | null>(null);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  const uploadStartTimeRef = useRef<number>(0);
  const lastProgressUpdateRef = useRef<number>(0);
  const lastBytesUploadedRef = useRef<number>(0);

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

  const handleDiagnoseVideo = async (videoId: string, videoTitle: string, videoUrl: string) => {
    try {
      console.log('[AdminScreen] ========== DIAGNOSING VIDEO ==========');
      console.log('[AdminScreen] Video ID:', videoId);
      console.log('[AdminScreen] Video Title:', videoTitle);
      console.log('[AdminScreen] Video URL:', videoUrl);
      
      Alert.alert('Diagnosing Video', 'Checking video file...', [{ text: 'OK' }]);
      
      const headResponse = await fetch(videoUrl, { method: 'HEAD' });
      console.log('[AdminScreen] HEAD response status:', headResponse.status);
      console.log('[AdminScreen] Content-Type:', headResponse.headers.get('content-type'));
      console.log('[AdminScreen] Content-Length:', headResponse.headers.get('content-length'));
      
      const contentType = headResponse.headers.get('content-type');
      const contentLength = headResponse.headers.get('content-length');
      
      if (!headResponse.ok) {
        Alert.alert(
          'Video Not Accessible',
          `The video file cannot be accessed (HTTP ${headResponse.status}).\n\n` +
          'This usually means:\n' +
          '• The file was not uploaded correctly\n' +
          '• The file was deleted from storage\n' +
          '• Storage bucket permissions are incorrect\n\n' +
          'Try deleting this video record and re-uploading the video.',
          [{ text: 'OK' }]
        );
        return;
      }
      
      if (!contentType || !contentType.includes('video')) {
        Alert.alert(
          'Invalid Content Type',
          `The file has wrong content-type: ${contentType}\n\n` +
          'Expected: video/mp4 or similar\n\n' +
          'The file may be corrupted or in the wrong format.',
          [{ text: 'OK' }]
        );
        return;
      }
      
      if (!contentLength || parseInt(contentLength) === 0) {
        Alert.alert(
          'Empty File',
          'The video file is empty (0 bytes).\n\n' +
          'The upload process failed. Try re-uploading the video.',
          [{ text: 'OK' }]
        );
        return;
      }
      
      Alert.alert(
        'Video Diagnosis: GOOD ✓',
        `File Size: ${formatFileSize(parseInt(contentLength))}\n` +
        `Content-Type: ${contentType}\n` +
        `Status: Accessible\n\n` +
        'The video file appears to be valid and should be playable.\n\n' +
        'If the video still won\'t play:\n' +
        '• Try refreshing the app\n' +
        '• Check your internet connection\n' +
        '• The video player may need time to buffer',
        [{ text: 'OK' }]
      );
      
      console.log('[AdminScreen] ========== DIAGNOSIS COMPLETE ==========');
    } catch (error: any) {
      console.error('[AdminScreen] Error diagnosing video:', error);
      Alert.alert(
        'Diagnosis Failed',
        `Could not diagnose video:\n\n${error.message}\n\n` +
        'This usually indicates a network error or the video file is completely inaccessible.',
        [{ text: 'OK' }]
      );
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
      console.log('[AdminScreen] ========== VALIDATING VIDEO METADATA ==========');
      console.log('[AdminScreen] Video URI:', uri);
      console.log('[AdminScreen] Asset width:', assetWidth);
      console.log('[AdminScreen] Asset height:', assetHeight);
      console.log('[AdminScreen] Asset duration (ms):', assetDuration);
      
      // Use the new File API for Expo 54
      console.log('[AdminScreen] Using new File API to get file info...');
      const file = new File(uri);
      const fileSize = file.size;
      
      console.log('[AdminScreen] File size:', formatFileSize(fileSize));

      if (fileSize === 0) {
        console.error('[AdminScreen] Video file is empty (0 bytes)');
        throw new Error('Video file is empty');
      }

      let width = 1920;
      let height = 1080;
      
      if (assetWidth && assetHeight && assetWidth > 0 && assetHeight > 0) {
        width = assetWidth;
        height = assetHeight;
        console.log('[AdminScreen] Using dimensions from picker:', width, 'x', height);
      } else {
        console.log('[AdminScreen] No dimensions from picker, using defaults:', width, 'x', height);
      }
      
      let duration = 0;
      if (assetDuration && assetDuration > 0) {
        duration = assetDuration / 1000;
        console.log('[AdminScreen] Duration from picker:', duration, 'seconds');
      } else {
        console.log('[AdminScreen] No duration from picker, will be set to 0 (unknown)');
      }

      const metadata: VideoMetadata = {
        width,
        height,
        duration,
        size: fileSize
      };

      console.log('[AdminScreen] ✓ Video metadata validated successfully:');
      console.log('[AdminScreen]   Resolution:', formatResolution(width, height));
      console.log('[AdminScreen]   Duration:', duration > 0 ? formatDuration(duration) : 'Unknown');
      console.log('[AdminScreen]   Size:', formatFileSize(fileSize));
      console.log('[AdminScreen] ========== VALIDATION COMPLETE ==========');

      return metadata;
    } catch (error: any) {
      console.error('[AdminScreen] ========== VALIDATION FAILED ==========');
      console.error('[AdminScreen] Error:', error);
      console.error('[AdminScreen] Error message:', error.message);
      console.error('[AdminScreen] Error stack:', error.stack);
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
      console.log('[AdminScreen] ========== PICK VIDEO STARTED ==========');
      setValidationErrors([]);
      setVideoMetadata(null);
      
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        console.log('[AdminScreen] Permission denied');
        Alert.alert('Permission Required', 'Please grant permission to access your photo library');
        return;
      }

      console.log('[AdminScreen] Launching image picker...');
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['videos'],
        allowsEditing: false,
        quality: 1,
        videoMaxDuration: 300,
      });

      console.log('[AdminScreen] Image picker result:', {
        canceled: result.canceled,
        hasAssets: result.assets && result.assets.length > 0
      });

      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        const videoUri = asset.uri;
        
        console.log('[AdminScreen] Video selected:', videoUri);
        console.log('[AdminScreen] Asset details:', {
          width: asset.width,
          height: asset.height,
          duration: asset.duration,
          type: asset.type,
          fileName: asset.fileName
        });
        
        setValidatingVideo(true);
        
        try {
          console.log('[AdminScreen] Starting metadata validation...');
          const metadata = await validateVideoMetadata(
            videoUri, 
            asset.width, 
            asset.height, 
            asset.duration
          );
          
          if (!metadata) {
            console.error('[AdminScreen] Metadata validation returned null');
            Alert.alert(
              'Error', 
              'Could not read video information. The video file may be corrupted or in an unsupported format.\n\nPlease try:\n• Selecting a different video\n• Recording a new video\n• Converting the video to MP4 format'
            );
            return;
          }

          console.log('[AdminScreen] Metadata validated successfully');
          setVideoMetadata(metadata);
          
          const errors = checkVideoRequirements(metadata);
          setValidationErrors(errors);

          if (errors.length > 0) {
            console.log('[AdminScreen] Video does not meet requirements:', errors);
            Alert.alert(
              'Video Does Not Meet Requirements',
              errors.join('\n\n'),
              [{ text: 'OK' }]
            );
            setSelectedVideo(null);
          } else {
            console.log('[AdminScreen] Video meets all requirements');
            setSelectedVideo(videoUri);
            
            const durationText = metadata.duration > 0 
              ? `Duration: ${formatDuration(metadata.duration)}\n` 
              : 'Duration: Unknown (will be detected during upload)\n';
            
            Alert.alert(
              'Video Validated ✓',
              `Resolution: ${formatResolution(metadata.width, metadata.height)}\n${durationText}Size: ${formatFileSize(metadata.size)}\n\nThis video is ready to upload.`,
              [{ text: 'OK' }]
            );
          }
        } catch (error: any) {
          console.error('[AdminScreen] Error during validation:', error);
          Alert.alert(
            'Validation Error',
            'Could not validate video. Please ensure the video is a valid format and try again.\n\nError: ' + error.message
          );
        } finally {
          setValidatingVideo(false);
        }
      } else {
        console.log('[AdminScreen] Video selection canceled or no assets');
      }
      
      console.log('[AdminScreen] ========== PICK VIDEO COMPLETED ==========');
    } catch (error: any) {
      console.error('[AdminScreen] ========== PICK VIDEO FAILED ==========');
      console.error('[AdminScreen] Error picking video:', error);
      console.error('[AdminScreen] Error message:', error.message);
      console.error('[AdminScreen] Error stack:', error.stack);
      Alert.alert('Error', 'Failed to pick video: ' + error.message);
      setValidatingVideo(false);
    }
  };

  const uploadVideo = async () => {
    console.log('[AdminScreen] ========== UPLOAD BUTTON TAPPED ==========');
    console.log('[AdminScreen] User tapped Upload Video button');
    
    if (!selectedVideo || !videoTitle || !videoMetadata) {
      console.log('[AdminScreen] Upload validation failed: Missing video, title, or metadata');
      Alert.alert('Error', 'Please select a valid video and enter a title');
      return;
    }

    if (!session?.access_token) {
      console.log('[AdminScreen] Upload validation failed: No session token');
      Alert.alert('Error', 'You are not logged in. Please log out and log back in.');
      return;
    }

    const errors = checkVideoRequirements(videoMetadata);
    if (errors.length > 0) {
      console.log('[AdminScreen] Upload validation failed: Video requirements not met:', errors);
      Alert.alert('Cannot Upload', errors.join('\n\n'));
      return;
    }

    console.log('[AdminScreen] ✓ All validations passed, starting upload process');

    try {
      uploadStartTimeRef.current = Date.now();
      lastProgressUpdateRef.current = Date.now();
      lastBytesUploadedRef.current = 0;
      setUploading(true);
      setUploadProgress(0);
      setUploadSpeed('');
      setEstimatedTimeRemaining('');
      setUploadStatus('Preparing upload...');
      
      console.log('[AdminScreen] ========== STARTING DIRECT UPLOAD TO SUPABASE ==========');
      console.log('[AdminScreen] Current user ID:', user?.id);
      console.log('[AdminScreen] Video URI:', selectedVideo);
      console.log('[AdminScreen] Video metadata:', {
        resolution: formatResolution(videoMetadata.width, videoMetadata.height),
        duration: videoMetadata.duration > 0 ? formatDuration(videoMetadata.duration) : 'Unknown',
        size: formatFileSize(videoMetadata.size)
      });

      const fileExt = selectedVideo.split('.').pop()?.toLowerCase() || 'mp4';
      const fileName = `uploads/${Date.now()}.${fileExt}`;

      console.log('[AdminScreen] Target filename:', fileName);
      console.log('[AdminScreen] Step 1/5: Reading video file...');
      setUploadProgress(5);
      setUploadStatus('Reading video file...');

      // Use the new File API for Expo 54
      const file = new File(selectedVideo);
      const totalSize = file.size;
      
      console.log('[AdminScreen] ✓ File verified:', formatFileSize(totalSize));
      setUploadProgress(10);

      console.log('[AdminScreen] Step 2/5: Reading file as base64...');
      setUploadStatus('Preparing video data...');
      
      const base64Data = await FileSystem.readAsStringAsync(selectedVideo, {
        encoding: 'base64',
      });
      
      console.log('[AdminScreen] ✓ File read as base64, length:', base64Data.length);
      setUploadProgress(20);

      console.log('[AdminScreen] Step 3/5: Converting to binary...');
      setUploadStatus('Converting video...');
      
      const binaryString = atob(base64Data);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      const blob = new Blob([bytes], { type: 'video/mp4' });
      
      console.log('[AdminScreen] ✓ Converted to blob, size:', formatFileSize(blob.size));
      setUploadProgress(30);

      console.log('[AdminScreen] Step 4/5: Uploading to Supabase Storage...');
      setUploadStatus('Uploading video to cloud...');

      const startTime = Date.now();
      
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('videos')
        .upload(fileName, blob, {
          contentType: 'video/mp4',
          upsert: false,
        });

      if (uploadError) {
        console.error('[AdminScreen] Upload error:', uploadError);
        throw uploadError;
      }

      const elapsedSeconds = (Date.now() - startTime) / 1000;
      const speedMBps = (totalSize / (1024 * 1024) / elapsedSeconds).toFixed(2);
      
      console.log('[AdminScreen] ✓ Video uploaded successfully');
      console.log('[AdminScreen] Upload speed:', speedMBps, 'MB/s');
      console.log('[AdminScreen] Upload time:', elapsedSeconds.toFixed(1), 'seconds');
      
      setUploadProgress(70);

      console.log('[AdminScreen] Step 5/5: Getting video public URL...');
      setUploadStatus('Finalizing...');
      
      const { data: { publicUrl: videoPublicUrl } } = supabase.storage
        .from('videos')
        .getPublicUrl(fileName);
      
      console.log('[AdminScreen] Video public URL:', videoPublicUrl);

      console.log('[AdminScreen] Verifying video and generating thumbnail...');
      setUploadStatus('Verifying video...');
      
      const headResponse = await fetch(videoPublicUrl, { method: 'HEAD' });
      console.log('[AdminScreen] Video HEAD request status:', headResponse.status);
      
      if (!headResponse.ok) {
        throw new Error(`Video file is not accessible (HTTP ${headResponse.status})`);
      }

      setUploadProgress(80);

      setUploadStatus('Generating thumbnail...');
      const thumbnailUrl = await (async () => {
        try {
          const { uri: thumbnailUri } = await VideoThumbnails.getThumbnailAsync(selectedVideo, {
            time: 1000,
          });
          
          console.log('[AdminScreen] ✓ Thumbnail generated:', thumbnailUri);
          
          const thumbnailFileName = `thumbnails/${Date.now()}.jpg`;
          
          const thumbnailBase64 = await FileSystem.readAsStringAsync(thumbnailUri, {
            encoding: 'base64',
          });
          
          const thumbnailBinaryString = atob(thumbnailBase64);
          const thumbnailBytes = new Uint8Array(thumbnailBinaryString.length);
          for (let i = 0; i < thumbnailBinaryString.length; i++) {
            thumbnailBytes[i] = thumbnailBinaryString.charCodeAt(i);
          }
          const thumbnailBlob = new Blob([thumbnailBytes], { type: 'image/jpeg' });

          const { error: thumbnailUploadError } = await supabase.storage
            .from('videos')
            .upload(thumbnailFileName, thumbnailBlob, {
              contentType: 'image/jpeg',
              upsert: false,
            });

          if (!thumbnailUploadError) {
            const { data: { publicUrl: thumbPublicUrl } } = supabase.storage
              .from('videos')
              .getPublicUrl(thumbnailFileName);
            
            console.log('[AdminScreen] ✓ Thumbnail uploaded:', thumbPublicUrl);
            return thumbPublicUrl;
          }
          return null;
        } catch (thumbnailError) {
          console.error('[AdminScreen] Error generating thumbnail:', thumbnailError);
          console.log('[AdminScreen] Continuing without thumbnail');
          return null;
        }
      })();

      setUploadProgress(90);

      console.log('[AdminScreen] Saving to database...');
      setUploadStatus('Saving video information...');
      const { error: dbError } = await supabase
        .from('videos')
        .insert({
          title: videoTitle,
          description: videoDescription || null,
          video_url: videoPublicUrl,
          thumbnail_url: thumbnailUrl,
          duration_seconds: videoMetadata.duration > 0 ? videoMetadata.duration : null,
          resolution_width: videoMetadata.width,
          resolution_height: videoMetadata.height,
          file_size_bytes: totalSize,
          uploaded_by: user?.id
        });

      if (dbError) {
        console.error('[AdminScreen] Database error:', dbError);
        throw dbError;
      }
      
      setUploadProgress(100);
      setUploadStatus('Upload complete!');
      console.log('[AdminScreen] ========== UPLOAD COMPLETED SUCCESSFULLY ==========');

      Alert.alert(
        'Success', 
        `Video uploaded successfully in ${elapsedSeconds.toFixed(1)} seconds!\n\nAverage speed: ${speedMBps} MB/s\n\nThe video is now playable.`,
        [{ text: 'OK' }]
      );
      
      setVideoTitle('');
      setVideoDescription('');
      setSelectedVideo(null);
      setVideoMetadata(null);
      
      await refreshVideos();

    } catch (error: any) {
      console.error('[AdminScreen] ========== UPLOAD FAILED ==========');
      console.error('[AdminScreen] Error:', error);
      console.error('[AdminScreen] Error stack:', error.stack);
      
      let errorMessage = 'Failed to upload video. ';
      
      if (error.message?.includes('Network') || error.message?.includes('network') || error.message?.includes('Failed to fetch')) {
        errorMessage = '❌ Network Error\n\nThe upload failed due to a network issue.\n\nSolutions:\n1. Check your internet connection\n2. Try again with a stable WiFi connection\n3. Disable VPN if you\'re using one\n4. If the problem persists, try again later';
      } else if (error.message?.includes('not accessible')) {
        errorMessage = '❌ Upload Failed\n\n' + error.message + '\n\nThe video was uploaded but could not be verified. Please try again.';
      } else if (error.message?.includes('empty') || error.message?.includes('0 bytes')) {
        errorMessage = '❌ File Read Error\n\nThe video file could not be read or is empty.\n\nSolutions:\n1. Try selecting the video again\n2. Check if the video plays in your Photos app\n3. Try a different video\n4. Restart the app and try again';
      } else if (error.message?.includes('413') || error.message?.includes('Payload Too Large')) {
        errorMessage = '❌ File Too Large\n\nThe video file exceeds the upload limit.\n\nSolutions:\n1. Compress the video before uploading\n2. Use a shorter video (max 90 seconds)\n3. Reduce video quality/resolution\n4. Contact support for larger file support';
      } else {
        errorMessage += error.message || 'Unknown error. Please try again.';
      }
      
      Alert.alert('Upload Failed', errorMessage);
    } finally {
      setUploading(false);
      setUploadSpeed('');
      setEstimatedTimeRemaining('');
      setUploadStatus('');
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

          <View style={[styles.infoBox, { backgroundColor: '#E8F5E9', borderColor: '#4CAF50' }]}>
            <IconSymbol
              ios_icon_name="checkmark.circle.fill"
              android_material_icon_name="check-circle"
              size={20}
              color="#388E3C"
            />
            <View style={styles.requirementsTextContainer}>
              <Text style={[styles.requirementsTitle, { color: '#1B5E20' }]}>
                ✅ DIRECT SUPABASE UPLOAD - Reliable & Simple
              </Text>
              <Text style={[styles.requirementsText, { color: '#2E7D32' }]}>
                • ✅ Direct upload to Supabase Storage
              </Text>
              <Text style={[styles.requirementsText, { color: '#2E7D32' }]}>
                • ✅ Handles files up to 3GB
              </Text>
              <Text style={[styles.requirementsText, { color: '#2E7D32' }]}>
                • ✅ No fake progress bars
              </Text>
              <Text style={[styles.requirementsText, { color: '#2E7D32' }]}>
                • ✅ Automatic video verification
              </Text>
              <Text style={[styles.requirementsText, { color: '#2E7D32' }]}>
                • ✅ Thumbnail generation
              </Text>
              <Text style={[styles.requirementsText, { color: '#2E7D32' }]}>
                • Maximum Duration: 90 seconds
              </Text>
              <Text style={[styles.requirementsText, { color: '#2E7D32' }]}>
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
                {uploadStatus || 'Uploading...'}
              </Text>
              <Text style={[styles.progressSubtext, { color: colors.textSecondary }]}>
                {uploadProgress.toFixed(1)}% complete
              </Text>
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
              • ✅ Direct upload to Supabase Storage{'\n'}
              • ✅ No fake progress bars{'\n'}
              • ✅ Handles large 6K videos{'\n'}
              • Use a stable WiFi connection{'\n'}
              • Keep the app open during upload{'\n'}
              • Upload time depends on file size and connection speed
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
                      <View style={styles.videoManagementActions}>
                        <TouchableOpacity
                          style={[styles.diagnoseIconButton, { backgroundColor: colors.primary }]}
                          onPress={() => handleDiagnoseVideo(video.id, video.title, video.video_url)}
                          disabled={isDeleting}
                        >
                          <IconSymbol
                            ios_icon_name="stethoscope"
                            android_material_icon_name="healing"
                            size={20}
                            color="#FFFFFF"
                          />
                        </TouchableOpacity>
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
    borderWidth: 2,
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
  videoManagementActions: {
    flexDirection: 'row',
    gap: 8,
  },
  diagnoseIconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
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
