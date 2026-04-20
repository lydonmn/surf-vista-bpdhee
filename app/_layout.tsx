
import React, { useEffect, useRef } from 'react';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack, usePathname, useRouter } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { Alert, AppState, AppStateStatus, useColorScheme, View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import * as Notifications from 'expo-notifications';

// Show notifications as banners even when the app is in the foreground
if (Platform.OS !== 'web') {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
    }),
  });
}
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { LocationProvider } from '@/contexts/LocationContext';
import { NotificationProvider } from "@/contexts/NotificationContext";
import { SubscriptionProvider, useSubscription } from "@/contexts/SubscriptionContext";
import { isOnboardingComplete, incrementAppOpenCount, getAppOpenCount, hasSurveyBeenShown, markSurveyShown, shouldShowNamePrompt, markNamePromptShown } from "@/utils/onboardingStorage";
import { setupAndroidNotificationChannels, ensurePushTokenRegistered } from "@/utils/pushNotifications";
import { trackAppOpen, trackAppBackground } from "@/utils/usageTracking";

// Only prevent splash screen auto-hide on native — SplashScreen throws on web
if (Platform.OS !== 'web') {
  SplashScreen.preventAutoHideAsync().catch((err) => {
    console.log('[RootLayout] Splash screen already hidden or error:', err);
  });
}

// ErrorUtils is native-only — not available on web
const NativeErrorUtils = Platform.OS !== 'web'
  ? (global as unknown as { ErrorUtils?: { getGlobalHandler: () => ((e: Error, f: boolean) => void) | null; setGlobalHandler: (h: (e: Error, f: boolean) => void) => void } }).ErrorUtils
  : undefined;

if (NativeErrorUtils) {
  const originalHandler = NativeErrorUtils.getGlobalHandler();
  NativeErrorUtils.setGlobalHandler((error: Error, isFatal: boolean) => {
    console.error('[GlobalErrorHandler] Fatal:', isFatal, 'Error:', error);
    if (error?.message) console.error('[GlobalErrorHandler] Message:', error.message);
    if (error?.stack) console.error('[GlobalErrorHandler] Stack:', error.stack);
    if (originalHandler) originalHandler(error, isFatal);
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

function SubscriptionRedirect() {
  const { loading } = useSubscription();
  const { user, profile, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const hasRedirected = useRef(false);

  useEffect(() => {
    // Wait until both auth and subscription are resolved
    if (loading || authLoading) return;
    // Don't redirect if already on auth or onboarding screens
    if (pathname === "/login" || pathname.startsWith("/onboarding")) return;
    // Only run the redirect check once per session to avoid re-triggering mid-session
    if (hasRedirected.current) return;

    if (!user) {
      console.log('[SubscriptionRedirect] No user found, redirecting to login');
      hasRedirected.current = true;
      router.replace("/login");
      return;
    }

    let cancelled = false;
    isOnboardingComplete().then(async (done) => {
      if (cancelled) return;
      if (!done) {
        console.log('[SubscriptionRedirect] Onboarding not complete, redirecting to onboarding (first-time user)');
        hasRedirected.current = true;
        router.replace("/onboarding");
        return;
      }

      // --- Survey check (DB-backed + AsyncStorage) ---
      // Check DB first: if survey_completed is true in profiles, never show again
      const dbSurveyDone = (profile as any)?.survey_completed === true;
      const [count, asyncSurveyShown] = await Promise.all([
        getAppOpenCount(),
        hasSurveyBeenShown(),
      ]);
      const alreadyShown = dbSurveyDone || asyncSurveyShown;
      console.log('[SubscriptionRedirect] App open count:', count, '| Survey shown (DB):', dbSurveyDone, '| Survey shown (AsyncStorage):', asyncSurveyShown);

      if (count >= 5 && !alreadyShown) {
        console.log('[SubscriptionRedirect] Triggering survey on app open', count);
        // Mark in AsyncStorage immediately; DB update happens in onboarding on submit
        markSurveyShown().catch(() => {});
        hasRedirected.current = true;
        router.replace("/onboarding");
        return;
      }

      hasRedirected.current = true;
      console.log('[SubscriptionRedirect] Onboarding already complete, skipping redirect');

      // --- Name prompt check (only if survey was NOT just shown, not admin) ---
      const isAdmin = (profile as any)?.is_admin === true;
      const hasName = !!(profile as any)?.full_name;
      if (!isAdmin && !hasName) {
        const showPrompt = await shouldShowNamePrompt();
        console.log('[SubscriptionRedirect] Name prompt check — hasName:', hasName, '| shouldShow:', showPrompt);
        if (showPrompt) {
          markNamePromptShown().catch(() => {});
          Alert.alert(
            "Add Your Name",
            "Help us personalize your experience. What's your name?",
            [
              {
                text: "Not Now",
                style: "cancel",
                onPress: () => {
                  console.log('[SubscriptionRedirect] Name prompt dismissed — Not Now');
                },
              },
              {
                text: "Add Name",
                onPress: () => {
                  console.log('[SubscriptionRedirect] Name prompt accepted — navigating to edit-name');
                  router.push("/edit-name");
                },
              },
            ]
          );
        }
      }
    }).catch(() => {});
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, authLoading, user, profile]);

  return null;
}

function AppLifecycleTracker() {
  const { user } = useAuth();
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);

  // Track initial app open and set up AppState listener
  useEffect(() => {
    console.log('[RootLayout] Tracking initial app_open, user:', user?.id ?? 'anonymous');
    trackAppOpen(user?.id).catch(() => {});

    const subscription = AppState.addEventListener('change', (nextState: AppStateStatus) => {
      const prevState = appStateRef.current;
      appStateRef.current = nextState;

      if (nextState === 'background' || nextState === 'inactive') {
        console.log('[RootLayout] AppState -> background/inactive, tracking app_background');
        trackAppBackground(user?.id).catch(() => {});
      } else if (nextState === 'active' && (prevState === 'background' || prevState === 'inactive')) {
        console.log('[RootLayout] AppState -> active (from background), tracking new app_open');
        trackAppOpen(user?.id).catch(() => {});
      }
    });

    return () => subscription.remove();
  // Re-run only when user identity changes so the correct user_id is captured
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  // One-time push token refresh: if user has notifications enabled but token is stale/null
  useEffect(() => {
    if (!user?.id) return;
    console.log('[RootLayout] Running push token refresh check for user:', user.id);
    ensurePushTokenRegistered(user.id).catch(() => {});
  }, [user?.id]);

  return null;
}

export default function RootLayout() {
  console.log('[RootLayout] ===== COMPONENT MOUNTING =====');

  const colorScheme = useColorScheme();
  const router = useRouter();
  const notificationListener = useRef<Notifications.EventSubscription | null>(null);
  const responseListener = useRef<Notifications.EventSubscription | null>(null);

  const [loaded, fontError] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
  });

  // Set up notification listeners at the app root — native only
  useEffect(() => {
    if (Platform.OS === 'web') return;

    // Foreground notification listener
    notificationListener.current = Notifications.addNotificationReceivedListener(notification => {
      console.log('[RootLayout] Foreground notification received:', notification.request.identifier);
      console.log('[RootLayout] Notification title:', notification.request.content.title);
      console.log('[RootLayout] Notification body:', notification.request.content.body);
    });

    // Notification response listener (user tapped notification) — deep link to correct screen
    responseListener.current = Notifications.addNotificationResponseReceivedListener(response => {
      console.log('[RootLayout] Notification tapped:', response.notification.request.identifier);
      console.log('[RootLayout] Notification action:', response.actionIdentifier);
      const data = response.notification.request.content.data;
      console.log('[RootLayout] Notification data:', data);

      if (data?.type === 'daily_report') {
        console.log('[RootLayout] Deep linking to home tab for daily_report notification');
        router.push('/(tabs)/(home)');
      } else if (data?.type === 'new_video') {
        console.log('[RootLayout] Deep linking to videos tab for new_video notification');
        router.push('/(tabs)/videos');
      } else if (data?.type === 'swell_alert') {
        console.log('[RootLayout] Deep linking to home tab for swell_alert notification');
        router.push('/(tabs)/(home)');
      }
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

  // Register Android notification channels at startup (no-op on iOS/web)
  useEffect(() => {
    setupAndroidNotificationChannels().catch(() => {});
  }, []);

  // Increment app open count once on mount
  useEffect(() => {
    incrementAppOpenCount().catch(() => {});
  }, []);

  // Hide splash screen once fonts are ready
  useEffect(() => {
    if (loaded || fontError) {
      if (Platform.OS !== 'web') {
        SplashScreen.hideAsync().catch(() => {});
      }
    }
  }, [loaded, fontError]);

  // Don't render anything until fonts are loaded or onboarding state is known
  if ((!loaded && !fontError)) {
    return null;
  }

  return (
    <ErrorBoundaryClass>
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <AuthProvider>
        <SubscriptionProvider>
          <SubscriptionRedirect />
          <AppLifecycleTracker />
        <NotificationProvider>
          <LocationProvider>

            <Stack screenOptions={{ headerShown: false }}>
              <Stack.Screen name="onboarding" options={{ headerShown: false }} />

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
              <Stack.Screen name="privacy-policy" options={{ headerShown: false }} />
              <Stack.Screen name="terms-of-service" options={{ headerShown: false }} />
              <Stack.Screen name="reset-password" options={{ headerShown: false }} />
              <Stack.Screen name="notification-preferences" options={{ headerShown: false }} />
              <Stack.Screen name="edit-name" options={{ headerShown: false }} />
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
        </NotificationProvider>
        </SubscriptionProvider>
        </AuthProvider>
      </ThemeProvider>
    </ErrorBoundaryClass>
  );
}
