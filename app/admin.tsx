
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
        quality: 1,
        videoMaxDuration: 600, // 10 minutes max
      });

      if (!result.canceled && result.assets[0]) {
        const videoUri = result.assets[0].uri;
        setSelectedVideo(videoUri);
        
        // Get file size
        try {
          const fileInfo = await FileSystem.getInfoAsync(videoUri);
          if (fileInfo.exists && 'size' in fileInfo) {
            setVideoSize(fileInfo.size);
            console.log('[AdminScreen] Video selected:', {
              uri: videoUri,
              size: formatFileSize(fileInfo.size)
            });
            
            // Warn if file is very large
            if (fileInfo.size > 500 * 1024 * 1024) { // 500MB
              Alert.alert(
                'Large File',
                `This video is ${formatFileSize(fileInfo.size)}. Upload may take several minutes. Consider using a shorter video or lower resolution for faster uploads.`,
                [
                  { text: 'Cancel', onPress: () => setSelectedVideo(null), style: 'cancel' },
                  { text: 'Continue', style: 'default' }
                ]
              );
            }
          }
        } catch (error) {
          console.error('[AdminScreen] Error getting file info:', error);
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

    try {
      setUploading(true);
      setUploadProgress(0);
      
      console.log('[AdminScreen] Starting video upload...');
      console.log('[AdminScreen] Video URI:', selectedVideo);
      console.log('[AdminScreen] Video size:', formatFileSize(videoSize));

      // Generate unique filename
      const fileExt = selectedVideo.split('.').pop()?.toLowerCase() || 'mp4';
      const fileName = `${Date.now()}.${fileExt}`;
      const filePath = `videos/${fileName}`;

      console.log('[AdminScreen] Uploading file:', filePath);
      setUploadProgress(20);

      // For React Native, we need to use fetch with FormData
      // First, get the Supabase storage URL
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Not authenticated');
      }

      // Read file as base64
      const base64 = await FileSystem.readAsStringAsync(selectedVideo, {
        encoding: FileSystem.EncodingType.Base64,
      });

      console.log('[AdminScreen] File read as base64, length:', base64.length);
      setUploadProgress(40);

      // Convert base64 to blob
      const byteCharacters = atob(base64);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: `video/${fileExt}` });

      console.log('[AdminScreen] Blob created, size:', blob.size);
      setUploadProgress(60);

      // Upload using fetch directly to Supabase Storage
      const supabaseUrl = 'https://ucbilksfpnmltrkwvzft.supabase.co';
      const uploadUrl = `${supabaseUrl}/storage/v1/object/videos/${filePath}`;

      const uploadResponse = await fetch(uploadUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': `video/${fileExt}`,
          'x-upsert': 'false',
        },
        body: blob,
      });

      if (!uploadResponse.ok) {
        const errorText = await uploadResponse.text();
        console.error('[AdminScreen] Upload failed:', errorText);
        throw new Error(`Upload failed: ${uploadResponse.status} ${errorText}`);
      }

      console.log('[AdminScreen] Upload successful');
      setUploadProgress(80);

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('videos')
        .getPublicUrl(filePath);

      console.log('[AdminScreen] Public URL:', publicUrl);
      setUploadProgress(90);

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
      setUploadProgress(100);

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
      Alert.alert(
        'Upload Failed', 
        error.message || 'Failed to upload video. Please check your internet connection and try again.'
      );
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
                <Text style={[styles.fileSize, { color: colors.textSecondary }]}>
                  Size: {formatFileSize(videoSize)}
                </Text>
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
              For best results, use videos under 500MB. Large files may take several minutes to upload.
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
    fontSize: 12,
    textAlign: 'center',
    marginTop: 8,
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
    lineHeight: 16,
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
