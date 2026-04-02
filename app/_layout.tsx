
import React, { useEffect, useState, useRef } from 'react';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useColorScheme, View, Text, TouchableOpacity, StyleSheet, ErrorUtils } from 'react-native';
import 'react-native-reanimated';
import * as Notifications from 'expo-notifications';
import { AuthProvider } from '@/contexts/AuthContext';
import { LocationProvider } from '@/contexts/LocationContext';

// 🚨 CRITICAL: Prevent auto-hiding of splash screen
SplashScreen.preventAutoHideAsync().catch((err) => {
  console.log('[RootLayout] Splash screen already hidden or error:', err);
});

// 🚨 CRITICAL: Global error handler for native crashes
if (ErrorUtils) {
  const originalHandler = ErrorUtils.getGlobalHandler();
  
  ErrorUtils.setGlobalHandler((error, isFatal) => {
    console.error('[GlobalErrorHandler] Fatal:', isFatal, 'Error:', error);
    
    // Log to help debug
    if (error && error.message) {
      console.error('[GlobalErrorHandler] Message:', error.message);
    }
    if (error && error.stack) {
      console.error('[GlobalErrorHandler] Stack:', error.stack);
    }
    
    // Call original handler
    if (originalHandler) {
      originalHandler(error, isFatal);
    }
  });
}

// 🚨 CRITICAL: Global error boundary component
class ErrorBoundaryClass extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    console.error('[ErrorBoundary] Caught error:', error);
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('[ErrorBoundary] Error:', error);
    console.error('[ErrorBoundary] Stack:', errorInfo.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <View style={errorStyles.container}>
          <Text style={errorStyles.title}>Something went wrong</Text>
          <Text style={errorStyles.message}>
            {this.state.error?.message || 'An unexpected error occurred'}
          </Text>
          <TouchableOpacity
            style={errorStyles.button}
            onPress={() => this.setState({ hasError: false, error: null })}
          >
            <Text style={errorStyles.buttonText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return this.props.children;
  }
}

const errorStyles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#000000',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 12,
  },
  message: {
    fontSize: 16,
    color: '#CCCCCC',
    textAlign: 'center',
    marginBottom: 24,
  },
  button: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default function RootLayout() {
  console.log('[RootLayout] ===== COMPONENT MOUNTING =====');
  
  const colorScheme = useColorScheme();
  const [appReady, setAppReady] = useState(false);
  const notificationListener = useRef<Notifications.EventSubscription | null>(null);
  const responseListener = useRef<Notifications.EventSubscription | null>(null);

  const [loaded, fontError] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
  });

  // Set up notification listeners at the app root
  useEffect(() => {
    // Foreground notification listener
    notificationListener.current = Notifications.addNotificationReceivedListener(notification => {
      console.log('[RootLayout] Foreground notification received:', notification.request.identifier);
      console.log('[RootLayout] Notification title:', notification.request.content.title);
      console.log('[RootLayout] Notification body:', notification.request.content.body);
    });

    // Notification response listener (user tapped notification)
    responseListener.current = Notifications.addNotificationResponseReceivedListener(response => {
      console.log('[RootLayout] Notification tapped:', response.notification.request.identifier);
      console.log('[RootLayout] Notification action:', response.actionIdentifier);
      const data = response.notification.request.content.data;
      console.log('[RootLayout] Notification data:', data);
    });

    return () => {
      if (notificationListener.current) {
        notificationListener.current.remove();
      }
      if (responseListener.current) {
        responseListener.current.remove();
      }
    };
  }, []);

  // 🚨 CRITICAL FIX: Wait for fonts to load before rendering app
  useEffect(() => {
    console.log('[RootLayout] Font loading status - loaded:', loaded, 'error:', fontError);
    
    if (loaded || fontError) {
      console.log('[RootLayout] Fonts ready, preparing app...');
      
      // Small delay to ensure everything is ready
      setTimeout(() => {
        console.log('[RootLayout] Hiding splash screen...');
        SplashScreen.hideAsync()
          .then(() => {
            console.log('[RootLayout] Splash hidden successfully');
            setAppReady(true);
          })
          .catch((err) => {
            console.log('[RootLayout] Splash hide error:', err);
            setAppReady(true); // Continue anyway
          });
      }, 100);
    }
  }, [loaded, fontError]);

  // 🚨 CRITICAL FIX: Don't render anything until fonts are loaded
  if (!loaded && !fontError) {
    console.log('[RootLayout] Waiting for fonts to load...');
    return null;
  }

  console.log('[RootLayout] Rendering app - appReady:', appReady);

  return (
    <ErrorBoundaryClass>
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <AuthProvider>
          <LocationProvider>
            <Stack screenOptions={{ headerShown: false }}>
              <Stack.Screen name="index" options={{ headerShown: false }} />
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
    </ErrorBoundaryClass>
  );
}
