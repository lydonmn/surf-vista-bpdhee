
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState } from 'react';
import { useColorScheme, AppState, AppStateStatus, Platform } from 'react-native';
import 'react-native-reanimated';
import { AuthProvider } from '@/contexts/AuthContext';
import { LocationProvider } from '@/contexts/LocationContext';

// 🚨 CRITICAL FIX G20: DO NOT import expo-notifications at top level
// This causes native module initialization on app launch, leading to SIGABRT crashes
// We'll dynamically import it only when needed, after a significant delay

// Prevent auto-hide of splash screen
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const appState = useRef(AppState.currentState);
  const hasInitialized = useRef(false);
  const [isReady, setIsReady] = useState(false);

  const [loaded] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
  });

  useEffect(() => {
    if (loaded) {
      SplashScreen.hideAsync();
      // Mark as ready after splash screen hides
      setTimeout(() => {
        setIsReady(true);
      }, 500);
    }
  }, [loaded]);

  // 🚨 CRITICAL FIX G20: Defer ALL initialization until app is FULLY rendered and stable
  // Previous attempts with 1-3 second delays were insufficient
  // We now wait 5 seconds to ensure the JavaScript runtime is completely stable
  useEffect(() => {
    // Only run after fonts are loaded and app is ready
    if (!isReady || hasInitialized.current) {
      return;
    }

    console.log('[RootLayout] 🚀 App is ready - scheduling deferred initialization...');
    hasInitialized.current = true;
    
    // 🚨 CRITICAL: 5 second delay to ensure app is FULLY stable
    // This prevents background thread crashes during native module initialization
    const initTimer = setTimeout(() => {
      console.log('[RootLayout] ⏰ Starting deferred initialization (5s delay)...');
      
      // Wrap in async IIFE to handle promises
      (async () => {
        try {
          // 🚨 STEP 1: Initialize notification listeners (least risky)
          try {
            console.log('[RootLayout] 📱 Setting up notification listeners...');
            const Notifications = await import('expo-notifications');
            const { router } = await import('expo-router');
            
            // Configure notification handler
            Notifications.default.setNotificationHandler({
              handleNotification: async () => ({
                shouldShowAlert: true,
                shouldPlaySound: true,
                shouldSetBadge: true,
              }),
            });
            
            // Listen for notifications when app is in foreground
            Notifications.default.addNotificationReceivedListener(notification => {
              console.log('[Notifications] Notification received:', notification);
            });

            // Listen for notification taps
            Notifications.default.addNotificationResponseReceivedListener(response => {
              console.log('[Notifications] Notification tapped:', response);
              
              const data = response.notification.request.content.data;
              
              // Navigate to report screen when daily report notification is tapped
              if (data?.type === 'daily_report') {
                console.log('[Notifications] Navigating to report screen');
                router.push('/(tabs)/report');
              }
            });
            
            console.log('[RootLayout] ✅ Notification listeners configured');
          } catch (notificationError) {
            console.error('[RootLayout] ⚠️ Notification setup failed (non-critical):', notificationError);
          }
          
          // 🚨 STEP 2: Wait another 2 seconds before touching audio/video modules
          await new Promise(resolve => setTimeout(resolve, 2000));
          
          // 🚨 STEP 3: Initialize audio session (iOS only, high risk)
          if (Platform.OS === 'ios') {
            try {
              console.log('[RootLayout] 🎵 Configuring audio session...');
              const { configureAudioSession } = await import('@/utils/audioSession');
              await configureAudioSession();
              console.log('[RootLayout] ✅ Audio session configured');
            } catch (audioError) {
              console.error('[RootLayout] ⚠️ Audio session config failed (non-critical):', audioError);
            }
          }
          
          // 🚨 STEP 4: Wait another 1 second before video system
          await new Promise(resolve => setTimeout(resolve, 1000));
          
          // 🚨 STEP 5: Initialize video system (lowest priority)
          try {
            console.log('[RootLayout] 🎬 Initializing video system...');
            const { initializeVideoDownloads, configureBackgroundDownloads } = await import('@/utils/videoDownloadInit');
            configureBackgroundDownloads();
            await initializeVideoDownloads();
            console.log('[RootLayout] ✅ Video system initialized');
          } catch (videoError) {
            console.error('[RootLayout] ⚠️ Video system init failed (non-critical):', videoError);
          }
          
          console.log('[RootLayout] ✅ Deferred initialization complete');
        } catch (error) {
          console.error('[RootLayout] ❌ Deferred initialization error:', error);
          // Don't throw - allow app to continue
        }
      })();
    }, 5000); // 🚨 CRITICAL: 5 second delay (increased from 1 second)

    return () => {
      clearTimeout(initTimer);
    };
  }, [isReady]);

  // Monitor app state changes
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
      if (
        appState.current.match(/inactive|background/) &&
        nextAppState === 'active'
      ) {
        console.log('[RootLayout] App has come to the foreground');
      }

      appState.current = nextAppState;
      console.log('[RootLayout] AppState:', appState.current);
    });

    return () => {
      subscription.remove();
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
