
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef } from 'react';
import { useColorScheme, AppState, AppStateStatus } from 'react-native';
import 'react-native-reanimated';
import { AuthProvider } from '@/contexts/AuthContext';
import { LocationProvider } from '@/contexts/LocationContext';
import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';

// 🚨 CRITICAL FIX G19: Prevent SIGABRT crash on TestFlight launch
// The crash is happening on a background thread during native module initialization
// Solution: Defer ALL non-critical initialization until AFTER the app is fully mounted

// Prevent auto-hide of splash screen
SplashScreen.preventAutoHideAsync();

// Configure notification handler
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const notificationListener = useRef<Notifications.Subscription | undefined>();
  const responseListener = useRef<Notifications.Subscription | undefined>();
  const appState = useRef(AppState.currentState);
  const hasInitialized = useRef(false);

  const [loaded] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
  });

  useEffect(() => {
    if (loaded) {
      SplashScreen.hideAsync();
    }
  }, [loaded]);

  // 🚨 CRITICAL FIX G19: Defer ALL initialization until app is fully mounted and active
  // This prevents background thread crashes during native module initialization
  useEffect(() => {
    // Only initialize once
    if (hasInitialized.current) {
      console.log('[RootLayout] Already initialized, skipping...');
      return;
    }

    console.log('[RootLayout] 🚀 App mounted - scheduling deferred initialization...');
    
    // 🚨 CRITICAL: Use setTimeout to defer initialization to AFTER the current render cycle
    // This ensures the app UI is fully mounted before any native modules initialize
    const initTimer = setTimeout(() => {
      console.log('[RootLayout] ⏰ Starting deferred initialization...');
      hasInitialized.current = true;
      
      // Wrap in async IIFE to handle promises
      (async () => {
        try {
          // 🚨 CRITICAL: Import and initialize modules ONLY after app is mounted
          // This prevents background thread crashes during app launch
          
          console.log('[RootLayout] 📦 Dynamically importing initialization modules...');
          
          // Dynamic imports to defer loading until needed
          const { configureAudioSession } = await import('@/utils/audioSession');
          const { initializeVideoDownloads, configureBackgroundDownloads } = await import('@/utils/videoDownloadInit');
          
          // Audio session configuration (iOS only, non-critical)
          try {
            console.log('[RootLayout] 🎵 Configuring audio session...');
            await configureAudioSession();
            console.log('[RootLayout] ✅ Audio session configured');
          } catch (audioError) {
            console.error('[RootLayout] ⚠️ Audio session config failed (non-critical):', audioError);
          }
          
          // Video system initialization (non-critical)
          try {
            console.log('[RootLayout] 🎬 Initializing video system...');
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
    }, 1000); // 🚨 CRITICAL: 1 second delay to ensure app is fully mounted

    return () => {
      clearTimeout(initTimer);
    };
  }, []);

  // Setup notification listeners (safe - no native initialization)
  useEffect(() => {
    try {
      // Listen for notifications when app is in foreground
      notificationListener.current = Notifications.addNotificationReceivedListener(notification => {
        console.log('[Notifications] Notification received:', notification);
      });

      // Listen for notification taps
      responseListener.current = Notifications.addNotificationResponseReceivedListener(response => {
        console.log('[Notifications] Notification tapped:', response);
        
        const data = response.notification.request.content.data;
        
        // Navigate to report screen when daily report notification is tapped
        if (data?.type === 'daily_report') {
          console.log('[Notifications] Navigating to report screen');
          router.push('/(tabs)/report');
        }
      });
    } catch (error) {
      console.error('[RootLayout] ⚠️ Notification listener setup failed:', error);
    }

    return () => {
      try {
        notificationListener.current?.remove();
        responseListener.current?.remove();
      } catch (error) {
        console.error('[RootLayout] ⚠️ Notification cleanup error:', error);
      }
    };
  }, []);

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
