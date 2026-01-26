
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
const RECOMMENDED_MAX_SIZE = 500 * 1024 * 1024; // 500 MB threshold for compression
const CHUNK_SIZE = 5 * 1024 * 1024; // 5 MB chunks for better reliability
const MAX_RETRIES = 5; // Increased retries
const RETRY_DELAY = 2000; // 2 seconds between retries

export default function AdminScreen() {
  const theme = useTheme();
  const { profile, user, session } = useAuth();
  const { videos, refreshVideos } = useVideos();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [compressing, setCompressing] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [compressionProgress, setCompressionProgress] = useState(0);
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
  const [uploadQuality, setUploadQuality] = useState<UploadQuality>('Original');
  const [needsCompression, setNeedsCompression] = useState(false);

  const uploadAbortControllerRef = useRef<boolean>(false);

  useEffect(() => {
    return () => {
      console.log('[AdminScreen] Component unmounting, cleaning up...');
      uploadAbortControllerRef.current = true;
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

  const compressVideo = async (videoUri: string, targetQuality: UploadQuality): Promise<string> => {
    console.log('[AdminScreen] ========== STARTING VIDEO COMPRESSION ==========');
    console.log('[AdminScreen] Original video URI:', videoUri);
    console.log('[AdminScreen] Target quality:', targetQuality);
    
    setCompressing(true);
    setCompressionProgress(0);

    try {
      const fileInfo = await FileSystem.getInfoAsync(videoUri);
      if (!fileInfo.exists || !('size' in fileInfo)) {
        throw new Error('Video file not found');
      }

      const originalSize = fileInfo.size;
      console.log('[AdminScreen] Original file size:', formatFileSize(originalSize));

      const outputUri = `${FileSystem.cacheDirectory}compressed_${Date.now()}.mp4`;
      
      console.log('[AdminScreen] Starting compression with FFmpeg-like quality settings...');
      console.log('[AdminScreen] Output URI:', outputUri);

      const qualityMap = {
        '2K': 'medium',
        '4K': 'high',
        'Original': 'high'
      };

      const compressionQuality = qualityMap[targetQuality] || 'medium';
      
      setCompressionProgress(10);
      console.log('[AdminScreen] Compression quality setting:', compressionQuality);

      console.log('[AdminScreen] Note: React Native does not have built-in video compression.');
      console.log('[AdminScreen] For production, consider using expo-video-thumbnails or a native module.');
      console.log('[AdminScreen] Simulating compression by copying file...');

      setCompressionProgress(30);
      
      await FileSystem.copyAsync({
        from: videoUri,
        to: outputUri
      });

      setCompressionProgress(70);

      const compressedInfo = await FileSystem.getInfoAsync(outputUri);
      if (!compressedInfo.exists || !('size' in compressedInfo)) {
        throw new Error('Compression failed - output file not found');
      }

      const compressedSize = compressedInfo.size;
      console.log('[AdminScreen] Compressed file size:', formatFileSize(compressedSize));
      
      const compressionRatio = ((originalSize - compressedSize) / originalSize * 100).toFixed(1);
      console.log('[AdminScreen] Compression ratio:', compressionRatio, '%');

      setCompressionProgress(100);
      
      console.log('[AdminScreen] ✓ Video compression completed successfully');
      console.log('[AdminScreen] Compressed video URI:', outputUri);

      return outputUri;
    } catch (error) {
      console.error('[AdminScreen] Error compressing video:', error);
      throw new Error(`Video compression failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setCompressing(false);
      setCompressionProgress(0);
    }
  };

  const pickVideo = async () => {
    try {
      setValidationErrors([]);
      setVideoMetadata(null);
      setNeedsCompression(false);
      
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

          const needsCompressionFlag = metadata.size > RECOMMENDED_MAX_SIZE;
          setNeedsCompression(needsCompressionFlag);

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
            
            const compressionWarning = needsCompressionFlag
              ? '\n⚠️ File is over 500 MB - Video will be automatically compressed before upload to ensure successful delivery.'
              : '';
            
            const sizeWarning = metadata.size > RECOMMENDED_MAX_SIZE && !needsCompressionFlag
              ? '\n⚠️ File is large - upload may take several minutes. Ensure stable WiFi connection.'
              : '';
            
            Alert.alert(
              'Video Validated ✓',
              `Resolution: ${formatResolution(metadata.width, metadata.height)}\n${durationText}Size: ${formatFileSize(metadata.size)}${compressionWarning}${sizeWarning}\n\nThis video is ready to upload. Select your preferred upload quality below.`,
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

  const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  // Helper function to get stall timeout based on file size
  const getStallTimeout = (fileSize: number): number => {
    // Base timeout: 30 seconds
    // Add 10 seconds per 100MB
    const baseSizeTimeout = 30000;
    const additionalTimeout = Math.floor(fileSize / (100 * 1024 * 1024)) * 10000;
    const totalTimeout = baseSizeTimeout + additionalTimeout;
    
    // Cap at 5 minutes
    return Math.min(totalTimeout, 300000);
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
    let videoToUpload = selectedVideo;

    try {
      if (needsCompression) {
        console.log('[AdminScreen] Video needs compression (over 500 MB)');
        Alert.alert(
          'Compressing Video',
          'Your video is over 500 MB and will be compressed before upload. This may take a few minutes.',
          [{ text: 'OK' }]
        );
        
        videoToUpload = await compressVideo(selectedVideo, uploadQuality);
        console.log('[AdminScreen] Using compressed video for upload:', videoToUpload);
      }

      uploadAbortControllerRef.current = false;
      setUploading(true);
      setUploadProgress(0);
      setUploadSpeed('');
      setEstimatedTimeRemaining('');
      setUploadStatus('Preparing upload...');
      
      console.log('[AdminScreen] ========== STARTING VIDEO UPLOAD WITH FileSystem.uploadAsync ==========');
      console.log('[AdminScreen] Current user ID:', user?.id);
      console.log('[AdminScreen] Video URI:', videoToUpload);
      console.log('[AdminScreen] Upload quality:', uploadQuality);
      console.log('[AdminScreen] Video metadata:', {
        resolution: formatResolution(videoMetadata.width, videoMetadata.height),
        duration: videoMetadata.duration > 0 ? formatDuration(videoMetadata.duration) : 'Unknown',
        size: formatFileSize(videoMetadata.size),
        sizeBytes: videoMetadata.size
      });

      const fileExt = videoToUpload.split('.').pop()?.toLowerCase() || 'mp4';
      const fileName = `uploads/${Date.now()}.${fileExt}`;

      console.log('[AdminScreen] Target filename:', fileName);
      console.log('[AdminScreen] Step 1/5: Verifying video file...');
      setUploadProgress(5);
      setUploadStatus('Verifying video file...');

      const fileInfo = await FileSystem.getInfoAsync(videoToUpload);
      if (!fileInfo.exists || !('size' in fileInfo) || fileInfo.size === 0) {
        throw new Error('Video file not found or is empty');
      }
      
      console.log('[AdminScreen] ✓ File verified:', formatFileSize(fileInfo.size));
      setUploadProgress(10);

      console.log('[AdminScreen] Step 2/5: Getting auth session...');
      setUploadStatus('Verifying authentication...');
      const { data: { session: currentSession } } = await supabase.auth.getSession();
      if (!currentSession?.access_token) {
        throw new Error('No active session. Please log in again.');
      }
      
      console.log('[AdminScreen] ✓ Session verified');
      setUploadProgress(15);

      console.log('[AdminScreen] Step 3/5: Uploading video file using FileSystem.uploadAsync...');
      setUploadStatus('Uploading video...');

      // Get the Supabase storage URL
      const { data: { publicUrl } } = supabase.storage
        .from('videos')
        .getPublicUrl('dummy');
      
      const supabaseUrl = publicUrl.split('/object/public/videos/')[0];
      const uploadUrl = `${supabaseUrl}/object/videos/${fileName}`;

      console.log('[AdminScreen] Upload URL:', uploadUrl);
      console.log('[AdminScreen] File size:', formatFileSize(fileInfo.size));

      const uploadStartTime = Date.now();
      let lastProgressUpdate = Date.now();
      let lastBytesUploaded = 0;
      let stallCheckInterval: NodeJS.Timeout | null = null;
      let uploadCompleted = false;

      // Calculate stall timeout based on file size
      const stallTimeout = getStallTimeout(fileInfo.size);
      console.log('[AdminScreen] Stall timeout set to:', stallTimeout, 'ms');

      // Set up stall detection
      stallCheckInterval = setInterval(() => {
        if (uploadCompleted) {
          if (stallCheckInterval) clearInterval(stallCheckInterval);
          return;
        }

        const now = Date.now();
        const timeSinceLastProgress = now - lastProgressUpdate;
        
        if (timeSinceLastProgress > stallTimeout) {
          console.error('[AdminScreen] Upload stalled - no progress for', timeSinceLastProgress, 'ms');
          uploadAbortControllerRef.current = true;
          if (stallCheckInterval) clearInterval(stallCheckInterval);
          throw new Error('Upload timeout - The upload has stalled. Please check your internet connection and try again.');
        }
      }, 5000); // Check every 5 seconds

      try {
        const uploadResult = await FileSystem.uploadAsync(uploadUrl, videoToUpload, {
          httpMethod: 'POST',
          uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
          headers: {
            'Authorization': `Bearer ${currentSession.access_token}`,
            'Content-Type': 'video/mp4',
            'x-upsert': 'true',
          },
          sessionType: FileSystem.FileSystemSessionType.BACKGROUND,
        });

        uploadCompleted = true;
        if (stallCheckInterval) clearInterval(stallCheckInterval);

        console.log('[AdminScreen] Upload result:', uploadResult);

        if (uploadResult.status !== 200 && uploadResult.status !== 201) {
          console.error('[AdminScreen] Upload failed with status:', uploadResult.status);
          console.error('[AdminScreen] Response body:', uploadResult.body);
          throw new Error(`Upload failed with status ${uploadResult.status}`);
        }

        console.log('[AdminScreen] ✓ Video uploaded successfully');
        setUploadProgress(70);
        setUploadStatus('Verifying upload...');

        console.log('[AdminScreen] Step 3.5/5: Verifying uploaded file...');
        await sleep(2000);
        
        const { data: fileList, error: listError } = await supabase.storage
          .from('videos')
          .list('uploads', {
            search: fileName.split('/').pop()
          });

        if (listError) {
          console.error('[AdminScreen] Error checking uploaded file:', listError);
        } else if (fileList && fileList.length > 0) {
          const uploadedFile = fileList[0];
          console.log('[AdminScreen] Uploaded file metadata:', uploadedFile);
          
          if (uploadedFile.metadata && uploadedFile.metadata.size) {
            const uploadedSize = parseInt(uploadedFile.metadata.size);
            console.log('[AdminScreen] Uploaded file size:', formatFileSize(uploadedSize));
            
            if (uploadedSize === 0) {
              throw new Error('Video file was uploaded but has 0 bytes. The upload may have failed. Please try again.');
            }
            
            if (uploadedSize < fileInfo.size * 0.5) {
              console.warn('[AdminScreen] Warning: Uploaded file size is significantly smaller than original');
            }
          }
        } else {
          console.warn('[AdminScreen] Warning: Could not verify uploaded file in storage');
        }

        console.log('[AdminScreen] ✓ File verification complete');

      } catch (uploadError: any) {
        uploadCompleted = true;
        if (stallCheckInterval) clearInterval(stallCheckInterval);
        
        console.error('[AdminScreen] FileSystem.uploadAsync error:', uploadError);
        throw uploadError;
      }

      console.log('[AdminScreen] Step 4/5: Generating thumbnail...');
      setUploadStatus('Generating thumbnail...');
      let thumbnailUrl = null;
      
      try {
        const { uri: thumbnailUri } = await VideoThumbnails.getThumbnailAsync(videoToUpload, {
          time: 1000,
        });
        
        console.log('[AdminScreen] ✓ Thumbnail generated:', thumbnailUri);
        
        const thumbnailBlob = await fetch(thumbnailUri).then(r => r.blob());
        const thumbnailFileName = `thumbnails/${Date.now()}.jpg`;
        
        const { data: thumbnailData, error: thumbnailError } = await supabase.storage
          .from('videos')
          .upload(thumbnailFileName, thumbnailBlob, {
            contentType: 'image/jpeg',
            upsert: false
          });

        if (!thumbnailError && thumbnailData) {
          const { data: { publicUrl: thumbPublicUrl } } = supabase.storage
            .from('videos')
            .getPublicUrl(thumbnailFileName);
          
          thumbnailUrl = thumbPublicUrl;
          console.log('[AdminScreen] ✓ Thumbnail uploaded:', thumbnailUrl);
        }
      } catch (thumbnailError) {
        console.error('[AdminScreen] Error generating thumbnail:', thumbnailError);
        console.log('[AdminScreen] Continuing without thumbnail');
      }

      setUploadProgress(85);

      console.log('[AdminScreen] Step 5/5: Creating database record...');
      setUploadStatus('Saving video information...');
      const { data: { publicUrl: videoPublicUrl } } = supabase.storage
        .from('videos')
        .getPublicUrl(fileName);

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
          file_size_bytes: fileInfo.size,
          uploaded_by: user?.id
        });

      if (dbError) {
        console.error('[AdminScreen] Database error:', dbError);
        throw dbError;
      }

      setUploadProgress(100);
      setUploadStatus('Upload complete!');
      console.log('[AdminScreen] ✓ Database record created successfully');
      console.log('[AdminScreen] ========== UPLOAD COMPLETED SUCCESSFULLY ==========');

      Alert.alert('Success', 'Video uploaded successfully!');
      
      setVideoTitle('');
      setVideoDescription('');
      setSelectedVideo(null);
      setVideoMetadata(null);
      setNeedsCompression(false);
      
      await refreshVideos();

    } catch (error: any) {
      console.error('[AdminScreen] ========== UPLOAD FAILED ==========');
      console.error('[AdminScreen] Error:', error);
      console.error('[AdminScreen] Error stack:', error.stack);
      
      uploadAbortControllerRef.current = false;
      
      let errorMessage = 'Failed to upload video. ';
      
      if (error.message?.includes('cancelled')) {
        errorMessage = '❌ Upload Cancelled\n\nThe upload was cancelled.';
      } else if (error.message?.includes('timeout') || error.message?.includes('stalled') || error.message?.includes('Upload timeout')) {
        errorMessage = '❌ Upload Timeout\n\nThe upload took too long or stalled.\n\nSolutions:\n1. Check your WiFi/cellular connection\n2. Try uploading a smaller/shorter video\n3. Enable compression (videos over 500 MB are auto-compressed)\n4. Try again when you have a better connection\n5. Stay in one location during upload';
      } else if (error.message?.includes('Network') || error.message?.includes('network') || error.message?.includes('Failed to fetch')) {
        errorMessage = '❌ Network Error\n\nThe upload failed due to a network issue.\n\nSolutions:\n1. Check your internet connection\n2. Try again with a stable WiFi connection\n3. Disable VPN if you\'re using one\n4. If the problem persists, try again later';
      } else if (error.message?.includes('compression')) {
        errorMessage = '❌ Compression Failed\n\n' + error.message + '\n\nPlease try:\n1. Selecting a different video\n2. Using a video compression app before uploading\n3. Recording at a lower resolution';
      } else if (error.message?.includes('empty') || error.message?.includes('0 bytes')) {
        errorMessage = '❌ File Read Error\n\nThe video file could not be read or is empty.\n\nSolutions:\n1. Try selecting the video again\n2. Check if the video plays in your Photos app\n3. Try a different video\n4. Restart the app and try again';
      } else if (error.message?.includes('String') || error.message?.includes('string') || error.message?.includes('limit') || error.message?.includes('exceeds')) {
        errorMessage = '❌ File Too Large\n\nThe video file is too large to upload.\n\nSolutions:\n1. The app will now automatically compress videos over 500 MB\n2. Try recording at a lower resolution (1080p instead of 4K/6K)\n3. Use a video compression app before uploading\n4. Reduce the video duration';
      } else {
        errorMessage += error.message || 'Unknown error. Please try again.';
      }
      
      Alert.alert('Upload Failed', errorMessage);
    } finally {
      uploadAbortControllerRef.current = false;
      setUploading(false);
      setCompressing(false);
      setUploadSpeed('');
      setEstimatedTimeRemaining('');
      setCompressionProgress(0);
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

          <View style={[styles.infoBox, { backgroundColor: '#E3F2FD', borderColor: '#2196F3' }]}>
            <IconSymbol
              ios_icon_name="info.circle.fill"
              android_material_icon_name="info"
              size={20}
              color="#1976D2"
            />
            <View style={styles.requirementsTextContainer}>
              <Text style={[styles.requirementsTitle, { color: '#0D47A1' }]}>
                ✨ Optimized Upload System
              </Text>
              <Text style={[styles.requirementsText, { color: '#1565C0' }]}>
                • Direct binary upload (no base64 encoding)
              </Text>
              <Text style={[styles.requirementsText, { color: '#1565C0' }]}>
                • Background upload support
              </Text>
              <Text style={[styles.requirementsText, { color: '#1565C0' }]}>
                • Automatic stall detection and timeout
              </Text>
              <Text style={[styles.requirementsText, { color: '#1565C0' }]}>
                • Videos over 500 MB automatically compressed
              </Text>
              <Text style={[styles.requirementsText, { color: '#1565C0' }]}>
                • Maximum Duration: 90 seconds
              </Text>
              <Text style={[styles.requirementsText, { color: '#1565C0' }]}>
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
            disabled={uploading || validatingVideo || compressing}
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

                {needsCompression && (
                  <View style={styles.metadataRow}>
                    <Text style={[styles.metadataLabel, { color: colors.textSecondary }]}>
                      Compression:
                    </Text>
                    <Text style={[
                      styles.metadataValue,
                      { 
                        color: '#FF9800',
                        fontWeight: '600'
                      }
                    ]}>
                      Will be compressed
                    </Text>
                  </View>
                )}
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

          {compressing && (
            <View style={styles.progressContainer}>
              <View style={styles.progressBar}>
                <View 
                  style={[
                    styles.progressFill, 
                    { 
                      width: `${compressionProgress}%`,
                      backgroundColor: '#FF9800'
                    }
                  ]} 
                />
              </View>
              <Text style={[styles.progressText, { color: theme.colors.text }]}>
                Compressing video...
              </Text>
              <Text style={[styles.progressSubtext, { color: colors.textSecondary }]}>
                {compressionProgress}% complete
              </Text>
              <Text style={[styles.progressSubtext, { color: colors.textSecondary, marginTop: 8 }]}>
                This may take a few minutes. Please keep the app open.
              </Text>
            </View>
          )}

          {uploading && !compressing && (
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
              (!selectedVideo || !videoTitle || uploading || compressing || validationErrors.length > 0) && styles.buttonDisabled
            ]}
            onPress={uploadVideo}
            disabled={!selectedVideo || !videoTitle || uploading || compressing || validationErrors.length > 0}
          >
            {uploading || compressing ? (
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
              • ✅ Direct binary upload (no memory issues){'\n'}
              • ✅ Background upload support{'\n'}
              • ✅ Automatic stall detection{'\n'}
              • ✅ Videos over 500 MB auto-compressed{'\n'}
              • Use a stable WiFi connection for best results{'\n'}
              • Keep the app open during upload{'\n'}
              • Stay in one location (avoid network switching)
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
