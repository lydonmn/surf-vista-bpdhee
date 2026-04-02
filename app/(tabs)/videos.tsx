
import React, { useEffect } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl, Alert, Image } from "react-native";
import { useTheme } from "@react-navigation/native";
import { useAuth } from "@/contexts/AuthContext";
import { router } from "expo-router";
import { colors } from "@/styles/commonStyles";
import { IconSymbol } from "@/components/IconSymbol";
import { useVideos } from "@/hooks/useVideos";
import { supabase } from "@/app/integrations/supabase/client";
import { VideoPreloadIndicator } from "@/components/VideoPreloadIndicator";
import { useLocation } from "@/contexts/LocationContext";
import { openPaywall } from "@/utils/paywallHelper";

// 🎬 Mux HLS URL prefix for detection
const MUX_HLS_PREFIX = 'https://stream.mux.com/';

export default function VideosScreen() {
  const theme = useTheme();
  const { user, profile, checkSubscription, isLoading: authLoading, isInitialized } = useAuth();
  const { videos, isLoading: videosLoading, error, refreshVideos } = useVideos();
  const { locationData } = useLocation();
  const [isRefreshing, setIsRefreshing] = React.useState(false);
  const [deletingVideoId, setDeletingVideoId] = React.useState<string | null>(null);
  const isSubscribed = checkSubscription();

  useEffect(() => {
    console.log('VideosScreen - Auth state:', {
      hasUser: !!user,
      hasProfile: !!profile,
      isSubscribed,
      authLoading,
      isInitialized,
      profileData: profile ? {
        is_admin: profile.is_admin,
        is_subscribed: profile.is_subscribed,
        subscription_end_date: profile.subscription_end_date
      } : null
    });
  }, [user, profile, isSubscribed, authLoading, isInitialized]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await refreshVideos();
    setIsRefreshing(false);
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
              console.log('[VideosScreen] Deleting video:', videoId);

              // 🎬 CRITICAL FIX: Only delete from Supabase storage if it's NOT a Mux URL
              if (!videoUrl.startsWith(MUX_HLS_PREFIX)) {
                // Extract filename from Supabase URL
                const urlParts = videoUrl.split('/videos/');
                if (urlParts.length === 2) {
                  const fileName = urlParts[1];
                  console.log('[VideosScreen] Deleting file from storage:', fileName);

                  // Delete from storage
                  const { error: storageError } = await supabase.storage
                    .from('videos')
                    .remove([fileName]);

                  if (storageError) {
                    console.error('[VideosScreen] Error deleting from storage:', storageError);
                    // Continue anyway to delete from database
                  }
                }
              } else {
                console.log('[VideosScreen] 🎬 Mux video detected - skipping Supabase storage deletion (video is on Mux)');
                // TODO: Add Mux asset deletion via Edge Function if needed
              }

              // Delete from database
              const { error: dbError } = await supabase
                .from('videos')
                .delete()
                .eq('id', videoId);

              if (dbError) {
                console.error('[VideosScreen] Error deleting from database:', dbError);
                throw dbError;
              }

              console.log('[VideosScreen] Video deleted successfully');
              Alert.alert('Success', 'Video deleted successfully');
              await refreshVideos();
            } catch (error: any) {
              console.error('[VideosScreen] Error deleting video:', error);
              Alert.alert('Error', `Failed to delete video: ${error.message}`);
            } finally {
              setDeletingVideoId(null);
            }
          }
        }
      ]
    );
  };

  const handleVideoPress = React.useCallback(async (videoId: string, preloadedUrl?: string, videoStatus?: string) => {
    // Don't allow playing processing videos
    if (videoStatus === 'processing') {
      Alert.alert('Video Processing', 'This video is still being processed by Mux. Please wait a moment and try again.');
      return;
    }

    // Non-subscribers: show paywall instead of playing
    if (!isSubscribed) {
      console.log('[VideosScreen] Non-subscriber tapped video — opening paywall');
      await openPaywall(user?.id, user?.email || undefined, async () => {
        // Subscription acquired — nothing extra needed here
      });
      return;
    }

    console.log('[VideosScreen] Opening fullscreen video player for:', videoId);
    console.log('[VideosScreen] Preloaded URL available:', !!preloadedUrl);
    
    router.push({
      pathname: '/video-player',
      params: { 
        videoId,
        preloadedUrl: preloadedUrl || '',
      }
    });
  }, [isSubscribed, user]);

  // Helper function to get the correct video source for preview
  const getVideoPreviewSource = React.useCallback((video: any) => {
    // Don't try to preview processing videos
    if (video.status === 'processing') {
      return null;
    }

    // 🎬 CRITICAL FIX: Check if this is a Mux HLS URL - if so, use it directly
    if (video.video_url.startsWith(MUX_HLS_PREFIX)) {
      console.log('[VideosScreen] 🎬 Using Mux HLS URL for preview:', video.id);
      return video.video_url;
    }
    
    // For Supabase videos, use signed URL if available, otherwise use video_url
    if (video.signed_url) {
      console.log('[VideosScreen] Using signed URL for preview:', video.id);
      return video.signed_url;
    }
    
    console.log('[VideosScreen] Using video_url for preview:', video.id);
    return video.video_url;
  }, []);

  // ✅ ATOMIC JSX: Extract location-specific subtitle text
  const videoLibrarySubtitle = `Exclusive drone footage from ${locationData.displayName}`;

  // Show loading state while auth is initializing or profile is being loaded
  if (!isInitialized || authLoading) {
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
            Loading your profile...
          </Text>
        </View>
      </View>
    );
  }

  console.log('VideosScreen - Showing video library for location:', locationData.displayName, '| isSubscribed:', isSubscribed);
  return (
    <ScrollView 
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      contentContainerStyle={styles.scrollContent}
      refreshControl={
        <RefreshControl
          refreshing={isRefreshing}
          onRefresh={handleRefresh}
          tintColor={colors.primary}
        />
      }
    >
      <View style={styles.header}>
        <Text style={[styles.headerTitle, { color: theme.colors.text }]}>
          Video Library
        </Text>
        <Text style={[styles.headerSubtitle, { color: colors.textSecondary }]}>
          {videoLibrarySubtitle}
        </Text>
      </View>

      {error && (
        <View style={[styles.errorCard, { backgroundColor: '#FF6B6B' }]}>
          <IconSymbol
            ios_icon_name="exclamationmark.triangle.fill"
            android_material_icon_name="warning"
            size={24}
            color="#FFFFFF"
          />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {videosLoading && !isRefreshing ? (
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
            Loading videos...
          </Text>
        </View>
      ) : videos.length === 0 ? (
        <View style={[styles.emptyCard, { backgroundColor: theme.colors.card }]}>
          <IconSymbol
            ios_icon_name="video.fill"
            android_material_icon_name="videocam"
            size={64}
            color={colors.textSecondary}
          />
          <Text style={[styles.emptyTitle, { color: theme.colors.text }]}>
            No Videos Yet
          </Text>
          <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
            New drone footage will appear here as it&apos;s uploaded by our team.
          </Text>
          {profile?.is_admin && (
            <TouchableOpacity
              style={[styles.uploadButton, { backgroundColor: colors.primary }]}
              onPress={() => router.push('/admin')}
            >
              <IconSymbol
                ios_icon_name="plus.circle.fill"
                android_material_icon_name="add_circle"
                size={20}
                color="#FFFFFF"
              />
              <Text style={styles.uploadButtonText}>Upload Video</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : (
        <React.Fragment>
          {videos.map((video) => {
            const isDeleting = deletingVideoId === video.id;
            const videoSource = getVideoPreviewSource(video);
            const isProcessing = video.status === 'processing';
            
            return (
              <React.Fragment key={video.id}>
                <View style={[styles.videoCard, { backgroundColor: theme.colors.card }]}>
                  <TouchableOpacity
                    style={styles.videoTouchable}
                    onPress={() => handleVideoPress(video.id, video.signed_url, video.status)}
                    disabled={isDeleting || isProcessing}
                    activeOpacity={0.7}
                  >
                    <View style={styles.videoPreviewContainer}>
                      {videoSource ? (
                        <>
                          <VideoPreview videoUrl={videoSource} />
                          <View style={styles.videoOverlay}>
                            <View style={styles.playButtonContainer}>
                              {isSubscribed ? (
                                <IconSymbol
                                  ios_icon_name="play.circle.fill"
                                  android_material_icon_name="play_circle"
                                  size={64}
                                  color="rgba(255, 255, 255, 0.9)"
                                />
                              ) : (
                                <IconSymbol
                                  ios_icon_name="lock.circle.fill"
                                  android_material_icon_name="lock"
                                  size={64}
                                  color="rgba(255, 255, 255, 0.9)"
                                />
                              )}
                              <Text style={styles.tapToPlayText}>
                                {isSubscribed ? 'Tap to play fullscreen' : 'Subscribe to watch'}
                              </Text>
                            </View>
                          </View>
                        </>
                      ) : (
                        <View style={styles.placeholderContainer}>
                          <IconSymbol
                            ios_icon_name={isSubscribed ? "video.fill" : "lock.fill"}
                            android_material_icon_name={isSubscribed ? "videocam" : "lock"}
                            size={48}
                            color={colors.textSecondary}
                          />
                        </View>
                      )}
                      
                      {/* Processing badge overlay */}
                      {isProcessing && (
                        <View style={styles.processingBadge}>
                          <ActivityIndicator size="small" color="#FFFFFF" />
                          <Text style={styles.processingText}>Processing...</Text>
                        </View>
                      )}

                      {/* Lock badge for non-subscribers */}
                      {!isSubscribed && !isProcessing && (
                        <View style={styles.lockBadge}>
                          <IconSymbol
                            ios_icon_name="lock.fill"
                            android_material_icon_name="lock"
                            size={12}
                            color="#FFFFFF"
                          />
                          <Text style={styles.lockBadgeText}>PRO</Text>
                        </View>
                      )}
                    </View>
                    {video.signed_url && !isProcessing && (
                      <View style={styles.preloadBadge}>
                        <VideoPreloadIndicator isPreloaded={true} size="small" />
                      </View>
                    )}
                    <View style={styles.videoInfo}>
                      <Text style={[styles.videoTitle, { color: theme.colors.text }]}>
                        {video.title}
                      </Text>
                      <Text style={[styles.videoDate, { color: colors.textSecondary }]}>
                        {new Date(video.created_at).toLocaleDateString('en-US', {
                          month: 'long',
                          day: 'numeric',
                          year: 'numeric'
                        })}
                      </Text>
                      {video.description && (
                        <Text 
                          style={[styles.videoDescription, { color: colors.textSecondary }]}
                          numberOfLines={2}
                        >
                          {video.description}
                        </Text>
                      )}
                      {isProcessing && (
                        <Text style={[styles.processingNote, { color: colors.accent }]}>
                          ⏳ Mux is transcoding this video. It will be ready soon!
                        </Text>
                      )}
                    </View>
                  </TouchableOpacity>

                  {profile?.is_admin && (
                    <View style={styles.adminActions}>
                      <TouchableOpacity
                        style={[styles.deleteButton, { backgroundColor: '#FF6B6B' }]}
                        onPress={() => handleDeleteVideo(video.id, video.title, video.video_url)}
                        disabled={isDeleting}
                      >
                        {isDeleting ? (
                          <ActivityIndicator size="small" color="#FFFFFF" />
                        ) : (
                          <React.Fragment>
                            <IconSymbol
                              ios_icon_name="trash.fill"
                              android_material_icon_name="delete"
                              size={16}
                              color="#FFFFFF"
                            />
                            <Text style={styles.deleteButtonText}>Delete</Text>
                          </React.Fragment>
                        )}
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              </React.Fragment>
            );
          })}
        </React.Fragment>
      )}

      {profile?.is_admin && videos.length > 0 && (
        <TouchableOpacity
          style={[styles.adminButton, { backgroundColor: colors.primary }]}
          onPress={() => router.push('/admin')}
        >
          <IconSymbol
            ios_icon_name="plus.circle.fill"
            android_material_icon_name="add_circle"
            size={20}
            color="#FFFFFF"
          />
          <Text style={styles.adminButtonText}>Upload New Video</Text>
        </TouchableOpacity>
      )}
    </ScrollView>
  );
}

// 🚨 CRITICAL FIX: Thumbnail-only preview component (no video player)
function VideoPreview({ videoUrl }: { videoUrl: string }) {
  const playbackId = videoUrl.includes('stream.mux.com/')
    ? videoUrl.split('stream.mux.com/')[1]?.split('.m3u8')[0]
    : null;
  
  const thumbnailUrl = playbackId
    ? `https://image.mux.com/${playbackId}/thumbnail.jpg?width=800&fit_mode=preserve&time=1`
    : null;

  if (!thumbnailUrl) {
    return (
      <View style={[styles.videoPreview, { backgroundColor: '#1a1a1a', justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  return (
    <Image
      source={{ uri: thumbnailUrl }}
      style={styles.videoPreview}
      resizeMode="cover"
    />
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: 48,
    paddingHorizontal: 16,
    paddingBottom: 100,
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingVertical: 48,
  },
  loadingText: {
    fontSize: 16,
    marginTop: 16,
  },
  header: {
    marginBottom: 24,
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
  debugText: {
    fontSize: 12,
    textAlign: 'center',
    marginBottom: 16,
    fontStyle: 'italic',
  },
  subscribeButton: {
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 12,
  },
  subscribeButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
  errorCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    gap: 12,
  },
  errorText: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  emptyCard: {
    alignItems: 'center',
    padding: 48,
    borderRadius: 12,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 20,
  },
  uploadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 8,
  },
  uploadButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  videoCard: {
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 16,
    boxShadow: '0px 2px 8px rgba(0, 0, 0, 0.1)',
    elevation: 3,
  },
  videoTouchable: {
    width: '100%',
  },
  videoPreviewContainer: {
    width: '100%',
    height: 200,
    position: 'relative',
  },
  videoPreview: {
    width: '100%',
    height: '100%',
  },
  placeholderContainer: {
    width: '100%',
    height: '100%',
    backgroundColor: '#1a1a1a',
    justifyContent: 'center',
    alignItems: 'center',
  },
  videoOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
  },
  playButtonContainer: {
    alignItems: 'center',
    gap: 8,
  },
  tapToPlayText: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: 14,
    fontWeight: '600',
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  preloadBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
  },
  processingBadge: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  processingText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  videoInfo: {
    padding: 12,
  },
  videoTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  videoDate: {
    fontSize: 14,
    marginBottom: 4,
  },
  videoDescription: {
    fontSize: 13,
    lineHeight: 18,
  },
  processingNote: {
    fontSize: 12,
    marginTop: 6,
    fontStyle: 'italic',
  },
  adminActions: {
    flexDirection: 'row',
    padding: 12,
    paddingTop: 0,
    gap: 8,
  },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 6,
    flex: 1,
  },
  deleteButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  adminButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    marginTop: 8,
  },
  adminButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  lockBadge: {
    position: 'absolute',
    top: 10,
    left: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  lockBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
});
