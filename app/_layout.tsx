
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

// Prevent auto-hiding of splash screen
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const notificationListener = useRef<Notifications.Subscription | undefined>();
  const responseListener = useRef<Notifications.Subscription | undefined>();

  const [loaded, error] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
  });

  useEffect(() => {
    if (loaded || error) {
      SplashScreen.hideAsync();
    }
  }, [loaded, error]);

  useEffect(() => {
    if (Platform.OS !== 'web') {
      notificationListener.current = Notifications.addNotificationReceivedListener(notification => {
        console.log('[Notifications] Received:', notification);
      });

      responseListener.current = Notifications.addNotificationResponseReceivedListener(response => {
        console.log('[Notifications] Tapped:', response);
        const data = response.notification.request.content.data;
        if (data?.type === 'daily_report') {
          router.push('/(tabs)/report');
        }
      });
    }

    return () => {
      notificationListener.current?.remove();
      responseListener.current?.remove();
    };
  }, []);

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
