
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { supabase } from '@/app/integrations/supabase/client';

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

    // Check if running on a physical device
    if (!Device.isDevice) {
      console.warn('[Push Notifications] Must use physical device for push notifications');
      return null;
    }

    // Check existing permissions
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    // Request permissions if not granted
    if (existingStatus !== 'granted') {
      console.log('[Push Notifications] Requesting permissions...');
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.warn('[Push Notifications] Permission not granted');
      return null;
    }

    // Get the Expo push token
    const tokenData = await Notifications.getExpoPushTokenAsync({
      projectId: 'your-project-id', // This will be auto-configured by Expo
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
    }

    return tokenData.data;
  } catch (error) {
    console.error('[Push Notifications] Error registering:', error);
    return null;
  }
}

/**
 * Save push token to user profile
 */
export async function savePushToken(userId: string, token: string): Promise<boolean> {
  try {
    console.log('[Push Notifications] Saving push token for user:', userId);

    const { error } = await supabase
      .from('profiles')
      .update({ push_token: token })
      .eq('id', userId);

    if (error) {
      console.error('[Push Notifications] Error saving token:', error);
      return false;
    }

    console.log('[Push Notifications] Token saved successfully');
    return true;
  } catch (error) {
    console.error('[Push Notifications] Exception saving token:', error);
    return false;
  }
}

/**
 * Enable or disable daily report notifications
 */
export async function setDailyReportNotifications(userId: string, enabled: boolean): Promise<boolean> {
  try {
    console.log('[Push Notifications] Setting daily report notifications:', enabled);

    // If enabling, register for push notifications first
    let pushToken = null;
    if (enabled) {
      pushToken = await registerForPushNotificationsAsync();
      if (!pushToken) {
        console.error('[Push Notifications] Failed to get push token');
        return false;
      }
    }

    // Update profile with notification preference and token
    const updateData: any = {
      daily_report_notifications: enabled,
    };

    if (pushToken) {
      updateData.push_token = pushToken;
    }

    const { error } = await supabase
      .from('profiles')
      .update(updateData)
      .eq('id', userId);

    if (error) {
      console.error('[Push Notifications] Error updating preferences:', error);
      return false;
    }

    console.log('[Push Notifications] Preferences updated successfully');
    return true;
  } catch (error) {
    console.error('[Push Notifications] Exception updating preferences:', error);
    return false;
  }
}

/**
 * Check if user has daily report notifications enabled
 */
export async function getDailyReportNotificationStatus(userId: string): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('daily_report_notifications')
      .eq('id', userId)
      .single();

    if (error) {
      console.error('[Push Notifications] Error fetching status:', error);
      return false;
    }

    return data?.daily_report_notifications || false;
  } catch (error) {
    console.error('[Push Notifications] Exception fetching status:', error);
    return false;
  }
}
