
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

interface UserProfile {
  id: string;
  email: string;
  is_admin: boolean;
  is_subscribed: boolean;
  subscription_end_date: string | null;
}

// Maximum file size: 50MB (Supabase free tier limit)
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB in bytes
const RECOMMENDED_FILE_SIZE = 30 * 1024 * 1024; // 30MB recommended

export default function AdminScreen() {
  const theme = useTheme();
  const { profile } = useAuth();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  // Video upload state
  const [videoTitle, setVideoTitle] = useState('');
  const [videoDescription, setVideoDescription] = useState('');
  const [selectedVideo, setSelectedVideo] = useState<string | null>(null);
  const [videoSize, setVideoSize] = useState<number>(0);

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

  const pickVideo = async () => {
    try {
      // Request permissions
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Please grant permission to access your photo library');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['videos'],
        allowsEditing: false,
        quality: 0.8, // Reduce quality to help with file size
        videoMaxDuration: 300, // 5 minutes max
      });

      if (!result.canceled && result.assets[0]) {
        const videoUri = result.assets[0].uri;
        
        // Get file size
        try {
          const fileInfo = await FileSystem.getInfoAsync(videoUri);
          if (fileInfo.exists && 'size' in fileInfo) {
            const fileSize = fileInfo.size;
            
            console.log('[AdminScreen] Video selected:', {
              uri: videoUri,
              size: formatFileSize(fileSize)
            });
            
            // Check if file exceeds maximum size
            if (fileSize > MAX_FILE_SIZE) {
              Alert.alert(
                'File Too Large',
                `This video is ${formatFileSize(fileSize)}, which exceeds the maximum allowed size of ${formatFileSize(MAX_FILE_SIZE)}.\n\nPlease:\n- Use a shorter video (under 5 minutes)\n- Record at a lower resolution (1080p instead of 4K)\n- Compress the video before uploading\n\nRecommended size: Under ${formatFileSize(RECOMMENDED_FILE_SIZE)} for best results.`,
                [{ text: 'OK' }]
              );
              return;
            }
            
            // Warn if file is large but within limits
            if (fileSize > RECOMMENDED_FILE_SIZE) {
              Alert.alert(
                'Large File Warning',
                `This video is ${formatFileSize(fileSize)}. While this is within the limit, upload may take several minutes and could fail on slower connections.\n\nFor best results, use videos under ${formatFileSize(RECOMMENDED_FILE_SIZE)}.`,
                [
                  { text: 'Cancel', style: 'cancel' },
                  { 
                    text: 'Continue Anyway', 
                    style: 'default',
                    onPress: () => {
                      setSelectedVideo(videoUri);
                      setVideoSize(fileSize);
                    }
                  }
                ]
              );
            } else {
              setSelectedVideo(videoUri);
              setVideoSize(fileSize);
            }
          }
        } catch (error) {
          console.error('[AdminScreen] Error getting file info:', error);
          Alert.alert('Error', 'Could not read video file information');
        }
      }
    } catch (error) {
      console.error('[AdminScreen] Error picking video:', error);
      Alert.alert('Error', 'Failed to pick video');
    }
  };

  const uploadVideo = async () => {
    if (!selectedVideo || !videoTitle) {
      Alert.alert('Error', 'Please select a video and enter a title');
      return;
    }

    // Double-check file size before upload
    if (videoSize > MAX_FILE_SIZE) {
      Alert.alert(
        'File Too Large',
        `This video exceeds the maximum allowed size of ${formatFileSize(MAX_FILE_SIZE)}. Please select a smaller video.`
      );
      return;
    }

    try {
      setUploading(true);
      setUploadProgress(0);
      
      console.log('[AdminScreen] Starting video upload...');
      console.log('[AdminScreen] Video URI:', selectedVideo);
      console.log('[AdminScreen] Video size:', formatFileSize(videoSize));

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

      // Use FileSystem.uploadAsync for all files with proper progress tracking
      const supabaseUrl = 'https://ucbilksfpnmltrkwvzft.supabase.co';
      const uploadUrl = `${supabaseUrl}/storage/v1/object/videos/${fileName}`;
      
      console.log('[AdminScreen] Upload URL:', uploadUrl);
      
      // Create upload task with progress tracking
      const uploadTask = FileSystem.createUploadTask(
        uploadUrl,
        selectedVideo,
        {
          httpMethod: 'POST',
          uploadType: FileSystem.FileSystemUploadType.MULTIPART,
          fieldName: 'file',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVjYmlsa3NmcG5tbHRya3d2emZ0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU4NDM2MjcsImV4cCI6MjA4MTQxOTYyN30.pQkSbD0JzvRV4_lj0rAmeaQFZqK1QVW0EkVlhYM-KA8',
            'x-upsert': 'false',
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
            errorMessage = `File size exceeds storage limits. Maximum allowed: ${formatFileSize(MAX_FILE_SIZE)}. Your file: ${formatFileSize(videoSize)}. Please use a smaller video.`;
          } else if (errorBody?.message) {
            errorMessage = errorBody.message;
          } else if (result?.status === 413) {
            errorMessage = `File too large for upload. Maximum: ${formatFileSize(MAX_FILE_SIZE)}`;
          }
        } catch (parseError) {
          console.error('[AdminScreen] Error parsing response:', parseError);
          if (result?.status === 413) {
            errorMessage = `File too large. Maximum allowed: ${formatFileSize(MAX_FILE_SIZE)}`;
          } else {
            errorMessage = `Upload failed with status ${result?.status}`;
          }
        }
        
        throw new Error(errorMessage);
      }
      
      console.log('[AdminScreen] Upload successful');
      setUploadProgress(100);

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('videos')
        .getPublicUrl(fileName);

      console.log('[AdminScreen] Public URL:', publicUrl);

      // Create video record in database
      const { error: dbError } = await supabase
        .from('videos')
        .insert({
          title: videoTitle,
          description: videoDescription,
          video_url: publicUrl,
          uploaded_by: profile?.id
        });

      if (dbError) {
        console.error('[AdminScreen] Database error:', dbError);
        throw dbError;
      }

      console.log('[AdminScreen] Video record created successfully');

      Alert.alert(
        'Success!', 
        'Video uploaded successfully! It may take a few moments to process.',
        [
          {
            text: 'OK',
            onPress: () => {
              setVideoTitle('');
              setVideoDescription('');
              setSelectedVideo(null);
              setVideoSize(0);
              setUploadProgress(0);
            }
          }
        ]
      );
    } catch (error: any) {
      console.error('[AdminScreen] Upload error:', error);
      
      let errorMessage = 'Failed to upload video. ';
      
      if (error.message?.includes('Payload too large') || error.message?.includes('File too large')) {
        errorMessage = error.message;
      } else if (error.message?.includes('Network request failed')) {
        errorMessage += 'Network connection lost. Please check your internet connection and try again with a smaller file if the problem persists.';
      } else if (error.message?.includes('Not authenticated')) {
        errorMessage += 'Your session has expired. Please log out and log in again.';
      } else if (error.message?.includes('storage')) {
        errorMessage += 'Storage service error. Please try again later or contact support.';
      } else {
        errorMessage += error.message || 'An unknown error occurred. Please try again with a smaller video file.';
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

          <View style={[styles.warningBox, { backgroundColor: '#FFF3CD', borderColor: '#FFC107' }]}>
            <IconSymbol
              ios_icon_name="exclamationmark.triangle.fill"
              android_material_icon_name="warning"
              size={20}
              color="#856404"
            />
            <View style={styles.warningTextContainer}>
              <Text style={[styles.warningTitle, { color: '#856404' }]}>
                File Size Limits
              </Text>
              <Text style={[styles.warningText, { color: '#856404' }]}>
                Maximum: {formatFileSize(MAX_FILE_SIZE)}
              </Text>
              <Text style={[styles.warningText, { color: '#856404' }]}>
                Recommended: Under {formatFileSize(RECOMMENDED_FILE_SIZE)}
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
            disabled={uploading}
          >
            <IconSymbol
              ios_icon_name="video.fill"
              android_material_icon_name="videocam"
              size={20}
              color="#FFFFFF"
            />
            <Text style={styles.buttonText}>
              {selectedVideo ? 'Change Video' : 'Select Video'}
            </Text>
          </TouchableOpacity>

          {selectedVideo && (
            <View style={styles.selectedFileInfo}>
              <Text style={[styles.selectedFile, { color: colors.textSecondary }]}>
                ✓ Video selected
              </Text>
              {videoSize > 0 && (
                <React.Fragment>
                  <Text style={[styles.fileSize, { 
                    color: videoSize > RECOMMENDED_FILE_SIZE ? '#FF6B6B' : colors.textSecondary,
                    fontWeight: videoSize > RECOMMENDED_FILE_SIZE ? '600' : 'normal'
                  }]}>
                    Size: {formatFileSize(videoSize)}
                  </Text>
                  {videoSize > RECOMMENDED_FILE_SIZE && (
                    <Text style={[styles.fileSizeWarning, { color: '#FF6B6B' }]}>
                      ⚠️ Large file - upload may be slow
                    </Text>
                  )}
                </React.Fragment>
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
                Uploading... {uploadProgress}%
              </Text>
              <Text style={[styles.progressSubtext, { color: colors.textSecondary }]}>
                Please keep the app open and maintain internet connection
              </Text>
            </View>
          )}

          <TouchableOpacity
            style={[
              styles.button,
              { backgroundColor: colors.accent },
              (!selectedVideo || !videoTitle || uploading) && styles.buttonDisabled
            ]}
            onPress={uploadVideo}
            disabled={!selectedVideo || !videoTitle || uploading}
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
              ios_icon_name="info.circle"
              android_material_icon_name="info"
              size={16}
              color={colors.primary}
            />
            <Text style={[styles.infoText, { color: colors.textSecondary }]}>
              Tips for successful uploads:{'\n'}
              • Record at 1080p instead of 4K{'\n'}
              • Keep videos under 5 minutes{'\n'}
              • Use a stable WiFi connection{'\n'}
              • Compress videos before uploading if needed
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
  warningBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    borderWidth: 1,
  },
  warningTextContainer: {
    flex: 1,
  },
  warningTitle: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 4,
  },
  warningText: {
    fontSize: 12,
    lineHeight: 16,
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
  selectedFileInfo: {
    marginTop: 12,
    alignItems: 'center',
  },
  selectedFile: {
    fontSize: 14,
    fontWeight: '600',
  },
  fileSize: {
    fontSize: 12,
    marginTop: 4,
  },
  fileSizeWarning: {
    fontSize: 11,
    marginTop: 4,
    fontWeight: '600',
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
  errorText: {
    fontSize: 18,
    marginTop: 16,
    marginBottom: 24,
  },
});
