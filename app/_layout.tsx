
import React, { useEffect, useRef } from 'react';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack, usePathname, useRouter } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { Alert, AppState, AppStateStatus, useColorScheme, View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { LocationProvider } from '@/contexts/LocationContext';
import { NotificationProvider } from "@/contexts/NotificationContext";
import { SubscriptionProvider, useSubscription } from "@/contexts/SubscriptionContext";
import { isOnboardingComplete, incrementAppOpenCount, getAppOpenCount, hasSurveyBeenShown, markSurveyShown, shouldShowNamePrompt, markNamePromptShown } from "@/utils/onboardingStorage";
import { setupAndroidNotificationChannels, setupNotificationCategories, ensurePushTokenRegistered } from "@/utils/pushNotifications";
import { trackAppOpen, trackAppBackground, linkSessionToUser } from "@/utils/usageTracking";

// Register notification handler at module level so it fires before any notification arrives
if (Platform.OS !== 'web') {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
    }),
  });
}

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
  const { user, isLoading: authLoading } = useAuth();
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);
  // Keep a ref to the latest user id so AppState listeners always read the current value
  // even if they were registered before the user logged in.
  const userIdRef = useRef<string | undefined>(user?.id);
  // Track whether the initial app_open has been fired (wait for auth to resolve first)
  const initialOpenTrackedRef = useRef(false);
  // Track the previous user id to detect login transitions (null → user)
  const prevUserIdRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    userIdRef.current = user?.id;
  }, [user?.id]);

  // Track initial app open AFTER auth has resolved (not on raw mount).
  // This ensures user_id is available if the user was already logged in.
  useEffect(() => {
    if (authLoading) return; // wait until auth state is known
    if (initialOpenTrackedRef.current) return; // only fire once
    initialOpenTrackedRef.current = true;

    console.log('[RootLayout] Auth resolved — tracking initial app_open, user:', user?.id ?? 'anonymous');
    trackAppOpen(user?.id).catch(() => {});

    // Record the user id at the time of the initial open
    prevUserIdRef.current = user?.id;

    const subscription = AppState.addEventListener('change', (nextState: AppStateStatus) => {
      const prevState = appStateRef.current;
      appStateRef.current = nextState;

      if (nextState === 'background' || nextState === 'inactive') {
        console.log('[RootLayout] AppState -> background/inactive, tracking app_background, user:', userIdRef.current ?? 'anonymous');
        trackAppBackground(userIdRef.current).catch(() => {});
      } else if (nextState === 'active' && (prevState === 'background' || prevState === 'inactive')) {
        console.log('[RootLayout] AppState -> active (from background), tracking new app_open, user:', userIdRef.current ?? 'anonymous');
        trackAppOpen(userIdRef.current).catch(() => {});
      }
    });

    return () => subscription.remove();
  // Re-run only when authLoading changes (goes from true → false)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading]);

  // When a user logs in after an anonymous session, link the existing session to their user_id
  useEffect(() => {
    if (authLoading) return;
    const prevId = prevUserIdRef.current;
    const currentId = user?.id;
    if (!prevId && currentId) {
      // Transition from anonymous → logged-in
      console.log('[RootLayout] User logged in after anonymous session — linking session to user:', currentId);
      linkSessionToUser(currentId).catch(() => {});
    }
    prevUserIdRef.current = currentId;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, authLoading]);

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

  const [loaded, fontError] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
  });

  // Shared handler — defined outside effects so both can reference it
  const handleNotificationResponse = React.useCallback((response: Notifications.NotificationResponse) => {
    console.log('[RootLayout] Notification response received:', response.notification.request.identifier);
    console.log('[RootLayout] Action identifier:', response.actionIdentifier);
    const data = response.notification.request.content.data as any;
    console.log('[RootLayout] Notification data:', data);
    if (!data) return;
    if (data.type === 'daily_report' || data.type === 'swell_alert') {
      console.log('[RootLayout] Deep linking to home tab for', data.type);
      router.replace('/(tabs)/(home)');
    } else if (data.type === 'new_video') {
      console.log('[RootLayout] Deep linking to videos tab for new_video');
      router.replace('/(tabs)/videos');
    }
  }, [router]);

  // Cold-start handler: notification tapped while app was fully closed
  // Delay ensures the router is mounted before we attempt navigation
  useEffect(() => {
    if (Platform.OS === 'web') return;
    const timer = setTimeout(async () => {
      try {
        const response = await Notifications.getLastNotificationResponseAsync();
        if (response) {
          console.log('[RootLayout] Cold-start notification response found, handling...');
          handleNotificationResponse(response);
        }
      } catch (err) {
        console.warn('[RootLayout] Cold-start notification check failed:', err);
      }
    }, 500);
    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Live listener: notification tapped while app is backgrounded or foregrounded
  useEffect(() => {
    if (Platform.OS === 'web') return;

    // Foreground notification received (display only — no navigation)
    notificationListener.current = Notifications.addNotificationReceivedListener(notification => {
      console.log('[RootLayout] Foreground notification received:', notification.request.identifier);
      console.log('[RootLayout] Notification title:', notification.request.content.title);
      console.log('[RootLayout] Notification body:', notification.request.content.body);
    });

    // Response listener (user tapped notification)
    const responseSub = Notifications.addNotificationResponseReceivedListener(handleNotificationResponse);

    return () => {
      if (notificationListener.current) {
        notificationListener.current.remove();
      }
      responseSub.remove();
    };
  }, [handleNotificationResponse]);

  // Register Android channels + iOS categories at startup
  useEffect(() => {
    setupAndroidNotificationChannels().catch(() => {});
    setupNotificationCategories().catch(() => {});
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
              <Stack.Screen name="admin-survey" options={{ headerShown: false }} />
              <Stack.Screen name="admin-usage" options={{ headerShown: false }} />
              <Stack.Screen name="paywall" options={{ headerShown: false }} />
              <Stack.Screen name="demo-paywall" options={{ headerShown: false }} />
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
