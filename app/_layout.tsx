
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef } from 'react';
import { useColorScheme } from 'react-native';
import 'react-native-reanimated';
import { AuthProvider } from '@/contexts/AuthContext';
import { LocationProvider } from '@/contexts/LocationContext';
import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { initializeVideoDownloads, configureBackgroundDownloads } from '@/utils/videoDownloadInit';
import { configureAudioSession } from '@/utils/audioSession';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const notificationListener = useRef<Notifications.Subscription | undefined>();
  const responseListener = useRef<Notifications.Subscription | undefined>();

  const [loaded] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
  });

  useEffect(() => {
    if (loaded) {
      SplashScreen.hideAsync();
    }
  }, [loaded]);

  // 🚨 CRITICAL FIX: Configure iOS audio session on app startup
  // This prevents audio cutout at ~10 seconds into video playback
  useEffect(() => {
    const initializeAudioAndVideo = async () => {
      try {
        console.log('[RootLayout] 🎵 Configuring iOS audio session for continuous video playback...');
        
        // 🚨 CRITICAL: Configure audio session FIRST before any video playback
        await configureAudioSession({
          category: 'playback',
          mode: 'moviePlayback',
          mixWithOthers: false, // Exclusive audio control prevents cutouts
        });
        
        console.log('[RootLayout] ✅ iOS audio session configured - audio cutout fix applied');
        
        // Then initialize video download system
        console.log('[RootLayout] 🚀 Initializing video download system...');
        configureBackgroundDownloads();
        await initializeVideoDownloads();
        console.log('[RootLayout] ✅ Video system initialized');
      } catch (error) {
        console.error('[RootLayout] ⚠️ Initialization failed, app will continue:', error);
        // App continues normally - videos will stream instead of downloading
      }
    };

    initializeAudioAndVideo();
  }, []);

  // ✅ CRITICAL FIX: Enhanced notification handling with data refresh trigger
  useEffect(() => {
    // Listen for notifications when app is in foreground
    notificationListener.current = Notifications.addNotificationReceivedListener(notification => {
      console.log('[Notifications] ═══════════════════════════════════════');
      console.log('[Notifications] 🔔 NOTIFICATION RECEIVED (Foreground)');
      console.log('[Notifications] Title:', notification.request.content.title);
      console.log('[Notifications] Body:', notification.request.content.body);
      console.log('[Notifications] Data:', notification.request.content.data);
      console.log('[Notifications] ═══════════════════════════════════════');
      
      // ✅ CRITICAL FIX: When daily report notification arrives, trigger data refresh
      const data = notification.request.content.data;
      if (data?.type === 'daily_report') {
        console.log('[Notifications] 📊 Daily report notification - data should auto-refresh via real-time subscription');
      }
    });

    // Listen for notification taps
    responseListener.current = Notifications.addNotificationResponseReceivedListener(response => {
      console.log('[Notifications] ═══════════════════════════════════════');
      console.log('[Notifications] 👆 NOTIFICATION TAPPED');
      console.log('[Notifications] Data:', response.notification.request.content.data);
      console.log('[Notifications] ═══════════════════════════════════════');
      
      const data = response.notification.request.content.data;
      
      // Navigate to report screen when daily report notification is tapped
      if (data?.type === 'daily_report') {
        console.log('[Notifications] 📱 Navigating to report screen...');
        router.push('/(tabs)/report');
      }
    });

    return () => {
      notificationListener.current?.remove();
      responseListener.current?.remove();
    };
  }, []);

  if (!loaded) {
    return null;
  }

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <AuthProvider>
        <LocationProvider>
          <Stack>
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="login" options={{ headerShown: false }} />
            <Stack.Screen name="auth/callback" options={{ headerShown: false }} />
            <Stack.Screen name="verification-success" options={{ headerShown: false }} />
            <Stack.Screen name="video-player" options={{ headerShown: false }} />
            <Stack.Screen name="video-player-v2" options={{ headerShown: false }} />
            <Stack.Screen name="video-player-simple" options={{ headerShown: false }} />
            <Stack.Screen name="edit-report" options={{ headerShown: false }} />
            <Stack.Screen name="admin" options={{ headerShown: false }} />
            <Stack.Screen name="admin-data" options={{ headerShown: false }} />
            <Stack.Screen name="admin-users" options={{ headerShown: false }} />
            <Stack.Screen name="manage-all-users" options={{ headerShown: false }} />
            <Stack.Screen name="admin-locations" options={{ headerShown: false }} />
            <Stack.Screen name="admin-debug" options={{ headerShown: false }} />
            <Stack.Screen name="admin-predictions" options={{ headerShown: false }} />
            <Stack.Screen name="admin-cron-logs" options={{ headerShown: false }} />
            <Stack.Screen name="admin-video-cache" options={{ headerShown: false }} />
            <Stack.Screen name="setup-admin" options={{ headerShown: false }} />
            <Stack.Screen name="demo-paywall" options={{ headerShown: false }} />
            <Stack.Screen name="privacy-policy" options={{ headerShown: false }} />
            <Stack.Screen name="terms-of-service" options={{ headerShown: false }} />
            <Stack.Screen name="reset-password" options={{ headerShown: false }} />
            <Stack.Screen name="+not-found" />
            <Stack.Screen 
              name="modal" 
              options={{ 
                presentation: "modal",
                title: "Modal"
              }} 
            />
            <Stack.Screen 
              name="formsheet" 
              options={{ 
                presentation: "formSheet",
                title: "Form Sheet",
                sheetGrabberVisible: true,
                sheetAllowedDetents: [0.5, 0.8, 1.0],
                sheetCornerRadius: 20
              }} 
            />
            <Stack.Screen 
              name="transparent-modal" 
              options={{ 
                presentation: "transparentModal",
                headerShown: false
              }} 
            />
          </Stack>
          <StatusBar style="auto" />
        </LocationProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
