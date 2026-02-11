
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
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
 * Register for push notifications and get the Expo push token
 */
export async function registerForPushNotificationsAsync(): Promise<string | null> {
  try {
    console.log('[Push Notifications] Registering for push notifications...');
    console.log('[Push Notifications] Platform:', Platform.OS);
    console.log('[Push Notifications] Is Device:', Device.isDevice);

    // Check if running on a physical device
    if (!Device.isDevice) {
      console.warn('[Push Notifications] Must use physical device for push notifications');
      // For web/simulator, return a dummy token so the toggle still works
      if (Platform.OS === 'web') {
        console.log('[Push Notifications] Web platform - using dummy token');
        return 'web-dummy-token';
      }
      return null;
    }

    // Check existing permissions
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    console.log('[Push Notifications] Existing permission status:', existingStatus);

    // Request permissions if not granted
    if (existingStatus !== 'granted') {
      console.log('[Push Notifications] Requesting permissions...');
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
      console.log('[Push Notifications] Permission request result:', status);
    }

    if (finalStatus !== 'granted') {
      console.warn('[Push Notifications] Permission not granted:', finalStatus);
      return null;
    }

    // Get the project ID from app config
    const projectId = Constants.expoConfig?.extra?.eas?.projectId;
    console.log('[Push Notifications] EAS Project ID:', projectId);

    // Get the Expo push token
    const tokenData = await Notifications.getExpoPushTokenAsync({
      projectId: projectId || undefined,
    });

    console.log('[Push Notifications] Token obtained:', tokenData.data);

    // Configure notification channel for Android
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('daily-reports', {
        name: 'Daily Surf Reports',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#0EA5E9',
      });
      console.log('[Push Notifications] Android notification channel configured');
    }

    return tokenData.data;
  } catch (error) {
    console.error('[Push Notifications] Error registering:', error);
    if (error instanceof Error) {
      console.error('[Push Notifications] Error details:', error.message);
      console.error('[Push Notifications] Error stack:', error.stack);
    }
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

    console.log('[Push Notifications] Token saved successfully:', data);
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
      
      if (!pushToken) {
        console.error('[Push Notifications] Failed to get push token');
        // Still allow the toggle to work even without a token (for web/simulator)
        if (Platform.OS !== 'web') {
          return false;
        }
        console.log('[Push Notifications] Web platform - continuing without token');
      }
    }

    // Update profile with notification preference and token
    const updateData: any = {
      daily_report_notifications: enabled,
    };

    if (pushToken) {
      updateData.push_token = pushToken;
    }

    console.log('[Push Notifications] Updating profile with data:', updateData);

    const { data, error } = await supabase
      .from('profiles')
      .update(updateData)
      .eq('id', userId)
      .select();

    if (error) {
      console.error('[Push Notifications] Error updating preferences:', error);
      console.error('[Push Notifications] Error code:', error.code);
      console.error('[Push Notifications] Error message:', error.message);
      console.error('[Push Notifications] Error details:', JSON.stringify(error));
      return false;
    }

    console.log('[Push Notifications] Preferences updated successfully');
    console.log('[Push Notifications] Updated data:', data);
    console.log('[Push Notifications] ===== SET DAILY REPORT NOTIFICATIONS COMPLETE =====');
    return true;
  } catch (error) {
    console.error('[Push Notifications] ===== EXCEPTION IN SET DAILY REPORT NOTIFICATIONS =====');
    console.error('[Push Notifications] Exception updating preferences:', error);
    if (error instanceof Error) {
      console.error('[Push Notifications] Exception message:', error.message);
      console.error('[Push Notifications] Exception stack:', error.stack);
    }
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
