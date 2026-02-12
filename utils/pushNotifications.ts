
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
          'To receive daily surf reports, you need to enable notifications in your device settings.\n\nWould you like to open settings now?',
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
                  resolve(false); // Still return false since we can't verify if they enabled it
                } catch (error) {
                  console.error('[Push Notifications] Error opening settings:', error);
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
        'You have denied notification permissions. To receive daily surf reports, please enable notifications in your device settings.',
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
 * Register for push notifications and get the Expo push token
 */
export async function registerForPushNotificationsAsync(): Promise<string | null> {
  try {
    console.log('[Push Notifications] ===== REGISTERING FOR PUSH NOTIFICATIONS =====');
    console.log('[Push Notifications] Platform:', Platform.OS);
    console.log('[Push Notifications] Is Device:', Device.isDevice);

    // For web, return a dummy token so the toggle still works
    if (Platform.OS === 'web') {
      console.log('[Push Notifications] Web platform - using dummy token');
      return 'web-dummy-token';
    }

    // Check if running on a physical device
    if (!Device.isDevice) {
      console.warn('[Push Notifications] Simulator detected - using dummy token');
      return 'simulator-dummy-token';
    }

    // First, ensure we have permissions
    const hasPermission = await requestNotificationPermissions();
    if (!hasPermission) {
      console.error('[Push Notifications] ❌ No notification permission - cannot register');
      return null;
    }

    // Get the project ID from app config
    const projectId = Constants.expoConfig?.extra?.eas?.projectId;
    console.log('[Push Notifications] EAS Project ID:', projectId);

    if (!projectId) {
      console.error('[Push Notifications] No EAS project ID found in config');
      Alert.alert(
        'Configuration Error',
        'Push notifications are not properly configured. Please contact support.',
        [{ text: 'OK' }]
      );
      return null;
    }

    // Get the Expo push token
    console.log('[Push Notifications] Getting Expo push token...');
    const tokenData = await Notifications.getExpoPushTokenAsync({
      projectId: projectId,
    });

    console.log('[Push Notifications] ✅ Token obtained:', tokenData.data);

    // Configure notification channel for Android
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('daily-reports', {
        name: 'Daily Surf Reports',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#0EA5E9',
        description: 'Receive your daily surf report at 5 AM',
      });
      console.log('[Push Notifications] Android notification channel configured');
    }

    console.log('[Push Notifications] ===== REGISTRATION COMPLETE =====');
    return tokenData.data;
  } catch (error) {
    console.error('[Push Notifications] ===== REGISTRATION ERROR =====');
    console.error('[Push Notifications] Error:', error);
    if (error instanceof Error) {
      console.error('[Push Notifications] Error message:', error.message);
      console.error('[Push Notifications] Error stack:', error.stack);
    }
    
    Alert.alert(
      'Registration Failed',
      'Failed to register for push notifications. Please try again or contact support if the problem persists.',
      [{ text: 'OK' }]
    );
    return null;
  }
}

/**
 * Save push token to user profile
 */
export async function savePushToken(userId: string, token: string): Promise<boolean> {
  try {
    console.log('[Push Notifications] Saving push token for user:', userId);
    console.log('[Push Notifications] Token:', token);

    const { data, error } = await supabase
      .from('profiles')
      .update({ push_token: token })
      .eq('id', userId)
      .select();

    if (error) {
      console.error('[Push Notifications] Error saving token:', error);
      console.error('[Push Notifications] Error details:', JSON.stringify(error));
      return false;
    }

    console.log('[Push Notifications] ✅ Token saved successfully');
    return true;
  } catch (error) {
    console.error('[Push Notifications] Exception saving token:', error);
    if (error instanceof Error) {
      console.error('[Push Notifications] Exception details:', error.message);
    }
    return false;
  }
}

/**
 * Enable or disable daily report notifications
 */
export async function setDailyReportNotifications(userId: string, enabled: boolean): Promise<boolean> {
  try {
    console.log('[Push Notifications] ===== SET DAILY REPORT NOTIFICATIONS =====');
    console.log('[Push Notifications] User ID:', userId);
    console.log('[Push Notifications] Enabled:', enabled);
    console.log('[Push Notifications] Platform:', Platform.OS);

    // If enabling, register for push notifications first
    let pushToken = null;
    if (enabled) {
      console.log('[Push Notifications] Registering for push notifications...');
      pushToken = await registerForPushNotificationsAsync();
      console.log('[Push Notifications] Push token result:', pushToken);
      
      // If we didn't get a token and we're not on web/simulator, fail
      if (!pushToken && Platform.OS !== 'web' && Device.isDevice) {
        console.error('[Push Notifications] Failed to get push token on physical device');
        return false;
      }
    }

    // Update profile with notification preference and token
    const updateData: any = {
      daily_report_notifications: enabled,
    };

    // Only update push_token if we have one
    if (pushToken) {
      updateData.push_token = pushToken;
    } else if (!enabled) {
      // Clear push token when disabling notifications
      updateData.push_token = null;
    }

    console.log('[Push Notifications] Updating profile with data:', updateData);

    const { data, error } = await supabase
      .from('profiles')
      .update(updateData)
      .eq('id', userId)
      .select();

    if (error) {
      console.error('[Push Notifications] ===== UPDATE ERROR =====');
      console.error('[Push Notifications] Error code:', error.code);
      console.error('[Push Notifications] Error message:', error.message);
      console.error('[Push Notifications] Error details:', JSON.stringify(error));
      console.error('[Push Notifications] ===== END ERROR =====');
      return false;
    }

    console.log('[Push Notifications] ✅ Preferences updated successfully');
    console.log('[Push Notifications] Updated data:', data);
    console.log('[Push Notifications] ===== SET DAILY REPORT NOTIFICATIONS COMPLETE =====');
    return true;
  } catch (error) {
    console.error('[Push Notifications] ===== EXCEPTION IN SET DAILY REPORT NOTIFICATIONS =====');
    console.error('[Push Notifications] Exception:', error);
    if (error instanceof Error) {
      console.error('[Push Notifications] Exception message:', error.message);
      console.error('[Push Notifications] Exception stack:', error.stack);
    }
    console.error('[Push Notifications] ===== END EXCEPTION =====');
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
      console.error('[Push Notifications] Error details:', JSON.stringify(error));
      return false;
    }

    console.log('[Push Notifications] Status data:', data);
    const status = data?.daily_report_notifications || false;
    console.log('[Push Notifications] Notification status:', status);
    return status;
  } catch (error) {
    console.error('[Push Notifications] Exception fetching status:', error);
    if (error instanceof Error) {
      console.error('[Push Notifications] Exception details:', error.message);
    }
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
