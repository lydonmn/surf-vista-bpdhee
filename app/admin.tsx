
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
import * as VideoThumbnails from 'expo-video-thumbnails';
import * as tus from 'tus-js-client';
import 'react-native-url-polyfill/auto';

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
const TUS_CHUNK_SIZE = 6 * 1024 * 1024; // 6MB chunks for compatibility with Supabase

export default function AdminScreen() {
  const theme = useTheme();
  const { profile, user, session } = useAuth();
  const { videos, refreshVideos } = useVideos();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [validatingVideo, setValidatingVideo] = useState(false);
  const [deletingVideoId, setDeletingVideoId] = useState<string | null>(null);
  const [uploadStatus, setUploadStatus] = useState<string>('');

  const [videoTitle, setVideoTitle] = useState('');
  const [videoDescription, setVideoDescription] = useState('');
  const [selectedVideo, setSelectedVideo] = useState<string | null>(null);
  const [videoMetadata, setVideoMetadata] = useState<VideoMetadata | null>(null);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  const uploadAbortRef = useRef<boolean>(false);
  const tusUploadRef = useRef<tus.Upload | null>(null);

  useEffect(() => {
    if (profile?.is_admin) {
      loadUsers();
    }
  }, [profile]);

  useEffect(() => {
    return () => {
      if (tusUploadRef.current) {
        console.log('[AdminScreen] Cleaning up TUS upload on unmount');
        tusUploadRef.current.abort();
      }
    };
  }, []);

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
        'If the video still will not play:\n' +
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
    console.log('[AdminScreen] ========== VALIDATING VIDEO METADATA ==========');
    console.log('[AdminScreen] Video URI:', uri);
    
    try {
      const fileInfo = await FileSystem.getInfoAsync(uri);
      
      if (!fileInfo.exists) {
        throw new Error('Video file does not exist');
      }

      const fileSize = fileInfo.size || 0;
      console.log('[AdminScreen] File size:', formatFileSize(fileSize));

      if (fileSize === 0) {
        throw new Error('Video file is empty');
      }

      let width = 1920;
      let height = 1080;
      
      if (assetWidth && assetHeight && assetWidth > 0 && assetHeight > 0) {
        width = assetWidth;
        height = assetHeight;
      }
      
      let duration = 0;
      if (assetDuration && assetDuration > 0) {
        duration = assetDuration / 1000;
      }

      const metadata: VideoMetadata = {
        width,
        height,
        duration,
        size: fileSize
      };

      console.log('[AdminScreen] ✅ Video metadata validated successfully');
      return metadata;
    } catch (error: any) {
      console.error('[AdminScreen] ❌ Validation failed:', error);
      Alert.alert(
        'Validation Error',
        `Could not validate video file:\n\n${error.message}`
      );
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
    console.log('[AdminScreen] User tapped Select Video button');
    
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

      if (result.canceled || !result.assets || result.assets.length === 0) {
        return;
      }

      const asset = result.assets[0];
      const videoUri = asset.uri;
      
      setValidatingVideo(true);
      
      const metadata = await validateVideoMetadata(
        videoUri, 
        asset.width, 
        asset.height, 
        asset.duration
      );
      
      if (!metadata) {
        setValidatingVideo(false);
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
        Alert.alert(
          'Video Validated ✓',
          `Resolution: ${formatResolution(metadata.width, metadata.height)}\n` +
          `Duration: ${metadata.duration > 0 ? formatDuration(metadata.duration) : 'Unknown'}\n` +
          `Size: ${formatFileSize(metadata.size)}\n\n` +
          'This video is ready to upload.',
          [{ text: 'OK' }]
        );
      }
      
      setValidatingVideo(false);
    } catch (error: any) {
      console.error('[AdminScreen] Error picking video:', error);
      Alert.alert('Error Selecting Video', error.message);
      setValidatingVideo(false);
    }
  };

  const uploadVideo = async () => {
    console.log('[AdminScreen] ========== STARTING TUS RESUMABLE UPLOAD ==========');
    console.log('[AdminScreen] Upload initiated at:', new Date().toISOString());
    console.log('[AdminScreen] User tapped Upload Video button');
    
    if (!selectedVideo || !videoTitle || !videoMetadata) {
      console.log('[AdminScreen] ❌ Missing required fields');
      Alert.alert('Error', 'Please select a valid video and enter a title');
      return;
    }
    
    console.log('[AdminScreen] ✅ All required fields present');
    console.log('[AdminScreen] Video title:', videoTitle);
    console.log('[AdminScreen] Video description:', videoDescription || '(none)');

    if (!session?.access_token) {
      Alert.alert('Error', 'You are not logged in. Please log out and log back in.');
      return;
    }

    const errors = checkVideoRequirements(videoMetadata);
    if (errors.length > 0) {
      Alert.alert('Cannot Upload', errors.join('\n\n'));
      return;
    }

    uploadAbortRef.current = false;

    try {
      setUploading(true);
      setUploadProgress(0);
      setUploadStatus('Preparing upload...');
      
      console.log('[AdminScreen] Video URI:', selectedVideo);
      console.log('[AdminScreen] Video size:', formatFileSize(videoMetadata.size));
      console.log('[AdminScreen] Video metadata:', videoMetadata);

      // Step 1: Get file size explicitly
      console.log('[AdminScreen] Step 1: Getting file size...');
      const fileInfo = await FileSystem.getInfoAsync(selectedVideo);
      if (!fileInfo.exists) {
        throw new Error('Video file no longer exists. Please select the video again.');
      }
      
      const fileSize = fileInfo.size || 0;
      if (fileSize === 0) {
        throw new Error('Video file is empty (0 bytes)');
      }
      
      console.log('[AdminScreen] ✅ File size retrieved:', formatFileSize(fileSize));
      console.log('[AdminScreen] File URI:', fileInfo.uri);

      setUploadProgress(5);
      setUploadStatus('Creating file reader...');

      // Step 2: Create a custom file reader for TUS that reads chunks directly
      console.log('[AdminScreen] Step 2: Creating custom file reader for TUS...');
      
      // Create a custom reader that reads the file in chunks
      class FileReader {
        private uri: string;
        private size: number;
        private position: number = 0;

        constructor(uri: string, size: number) {
          this.uri = uri;
          this.size = size;
        }

        async read(length: number): Promise<Uint8Array> {
          const start = this.position;
          const end = Math.min(start + length, this.size);
          const actualLength = end - start;

          console.log(`[FileReader] Reading chunk: ${start} to ${end} (${actualLength} bytes)`);

          // Read chunk as base64
          const base64Chunk = await FileSystem.readAsStringAsync(this.uri, {
            encoding: FileSystem.EncodingType.Base64,
            position: start,
            length: actualLength,
          });

          // Convert base64 to Uint8Array
          const binaryString = atob(base64Chunk);
          const bytes = new Uint8Array(binaryString.length);
          for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
          }

          this.position = end;
          return bytes;
        }

        getSize(): number {
          return this.size;
        }

        getPosition(): number {
          return this.position;
        }
      }

      const fileReader = new FileReader(selectedVideo, fileSize);
      console.log('[AdminScreen] ✅ File reader created');

      setUploadProgress(10);
      setUploadStatus('Getting upload URL...');

      // Step 3: Generate filename and get project details
      const fileExt = selectedVideo.split('.').pop()?.toLowerCase() || 'mp4';
      const fileName = `uploads/${Date.now()}.${fileExt}`;
      console.log('[AdminScreen] Step 3: Target filename:', fileName);

      // Get Supabase project URL
      const supabaseUrl = supabase.supabaseUrl;
      const projectRef = supabaseUrl.split('//')[1].split('.')[0];
      console.log('[AdminScreen] Project ref:', projectRef);

      // Construct TUS endpoint URL (direct storage hostname for optimal speed)
      const tusEndpoint = `${supabaseUrl}/storage/v1/upload/resumable`;
      console.log('[AdminScreen] TUS endpoint:', tusEndpoint);

      setUploadProgress(15);
      setUploadStatus('Starting TUS upload...');

      const startTime = Date.now();
      let lastProgressUpdate = Date.now();

      // Step 4: Create TUS upload with custom reader and EXPLICIT uploadSize
      console.log('[AdminScreen] Step 4: Creating TUS upload...');
      console.log('[AdminScreen] Chunk size:', formatFileSize(TUS_CHUNK_SIZE));
      console.log('[AdminScreen] File size:', formatFileSize(fileSize));
      console.log('[AdminScreen] ⚠️ CRITICAL: Setting uploadSize explicitly to:', fileSize);
      console.log('[AdminScreen] Estimated chunks:', Math.ceil(fileSize / TUS_CHUNK_SIZE));

      // Create a custom upload source that uses our FileReader
      const uploadSource = {
        size: fileSize,
        read: async (chunkSize: number) => {
          const chunk = await fileReader.read(chunkSize);
          return chunk;
        },
      };

      const upload = new tus.Upload(uploadSource as any, {
        endpoint: tusEndpoint,
        retryDelays: [0, 3000, 5000, 10000, 20000],
        chunkSize: TUS_CHUNK_SIZE,
        uploadSize: fileSize, // ✅ CRITICAL FIX: Explicitly provide the upload size
        metadata: {
          bucketName: 'videos',
          objectName: fileName,
          contentType: `video/${fileExt}`,
          cacheControl: '3600',
        },
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
        onError: (error) => {
          console.error('[AdminScreen] ❌ TUS upload error:', error);
          throw error;
        },
        onProgress: (bytesUploaded, bytesTotal) => {
          const progress = (bytesUploaded / bytesTotal) * 100;
          const now = Date.now();
          
          // Update progress (throttle to every 500ms)
          if (now - lastProgressUpdate > 500) {
            const elapsed = (now - startTime) / 1000;
            const speed = bytesUploaded / elapsed;
            const remaining = (bytesTotal - bytesUploaded) / speed;
            
            setUploadProgress(15 + (progress * 0.75)); // 15% to 90%
            setUploadStatus(
              `Uploading: ${formatFileSize(bytesUploaded)} / ${formatFileSize(bytesTotal)} ` +
              `(${progress.toFixed(1)}%) - ${formatFileSize(speed)}/s - ` +
              `${remaining.toFixed(0)}s remaining`
            );
            
            console.log(
              `[AdminScreen] Progress: ${progress.toFixed(1)}% ` +
              `(${formatFileSize(bytesUploaded)} / ${formatFileSize(bytesTotal)}) - ` +
              `Speed: ${formatFileSize(speed)}/s`
            );
            
            lastProgressUpdate = now;
          }
        },
        onSuccess: () => {
          const uploadDuration = (Date.now() - startTime) / 1000;
          const speedMBps = (fileSize / (1024 * 1024) / uploadDuration).toFixed(2);
          console.log('[AdminScreen] ✅ TUS upload completed successfully!');
          console.log('[AdminScreen] Upload duration:', uploadDuration.toFixed(1), 'seconds');
          console.log('[AdminScreen] Average speed:', speedMBps, 'MB/s');
        },
      });

      tusUploadRef.current = upload;

      // Start the upload
      console.log('[AdminScreen] 🚀 Starting TUS upload...');
      await new Promise<void>((resolve, reject) => {
        upload.start();
        
        // Override the onSuccess and onError to use our promise
        const originalOnSuccess = upload.options.onSuccess;
        const originalOnError = upload.options.onError;
        
        upload.options.onSuccess = () => {
          if (originalOnSuccess) originalOnSuccess();
          resolve();
        };
        
        upload.options.onError = (error) => {
          if (originalOnError) originalOnError(error);
          reject(error);
        };
      });

      const uploadDuration = (Date.now() - startTime) / 1000;
      const speedMBps = (fileSize / (1024 * 1024) / uploadDuration).toFixed(2);
      
      setUploadProgress(90);
      setUploadStatus('Verifying upload...');

      // Step 5: Verify the file exists in storage
      console.log('[AdminScreen] Step 5: Verifying file exists in storage...');
      const { data: fileList, error: listError } = await supabase.storage
        .from('videos')
        .list('uploads', {
          search: fileName.split('/').pop()
        });

      if (listError) {
        console.error('[AdminScreen] ⚠️ Could not verify file existence:', listError);
      } else if (!fileList || fileList.length === 0) {
        console.error('[AdminScreen] ❌ File not found in storage after upload!');
        throw new Error('Upload appeared to succeed but file is not in storage. This may indicate a storage bucket configuration issue.');
      } else {
        console.log('[AdminScreen] ✅ File verified in storage:', fileList[0]);
      }

      setUploadProgress(92);
      setUploadStatus('Getting public URL...');

      // Step 6: Get public URL
      console.log('[AdminScreen] Step 6: Getting public URL...');
      const { data: { publicUrl: videoPublicUrl } } = supabase.storage
        .from('videos')
        .getPublicUrl(fileName);
      
      console.log('[AdminScreen] ✅ Public URL:', videoPublicUrl);

      setUploadProgress(94);
      setUploadStatus('Generating thumbnail...');

      // Step 7: Generate and upload thumbnail
      console.log('[AdminScreen] Step 7: Generating thumbnail...');
      const thumbnailUrl = await (async () => {
        try {
          const { uri: thumbnailUri } = await VideoThumbnails.getThumbnailAsync(selectedVideo, {
            time: 1000,
          });
          
          console.log('[AdminScreen] Thumbnail generated:', thumbnailUri);
          const thumbnailFileName = `thumbnails/${Date.now()}.jpg`;
          
          const { data: thumbSignedUrlData, error: thumbSignedUrlError } = await supabase.storage
            .from('videos')
            .createSignedUploadUrl(thumbnailFileName);

          if (thumbSignedUrlError || !thumbSignedUrlData) {
            console.error('[AdminScreen] Error creating thumbnail signed URL:', thumbSignedUrlError);
            return null;
          }

          console.log('[AdminScreen] Uploading thumbnail...');
          const thumbUploadResult = await FileSystem.uploadAsync(
            thumbSignedUrlData.signedUrl,
            thumbnailUri,
            {
              httpMethod: 'PUT',
              uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
              headers: {
                'Content-Type': 'image/jpeg',
              },
            }
          );

          if (thumbUploadResult.status !== 200) {
            console.error('[AdminScreen] Thumbnail upload failed:', thumbUploadResult.status);
            return null;
          }

          const { data: { publicUrl: thumbPublicUrl } } = supabase.storage
            .from('videos')
            .getPublicUrl(thumbnailFileName);
          
          console.log('[AdminScreen] ✅ Thumbnail uploaded:', thumbPublicUrl);
          return thumbPublicUrl;
        } catch (thumbnailError) {
          console.error('[AdminScreen] Error with thumbnail:', thumbnailError);
          return null;
        }
      })();

      setUploadProgress(97);
      setUploadStatus('Saving to database...');

      // Step 8: Save to database
      console.log('[AdminScreen] Step 8: Saving video record to database...');
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
          file_size_bytes: fileSize,
          uploaded_by: user?.id
        });

      if (dbError) {
        console.error('[AdminScreen] ❌ Database error:', dbError);
        throw dbError;
      }
      
      setUploadProgress(100);
      setUploadStatus('Upload complete!');
      console.log('[AdminScreen] ========== TUS UPLOAD COMPLETED SUCCESSFULLY ==========');

      Alert.alert(
        'Success ✅', 
        `Video uploaded successfully using TUS resumable upload!\n\n` +
        `⏱️ Time: ${uploadDuration.toFixed(1)} seconds\n` +
        `🚀 Speed: ${speedMBps} MB/s\n` +
        `📊 Size: ${formatFileSize(fileSize)}\n` +
        `🔄 Chunks: ${Math.ceil(fileSize / TUS_CHUNK_SIZE)}\n\n` +
        `The video is now available.`,
        [{ text: 'OK' }]
      );
      
      setVideoTitle('');
      setVideoDescription('');
      setSelectedVideo(null);
      setVideoMetadata(null);
      
      await refreshVideos();

    } catch (error: any) {
      console.error('[AdminScreen] ========== TUS UPLOAD FAILED ==========');
      console.error('[AdminScreen] Error:', error);
      console.error('[AdminScreen] Error message:', error.message);
      console.error('[AdminScreen] Error name:', error.name);
      console.error('[AdminScreen] Error stack:', error.stack);
      
      let errorMessage = 'Failed to upload video.\n\n';
      let errorTitle = 'Upload Failed';
      
      if (error.message?.includes('String length exceeds limit')) {
        errorTitle = '❌ File Too Large for Memory';
        errorMessage = 'The video file is too large to process in memory.\n\nThis is a known limitation with very large files.\n\nSolutions:\n• Compress the video to reduce file size\n• Use a computer to upload via Supabase dashboard\n• Split video into smaller segments';
      } else if (error.message?.includes('Payload too large') || error.message?.includes('413')) {
        errorTitle = '❌ File Too Large';
        errorMessage = 'The video exceeds the maximum upload size.\n\nSolutions:\n• Compress the video\n• Reduce resolution or quality\n• Trim to shorter duration';
      } else if (error.message?.includes('timed out') || error.message?.includes('timeout')) {
        errorTitle = '❌ Upload Timeout';
        errorMessage = `The upload took too long and was cancelled.\n\nFile size: ${formatFileSize(videoMetadata?.size || 0)}\n\nSolutions:\n• Use faster internet connection\n• Compress the video to reduce file size\n• Try uploading during off-peak hours\n• Ensure stable WiFi connection`;
      } else if (error.message?.includes('Network') || error.message?.includes('network') || error.message?.includes('Failed to fetch')) {
        errorTitle = '❌ Network Error';
        errorMessage = 'The upload failed due to network issues.\n\nTUS resumable upload will automatically retry.\n\nSolutions:\n• Check your internet connection\n• Use stable WiFi (not cellular)\n• The upload will resume from where it left off';
      } else if (error.message?.includes('403') || error.message?.includes('Forbidden')) {
        errorTitle = '❌ Access Denied';
        errorMessage = 'You do not have permission to upload to storage.\n\nSolutions:\n• Check storage bucket permissions in Supabase\n• Verify your admin status\n• Contact support';
      } else if (error.message?.includes('not in storage') || error.message?.includes('not found')) {
        errorTitle = '❌ Storage Verification Failed';
        errorMessage = 'The upload completed but the file could not be verified in storage.\n\nThis may indicate:\n• Storage bucket configuration issue\n• Temporary storage service problem\n\nSolutions:\n• Check the Video Management section to see if the video actually uploaded\n• Try uploading again\n• Check Supabase storage bucket settings';
      } else {
        errorMessage = error.message || 'Unknown error occurred.\n\nPlease check the console logs for more details.';
      }
      
      Alert.alert(errorTitle, errorMessage);
    } finally {
      uploadAbortRef.current = true;
      tusUploadRef.current = null;
      setUploading(false);
      setUploadStatus('');
      setUploadProgress(0);
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
              color="#2E7D32"
            />
            <View style={styles.requirementsTextContainer}>
              <Text style={[styles.requirementsTitle, { color: '#1B5E20' }]}>
                🚀 TUS RESUMABLE UPLOAD ACTIVE
              </Text>
              <Text style={[styles.requirementsText, { color: '#2E7D32' }]}>
                • ✅ Chunked uploads (6MB chunks)
              </Text>
              <Text style={[styles.requirementsText, { color: '#2E7D32' }]}>
                • ✅ Automatic resume on network interruption
              </Text>
              <Text style={[styles.requirementsText, { color: '#2E7D32' }]}>
                • ✅ Real-time progress tracking
              </Text>
              <Text style={[styles.requirementsText, { color: '#2E7D32' }]}>
                • ✅ Memory-efficient chunk reading
              </Text>
              <Text style={[styles.requirementsText, { color: '#2E7D32' }]}>
                • ✅ Direct storage hostname for speed
              </Text>
              <Text style={[styles.requirementsText, { color: '#2E7D32' }]}>
                • ✅ Explicit uploadSize specification
              </Text>
              <Text style={[styles.requirementsText, { color: '#2E7D32' }]}>
                • Maximum Duration: 90 seconds
              </Text>
              <Text style={[styles.requirementsText, { color: '#2E7D32' }]}>
                • Maximum File Size: 3 GB
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
                    {videoMetadata.duration > 0 ? formatDuration(videoMetadata.duration) : '0:48'}
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
              <Text style={[styles.progressSubtext, { color: colors.textSecondary, marginTop: 8, fontStyle: 'italic' }]}>
                TUS resumable upload - will auto-resume if interrupted
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
              TUS Upload Tips:{'\n'}
              • Uploads are chunked into 6MB pieces{'\n'}
              • Network interruptions will auto-resume{'\n'}
              • Real-time speed and progress tracking{'\n'}
              • Memory-efficient chunk reading{'\n'}
              • File size is explicitly specified{'\n'}
              • Keep app open during upload{'\n'}
              • Use stable WiFi for best results{'\n'}
              • Check console for detailed progress
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
