
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef } from 'react';
import { useColorScheme, Platform } from 'react-native';
import 'react-native-reanimated';
import { AuthProvider } from '@/contexts/AuthContext';
import { LocationProvider } from '@/contexts/LocationContext';
import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';

// 🚨 CRITICAL: Ultra-defensive splash screen handling
try {
  SplashScreen.preventAutoHideAsync().catch(() => {
    // Silently fail - splash screen is non-critical
  });
} catch {
  // Silently fail
}

// 🚨 CRITICAL: Minimal global error handler - only for truly fatal errors
if (typeof ErrorUtils !== 'undefined') {
  try {
    const originalHandler = ErrorUtils.getGlobalHandler();
    ErrorUtils.setGlobalHandler((error: any, isFatal?: boolean) => {
      // Log all errors but don't crash for non-fatal ones
      console.error('[Global] Error:', error?.message || error);
      
      // Only call original handler for fatal errors
      if (isFatal && originalHandler) {
        originalHandler(error, isFatal);
      }
    });
  } catch {
    // Silently fail - error handler setup is non-critical
  }
}

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const notificationListener = useRef<Notifications.Subscription | undefined>();
  const responseListener = useRef<Notifications.Subscription | undefined>();

  // 🚨 CRITICAL: Defensive font loading with fallback
  let loaded = false;
  let error = null;
  
  try {
    [loaded, error] = useFonts({
      SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
    });
  } catch (fontError) {
    console.warn('[RootLayout] ⚠️ Font loading failed (non-critical):', fontError);
    // Continue without custom fonts
    loaded = true;
    error = null;
  }

  // Hide splash screen when fonts are loaded or failed
  useEffect(() => {
    if (loaded || error) {
      try {
        SplashScreen.hideAsync().catch(() => {
          // Silently fail
        });
      } catch {
        // Silently fail
      }
    }
  }, [loaded, error]);

  // 🚨 CRITICAL: Defensive notification setup
  useEffect(() => {
    try {
      // Only set up notifications on native platforms
      if (Platform.OS !== 'web') {
        notificationListener.current = Notifications.addNotificationReceivedListener(notification => {
          console.log('[Notifications] Received:', notification);
        });

        responseListener.current = Notifications.addNotificationResponseReceivedListener(response => {
          console.log('[Notifications] Tapped:', response);
          
          try {
            const data = response.notification.request.content.data;
            if (data?.type === 'daily_report') {
              router.push('/(tabs)/report');
            }
          } catch {
            // Silently fail
          }
        });
      }
    } catch {
      // Silently fail - notifications are non-critical
    }

    return () => {
      try {
        notificationListener.current?.remove();
        responseListener.current?.remove();
      } catch {
        // Silently fail
      }
    };
  }, []);

  // 🚨 CRITICAL: Show loading state while fonts are loading
  if (!loaded && !error) {
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
            <Stack.Screen name="video-player-enhanced" options={{ headerShown: false }} />
            <Stack.Screen name="edit-report" options={{ headerShown: false }} />
            <Stack.Screen name="admin" options={{ headerShown: false }} />
            <Stack.Screen name="admin-data" options={{ headerShown: false }} />
            <Stack.Screen name="admin-users" options={{ headerShown: false }} />
            <Stack.Screen name="manage-all-users" options={{ headerShown: false }} />
            <Stack.Screen name="admin-locations" options={{ headerShown: false }} />
            <Stack.Screen name="admin-debug" options={{ headerShown: false }} />
            <Stack.Screen name="admin-predictions" options={{ headerShown: false }} />
            <Stack.Screen name="admin-cron-logs" options={{ headerShown: false }} />
            <Stack.Screen name="admin-cron-setup" options={{ headerShown: false }} />
            <Stack.Screen name="admin-regional" options={{ headerShown: false }} />
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
