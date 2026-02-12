
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
 * ✅ V8.0 FIX: Enhanced with better error handling and no user-facing alerts for expected failures
 */
export async function registerForPushNotificationsAsync(): Promise<string | null> {
  try {
    console.log('[Push Notifications] ===== REGISTERING FOR PUSH NOTIFICATIONS =====');
    console.log('[Push Notifications] Platform:', Platform.OS);
    console.log('[Push Notifications] Is Device:', Device.isDevice);
    console.log('[Push Notifications] Constants.expoConfig:', JSON.stringify(Constants.expoConfig?.extra, null, 2));
    console.log('[Push Notifications] Constants.manifest:', JSON.stringify(Constants.manifest?.extra, null, 2));

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

    // ✅ V8.0 FIX: Try to get project ID from multiple sources, with better logging
    let projectId = null;
    
    // Try expoConfig first (most reliable in EAS builds)
    if (Constants.expoConfig?.extra?.eas?.projectId) {
      projectId = Constants.expoConfig.extra.eas.projectId;
      console.log('[Push Notifications] ✅ Found projectId in expoConfig.extra.eas');
    }
    // Try manifest (legacy)
    else if (Constants.manifest?.extra?.eas?.projectId) {
      projectId = Constants.manifest.extra.eas.projectId;
      console.log('[Push Notifications] ✅ Found projectId in manifest.extra.eas');
    }
    // Try manifest2 (newer format)
    else if (Constants.manifest2?.extra?.eas?.projectId) {
      projectId = Constants.manifest2.extra.eas.projectId;
      console.log('[Push Notifications] ✅ Found projectId in manifest2.extra.eas');
    }
    // Hardcoded fallback for production builds
    else {
      projectId = 'e1ee166c-212b-4eca-a1d7-44183b7be073';
      console.log('[Push Notifications] ⚠️ Using hardcoded fallback projectId');
    }
    
    console.log('[Push Notifications] ===== EAS PROJECT ID =====');
    console.log('[Push Notifications] Using EAS Project ID:', projectId);
    console.log('[Push Notifications] ===================================');

    // ✅ V8.0 FIX: Retry logic with longer delays and better error handling
    let tokenData = null;
    let lastError = null;
    const maxRetries = 5; // Increased from 3 to 5
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`[Push Notifications] 🔄 Token registration attempt ${attempt}/${maxRetries}...`);
        
        // ✅ V8.0 FIX: Add a small delay before first attempt to let network stabilize
        if (attempt === 1) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
        
        tokenData = await Notifications.getExpoPushTokenAsync({
          projectId: projectId,
        });

        console.log('[Push Notifications] ===== TOKEN OBTAINED =====');
        console.log('[Push Notifications] ✅ Token:', tokenData.data);
        console.log('[Push Notifications] Token length:', tokenData.data.length);
        console.log('[Push Notifications] Token type:', typeof tokenData.data);
        console.log('[Push Notifications] ===================================');
        
        // Success! Break out of retry loop
        break;
      } catch (tokenError: any) {
        lastError = tokenError;
        console.error(`[Push Notifications] ❌ Attempt ${attempt} failed:`, tokenError?.message);
        console.error(`[Push Notifications] Error code:`, tokenError?.code);
        console.error(`[Push Notifications] Error details:`, JSON.stringify(tokenError, null, 2));
        
        // If this is the last attempt, we'll handle the error below
        if (attempt < maxRetries) {
          // Wait before retrying (exponential backoff with longer delays)
          const waitTime = attempt * 2000; // 2s, 4s, 6s, 8s
          console.log(`[Push Notifications] ⏳ Waiting ${waitTime}ms before retry...`);
          await new Promise(resolve => setTimeout(resolve, waitTime));
        }
      }
    }

    // If we still don't have a token after retries, handle the error
    if (!tokenData) {
      console.error('[Push Notifications] ===== TOKEN ERROR (ALL RETRIES FAILED) =====');
      console.error('[Push Notifications] ❌ Failed to get Expo push token after', maxRetries, 'attempts');
      console.error('[Push Notifications] Last error:', lastError);
      console.error('[Push Notifications] Error message:', lastError?.message);
      console.error('[Push Notifications] Error code:', lastError?.code);
      console.error('[Push Notifications] ===================================');
      
      // ✅ V8.0 FIX: Better error handling - don't show alert, just return null
      // The calling function will handle showing appropriate UI feedback
      return null;
    }

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
    
    // Don't show alert - just log and return null
    return null;
  }
}

/**
 * Save push token to user profile
 * ✅ V7.0 FIX: Enhanced with retry logic and better error handling
 */
export async function savePushToken(userId: string, token: string): Promise<boolean> {
  try {
    console.log('[Push Notifications] ===== SAVING PUSH TOKEN =====');
    console.log('[Push Notifications] User ID:', userId);
    console.log('[Push Notifications] Token:', token);
    console.log('[Push Notifications] Token length:', token.length);

    // ✅ V7.0 FIX: Retry logic for saving token
    let lastError = null;
    const maxRetries = 3;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`[Push Notifications] 💾 Save attempt ${attempt}/${maxRetries}...`);
        
        const { data, error } = await supabase
          .from('profiles')
          .update({ push_token: token })
          .eq('id', userId)
          .select();

        if (error) {
          lastError = error;
          console.error(`[Push Notifications] ❌ Attempt ${attempt} failed:`, error.message);
          
          // If this is the last attempt, we'll handle the error below
          if (attempt < maxRetries) {
            // Wait before retrying
            const waitTime = attempt * 500;
            console.log(`[Push Notifications] ⏳ Waiting ${waitTime}ms before retry...`);
            await new Promise(resolve => setTimeout(resolve, waitTime));
            continue;
          }
        } else {
          // Success!
          console.log('[Push Notifications] ===== TOKEN SAVED =====');
          console.log('[Push Notifications] ✅ Token saved successfully on attempt', attempt);
          console.log('[Push Notifications] Updated data:', data);
          console.log('[Push Notifications] ===================================');
          return true;
        }
      } catch (attemptError) {
        lastError = attemptError;
        console.error(`[Push Notifications] ❌ Exception on attempt ${attempt}:`, attemptError);
        
        if (attempt < maxRetries) {
          const waitTime = attempt * 500;
          await new Promise(resolve => setTimeout(resolve, waitTime));
        }
      }
    }

    // If we get here, all retries failed
    console.error('[Push Notifications] ===== SAVE TOKEN ERROR (ALL RETRIES FAILED) =====');
    console.error('[Push Notifications] ❌ Error saving token after', maxRetries, 'attempts');
    console.error('[Push Notifications] Last error:', lastError);
    console.error('[Push Notifications] ===================================');
    return false;
  } catch (error) {
    console.error('[Push Notifications] ===== SAVE TOKEN EXCEPTION =====');
    console.error('[Push Notifications] ❌ Exception saving token:', error);
    if (error instanceof Error) {
      console.error('[Push Notifications] Exception message:', error.message);
      console.error('[Push Notifications] Exception stack:', error.stack);
    }
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
 * Enable or disable daily report notifications
 * ✅ V8.0 FIX: Enhanced with better token handling and user-friendly error messages
 */
export async function setDailyReportNotifications(userId: string, enabled: boolean): Promise<boolean> {
  try {
    console.log('[Push Notifications] ===== SET DAILY REPORT NOTIFICATIONS =====');
    console.log('[Push Notifications] User ID:', userId);
    console.log('[Push Notifications] Enabled:', enabled);
    console.log('[Push Notifications] Platform:', Platform.OS);
    console.log('[Push Notifications] Is Device:', Device.isDevice);

    // ✅ V8.0 CRITICAL FIX: If enabling, ALWAYS try to register token first
    let pushToken = null;
    if (enabled) {
      console.log('[Push Notifications] 📲 Registering for push notifications...');
      pushToken = await registerForPushNotificationsAsync();
      console.log('[Push Notifications] 📲 Push token result:', pushToken);
      
      // ✅ V8.0 CRITICAL FIX: Better handling when token registration fails
      if (Platform.OS !== 'web' && Device.isDevice && !pushToken) {
        console.error('[Push Notifications] ❌ CRITICAL: Physical device but no token obtained');
        
        // ✅ V8.0 FIX: More helpful error message with specific troubleshooting steps
        Alert.alert(
          'Token Registration Failed',
          'Unable to register for push notifications. This may be due to:\n\n' +
          '• Network connectivity issues\n' +
          '• Expo push notification service temporarily unavailable\n\n' +
          'Please try again in a moment. If the problem persists, try:\n' +
          '1. Restart the app\n' +
          '2. Check your internet connection\n' +
          '3. Contact support if issue continues',
          [{ text: 'OK' }]
        );
        return false;
      }
      
      // If we got a dummy token (web/simulator), warn but allow
      if (pushToken === 'web-dummy-token' || pushToken === 'simulator-dummy-token') {
        console.log('[Push Notifications] ⚠️ Using dummy token (development environment)');
      }
    }

    // ✅ V8.0 FIX: Build update data object
    const updateData: any = {
      daily_report_notifications: enabled,
    };

    // ✅ V8.0 CRITICAL FIX: ALWAYS update push_token field
    if (enabled && pushToken) {
      // Save the token when enabling
      updateData.push_token = pushToken;
      console.log('[Push Notifications] ✅ Will save push token:', pushToken.substring(0, 20) + '...');
    } else if (!enabled) {
      // Clear the token when disabling
      updateData.push_token = null;
      console.log('[Push Notifications] ℹ️ Will clear push token (notifications disabled)');
    } else {
      // Enabling but no token - this should only happen in dev
      console.log('[Push Notifications] ⚠️ Enabling without token (development only)');
    }

    console.log('[Push Notifications] 💾 Updating profile with data:', JSON.stringify(updateData));

    // ✅ V8.0 FIX: Retry logic for database update with better error handling
    let lastDbError = null;
    const maxRetries = 3;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`[Push Notifications] 💾 Database update attempt ${attempt}/${maxRetries}...`);
        
        const { data, error } = await supabase
          .from('profiles')
          .update(updateData)
          .eq('id', userId)
          .select();

        if (error) {
          lastDbError = error;
          console.error(`[Push Notifications] ❌ Attempt ${attempt} failed:`, error.message);
          console.error(`[Push Notifications] Error details:`, JSON.stringify(error, null, 2));
          
          // If this is the last attempt, we'll handle the error below
          if (attempt < maxRetries) {
            const waitTime = attempt * 500;
            console.log(`[Push Notifications] ⏳ Waiting ${waitTime}ms before retry...`);
            await new Promise(resolve => setTimeout(resolve, waitTime));
            continue;
          }
        } else if (!data || data.length === 0) {
          lastDbError = new Error('No data returned from update');
          console.error(`[Push Notifications] ❌ Attempt ${attempt}: No data returned`);
          
          if (attempt < maxRetries) {
            const waitTime = attempt * 500;
            await new Promise(resolve => setTimeout(resolve, waitTime));
            continue;
          }
        } else {
          // Success!
          console.log('[Push Notifications] ===== UPDATE SUCCESS =====');
          console.log('[Push Notifications] ✅ Preferences updated successfully on attempt', attempt);
          console.log('[Push Notifications] Updated data:', JSON.stringify(data, null, 2));
          console.log('[Push Notifications] Push token in DB:', data[0]?.push_token ? 'Present ✓' : 'Missing ✗');
          console.log('[Push Notifications] ===== SET DAILY REPORT NOTIFICATIONS COMPLETE =====');
          return true;
        }
      } catch (attemptError) {
        lastDbError = attemptError;
        console.error(`[Push Notifications] ❌ Exception on attempt ${attempt}:`, attemptError);
        
        if (attempt < maxRetries) {
          const waitTime = attempt * 500;
          await new Promise(resolve => setTimeout(resolve, waitTime));
        }
      }
    }

    // If we get here, all retries failed
    console.error('[Push Notifications] ===== UPDATE FAILED (ALL RETRIES) =====');
    console.error('[Push Notifications] Last error:', lastDbError);
    
    Alert.alert(
      'Update Failed',
      'Failed to update notification preferences after multiple attempts. Please try:\n\n' +
      '1. Check your internet connection\n' +
      '2. Refresh your profile data\n' +
      '3. Sign out and sign back in\n' +
      '4. Contact support if issue persists',
      [{ text: 'OK' }]
    );
    return false;
  } catch (error) {
    console.error('[Push Notifications] ===== EXCEPTION IN SET DAILY REPORT NOTIFICATIONS =====');
    console.error('[Push Notifications] Exception:', error);
    if (error instanceof Error) {
      console.error('[Push Notifications] Exception message:', error.message);
      console.error('[Push Notifications] Exception stack:', error.stack);
    }
    console.error('[Push Notifications] ===== END EXCEPTION =====');
    
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

/**
 * ✅ V8.0 ENHANCED: Force re-register push token for existing users
 * This function should be called when a user who has notifications enabled but no token
 * opens the app or refreshes their profile
 */
export async function ensurePushTokenRegistered(userId: string): Promise<void> {
  try {
    console.log('[Push Notifications] ===== ENSURE PUSH TOKEN REGISTERED =====');
    console.log('[Push Notifications] User ID:', userId);
    console.log('[Push Notifications] Platform:', Platform.OS);
    console.log('[Push Notifications] Is Device:', Device.isDevice);

    // Skip for web and simulators
    if (Platform.OS === 'web' || !Device.isDevice) {
      console.log('[Push Notifications] Skipping token check (web/simulator)');
      return;
    }

    // ✅ V8.0 FIX: Add retry logic for profile fetch
    let profile = null;
    let profileError = null;
    const maxFetchRetries = 3;
    
    for (let attempt = 1; attempt <= maxFetchRetries; attempt++) {
      try {
        console.log(`[Push Notifications] 📋 Fetching profile attempt ${attempt}/${maxFetchRetries}...`);
        
        const { data, error } = await supabase
          .from('profiles')
          .select('daily_report_notifications, push_token')
          .eq('id', userId)
          .single();

        if (error) {
          profileError = error;
          console.error(`[Push Notifications] ❌ Fetch attempt ${attempt} failed:`, error.message);
          
          if (attempt < maxFetchRetries) {
            await new Promise(resolve => setTimeout(resolve, attempt * 500));
            continue;
          }
        } else {
          profile = data;
          break;
        }
      } catch (fetchError) {
        profileError = fetchError;
        console.error(`[Push Notifications] ❌ Fetch exception on attempt ${attempt}:`, fetchError);
        
        if (attempt < maxFetchRetries) {
          await new Promise(resolve => setTimeout(resolve, attempt * 500));
        }
      }
    }

    if (profileError || !profile) {
      console.error('[Push Notifications] ❌ Failed to fetch profile after all retries:', profileError);
      return;
    }

    console.log('[Push Notifications] Profile check:');
    console.log('[Push Notifications] - Notifications enabled:', profile.daily_report_notifications);
    console.log('[Push Notifications] - Has token:', !!profile.push_token);
    console.log('[Push Notifications] - Token value:', profile.push_token?.substring(0, 20) + '...' || 'null');

    // If notifications are enabled but no valid token, register one
    if (profile.daily_report_notifications && 
        (!profile.push_token || 
         profile.push_token === 'web-dummy-token' || 
         profile.push_token === 'simulator-dummy-token')) {
      
      console.log('[Push Notifications] 🔧 User has notifications enabled but no valid token - registering now...');
      
      // Check permissions first
      const { granted } = await checkNotificationPermissions();
      if (!granted) {
        console.log('[Push Notifications] ⚠️ Permissions not granted - cannot register token');
        console.log('[Push Notifications] ℹ️ User needs to enable permissions in device settings');
        return;
      }

      // ✅ V8.0 FIX: Add delay before token registration to let network stabilize
      console.log('[Push Notifications] ⏳ Waiting 1 second for network to stabilize...');
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Register token
      console.log('[Push Notifications] 📲 Attempting to register push token...');
      const token = await registerForPushNotificationsAsync();
      console.log('[Push Notifications] 📲 Token registration result:', token ? 'Success' : 'Failed');
      
      if (token && token !== 'web-dummy-token' && token !== 'simulator-dummy-token') {
        console.log('[Push Notifications] 📲 Got valid token, saving to database...');
        const saved = await savePushToken(userId, token);
        
        if (saved) {
          console.log('[Push Notifications] ✅ Token registered and saved successfully');
          console.log('[Push Notifications] ✅ Push notifications are now active for this user');
        } else {
          console.error('[Push Notifications] ❌ Failed to save token to database');
        }
      } else {
        console.log('[Push Notifications] ⚠️ No valid token obtained - notifications may not work');
        console.log('[Push Notifications] ℹ️ This is expected in development/Expo Go');
        console.log('[Push Notifications] ℹ️ Notifications will work in TestFlight/App Store builds');
      }
    } else if (profile.push_token && 
               profile.push_token !== 'web-dummy-token' && 
               profile.push_token !== 'simulator-dummy-token') {
      console.log('[Push Notifications] ✅ User already has valid push token');
      console.log('[Push Notifications] Token preview:', profile.push_token.substring(0, 30) + '...');
    } else {
      console.log('[Push Notifications] ℹ️ Notifications disabled or no token needed');
    }

    console.log('[Push Notifications] ===== ENSURE PUSH TOKEN COMPLETE =====');
  } catch (error) {
    console.error('[Push Notifications] ===== EXCEPTION IN ENSURE PUSH TOKEN =====');
    console.error('[Push Notifications] Exception:', error);
    if (error instanceof Error) {
      console.error('[Push Notifications] Exception message:', error.message);
      console.error('[Push Notifications] Exception stack:', error.stack);
    }
    console.error('[Push Notifications] ===== END EXCEPTION =====');
  }
}
