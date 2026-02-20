
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform, Alert, Linking } from 'react-native';
import { supabase } from '@/app/integrations/supabase/client';
import Constants from 'expo-constants';

// Configure notification handler
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

/**
 * Check current notification permission status
 */
export async function checkNotificationPermissions(): Promise<{
  granted: boolean;
  canAskAgain: boolean;
  status: string;
}> {
  try {
    console.log('[Push Notifications] Checking notification permissions...');
    
    // For web, always return granted
    if (Platform.OS === 'web') {
      console.log('[Push Notifications] Web platform - permissions not applicable');
      return { granted: true, canAskAgain: false, status: 'granted' };
    }

    // For simulators, return a special status
    if (!Device.isDevice) {
      console.log('[Push Notifications] Simulator detected - permissions not applicable');
      return { granted: false, canAskAgain: false, status: 'simulator' };
    }

    const { status, canAskAgain } = await Notifications.getPermissionsAsync();
    console.log('[Push Notifications] Permission status:', status);
    console.log('[Push Notifications] Can ask again:', canAskAgain);

    return {
      granted: status === 'granted',
      canAskAgain: canAskAgain ?? true,
      status: status,
    };
  } catch (error) {
    console.error('[Push Notifications] Error checking permissions:', error);
    return { granted: false, canAskAgain: true, status: 'undetermined' };
  }
}

/**
 * Request notification permissions with user-friendly prompts
 */
export async function requestNotificationPermissions(): Promise<boolean> {
  try {
    console.log('[Push Notifications] ===== REQUESTING NOTIFICATION PERMISSIONS =====');
    console.log('[Push Notifications] Platform:', Platform.OS);
    console.log('[Push Notifications] Is Device:', Device.isDevice);

    // For web, return true
    if (Platform.OS === 'web') {
      console.log('[Push Notifications] Web platform - permissions granted by default');
      return true;
    }

    // For simulators, show info and return false
    if (!Device.isDevice) {
      console.warn('[Push Notifications] Simulator detected - notifications not available');
      Alert.alert(
        'Physical Device Required',
        'Push notifications only work on physical devices, not simulators. Please test on a real device to enable notifications.',
        [{ text: 'OK' }]
      );
      return false;
    }

    // Check current status
    const { status: existingStatus, canAskAgain } = await Notifications.getPermissionsAsync();
    console.log('[Push Notifications] Current status:', existingStatus);
    console.log('[Push Notifications] Can ask again:', canAskAgain);

    // If already granted, return true
    if (existingStatus === 'granted') {
      console.log('[Push Notifications] ✅ Permissions already granted');
      return true;
    }

    // If we can't ask again (user denied previously), show settings prompt
    if (!canAskAgain || existingStatus === 'denied') {
      console.log('[Push Notifications] ⚠️ Cannot ask again - user must enable in settings');
      
      return new Promise((resolve) => {
        Alert.alert(
          'Notification Permission Required',
          'To receive daily surf reports at 6 AM EST, you need to enable notifications in your device settings.\n\nWould you like to open settings now?',
          [
            {
              text: 'Cancel',
              style: 'cancel',
              onPress: () => {
                console.log('[Push Notifications] User cancelled settings navigation');
                resolve(false);
              }
            },
            {
              text: 'Open Settings',
              onPress: async () => {
                console.log('[Push Notifications] Opening device settings...');
                try {
                  await Linking.openSettings();
                  resolve(false);
                } catch (settingsError) {
                  console.error('[Push Notifications] Error opening settings:', settingsError);
                  resolve(false);
                }
              }
            }
          ]
        );
      });
    }

    // Request permissions
    console.log('[Push Notifications] Requesting permissions from user...');
    const { status: newStatus } = await Notifications.requestPermissionsAsync();
    console.log('[Push Notifications] Permission request result:', newStatus);

    if (newStatus !== 'granted') {
      console.warn('[Push Notifications] ❌ Permission denied by user');
      Alert.alert(
        'Permission Denied',
        'You have denied notification permissions. To receive daily surf reports at 6 AM EST, please enable notifications in your device settings.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Open Settings',
            onPress: () => Linking.openSettings()
          }
        ]
      );
      return false;
    }

    console.log('[Push Notifications] ✅ Permissions granted successfully');
    return true;
  } catch (error) {
    console.error('[Push Notifications] ===== PERMISSION REQUEST ERROR =====');
    console.error('[Push Notifications] Error:', error);
    if (error instanceof Error) {
      console.error('[Push Notifications] Error message:', error.message);
      console.error('[Push Notifications] Error stack:', error.stack);
    }
    
    Alert.alert(
      'Permission Error',
      'Failed to request notification permissions. Please try again or enable notifications manually in your device settings.',
      [{ text: 'OK' }]
    );
    return false;
  }
}

/**
 * ✅ V9.2 CRITICAL FIX: Register for push notifications - PRODUCTION READY
 * Only shows "unavailable" message in Expo Go, works in production App Store builds
 */
export async function registerForPushNotificationsAsync(): Promise<string | null> {
  try {
    console.log('[Push Notifications] ===== TOKEN REGISTRATION START =====');
    console.log('[Push Notifications] Platform:', Platform.OS);
    console.log('[Push Notifications] Is Device:', Device.isDevice);
    console.log('[Push Notifications] App Ownership:', Constants.appOwnership);

    // For web, return a dummy token
    if (Platform.OS === 'web') {
      console.log('[Push Notifications] Web platform - using dummy token');
      return 'web-dummy-token';
    }

    // Check if running on a physical device
    if (!Device.isDevice) {
      console.warn('[Push Notifications] Simulator detected - using dummy token');
      return 'simulator-dummy-token';
    }

    // ✅ V9.2 CRITICAL FIX: Only show "unavailable" message in Expo Go
    // In production App Store builds, appOwnership is null or 'standalone'
    const isExpoGo = Constants.appOwnership === 'expo';
    console.log('[Push Notifications] Is Expo Go:', isExpoGo);

    // First, ensure we have permissions
    const hasPermission = await requestNotificationPermissions();
    if (!hasPermission) {
      console.error('[Push Notifications] ❌ No notification permission - cannot register');
      return null;
    }

    // Get project ID from multiple sources
    const projectId = Constants.expoConfig?.extra?.eas?.projectId || 
                    Constants.manifest?.extra?.eas?.projectId || 
                    Constants.manifest2?.extra?.eas?.projectId ||
                    'e1ee166c-212b-4eca-a1d7-44183b7be073';
    
    console.log('[Push Notifications] Using EAS Project ID:', projectId);

    // ✅ V9.2 FIX: Try to get device push token first (native token)
    console.log('[Push Notifications] 🔄 Step 1: Getting device push token...');
    
    try {
      const deviceToken = await Notifications.getDevicePushTokenAsync();
      console.log('[Push Notifications] ✅ Device push token obtained:', deviceToken.type);
      console.log('[Push Notifications] Device token data:', deviceToken.data);
    } catch (deviceTokenError: any) {
      console.warn('[Push Notifications] ⚠️ Could not get device token:', deviceTokenError?.message);
    }

    // ✅ V9.2 FIX: Attempt to get Expo push token with better error handling
    console.log('[Push Notifications] 🔄 Step 2: Getting Expo push token...');
    
    try {
      const tokenData = await Notifications.getExpoPushTokenAsync({
        projectId: projectId,
      });

      console.log('[Push Notifications] ===== TOKEN OBTAINED =====');
      console.log('[Push Notifications] ✅ Token:', tokenData.data);
      console.log('[Push Notifications] ===================================');
      
      // Configure notification channel for Android
      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('daily-reports', {
          name: 'Daily Surf Reports',
          importance: Notifications.AndroidImportance.HIGH,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#0EA5E9',
          description: 'Receive your daily surf report at 6 AM EST',
        });
        console.log('[Push Notifications] Android notification channel configured');
      }

      return tokenData.data;
    } catch (tokenError: any) {
      console.error('[Push Notifications] ===== TOKEN ERROR =====');
      console.error('[Push Notifications] ❌ Failed to get Expo push token');
      console.error('[Push Notifications] Error:', tokenError);
      console.error('[Push Notifications] Error message:', tokenError?.message);
      console.error('[Push Notifications] Error code:', tokenError?.code);
      console.error('[Push Notifications] ===================================');
      
      // ✅ V9.2 CRITICAL FIX: Only show "unavailable" alert in Expo Go
      // In production builds, just log the error and return null
      if (isExpoGo) {
        console.log('[Push Notifications] Running in Expo Go - showing unavailable message');
        Alert.alert(
          'Push Notifications Unavailable',
          'Push notifications require the app to be built with EAS Build and submitted to the App Store.\n\n' +
          'This feature will be available once the app is published.\n\n' +
          'For now, you can still use all other features of the app.',
          [{ text: 'OK' }]
        );
      } else {
        console.log('[Push Notifications] Production build - silently handling error');
        // In production, just log the error - don't show alert
        // The user can still enable notifications, and it will work once the backend is configured
      }
      
      return null;
    }
  } catch (error) {
    console.error('[Push Notifications] ===== REGISTRATION ERROR =====');
    console.error('[Push Notifications] Error:', error);
    if (error instanceof Error) {
      console.error('[Push Notifications] Error message:', error.message);
      console.error('[Push Notifications] Error stack:', error.stack);
    }
    
    return null;
  }
}

/**
 * Save push token to user profile
 * ✅ V9.0 FIX: Enhanced with immediate feedback
 */
export async function savePushToken(userId: string, token: string): Promise<boolean> {
  try {
    console.log('[Push Notifications] ===== SAVING PUSH TOKEN =====');
    console.log('[Push Notifications] User ID:', userId);
    console.log('[Push Notifications] Token:', token);

    const { data, error } = await supabase
      .from('profiles')
      .update({ push_token: token })
      .eq('id', userId)
      .select();

    if (error) {
      console.error('[Push Notifications] ===== SAVE ERROR =====');
      console.error('[Push Notifications] Error:', error.message);
      console.error('[Push Notifications] ===================================');
      return false;
    }

    console.log('[Push Notifications] ===== TOKEN SAVED =====');
    console.log('[Push Notifications] ✅ Token saved successfully');
    console.log('[Push Notifications] Updated data:', data);
    console.log('[Push Notifications] ===================================');
    return true;
  } catch (error) {
    console.error('[Push Notifications] ===== SAVE EXCEPTION =====');
    console.error('[Push Notifications] ❌ Exception saving token:', error);
    console.error('[Push Notifications] ===================================');
    return false;
  }
}

/**
 * Get user's selected notification locations
 */
export async function getNotificationLocations(userId: string): Promise<string[]> {
  try {
    console.log('[Push Notifications] Fetching notification locations for user:', userId);
    
    const { data, error } = await supabase
      .from('profiles')
      .select('notification_locations')
      .eq('id', userId)
      .single();

    if (error) {
      console.error('[Push Notifications] Error fetching locations:', error);
      return ['folly-beach'];
    }

    console.log('[Push Notifications] Notification locations:', data?.notification_locations);
    return data?.notification_locations || ['folly-beach'];
  } catch (error) {
    console.error('[Push Notifications] Exception fetching locations:', error);
    return ['folly-beach'];
  }
}

/**
 * Update user's selected notification locations
 */
export async function setNotificationLocations(userId: string, locationIds: string[]): Promise<boolean> {
  try {
    console.log('[Push Notifications] ===== SET NOTIFICATION LOCATIONS =====');
    console.log('[Push Notifications] User ID:', userId);
    console.log('[Push Notifications] Location IDs:', locationIds);

    const { data, error } = await supabase
      .from('profiles')
      .update({ notification_locations: locationIds })
      .eq('id', userId)
      .select();

    if (error) {
      console.error('[Push Notifications] ===== UPDATE ERROR =====');
      console.error('[Push Notifications] Error:', JSON.stringify(error, null, 2));
      
      Alert.alert(
        'Update Failed',
        `Failed to update notification locations:\n\n${error.message}`,
        [{ text: 'OK' }]
      );
      return false;
    }

    if (!data || data.length === 0) {
      console.error('[Push Notifications] ❌ No data returned from update');
      return false;
    }

    console.log('[Push Notifications] ✅ Locations updated successfully');
    console.log('[Push Notifications] ===== SET NOTIFICATION LOCATIONS COMPLETE =====');
    return true;
  } catch (error) {
    console.error('[Push Notifications] ===== EXCEPTION =====');
    console.error('[Push Notifications] Exception:', error);
    
    Alert.alert(
      'Error',
      'An unexpected error occurred while updating notification locations.',
      [{ text: 'OK' }]
    );
    return false;
  }
}

/**
 * ✅ V9.1 CRITICAL FIX: Enable or disable daily report notifications
 * Enhanced to handle EAS project configuration issues gracefully
 */
export async function setDailyReportNotifications(userId: string, enabled: boolean): Promise<boolean> {
  try {
    console.log('[Push Notifications] ═══════════════════════════════════════');
    console.log('[Push Notifications] V9.1 CRITICAL FIX: TOGGLE NOTIFICATIONS');
    console.log('[Push Notifications] ═══════════════════════════════════════');
    console.log('[Push Notifications] User ID:', userId);
    console.log('[Push Notifications] Enabled:', enabled);
    console.log('[Push Notifications] Platform:', Platform.OS);
    console.log('[Push Notifications] Is Device:', Device.isDevice);

    // ✅ V9.1 FIX: If enabling, ALWAYS register token first
    let pushToken = null;
    if (enabled) {
      console.log('[Push Notifications] 📲 User is ENABLING notifications - registering token...');
      
      // ✅ V9.1 CRITICAL FIX: Add longer delay to ensure network is ready
      console.log('[Push Notifications] ⏳ Waiting 1 second for network stability...');
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      pushToken = await registerForPushNotificationsAsync();
      console.log('[Push Notifications] 📲 Token registration result:', pushToken ? 'SUCCESS ✓' : 'FAILED ✗');
      
      // ✅ V9.1 CRITICAL FIX: If on physical device and no token, check if it's EAS config issue
      if (Platform.OS !== 'web' && Device.isDevice && !pushToken) {
        console.error('[Push Notifications] ❌ CRITICAL: Physical device but no token obtained');
        console.error('[Push Notifications] ❌ This is likely an EAS project configuration issue');
        
        // Don't show another alert here - registerForPushNotificationsAsync already showed one
        return false;
      }
    }

    // ✅ V9.1 FIX: Build update data
    const updateData: any = {
      daily_report_notifications: enabled,
    };

    // ✅ V9.1 CRITICAL FIX: ALWAYS update push_token field
    if (enabled && pushToken) {
      updateData.push_token = pushToken;
      console.log('[Push Notifications] ✅ Will save push token:', pushToken.substring(0, 20) + '...');
    } else if (!enabled) {
      updateData.push_token = null;
      console.log('[Push Notifications] ℹ️ Will clear push token (notifications disabled)');
    }

    console.log('[Push Notifications] 💾 Updating profile with data:', JSON.stringify(updateData));

    // ✅ V9.1 CRITICAL FIX: Single database update with immediate verification
    const { data, error } = await supabase
      .from('profiles')
      .update(updateData)
      .eq('id', userId)
      .select();

    if (error) {
      console.error('[Push Notifications] ===== DATABASE UPDATE ERROR =====');
      console.error('[Push Notifications] ❌ Error:', error.message);
      console.error('[Push Notifications] Error details:', JSON.stringify(error, null, 2));
      console.error('[Push Notifications] ===================================');
      
      Alert.alert(
        'Update Failed',
        `Failed to update notification preferences:\n\n${error.message}\n\nPlease try again.`,
        [{ text: 'OK' }]
      );
      return false;
    }

    if (!data || data.length === 0) {
      console.error('[Push Notifications] ❌ No data returned from update');
      Alert.alert(
        'Update Failed',
        'No data returned from database. Please try again.',
        [{ text: 'OK' }]
      );
      return false;
    }

    // ✅ V9.1 CRITICAL FIX: Verify the data was actually saved
    console.log('[Push Notifications] ===== VERIFICATION =====');
    console.log('[Push Notifications] ✅ Database update successful');
    console.log('[Push Notifications] Updated data:', JSON.stringify(data[0], null, 2));
    console.log('[Push Notifications] daily_report_notifications:', data[0]?.daily_report_notifications);
    console.log('[Push Notifications] push_token:', data[0]?.push_token ? 'Present ✓' : 'Missing ✗');
    
    if (enabled && !data[0]?.push_token) {
      console.error('[Push Notifications] ⚠️ WARNING: Notifications enabled but no token in database!');
      console.error('[Push Notifications] ⚠️ User will NOT receive notifications!');
    } else if (enabled && data[0]?.push_token) {
      console.log('[Push Notifications] ✅ SUCCESS: Notifications enabled with valid token');
      console.log('[Push Notifications] ✅ User WILL receive notifications at 6AM EST');
    }
    console.log('[Push Notifications] ===================================');

    return true;
  } catch (error) {
    console.error('[Push Notifications] ===== EXCEPTION =====');
    console.error('[Push Notifications] Exception:', error);
    if (error instanceof Error) {
      console.error('[Push Notifications] Exception message:', error.message);
      console.error('[Push Notifications] Exception stack:', error.stack);
    }
    console.error('[Push Notifications] ===================================');
    
    Alert.alert(
      'Error',
      'An unexpected error occurred while updating notifications. Please try again.',
      [{ text: 'OK' }]
    );
    return false;
  }
}

/**
 * Check if user has daily report notifications enabled
 */
export async function getDailyReportNotificationStatus(userId: string): Promise<boolean> {
  try {
    console.log('[Push Notifications] Fetching notification status for user:', userId);
    
    const { data, error } = await supabase
      .from('profiles')
      .select('daily_report_notifications')
      .eq('id', userId)
      .single();

    if (error) {
      console.error('[Push Notifications] Error fetching status:', error);
      return false;
    }

    const status = data?.daily_report_notifications || false;
    console.log('[Push Notifications] Notification status:', status);
    return status;
  } catch (error) {
    console.error('[Push Notifications] Exception fetching status:', error);
    return false;
  }
}

/**
 * Open device notification settings
 */
export async function openNotificationSettings(): Promise<void> {
  try {
    console.log('[Push Notifications] Opening notification settings...');
    await Linking.openSettings();
  } catch (error) {
    console.error('[Push Notifications] Error opening settings:', error);
    Alert.alert(
      'Cannot Open Settings',
      'Please manually open your device settings and enable notifications for SurfVista.',
      [{ text: 'OK' }]
    );
  }
}

/**
 * ✅ V9.1 VERIFIED: Force re-register push token for existing users
 * This function is called AUTOMATICALLY when:
 * - User opens the profile screen
 * - User refreshes profile data
 * - App initializes and user has notifications enabled
 */
export async function ensurePushTokenRegistered(userId: string): Promise<void> {
  try {
    console.log('[Push Notifications] ===== AUTOMATIC TOKEN CHECK =====');
    console.log('[Push Notifications] User ID:', userId);
    console.log('[Push Notifications] Platform:', Platform.OS);
    console.log('[Push Notifications] Is Device:', Device.isDevice);

    // Skip for web and simulators
    if (Platform.OS === 'web' || !Device.isDevice) {
      console.log('[Push Notifications] Skipping token check (web/simulator)');
      return;
    }

    // Fetch profile
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('daily_report_notifications, push_token')
      .eq('id', userId)
      .single();

    if (error || !profile) {
      console.error('[Push Notifications] ❌ Failed to fetch profile:', error);
      return;
    }

    console.log('[Push Notifications] ===== PROFILE STATUS =====');
    console.log('[Push Notifications] - Notifications enabled:', profile.daily_report_notifications);
    console.log('[Push Notifications] - Has token:', !!profile.push_token);
    console.log('[Push Notifications] ===================================');

    // ✅ V9.1 FIX: If notifications are enabled but no valid token, register one
    if (profile.daily_report_notifications && !profile.push_token) {
      console.log('[Push Notifications] 🔧 User has notifications enabled but no token - registering now...');
      
      // Check permissions first
      const { granted } = await checkNotificationPermissions();
      if (!granted) {
        console.log('[Push Notifications] ⚠️ Permissions not granted - cannot register token');
        return;
      }

      // Register token
      const token = await registerForPushNotificationsAsync();
      
      if (token && token !== 'web-dummy-token' && token !== 'simulator-dummy-token') {
        console.log('[Push Notifications] 📲 Got valid token, saving to database...');
        const saved = await savePushToken(userId, token);
        
        if (saved) {
          console.log('[Push Notifications] ✅ Token registered and saved successfully');
        } else {
          console.error('[Push Notifications] ❌ Failed to save token to database');
        }
      }
    }
  } catch (error) {
    console.error('[Push Notifications] ===== EXCEPTION =====');
    console.error('[Push Notifications] Exception:', error);
    console.error('[Push Notifications] ===================================');
  }
}

/**
 * ✅ V9.1 NEW: Send a test notification to verify setup
 * This is for admin testing only
 */
export async function sendTestNotification(token: string, title: string, body: string): Promise<void> {
  try {
    console.log('[Push Notifications] Sending test notification...');
    console.log('[Push Notifications] Token:', token);
    console.log('[Push Notifications] Title:', title);
    console.log('[Push Notifications] Body:', body);

    await Notifications.scheduleNotificationAsync({
      content: {
        title: title,
        body: body,
        sound: true,
        priority: Notifications.AndroidNotificationPriority.HIGH,
      },
      trigger: null, // Send immediately
    });

    console.log('[Push Notifications] ✅ Test notification sent');
  } catch (error) {
    console.error('[Push Notifications] Error sending test notification:', error);
    throw error;
  }
}
