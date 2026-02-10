
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import 'react-native-reanimated';
import { useColorScheme, AppState, AppStateStatus } from 'react-native';
import { AuthProvider } from '@/contexts/AuthContext';
import { WidgetProvider } from '@/contexts/WidgetContext';
import { LocationProvider } from '@/contexts/LocationContext';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { supabase } from '@/app/integrations/supabase/client';

SplashScreen.preventAutoHideAsync();

// ✅ CRITICAL: Background video preparation service
// This keeps videos preloaded even when app is in background
async function prepareVideosInBackground() {
  try {
    console.log('[BackgroundService] 🔄 Preparing videos for instant playback...');
    
    // Fetch all videos
    const { data: videos, error } = await supabase
      .from('videos')
      .select('id, video_url, location')
      .order('created_at', { ascending: false })
      .limit(10); // Prepare latest 10 videos

    if (error || !videos) {
      console.warn('[BackgroundService] Failed to fetch videos:', error);
      return;
    }

    console.log('[BackgroundService] ✅ Found', videos.length, 'videos to prepare');

    // Generate signed URLs and trigger CDN warming
    const preparePromises = videos.map(async (video) => {
      try {
        // Extract filename
        const urlParts = video.video_url.split('/videos/');
        if (urlParts.length !== 2) return;
        
        const fileName = urlParts[1].split('?')[0];
        
        // Generate signed URL
        const { data: signedUrlData, error: signedUrlError } = await supabase.storage
          .from('videos')
          .createSignedUrl(fileName, 7200);

        if (signedUrlError || !signedUrlData?.signedUrl) {
          console.warn('[BackgroundService] Failed to generate URL for:', video.id);
          return;
        }

        // Warm up CDN by fetching first 5MB
        const response = await fetch(signedUrlData.signedUrl, {
          method: 'GET',
          headers: {
            'Range': 'bytes=0-5242879', // First 5MB
          },
        });

        if (response.ok || response.status === 206) {
          console.log('[BackgroundService] ✅ Video prepared:', video.id);
        }
      } catch (err) {
        console.warn('[BackgroundService] Error preparing video:', video.id, err);
      }
    });

    await Promise.all(preparePromises);
    console.log('[BackgroundService] ✅ All videos prepared for instant playback');
  } catch (error) {
    console.error('[BackgroundService] Error in background preparation:', error);
  }
}

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const [loaded] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
  });

  useEffect(() => {
    if (loaded) {
      SplashScreen.hideAsync();
    }
  }, [loaded]);

  // ✅ CRITICAL: Set up background video preparation
  useEffect(() => {
    console.log('[RootLayout] Setting up background video preparation service');
    
    // Prepare videos immediately on app start
    prepareVideosInBackground();

    // Set up periodic preparation every 10 minutes
    const preparationInterval = setInterval(() => {
      console.log('[RootLayout] ⏰ Periodic video preparation triggered');
      prepareVideosInBackground();
    }, 10 * 60 * 1000); // 10 minutes

    // Set up app state listener to prepare videos when app becomes active
    const appStateSubscription = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
      if (nextAppState === 'active') {
        console.log('[RootLayout] 📱 App became active - preparing videos');
        prepareVideosInBackground();
      }
    });

    return () => {
      clearInterval(preparationInterval);
      appStateSubscription.remove();
    };
  }, []);

  if (!loaded) {
    return null;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AuthProvider>
        <LocationProvider>
          <WidgetProvider>
            <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
              <Stack screenOptions={{ headerShown: false }}>
                <Stack.Screen name="(tabs)" />
                <Stack.Screen name="login" />
                <Stack.Screen name="admin" />
                <Stack.Screen name="admin-data" />
                <Stack.Screen name="admin-debug" />
                <Stack.Screen name="admin-users" />
                <Stack.Screen name="admin-predictions" />
                <Stack.Screen name="admin-cron-logs" />
                <Stack.Screen name="setup-admin" />
                <Stack.Screen name="edit-report" />
                <Stack.Screen 
                  name="video-player" 
                  options={{ 
                    presentation: 'fullScreenModal',
                    animation: 'slide_from_bottom'
                  }} 
                />
                <Stack.Screen 
                  name="video-player-simple" 
                  options={{ 
                    presentation: 'fullScreenModal',
                    animation: 'slide_from_bottom'
                  }} 
                />
                <Stack.Screen 
                  name="modal" 
                  options={{ 
                    presentation: 'modal'
                  }} 
                />
                <Stack.Screen 
                  name="transparent-modal" 
                  options={{ 
                    presentation: 'transparentModal',
                    animation: 'fade'
                  }} 
                />
                <Stack.Screen 
                  name="formsheet" 
                  options={{ 
                    presentation: 'formSheet'
                  }} 
                />
                <Stack.Screen 
                  name="privacy-policy" 
                  options={{ 
                    presentation: 'modal',
                    headerShown: true,
                    title: 'Privacy Policy'
                  }} 
                />
                <Stack.Screen 
                  name="terms-of-service" 
                  options={{ 
                    presentation: 'modal',
                    headerShown: true,
                    title: 'Terms of Service'
                  }} 
                />
              </Stack>
            </ThemeProvider>
          </WidgetProvider>
        </LocationProvider>
      </AuthProvider>
    </GestureHandlerRootView>
  );
}
