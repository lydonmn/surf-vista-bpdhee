
import React, { useEffect, useRef } from 'react';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useColorScheme, Platform, View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import 'react-native-reanimated';
import { AuthProvider } from '@/contexts/AuthContext';
import { LocationProvider } from '@/contexts/LocationContext';
import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';

// Prevent auto-hiding of splash screen
SplashScreen.preventAutoHideAsync().catch(() => {
  // Silently fail if splash screen is already hidden
});

// 🚨 CRITICAL: Global error boundary component with React Error Boundary
class ErrorBoundaryClass extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    console.error('[ErrorBoundary] getDerivedStateFromError:', error);
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('[ErrorBoundary] componentDidCatch:', error);
    console.error('[ErrorBoundary] Error info:', errorInfo);
    console.error('[ErrorBoundary] Component stack:', errorInfo.componentStack);
  }

  render() {
    if (this.state.hasError) {
      console.log('[ErrorBoundary] Rendering error screen');
      return (
        <View style={errorStyles.container}>
          <Text style={errorStyles.title}>Something went wrong</Text>
          <Text style={errorStyles.message}>
            {this.state.error?.message || 'An unexpected error occurred'}
          </Text>
          <Text style={errorStyles.stack}>
            {this.state.error?.stack?.substring(0, 200)}
          </Text>
          <TouchableOpacity
            style={errorStyles.button}
            onPress={() => {
              console.log('[ErrorBoundary] User pressed Try Again');
              this.setState({ hasError: false, error: null });
            }}
          >
            <Text style={errorStyles.buttonText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return this.props.children;
  }
}

// Wrapper component for hooks
function ErrorBoundary({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    // Set up global error handler for non-React errors
    if (typeof ErrorUtils !== 'undefined') {
      const originalHandler = ErrorUtils.getGlobalHandler();
      ErrorUtils.setGlobalHandler((errorObj, isFatal) => {
        console.error('[GlobalErrorHandler] Caught error:', errorObj);
        console.error('[GlobalErrorHandler] Error stack:', errorObj.stack);
        console.error('[GlobalErrorHandler] Is fatal:', isFatal);
        originalHandler?.(errorObj, isFatal);
      });
    }
  }, []);

  return <ErrorBoundaryClass>{children}</ErrorBoundaryClass>;
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
    marginBottom: 12,
  },
  stack: {
    fontSize: 12,
    color: '#999999',
    textAlign: 'center',
    marginBottom: 24,
    fontFamily: 'monospace',
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
  console.log('[RootLayout] Color scheme:', colorScheme);
  
  const notificationListener = useRef<Notifications.Subscription | undefined>();
  const responseListener = useRef<Notifications.Subscription | undefined>();

  console.log('[RootLayout] Loading fonts...');
  const [loaded] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
  });
  console.log('[RootLayout] Fonts loaded:', loaded);

  // 🚨 CRITICAL FIX: Hide splash screen immediately on mount
  useEffect(() => {
    console.log('[RootLayout] Mounting - hiding splash screen immediately');
    SplashScreen.hideAsync().catch((err) => {
      console.log('[RootLayout] Splash screen already hidden or error:', err);
    });
  }, []);

  // 🚨 CRITICAL FIX: Also hide when fonts load
  useEffect(() => {
    if (loaded) {
      console.log('[RootLayout] Fonts loaded - hiding splash screen');
      SplashScreen.hideAsync().catch((err) => {
        console.log('[RootLayout] Splash screen already hidden or error:', err);
      });
    }
  }, [loaded]);

  useEffect(() => {
    if (Platform.OS !== 'web') {
      try {
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
      } catch (notificationError) {
        console.warn('[Notifications] Setup failed (non-critical):', notificationError);
      }
    }

    return () => {
      try {
        notificationListener.current?.remove();
        responseListener.current?.remove();
      } catch (cleanupError) {
        console.log('[Notifications] Cleanup error:', cleanupError);
      }
    };
  }, []);

  // 🚨 CRITICAL FIX: Don't block rendering - show content immediately
  console.log('[RootLayout] Rendering layout (loaded:', loaded, ')');

  // 🚨 CRITICAL FIX: Always render the app, even if fonts aren't loaded yet
  // This prevents white screen issues - fonts will load in the background

  return (
    <ErrorBoundary>
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
    </ErrorBoundary>
  );
}
