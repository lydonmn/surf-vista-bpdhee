
import React, { useState } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert } from "react-native";
import { useTheme } from "@react-navigation/native";
import { useAuth } from "@/contexts/AuthContext";
import { router } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { supabase } from "@/app/integrations/supabase/client";
import { colors } from "@/styles/commonStyles";
import { IconSymbol } from "@/components/IconSymbol";

export default function AdminScreen() {
  const theme = useTheme();
  const { user, isAdmin } = useAuth();
  const [subscriptionPrice, setSubscriptionPrice] = useState('5.00');
  const [selectedVideo, setSelectedVideo] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [videoTitle, setVideoTitle] = useState('');
  const [videoDescription, setVideoDescription] = useState('');
  const [isUploading, setIsUploading] = useState(false);

  if (!isAdmin()) {
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <View style={styles.centerContent}>
          <IconSymbol
            ios_icon_name="exclamationmark.triangle.fill"
            android_material_icon_name="warning"
            size={64}
            color={colors.textSecondary}
          />
          <Text style={[styles.title, { color: theme.colors.text }]}>
            Access Denied
          </Text>
          <Text style={[styles.text, { color: colors.textSecondary }]}>
            You need admin privileges to access this page
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

  const pickVideo = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['videos'],
        allowsEditing: true,
        quality: 1,
      });

      if (!result.canceled && result.assets[0]) {
        setSelectedVideo(result.assets[0]);
        console.log('Selected video:', result.assets[0]);
      }
    } catch (error) {
      console.log('Error picking video:', error);
      Alert.alert('Error', 'Failed to select video');
    }
  };

  const uploadVideo = async () => {
    if (!selectedVideo) {
      Alert.alert('No Video', 'Please select a video first');
      return;
    }

    if (!videoTitle.trim()) {
      Alert.alert('Missing Title', 'Please enter a title for the video');
      return;
    }

    setIsUploading(true);

    try {
      // Get video file
      const response = await fetch(selectedVideo.uri);
      const blob = await response.blob();
      const fileExt = selectedVideo.uri.split('.').pop();
      const fileName = `${Date.now()}.${fileExt}`;
      const filePath = `${fileName}`;

      console.log('Uploading video to storage...');

      // Upload to Supabase Storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('videos')
        .upload(filePath, blob, {
          contentType: selectedVideo.type || 'video/mp4',
          upsert: false
        });

      if (uploadError) {
        console.log('Upload error:', uploadError);
        throw uploadError;
      }

      console.log('Video uploaded, getting public URL...');

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('videos')
        .getPublicUrl(filePath);

      console.log('Creating video record in database...');

      // Create video record in database
      const { error: dbError } = await supabase
        .from('videos')
        .insert({
          title: videoTitle,
          description: videoDescription || null,
          video_url: publicUrl,
          duration: selectedVideo.duration ? `${Math.floor(selectedVideo.duration / 60)}:${String(Math.floor(selectedVideo.duration % 60)).padStart(2, '0')}` : null,
          uploaded_by: user?.id
        });

      if (dbError) {
        console.log('Database error:', dbError);
        throw dbError;
      }

      Alert.alert('Success', 'Video uploaded successfully!');
      setSelectedVideo(null);
      setVideoTitle('');
      setVideoDescription('');
    } catch (error: any) {
      console.log('Upload error:', error);
      Alert.alert('Upload Failed', error.message || 'Failed to upload video');
    } finally {
      setIsUploading(false);
    }
  };

  const updateSubscriptionPrice = () => {
    const price = parseFloat(subscriptionPrice);
    if (isNaN(price) || price <= 0) {
      Alert.alert('Invalid Price', 'Please enter a valid price');
      return;
    }

    Alert.alert(
      'Update Subscription Price',
      `Set subscription price to $${price.toFixed(2)}/month?\n\nNote: In production, this would update your Superwall configuration.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Update',
          onPress: () => {
            console.log('Subscription price updated to:', price);
            Alert.alert('Success', `Subscription price updated to $${price.toFixed(2)}/month`);
          }
        }
      ]
    );
  };

  return (
    <ScrollView 
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      contentContainerStyle={styles.scrollContent}
    >
      <View style={styles.header}>
        <Text style={[styles.headerTitle, { color: theme.colors.text }]}>
          Admin Panel
        </Text>
        <Text style={[styles.headerSubtitle, { color: colors.textSecondary }]}>
          Manage videos and subscription settings
        </Text>
      </View>

      {/* Video Upload Section */}
      <View style={[styles.card, { backgroundColor: theme.colors.card }]}>
        <View style={styles.cardHeader}>
          <IconSymbol
            ios_icon_name="video.fill"
            android_material_icon_name="videocam"
            size={24}
            color={colors.primary}
          />
          <Text style={[styles.cardTitle, { color: theme.colors.text }]}>
            Upload Drone Video
          </Text>
        </View>

        <Text style={[styles.cardDescription, { color: colors.textSecondary }]}>
          Upload high-resolution drone footage to Supabase Storage
        </Text>

        <View style={[styles.inputContainer, { backgroundColor: colors.background }]}>
          <Text style={[styles.inputLabel, { color: theme.colors.text }]}>
            Video Title *
          </Text>
          <TextInput
            style={[styles.textInput, { color: theme.colors.text }]}
            value={videoTitle}
            onChangeText={setVideoTitle}
            placeholder="e.g., Morning Session - Epic Conditions"
            placeholderTextColor={colors.textSecondary}
          />
        </View>

        <View style={[styles.inputContainer, { backgroundColor: colors.background }]}>
          <Text style={[styles.inputLabel, { color: theme.colors.text }]}>
            Description (optional)
          </Text>
          <TextInput
            style={[styles.textInput, styles.textArea, { color: theme.colors.text }]}
            value={videoDescription}
            onChangeText={setVideoDescription}
            placeholder="Add a description..."
            placeholderTextColor={colors.textSecondary}
            multiline
            numberOfLines={3}
          />
        </View>

        {selectedVideo && (
          <View style={[styles.selectedVideoInfo, { backgroundColor: colors.highlight }]}>
            <IconSymbol
              ios_icon_name="checkmark.circle.fill"
              android_material_icon_name="check_circle"
              size={20}
              color={colors.primary}
            />
            <Text style={[styles.selectedVideoText, { color: theme.colors.text }]}>
              Video selected: {selectedVideo.fileName || 'video file'}
            </Text>
          </View>
        )}

        <TouchableOpacity
          style={[styles.actionButton, { backgroundColor: colors.secondary }]}
          onPress={pickVideo}
          disabled={isUploading}
        >
          <IconSymbol
            ios_icon_name="photo.on.rectangle"
            android_material_icon_name="photo_library"
            size={20}
            color={colors.text}
          />
          <Text style={[styles.actionButtonText, { color: colors.text }]}>
            Select Video from Library
          </Text>
        </TouchableOpacity>

        {selectedVideo && (
          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: colors.primary, opacity: isUploading ? 0.6 : 1 }]}
            onPress={uploadVideo}
            disabled={isUploading}
          >
            <IconSymbol
              ios_icon_name="arrow.up.circle.fill"
              android_material_icon_name="cloud_upload"
              size={20}
              color="#FFFFFF"
            />
            <Text style={[styles.actionButtonText, { color: '#FFFFFF' }]}>
              {isUploading ? 'Uploading...' : 'Upload Video'}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Subscription Settings Section */}
      <View style={[styles.card, { backgroundColor: theme.colors.card }]}>
        <View style={styles.cardHeader}>
          <IconSymbol
            ios_icon_name="dollarsign.circle.fill"
            android_material_icon_name="payments"
            size={24}
            color={colors.primary}
          />
          <Text style={[styles.cardTitle, { color: theme.colors.text }]}>
            Subscription Settings
          </Text>
        </View>

        <Text style={[styles.cardDescription, { color: colors.textSecondary }]}>
          Adjust the monthly subscription price
        </Text>

        <View style={styles.priceInputContainer}>
          <Text style={[styles.priceLabel, { color: theme.colors.text }]}>
            Monthly Price (USD)
          </Text>
          <View style={[styles.priceInput, { backgroundColor: colors.background }]}>
            <Text style={[styles.dollarSign, { color: theme.colors.text }]}>$</Text>
            <TextInput
              style={[styles.input, { color: theme.colors.text }]}
              value={subscriptionPrice}
              onChangeText={setSubscriptionPrice}
              keyboardType="decimal-pad"
              placeholder="5.00"
              placeholderTextColor={colors.textSecondary}
            />
          </View>
        </View>

        <TouchableOpacity
          style={[styles.actionButton, { backgroundColor: colors.accent }]}
          onPress={updateSubscriptionPrice}
        >
          <IconSymbol
            ios_icon_name="checkmark.circle.fill"
            android_material_icon_name="check_circle"
            size={20}
            color="#FFFFFF"
          />
          <Text style={[styles.actionButtonText, { color: '#FFFFFF' }]}>
            Update Price
          </Text>
        </TouchableOpacity>
      </View>

      {/* Info Section */}
      <View style={[styles.infoCard, { backgroundColor: theme.colors.card }]}>
        <IconSymbol
          ios_icon_name="info.circle.fill"
          android_material_icon_name="info"
          size={24}
          color={colors.primary}
        />
        <View style={styles.infoTextContainer}>
          <Text style={[styles.infoTitle, { color: theme.colors.text }]}>
            Supabase Integration Active
          </Text>
          <Text style={[styles.infoText, { color: colors.textSecondary }]}>
            - Videos are stored in Supabase Storage
          </Text>
          <Text style={[styles.infoText, { color: colors.textSecondary }]}>
            - User authentication via Supabase Auth
          </Text>
          <Text style={[styles.infoText, { color: colors.textSecondary }]}>
            - Row Level Security (RLS) policies enabled
          </Text>
          <Text style={[styles.infoText, { color: colors.textSecondary }]}>
            - Integrate Superwall for subscription payments
          </Text>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 100,
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  header: {
    marginBottom: 24,
    paddingTop: 20,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginTop: 16,
    marginBottom: 8,
  },
  text: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 24,
  },
  button: {
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 12,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 18,
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
    marginBottom: 8,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  cardDescription: {
    fontSize: 14,
    marginBottom: 16,
    lineHeight: 20,
  },
  inputContainer: {
    marginBottom: 16,
    borderRadius: 8,
    padding: 12,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  textInput: {
    fontSize: 16,
    padding: 8,
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  selectedVideoInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  selectedVideoText: {
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  priceInputContainer: {
    marginBottom: 16,
  },
  priceLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  priceInput: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  dollarSign: {
    fontSize: 18,
    fontWeight: 'bold',
    marginRight: 4,
  },
  input: {
    flex: 1,
    fontSize: 18,
    fontWeight: '600',
  },
  infoCard: {
    flexDirection: 'row',
    padding: 16,
    borderRadius: 12,
    gap: 12,
    boxShadow: '0px 2px 8px rgba(0, 0, 0, 0.1)',
    elevation: 3,
  },
  infoTextContainer: {
    flex: 1,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  infoText: {
    fontSize: 13,
    lineHeight: 20,
    marginBottom: 4,
  },
});
